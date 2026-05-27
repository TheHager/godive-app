const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const out = fs.openSync(path.join(__dirname, 'server_stdout.log'), 'a');
const err = fs.openSync(path.join(__dirname, 'server_stderr.log'), 'a');

// Run with NODE_ENV=production to serve built files
const child = spawn('npx.cmd', ['tsx', 'server.ts'], {
  cwd: __dirname,
  detached: true,
  stdio: [ 'ignore', out, err ],
  shell: true,
  env: { ...process.env, NODE_ENV: 'production' }
});

child.unref();
console.log('Server spawned with PID:', child.pid);
process.exit(0);
