const { rmSync } = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = process.cwd();
const nextOutputDirectory = path.join(projectRoot, '.next');

try {
  rmSync(nextOutputDirectory, { recursive: true, force: true });
} catch {
  // Ignore cleanup errors; Next will recreate what it needs.
}

const nextCli = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const child = spawn(process.execPath, [nextCli, 'dev', '-p', '3001'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: false,
});

function shutdown(code) {
  process.exit(code);
}

child.on('exit', (code) => shutdown(code ?? 0));
child.on('error', () => shutdown(1));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
}