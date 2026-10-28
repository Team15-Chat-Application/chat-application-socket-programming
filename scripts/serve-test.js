const {randomBytes,randomUUID}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRuntime}=require('../src/runtime');
fs.mkdirSync('reports',{recursive:true});
const runtime=createRuntime({env:{},secret:randomBytes(48).toString('hex'),filename:path.resolve('reports','browser-'+randomUUID()+'.sqlite')});
runtime.app.start(Number(process.env.BROWSER_TEST_PORT||31337)).then(()=>console.log('Browser acceptance server ready'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await runtime.close();process.exit(0);});
