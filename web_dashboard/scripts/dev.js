const { mkdirSync, readdirSync } = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = process.cwd();
const appRoot = path.join(projectRoot, 'src', 'app');
const routeFileNames = new Set([
  'page',
  'layout',
  'error',
  'global-error',
  'loading',
  'not-found',
  'template',
  'default',
  'route',
]);

function collectAppOutputDirectories(sourceDirectory, relativePath = '') {
  const outputDirectories = [];
  const entries = readdirSync(sourceDirectory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const childRelativePath = path.join(relativePath, entry.name);
      outputDirectories.push(path.join(projectRoot, '.next', 'server', 'app', childRelativePath));
      outputDirectories.push(...collectAppOutputDirectories(path.join(sourceDirectory, entry.name), childRelativePath));
      continue;
    }

    const extension = path.extname(entry.name);
    const baseName = path.basename(entry.name, extension);
    if (!routeFileNames.has(baseName)) continue;

    outputDirectories.push(
      path.join(projectRoot, '.next', 'server', 'app', relativePath, baseName),
    );
  }

  return outputDirectories;
}

const directories = [
  path.join(projectRoot, '.next'),
  path.join(projectRoot, '.next', 'static'),
  path.join(projectRoot, '.next', 'static', 'development'),
  path.join(projectRoot, '.next', 'server'),
  path.join(projectRoot, '.next', 'server', 'app'),
  path.join(projectRoot, '.next', 'server', 'pages'),
  path.join(projectRoot, '.next', 'server', 'chunks'),
  path.join(projectRoot, '.next', 'server', 'chunks', 'ssr'),
  ...collectAppOutputDirectories(appRoot),
];

function ensureDevDirectories() {
  for (const directory of directories) {
    mkdirSync(directory, { recursive: true });
  }
}

ensureDevDirectories();

const keepAlive = setInterval(ensureDevDirectories, 1000);

const nextCli = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const child = spawn(process.execPath, [nextCli, 'dev', '--turbo', '-p', '3001'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: false,
});

function shutdown(code) {
  clearInterval(keepAlive);
  process.exit(code);
}

child.on('exit', (code) => shutdown(code ?? 0));
child.on('error', () => shutdown(1));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    clearInterval(keepAlive);
    if (!child.killed) {
      child.kill(signal);
    }
  });
}