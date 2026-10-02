const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src');
const destination = path.join(root, 'dist');
if (path.dirname(destination) !== root || path.basename(destination) !== 'dist') {
  throw new Error('Build output must be the repository dist directory');
}
if (fs.existsSync(destination)) {
  if (fs.realpathSync(destination) !== path.join(fs.realpathSync(root), 'dist')) {
    throw new Error('Refusing to clean a redirected build directory');
  }
  fs.rmSync(destination, { recursive: true });
}
fs.mkdirSync(destination, { recursive: true });
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
function copySource(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const input = path.join(from, entry.name);
    const output = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(output, { recursive: true });
      copySource(input, output);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.js')) {
        execFileSync(process.execPath, ['--check', input], { stdio: 'inherit' });
      }
      fs.copyFileSync(input, output);
    } else {
      throw new Error('Source links are not supported by this build');
    }
  }
}
copySource(source, destination);
console.log('Validated server JavaScript and built dist/. Run npm run start:built to use the build.');
