const {createRuntime}=require('../src/runtime');
const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),http=require('node:http');
const {randomBytes}=require('node:crypto');const {io}=require('socket.io-client');
async function main(){
 const cert=path.resolve('reports/test-tls/cert.pem'),key=path.resolve('reports/test-tls/key.pem'),ca=fs.readFileSync(cert);
 const runtime=createRuntime({env:{NODE_ENV:'production',TLS_CERT_PATH:cert,TLS_KEY_PATH:key},filename:':memory:',secret:randomBytes(48).toString('hex')});
 const address=await runtime.app.start(0),port=address.port;
 const request=options=>new Promise((resolve,reject)=>https.get({host:'127.0.0.1',port,path:'/api/health',ca,...options},res=>{let body='';const protocol=res.socket.getProtocol();res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,protocol,body}));}).on('error',reject));
 let s;
 try{
  const current=await request({}),tls12=await request({minVersion:'TLSv1.2',maxVersion:'TLSv1.2'});
  const plaintextRejected=await new Promise(resolve=>{const req=http.get({host:'127.0.0.1',port,path:'/api/health'},res=>{res.resume();resolve(false);});req.on('error',()=>resolve(true));req.setTimeout(3000,()=>{req.destroy();resolve(true);});});
  const creds={username:'tls_user',password:'test-tls-password'};await runtime.authService.register(creds);const login=await runtime.authService.login(creds);
  s=io('https://127.0.0.1:'+port,{autoConnect:false,transports:['websocket'],reconnection:false,ca,auth:{token:login.token}});
  await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);s.connect();});
  const legacyRejected=await request({minVersion:'TLSv1',maxVersion:'TLSv1.1'}).then(()=>false,()=>true);
  const report={recordedAt:new Date().toISOString(),protocol:current.protocol,tls12:tls12.protocol,health:current.status,
   plaintextRejected,legacyRejected,authenticatedWss:s.connected,certificate:'Fresh local test certificate explicitly trusted by this client; not a public CA or deployment',
   pass:current.status===200&&tls12.protocol==='TLSv1.2'&&plaintextRejected&&legacyRejected&&s.connected};
  fs.writeFileSync('reports/tls.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)throw Error('TLS criterion failed');
 }finally{s?.disconnect();await runtime.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
