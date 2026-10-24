const { readConfig } = require('./config');
const { createApplication } = require('./app');
const { RoomStore } = require('./rooms');
const { MessageService, registerMessageHandlers } = require('./messages');

async function main() {
  const config = readConfig();
  // One shared catalogue: the messaging service must gate on the same membership the
  // room handlers record, so the store instance is injected into both.
  const rooms = new RoomStore();
  const messages = new MessageService({ rooms });
  const app = createApplication({
    rooms,
    registerHandlers: (io, socket) => registerMessageHandlers(socket, messages, io)
  });
  const address = await app.start(config.port, config.host);
  console.log(`Node development server: http://${config.host}:${address.port}/api/health`);
  console.log('Rooms and messaging handlers are registered. Authentication is not connected, so socket access is denied by default.');
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
