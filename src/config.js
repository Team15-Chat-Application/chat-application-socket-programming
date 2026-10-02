function readConfig(env = process.env) {
  const raw = env.NODE_PORT ?? '3000';
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 65535) {
    throw new Error('NODE_PORT must be an integer from 1 to 65535');
  }
  const host = env.NODE_HOST ?? '127.0.0.1';
  if (!host.trim()) throw new Error('NODE_HOST must not be empty');
  return { host, port: Number(raw) };
}
module.exports = { readConfig };
