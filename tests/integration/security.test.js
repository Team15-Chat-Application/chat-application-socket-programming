const { io: connect } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { createApplication } = require('../../src/app');
const { createJwtAuth, ISSUER, AUDIENCE } = require('../../src/jwt-auth');
const { RoomStore, roomChannel } = require('../../src/rooms');
const { LoginLimiter } = require('../../src/login-limit');
const SECRET='test-only-security-edge-key-do-not-use-in-production-64-bytes-long';
const BASE=1800000000;
const events=['system:ping','room:create','room:list','room:join','room:leave','unknown:event'];
function once(socket,event) {
  return new Promise((resolve,reject)=>{
    const handler=value=>{clearTimeout(timer);resolve(value);};
    const timer=setTimeout(()=>{socket.off(event,handler);reject(new Error('Timed out: '+event));},3000);
    socket.once(event,handler);
  });
}
const ack=(socket,event,payload)=>new Promise((resolve,reject)=>socket.timeout(3000).emit(event,payload,(e,r)=>e?reject(e):resolve(r)));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
let app, clients, rooms, now, url, roomId;
beforeEach(()=>{
  clients=[];rooms=new RoomStore();now=BASE;
  jest.spyOn(Date,'now').mockImplementation(()=>now*1000);
  roomId=rooms.create({userId:'user',sessionId:'session'},{name:'Existing'}).roomId;
});
afterEach(async()=>{clients.forEach(s=>s.disconnect());if(app)await app.stop();jest.restoreAllMocks();});
async function start(extra={}) {
  const session={userId:'user',sessionId:'session',expiresAt:BASE+600,revokedAt:null};
  const auth=createJwtAuth({secret:SECRET,findSession:async()=>session});
  app=createApplication({auth,rooms,...extra});
  const address=await app.start(0);url=`http://127.0.0.1:${address.port}`;
}
async function client(exp=BASE+1) {
  const token=jwt.sign({sub:'user',jti:'session',iat:BASE-1,exp,iss:ISSUER,aud:AUDIENCE},SECRET,{algorithm:'HS256'});
  const socket=connect(url,{autoConnect:false,reconnection:false,auth:{token}});clients.push(socket);
  const connected=once(socket,'connect');socket.connect();await connected;return socket;
}
test.each(events)('TC-Sec-03 actual JWT expiry after connection rejects %s and removes membership',async event=>{
  await start();const socket=await client();
  await ack(socket,'room:join',{roomId});expect(rooms.hasMember(roomId,'user')).toBe(true);
  now=BASE+2;
  const denied=once(socket,'system:error'),gone=once(socket,'disconnect');
  socket.emit(event,{roomId,name:'Must not create',nonce:'expired'});
  expect(await denied).toMatchObject({ok:false,error:{code:'UNAUTHORIZED'}});await gone;
  expect(rooms.hasMember(roomId,'user')).toBe(false);expect(rooms.list()).toHaveLength(1);
});
test('TC-Sec-03 expiry during delayed join cannot mutate membership or execute a queued request',async()=>{
  const entered=deferred(),release=deferred(),queued=deferred();
  let serverSocket;
  await start({registerHandlers:(_io,socket)=>{
    serverSocket = socket;
    const join=socket.join.bind(socket);
    socket.join=async channel=>{
      if(channel===roomChannel(roomId)){entered.resolve();await release.promise;}
      return join(channel);
    };
    socket.use((packet,next)=>{if(packet[0]==='room:create')queued.resolve();next();});
  }});
  const socket=await client(),joined=jest.spyOn(rooms,'join');
  socket.emit('room:join',{roomId});await entered.promise;
  socket.emit('room:create',{name:'Queued before expiry'});await queued.promise;
  const denied=once(socket,'system:error'),gone=once(socket,'disconnect');
  now=BASE+2;release.resolve();
  expect(await denied).toMatchObject({error:{code:'UNAUTHORIZED'}});await gone;
  expect(joined).toHaveBeenCalledTimes(1);expect(rooms.list()).toHaveLength(1);
  expect(rooms.hasMember(roomId,'user')).toBe(false);
  expect(serverSocket.rooms.has(roomChannel(roomId))).toBe(false);
});
test('TC-Sec-04 concurrent HTTP attempts admit exactly five, then recover at the rolling boundary',async()=>{
  let time=0,calls=0;
  await start({loginLimiter:new LoginLimiter({clock:()=>time}),loginHandler:(_req,res)=>{
    calls++;res.statusCode=401;res.end(JSON.stringify({ok:false,error:{code:'UNAUTHORIZED',message:'Fixture login'}}));
  }});
  const loginUrl=url+'/api/auth/login';
  const responses=await Promise.all(Array.from({length:20},(_,i)=>fetch(loginUrl,{method:'POST',headers:{'X-Forwarded-For':`192.0.2.${i}`}})));
  expect(responses.filter(r=>r.status===401)).toHaveLength(5);
  expect(responses.filter(r=>r.status===429)).toHaveLength(15);expect(calls).toBe(5);
  for(const response of responses){
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    if(response.status===429)expect(response.headers.get('Retry-After')).toBe('60');
    await response.json();
  }
  time=59999;expect((await fetch(loginUrl,{method:'POST'})).status).toBe(429);
  time=60000;expect((await fetch(loginUrl,{method:'POST'})).status).toBe(401);expect(calls).toBe(6);
});
