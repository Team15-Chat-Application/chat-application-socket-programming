const { readConfig } = require('./config');
const { createApplication } = require('./app');

async function main() {
  const config = readConfig();
  const app = createApplication();
  const address = await app.start(config.port, config.host);
  console.log(`Node development server: http://${config.host}:${address.port}/api/health`);
  console.log('Authentication, rooms and messaging are not implemented yet. Socket access is denied by default.');
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await app.stop();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
