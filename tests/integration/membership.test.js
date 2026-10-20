const { io: connect } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { createApplication } = require('../../src/app');
const { createJwtAuth, ISSUER, AUDIENCE } = require('../../src/jwt-auth');
const { RoomStore, roomChannel } = require('../../src/rooms');
const { LoginLimiter } = require('../../src/login-limit');

const SECRET = 'test-only-signing-key-with-at-least-32-bytes';
function once(socket, event) {
  return new Promise((resolve, reject) => {
    const handler = value => { clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error('Timed out: '+event)); }, 3000);
    socket.once(event, handler);
  });
}
const ack = (s,e,p) => new Promise((resolve,reject) => s.timeout(3000).emit(e,p,(err,result) => err ? reject(err) : resolve(result)));
const barrier = s => ack(s, 'system:ping', { nonce: 'transport-barrier' });
let app, clients, sessions, rooms, url;
beforeEach(async () => {
  clients=[]; sessions=new Map(); rooms=new RoomStore();
  const auth=createJwtAuth({ secret: SECRET, findSession: async id => sessions.get(id) });
  app=createApplication({ auth, rooms });
  const address=await app.start(0); url=`http://127.0.0.1:${address.port}`;
});
afterEach(async () => { clients.forEach(s=>s.disconnect()); await app.stop(); });
async function client(userId, suffix='one') {
  const now=Math.floor(Date.now()/1000), sessionId=userId+'-'+suffix;
  sessions.set(sessionId,{ userId, sessionId, expiresAt: now+600, revokedAt: null });
  const token=jwt.sign({ sub:userId,jti:sessionId,iss:ISSUER,aud:AUDIENCE,iat:now,exp:now+600 },SECRET,{ algorithm:'HS256' });
  const s=connect(url,{ autoConnect:false,reconnection:false,auth:{token} });clients.push(s);
  const connected=once(s,'connect');s.connect();await connected;return s;
}

test('TC-Room-02/03/04: real transport join, room-only delivery, leave and live catalogue',async()=>{
  const alice=await client('alice'), bob=await client('bob'), outsider=await client('outsider');
  const outsideMembership=[], outsideProbes=[], bobProbes=[];
  outsider.on('room:membership',n=>outsideMembership.push(n));
  outsider.on('test:room-probe',n=>outsideProbes.push(n));
  bob.on('test:room-probe',n=>bobProbes.push(n));
  const update=once(outsider,'room:list-updated');
  const room=(await ack(alice,'room:create',{name:'General'})).data;
  expect((await update).rooms).toContainEqual(room);
  const payload={roomId:room.roomId};
  const ownJoin=once(alice,'room:membership');
  expect((await ack(alice,'room:join',payload)).data.memberCount).toBe(1);
  expect(await ownJoin).toEqual({...payload,userId:'alice',action:'join',memberCount:1});
  const notice=once(alice,'room:membership');
  expect((await ack(bob,'room:join',{...payload,userId:'forged'})).data.memberCount).toBe(2);
  expect(await notice).toEqual({...payload,userId:'bob',action:'join',memberCount:2});
  const delivered=once(bob,'test:room-probe');
  app.io.to(roomChannel(room.roomId)).emit('test:room-probe',{text:'transport fixture, not business messaging'});
  expect((await delivered).text).toContain('transport fixture');
  const left=once(alice,'room:membership');
  expect(await ack(bob,'room:leave',payload)).toEqual({ok:true,data:payload});
  expect(await left).toEqual({...payload,userId:'bob',action:'leave',memberCount:1});
  app.io.to(roomChannel(room.roomId)).emit('test:room-probe',{text:'after leave'});
  await barrier(bob);await barrier(outsider);
  expect(bobProbes).toHaveLength(1);
  expect(outsideMembership).toEqual([]);expect(outsideProbes).toEqual([]);
  expect((await ack(outsider,'room:list',{})).data.rooms).toEqual([{...room,memberCount:1}]);
  expect(rooms.hasSocket(room.roomId,alice.id)).toBe(true);
});

test('TC-Room-03/04: second tab does not inflate counts or cause an early leave notice',async()=>{
  const alice=await client('alice'), bob=await client('bob','first'), tab=await client('bob','second');
  const room=(await ack(alice,'room:create',{name:'General'})).data, payload={roomId:room.roomId};
  await ack(alice,'room:join',payload);await ack(bob,'room:join',payload);
  await barrier(alice);
  const notices=[];alice.on('room:membership',n=>notices.push(n));
  expect((await ack(tab,'room:join',payload)).data.memberCount).toBe(2);
  await ack(bob,'room:leave',payload);await barrier(alice);
  expect(notices).toEqual([]);expect(rooms.list()[0].memberCount).toBe(2);
  const departed=once(alice,'room:membership');tab.disconnect();
  expect(await departed).toEqual({...payload,userId:'bob',action:'leave',memberCount:1});
  expect(rooms.list()[0].memberCount).toBe(1);
});

test('rapid repeated joins are idempotent and internal socket rooms cannot be joined through the catalogue',async()=>{
  const alice=await client('alice'), observer=await client('observer');
  const room=(await ack(alice,'room:create',{name:'General'})).data,payload={roomId:room.roomId};
  const notices=[];alice.on('room:membership',n=>notices.push(n));
  const joined=await Promise.all([ack(alice,'room:join',payload),ack(alice,'room:join',payload)]);
  expect(joined.map(x=>x.data.memberCount)).toEqual([1,1]);expect(notices).toHaveLength(1);
  expect(await ack(alice,'room:join',{roomId:observer.id})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
  expect((await ack(alice,'room:list',{})).data.rooms).toHaveLength(1);
});

test.each(['room:join','room:leave'])('invalid %s payloads do not mutate memberships',async event=>{
  const alice=await client('alice');await ack(alice,'room:create',{name:'General'});
  for(const payload of [null,[],{}, {roomId:''},{roomId:42},{roomId:'x'.repeat(129)}]) {
    expect(await ack(alice,event,payload)).toMatchObject({ok:false,error:{code:'VALIDATION_ERROR'}});
  }
  expect(await ack(alice,event,{roomId:'missing'})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
  expect(rooms.list()[0].memberCount).toBe(0);
});

test('TC-Sec-03: actual revoked JWT session cannot send another room event and departure is broadcast',async()=>{
  const alice=await client('alice'), bob=await client('bob');
  const room=(await ack(alice,'room:create',{name:'General'})).data,payload={roomId:room.roomId};
  await ack(alice,'room:join',payload);await ack(bob,'room:join',payload);await barrier(alice);
  const departed=once(alice,'room:membership'), denied=once(bob,'system:error'), gone=once(bob,'disconnect');
  sessions.get('bob-one').revokedAt=Math.floor(Date.now()/1000);
  bob.emit('room:create',{name:'Blocked'});
  expect(await denied).toMatchObject({error:{code:'UNAUTHORIZED'}});await gone;
  expect(await departed).toMatchObject({userId:'bob',action:'leave',memberCount:1});
  expect(rooms.list()).toHaveLength(1);
});

test('TC-Sec-04: actual HTTP middleware rejects attempt six before the supplied login handler',async()=>{
  await app.stop();let count=0, now=0;
  app=createApplication({loginLimiter:new LoginLimiter({clock:()=>now}),loginHandler:(_req,res)=>{
    count++;res.statusCode=401;res.end(JSON.stringify({ok:false,error:{code:'UNAUTHORIZED',message:'Fixture login rejection'}}));
  }});
  const address=await app.start(0),loginUrl=`http://127.0.0.1:${address.port}/api/auth/login`;
  for(let i=0;i<5;i++) expect((await fetch(loginUrl,{method:'POST',headers:{'X-Forwarded-For':`192.0.2.${i}`}})).status).toBe(401);
  const limited=await fetch(loginUrl,{method:'POST',headers:{'X-Forwarded-For':'198.51.100.1'}});
  expect(limited.status).toBe(429);expect(limited.headers.get('Retry-After')).toBe('60');
  expect(await limited.json()).toEqual({ok:false,error:{code:'RATE_LIMITED',message:'Too many login attempts'}});
  expect(count).toBe(5);now=60000;
  expect((await fetch(loginUrl,{method:'POST'})).status).toBe(401);expect(count).toBe(6);
});
