const { rmSync } = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');

const projectRoot = path.resolve(__dirname, '..');
const nextOutputDirectory = path.join(projectRoot, '.next');
const devPort = 3001;

function shouldResetNextOutput() {
  const argv = process.argv.slice(2).map((arg) => arg.trim().toLowerCase());
  if (argv.includes('--clean') || argv.includes('--reset-cache')) {
    return true;
  }

  const envFlag = String(process.env.APL_DEV_CLEAN_NEXT || '').trim().toLowerCase();
  return envFlag === '1' || envFlag === 'true' || envFlag === 'yes';
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.on('error', () => resolve(''));
    child.on('close', () => resolve(stdout));
  });
}

function parsePids(rawOutput) {
  return rawOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => Number.parseInt(line, 10))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

async function getPidsOnPort(port) {
  if (process.platform === 'win32') {
    const psCommand = `$ErrorActionPreference='SilentlyContinue'; Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess`;
    const output = await runCommand('powershell.exe', ['-NoProfile', '-Command', psCommand]);
    return parsePids(output);
  }

  const output = await runCommand('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']);
  return parsePids(output);
}

async function killPids(pids) {
  for (const pid of pids) {
    if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
      continue;
    }

    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Ignore missing or inaccessible processes.
    }

    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      process.kill(pid, 0);
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already gone.
    }
  }
}

function canListenOnPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

async function ensurePortAvailable(port) {
  const pids = await getPidsOnPort(port);
  if (pids.length > 0) {
    console.log(`Port ${port} is in use. Stopping process(es): ${pids.join(', ')}`);
    await killPids(pids);
  }

  const availableAfterKill = await canListenOnPort(port);
  if (!availableAfterKill) {
    throw new Error(`Port ${port} is still busy after cleanup. Close the process manually and retry.`);
  }
}

if (shouldResetNextOutput()) {
  console.log('Cleaning .next cache before startup...');
  try {
    rmSync(nextOutputDirectory, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors; Next will recreate what it needs.
  }
}

async function startDevServer() {
  await ensurePortAvailable(devPort);

  const nextCli = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextCli, 'dev', '-p', String(devPort)], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      NEXT_DISABLE_WEBPACK_CACHE: '1',
    },
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
}

startDevServer().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to prepare dev server: ${message}`);
  process.exit(1);
});