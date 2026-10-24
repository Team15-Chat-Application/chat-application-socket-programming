// Test-only subprocess bridge: fixture inputs travel over stdin, never command arguments.
const { hashPassword, verifyPassword } = require('../../src/passwords');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', async () => {
  try {
    const data = JSON.parse(input);
    const result = data.operation === 'hash'
      ? await hashPassword(data.password, { cost: 10 })
      : await verifyPassword(data.password, data.hash);
    process.stdout.write(JSON.stringify(result));
  } catch {
    process.stderr.write('Password fixture operation failed');
    process.exitCode = 1;
  }
});
