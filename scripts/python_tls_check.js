// Real Flask HTTPS/WSS launcher check; explicitly trust only the local test CA.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const https=require('node:https'),http=require('node:http');
const {spawn,spawnSync}=require('node:child_process');
const {randomBytes,randomUUID}=require('node:crypto');
const {io}=require('socket.io-client');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const root=path.resolve(__dirname,'..');
 const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
 const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const cert=path.join(root,'reports/test-tls/cert.pem'),key=path.join(root,'reports/test-tls/key.pem'),ca=fs.readFileSync(cert);
 const python=process.env.PYTHON_EXECUTABLE||(fs.existsSync(path.join(root,'.venv/Scripts/python.exe'))?path.join(root,'.venv/Scripts/python.exe'):'python');
 const negativeStartupChecks={};
 for(const [name,settings,message] of [
  ['flaskProductionPlaintextRefused',{FLASK_ENV:'production',NODE_ENV:'development',TLS_CERT_PATH:'',TLS_KEY_PATH:''},'Production requires'],
  ['certificateOnlyRefused',{FLASK_ENV:'development',NODE_ENV:'development',TLS_CERT_PATH:cert,TLS_KEY_PATH:''},'Both TLS_CERT_PATH and TLS_KEY_PATH'],
  ['keyOnlyRefused',{FLASK_ENV:'development',NODE_ENV:'development',TLS_CERT_PATH:'',TLS_KEY_PATH:key},'Both TLS_CERT_PATH and TLS_KEY_PATH']
 ]){
  const filename=path.join(root,'reports','rejected-tls-'+randomUUID()+'.sqlite');
  const result=spawnSync(python,['-m','chat_backend'],{cwd:root,windowsHide:true,encoding:'utf8',timeout:4000,
   env:{...process.env,PYTHONPATH:path.join(root,'python_backend'),FLASK_HOST:'127.0.0.1',FLASK_PORT:String(port),
    FLASK_DB_PATH:filename,JWT_SECRET:randomBytes(48).toString('hex'),...settings}});
  if(result.error||result.status===0||!result.stderr.includes(message)||fs.existsSync(filename))throw Error('Fail-closed startup regression: '+name);
  negativeStartupChecks[name]=true;
 }
 const child=spawn(python,['-m','chat_backend'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],
  env:{...process.env,PYTHONPATH:path.join(root,'python_backend'),FLASK_HOST:'127.0.0.1',FLASK_PORT:String(port),
   FLASK_ENV:'production',NODE_ENV:'development',JWT_SECRET:randomBytes(48).toString('hex'),
   FLASK_DB_PATH:path.join(root,'reports','python-tls-'+randomUUID()+'.sqlite'),TLS_CERT_PATH:cert,TLS_KEY_PATH:key}});
 let logs='',spawnError,socket;
 child.on('error',error=>{spawnError=error;});
 for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{logs=(logs+data).slice(-2000);});
 const request=(route='/api/health',options={},body)=>new Promise((resolve,reject)=>{
  const req=https.request({hostname:'127.0.0.1',port,path:route,ca,...options},res=>{
   const protocol=res.socket.getProtocol();let text='';res.on('data',data=>{text+=data;});
   res.on('end',()=>resolve({status:res.statusCode,protocol,csp:res.headers['content-security-policy'],body:text}));
  });req.on('error',reject);req.setTimeout(3000,()=>req.destroy(Error('HTTPS timeout')));
  if(body)req.write(body);req.end();
 });
 try{
  let health;
  for(let attempt=0;attempt<100;attempt++){
   if(spawnError)throw Error('Python launch failed: '+spawnError.message);
   if(child.exitCode!==null)throw Error('Python stopped before TLS startup: '+logs);
   try{health=await request();if(health.status===200)break;}catch{}
   await delay(100);
  }
  if(health?.status!==200)throw Error('Python TLS health timeout: '+logs);
  const tls12=await request('/api/health',{minVersion:'TLSv1.2',maxVersion:'TLSv1.2'});
  const legacyRejected=await request('/api/health',{minVersion:'TLSv1',maxVersion:'TLSv1.1'}).then(()=>false,()=>true);
  const plaintextRejected=await new Promise(resolve=>{
   const req=http.get({hostname:'127.0.0.1',port,path:'/api/health'},res=>{res.resume();resolve(false);});
   req.on('error',()=>resolve(true));req.setTimeout(3000,()=>{req.destroy();resolve(true);});
  });
  const page=await request('/');
  const connectionPolicy=page.csp?.split(';').map(s=>s.trim()).find(s=>s.startsWith('connect-src '))?.split(/\s+/)||[];
  const secureCsp=connectionPolicy.includes('wss:')&&!connectionPolicy.includes('ws:');
  const credentials=JSON.stringify({username:'python_tls_user',password:'isolated-tls-test-password'});
  const post=route=>request(route,{method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(credentials)}},credentials);
  const registration=await post('/api/auth/register'),login=await post('/api/auth/login');
  if(registration.status!==201||login.status!==200)throw Error('Real HTTPS account flow failed');
  const token=JSON.parse(login.body).data.token;
  socket=io('https://127.0.0.1:'+port,{autoConnect:false,transports:['websocket'],reconnection:false,ca,auth:{token}});
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Authenticated Python WSS timeout')),5000);
   socket.once('connect',()=>{clearTimeout(timer);resolve();});socket.once('connect_error',error=>{clearTimeout(timer);reject(error);});socket.connect();
  });
  const report={recordedAt:new Date().toISOString(),backend:'flask',productionFlag:'FLASK_ENV=production with NODE_ENV=development',
   protocol:health.protocol,tls12:tls12.protocol,health:health.status,plaintextRejected,legacyRejected,secureCsp,
   realHttpsCredentials:true,authenticatedWss:socket.connected,negativeStartupChecks,
   scope:'Actual local Flask CLI listener and explicitly trusted temporary test certificate; not a public hosted endpoint',
   pass:tls12.protocol==='TLSv1.2'&&plaintextRejected&&legacyRejected&&secureCsp&&socket.connected};
  fs.writeFileSync(path.join(root,'reports/python-tls.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));if(!report.pass)throw Error('Python TLS criterion failed');
 }finally{
  socket?.disconnect();
  if(child.exitCode===null){child.kill('SIGTERM');for(let i=0;i<50&&child.exitCode===null;i++)await delay(100);if(child.exitCode===null)child.kill('SIGKILL');}
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
