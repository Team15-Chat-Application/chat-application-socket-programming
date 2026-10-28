const { createRuntime }=require('../../src/runtime');
const { io:connect }=require('socket.io-client');
const secret='test-real-account-issuer-only-not-for-production-123456';
let runtime,url,clients;
const ack=(socket,event,payload)=>new Promise((resolve,reject)=>socket.timeout(3000).emit(event,payload,(err,result)=>err?reject(err):resolve(result)));
async function request(route,body,token){const response=await fetch(url+'/api/auth/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:response.status===204?null:await response.json()};}
async function user(username){await request('register',{username,password:'test-password'});return (await request('login',{username,password:'test-password'})).body.data;}
async function client(login){const s=connect(url,{autoConnect:false,reconnection:false,auth:{token:login.token}});clients.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);s.connect();});return s;}
beforeEach(async()=>{clients=[];runtime=createRuntime({env:{},secret,filename:':memory:'});const address=await runtime.app.start(0);url='http://127.0.0.1:'+address.port;});
afterEach(async()=>{clients.forEach(s=>s.disconnect());await runtime.close();});
test('real HTTP registration/login, cross-user chat, history and read receipts',async()=>{
 const a=await user('Alice'),b=await user('Bob');const sa=await client(a),sb=await client(b);
 const room=(await ack(sa,'room:create',{name:'Team'})).data;
 await ack(sa,'room:join',{roomId:room.roomId});await ack(sb,'room:join',{roomId:room.roomId});
 const received=new Promise(resolve=>sb.once('message:received',resolve));
 const sent=await ack(sa,'message:send',{roomId:room.roomId,content:'Hello <b>team</b><script>bad()</script>'});
 expect(sent.ok).toBe(true);expect(sent.data.status).toBe('Delivered');expect((await received).content).toBe('Hello team');
 const read=await ack(sb,'message:read',{messageId:sent.data.messageId});expect(read.data.status).toBe('Read');expect(read.data.readBy[0].userId).toBe(b.user.userId);
 const history=await ack(sb,'room:history',{roomId:room.roomId});expect(history.data.messages).toHaveLength(1);
 const outsider=await client(await user('Outside'));expect((await ack(outsider,'room:history',{roomId:room.roomId})).error.code).toBe('FORBIDDEN');
 expect((await request('register',{username:'ALICE',password:'different'})).status).toBe(409);
});
test('logout revokes real issued JWT and immediately disconnects its live socket',async()=>{
 const a=await user('Alice');const socket=await client(a);
 const gone=new Promise(resolve=>socket.once('disconnect',resolve));
 expect((await request('logout',undefined,a.token)).status).toBe(204);await gone;
 const denied=connect(url,{autoConnect:false,reconnection:false,auth:{token:a.token}});clients.push(denied);
 const result=new Promise(resolve=>denied.once('connect_error',resolve));denied.connect();expect((await result).data.code).toBe('UNAUTHORIZED');
});
test('actual login handler keeps five-per-minute limit and rejects malformed JSON',async()=>{
 for(let i=0;i<5;i++)expect((await request('login',{})).status).toBe(401);
 expect((await request('login',{})).status).toBe(429);
 expect((await request('register',[])).status).toBe(400);
});
test('production refuses a plaintext listener and missing signing configuration',()=>{
 expect(()=>createRuntime({env:{NODE_ENV:'production'}})).toThrow('TLS');
});
test('typing debounce, room-scoped presence, and outsider rejection use real credentials',async()=>{
 const a=await user('Alice'),b=await user('Bob');const sa=await client(a),sb=await client(b);
 const room=(await ack(sa,'room:create',{name:'Team'})).data;await ack(sa,'room:join',{roomId:room.roomId});
 const presence=new Promise(resolve=>sa.once('presence:changed',resolve));await ack(sb,'room:join',{roomId:room.roomId});
 expect((await presence).status).toBe('online');expect((await ack(sa,'presence:list',{roomId:room.roomId})).data.users).toHaveLength(2);
 const typing=new Promise(resolve=>sa.once('presence:typing',resolve));await ack(sb,'typing:set',{roomId:room.roomId,typing:true});expect((await typing).typing).toBe(true);
 expect((await ack(sb,'typing:set',{roomId:room.roomId,typing:true})).data.debounced).toBe(true);
 const gone=new Promise(resolve=>sa.once('presence:changed',resolve));sb.disconnect();expect((await gone).status).toBe('offline');
});
