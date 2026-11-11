const { readConfig } = require('./config');
const { createRuntime } = require('./runtime');
async function main(){
  const config=readConfig();const runtime=createRuntime();
  await runtime.app.start(config.port,config.host);
  console.log('Chat application is listening on the configured host and port');
  let stopping=false;
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(stopping)return;stopping=true;await runtime.close();});
}
main().catch(()=>{console.error('Startup failed: check database, JWT and TLS configuration');process.exitCode=1;});
