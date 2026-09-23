const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const mobile = path.join(root, 'apps', 'mobile');
const output = path.join(mobile, 'dist');
const publicDir = path.join(root, 'public');

const result = spawnSync('npx', ['expo', 'export', '--platform', 'web'], {
  cwd: mobile,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
if (!fs.existsSync(path.join(output, 'index.html'))) {
  throw new Error('Expo no generó apps/mobile/dist/index.html.');
}

fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });
fs.cpSync(output, publicDir, { recursive: true });
