const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');const {randomBytes,randomUUID}=require('node:crypto');
const {io}=require('socket.io-client');
const ROOT=path.resolve(__dirname,'..');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ack=(s,e,p)=>new Promise((resolve,reject)=>s.timeout(5000).emit(e,p,(err,r)=>err?reject(err):r?.ok?resolve(r.data):reject(Error(r?.error?.code))));
async function freePort(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
async function check(backend){
 const port=await freePort(),url='http://127.0.0.1:'+port;
 const filename=path.resolve('reports','system-'+backend+'-'+randomUUID()+'.sqlite');
 const env={...process.env,NODE_ENV:'test',FLASK_ENV:'test',JWT_SECRET:randomBytes(48).toString('hex'),NODE_PORT:String(port),FLASK_PORT:String(port),NODE_HOST:'127.0.0.1',FLASK_HOST:'127.0.0.1',NODE_DB_PATH:filename,FLASK_DB_PATH:filename,TLS_CERT_PATH:'',TLS_KEY_PATH:'',PYTHONPATH:path.join(ROOT,'python_backend')};
 const python=process.env.PYTHON_EXECUTABLE||(fs.existsSync(path.join(ROOT,'.venv','Scripts','python.exe'))?path.join(ROOT,'.venv','Scripts','python.exe'):'python');
 let child,logs='',clients=[];
 async function start(){
  child=spawn(backend==='node'?process.execPath:python,backend==='node'?['src/index.js']:['-m','chat_backend'],{cwd:ROOT,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  child.stdout.on('data',chunk=>{logs+=chunk;});child.stderr.on('data',chunk=>{logs+=chunk;});
  for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(backend+' launcher stopped: '+logs.slice(-800));try{if((await fetch(url+'/api/health')).ok)return;}catch{}await delay(100);}throw Error('Launcher health timeout');
 }
 async function stop(){clients.forEach(s=>s.disconnect());clients=[];if(child&&child.exitCode===null){child.kill('SIGTERM');for(let i=0;i<50&&child.exitCode===null;i++)await delay(100);if(child.exitCode===null)child.kill('SIGKILL');}}
 async function post(route,data,token){const r=await fetch(url+'/api/auth/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});return{status:r.status,data:r.status===204?null:await r.json()};}
 async function account(username){const credentials={username,password:'isolated-system-test-password'};const registered=await post('register',credentials);if(registered.status!==201)throw Error('Real registration failed: '+registered.status);const logged=await post('login',credentials);if(logged.status!==200)throw Error('Real login failed');return logged.data.data;}
 async function connect(token,deny=false){const socket=io(url,{autoConnect:false,reconnection:false,transports:['websocket'],auth:{token}});clients.push(socket);const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Socket connection timeout')),5000);socket.once('connect',()=>{clearTimeout(timer);resolve(true);});socket.once('connect_error',()=>{clearTimeout(timer);resolve(false);});socket.connect();});if(result===deny)throw Error('Unexpected socket authorization outcome');return socket;}
 const requireTrue=(condition,label)=>{if(!condition)throw Error(backend+': '+label);};
 try{
  await start();const a=await account('Alice'),b=await account('Bob');const sa=await connect(a.token),sb=await connect(b.token);
  const room=await ack(sa,'room:create',{name:'Persistent room'}),payload={roomId:room.roomId};
  await ack(sa,'room:join',payload);await ack(sb,'room:join',payload);
  for(let i=0;i<55;i++){
   const received=new Promise(resolve=>sb.once('message:received',resolve));
   const sent=await ack(sa,'message:send',{...payload,content:'Persisted message '+i});
   requireTrue(sent.status==='Delivered','missing Delivered state');requireTrue((await received).messageId===sent.messageId,'receiver mismatch');
  }
  const before=await ack(sb,'room:history',payload);requireTrue(before.messages.length===50,'last-50 limit failed');
  requireTrue(before.messages[0].content==='Persisted message 5','history order failed');
  const last=before.messages.at(-1);const read=await ack(sb,'message:read',{messageId:last.messageId});requireTrue(read.status==='Read'&&read.readBy.some(r=>r.userId===b.user.userId),'read receipt missing');
  const logout=await post('logout',null,b.token);requireTrue(logout.status===204,'logout route failed');await connect(b.token,true);
  await stop();await start();const resumed=await connect(a.token);const rejoined=await ack(resumed,'room:join',payload);
  requireTrue(rejoined.history.length===50,'history did not survive process restart');requireTrue(rejoined.history.at(-1).status==='Read','receipt did not survive restart');await connect(b.token,true);
  const report={backend,recordedAt:new Date().toISOString(),realHttpCredentials:true,realWebSocketTransport:true,persistedMessages:55,last50AfterProcessRestart:true,readReceiptPersisted:true,logoutRevocationPersisted:true,pass:true};
  console.log(JSON.stringify(report));return report;
 }finally{await stop();}
}
async function main(){fs.mkdirSync('reports',{recursive:true});const results=[];for(const backend of ['node','flask'])results.push(await check(backend));fs.writeFileSync('reports/system.json',JSON.stringify(results,null,2));}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
