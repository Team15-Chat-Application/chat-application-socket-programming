// Real signed sessions and TCP/WebSocket delivery; no fixture auth or ACK proxy.
const {createRuntime}=require('../src/runtime');
const {randomBytes,randomUUID}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {io}=require('socket.io-client');
const ack=(s,e,p)=>new Promise((resolve,reject)=>s.timeout(10000).emit(e,p,(error,r)=>error?reject(error):r?.ok?resolve(r.data):reject(Error(r?.error?.code))));
async function main(){
 fs.mkdirSync('reports',{recursive:true});const filename=path.resolve('reports','load-'+randomUUID()+'.sqlite');
 const runtime=createRuntime({env:{},filename,secret:randomBytes(48).toString('hex')});const clients=[];
 const address=await runtime.app.start(0);const url='http://127.0.0.1:'+address.port;
 try{
  const logins=[];
  for(let i=0;i<50;i++){
   const credentials={username:'load_user_'+i,password:'isolated-load-test-password'};
   await runtime.authService.register(credentials);logins.push(await runtime.authService.login(credentials));
   if((i+1)%10===0)console.log('Real account-service sessions prepared:',i+1);
  }
  await Promise.all(Array.from({length:100},async(_,i)=>{
   const s=io(url,{autoConnect:false,transports:['websocket'],forceNew:true,reconnection:false,auth:{token:logins[i%50].token}});clients[i]=s;
   await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);s.connect();});
  }));
  const count=runtime.app.io.of('/').sockets.size;if(count!==100)throw Error('100 connections not established');
  const room=await ack(clients[0],'room:create',{name:'Measured load room'});
  await Promise.all(clients.slice(0,50).map(s=>ack(s,'room:join',{roomId:room.roomId})));
  const latencies=[],writes=[];const save=runtime.history.save.bind(runtime.history);
  runtime.history.save=message=>{const start=performance.now();try{return save(message);}finally{writes.push(performance.now()-start);}};
  for(let sample=0;sample<30;sample++){
   const start=performance.now();
   const received=clients.slice(0,50).map(s=>new Promise(resolve=>s.once('message:received',()=>{latencies.push(performance.now()-start);resolve();})));
   await Promise.all([ack(clients[0],'message:send',{roomId:room.roomId,content:'Measured delivery '+sample}),...received]);
  }
  latencies.sort((a,b)=>a-b);writes.sort((a,b)=>a-b);
  const p90=latencies[Math.ceil(latencies.length*.9)-1],maxWrite=writes.at(-1);
  const report={recordedAt:new Date().toISOString(),runtime:process.version,platform:os.platform(),transport:'real loopback WebSocket',
   credentialSetup:'50 actual account-service registrations and bcrypt logins; signed DB-backed sessions, not manually signed fixture tokens',
   distinctUsers:50,concurrentConnections:count,receivingRoomMembers:50,messages:30,receiverSamples:latencies.length,
   receiverP90Ms:p90,receiverMaximumMs:latencies.at(-1),persistenceMaximumMs:maxWrite,
   pass:p90<=200&&maxWrite<=500&&count>=100,scope:'This host and loopback environment only; no WAN or monthly availability claim'};
  fs.writeFileSync('reports/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  if(!report.pass)throw Error('Measured performance criterion failed');
 }finally{clients.forEach(s=>s?.disconnect());await runtime.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
