// Fixed labels only: never include credentials, payloads, exception text or stacks.
function audit(event, code) {
  try { console.warn(JSON.stringify({ event, code })); } catch { /* Logging cannot break dispatch. */ }
}
module.exports = { audit };
