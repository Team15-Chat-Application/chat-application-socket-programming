// Real launcher probe: no injected auth, signing keys, users or messaging fixtures.
const { io } = require('socket.io-client');
const [url, service] = process.argv.slice(2);
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url || '') || !['node', 'flask'].includes(service)) {
  throw new Error('Expected a loopback launcher URL and node/flask service');
}
const socket = io(url, { autoConnect: false, reconnection: false,
  transports: ['polling'], timeout: 3000, auth: { token: 'invalid-startup-probe' } });
let finished = false;
function finish(ok) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  socket.disconnect();
  if (!ok) {
    console.error('Expected an explicit default-auth namespace rejection');
    process.exitCode = 1;
  } else console.log(JSON.stringify({ service, unauthenticatedSocketRejected: true, transport: 'polling' }));
}
const timer = setTimeout(() => finish(false), 5000);
socket.on('connect', () => finish(false));
socket.on('connect_error', error => finish(service === 'node'
  ? error.data?.code === 'AUTH_NOT_IMPLEMENTED'
  : error.message === 'Connection rejected by server'));
socket.connect();
