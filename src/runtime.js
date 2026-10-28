const fs = require('node:fs');
const path = require('node:path');
const { createApplication } = require('./app');
const { createDatabase } = require('./database');
const { createAuthService } = require('./auth');
const { HistoryStore } = require('./history');
const { RoomStore } = require('./rooms');
const { MessageService, registerMessageHandlers } = require('./messages');
const { registerPresenceHandlers } = require('./presence');
const { AppError, failure } = require('./errors');

async function readBody(req) {
  let size=0;const chunks=[];
  for await (const chunk of req) {
    size+=chunk.length;
    if(size>16384)throw new AppError('VALIDATION_ERROR','Request body is too large');
    chunks.push(chunk);
  }
  try {
    const data=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
    if(!data||typeof data!=='object'||Array.isArray(data))throw Error();
    return data;
  } catch {throw new AppError('VALIDATION_ERROR','Credentials must be a JSON object');}
}
function createRuntime({ env=process.env, filename, secret=env.JWT_SECRET }={}) {
  let tls;
  if(env.TLS_CERT_PATH||env.TLS_KEY_PATH){
    if(!env.TLS_CERT_PATH||!env.TLS_KEY_PATH)throw Error('Both TLS_CERT_PATH and TLS_KEY_PATH are required');
    tls={cert:fs.readFileSync(env.TLS_CERT_PATH),key:fs.readFileSync(env.TLS_KEY_PATH)};
  }
  if(env.NODE_ENV==='production'&&!tls)throw Error('Production requires TLS certificate and key');
  if(env.NODE_ENV==='production'&&(!secret||Buffer.byteLength(secret)<32))throw Error('Production requires JWT_SECRET of at least 32 bytes');
  const file=filename||env.NODE_DB_PATH||env.CHAT_DB_PATH||path.join(process.cwd(),'data','chat.sqlite');
  const database=createDatabase(file),history=new HistoryStore(file),rooms=new RoomStore({repository:history});
  const authService=typeof secret==='string'&&Buffer.byteLength(secret)>=32 ? createAuthService({database,secret}) : null;
  history.usernameFor=id=>database.findUserById(id)?.username||id.slice(0,8);
  const messages=new MessageService({rooms,history});
  function error(res,err){
    const safe=failure(err);res.statusCode={UNAUTHORIZED:401,ACCOUNT_LOCKED:423,CONFLICT:409,VALIDATION_ERROR:400,AUTH_NOT_IMPLEMENTED:503}[safe.error.code]||500;
    res.end(JSON.stringify(safe));
  }
  const accountRoute=operation=>async(req,res)=>{
    try{
      if(!authService)throw new AppError('AUTH_NOT_IMPLEMENTED','Set JWT_SECRET to enable authentication');
      if(operation==='logout'){
        const header=req.headers.authorization;
        if(typeof header!=='string'||!header.startsWith('Bearer '))throw new AppError('UNAUTHORIZED','Authentication required');
        const token=header.slice(7);await authService.logout({token});
        for(const peer of app.io.of('/').sockets.values())if(peer.data.token===token)peer.disconnect(true);
        res.statusCode=204;res.end();return;
      }
      const result=await authService[operation](await readBody(req));
      res.statusCode=operation==='register'?201:200;
      res.end(JSON.stringify(operation==='register'?{ok:true,data:{user:result},user:result}:{ok:true,data:result,...result}));
    }catch(err){error(res,err);}
  };
  const assets=fs.existsSync(path.join(__dirname,'public'))?path.join(__dirname,'public'):path.join(__dirname,'..','public');
  const files={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
  const app=createApplication({rooms,tls,auth:authService?.getJwtAuth(),
    registerHandler:accountRoute('register'),loginHandler:accountRoute('login'),logoutHandler:accountRoute('logout'),
    requestHandler(req,res){
      if(req.method!=='GET')return false;
      const pathname=req.url.split('?')[0];
      if(pathname==='/vendor/socket.io.min.js'){
        const vendor=fs.existsSync(path.join(assets,'vendor','socket.io.min.js'))?path.join(assets,'vendor','socket.io.min.js'):path.join(__dirname,'..','node_modules','socket.io','client-dist','socket.io.min.js');
        res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(vendor));return true;
      }
      const item=files[pathname];if(!item)return false;
      res.setHeader('Content-Type',item[1]);
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ws: wss:; base-uri 'none'; frame-ancestors 'none'");
      res.end(fs.readFileSync(path.join(assets,item[0])));return true;
    },
    registerHandlers(io,socket){
      registerMessageHandlers(socket,messages,io);
      registerPresenceHandlers(io,socket,rooms,history.usernameFor);
    }
  });
  let closed=false;
  return {app,database,history,rooms,authService,
    async close(){if(closed)return;closed=true;await app.stop();history.close();database.close();}};
}
module.exports={createRuntime};
