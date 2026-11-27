// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Zero-Dependency Local Environment & Compile-Server Diagnostic (`npm run doctor`)
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const LOCAL_IMAGE = 'k-comp-compile-server:local';
const COMPILE_URL = (process.env.COMPILE_SERVER_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');

function ok(label, detail) {
  console.log(`  [OK]   ${label}${detail ? ` — ${detail}` : ''}`);
}

function warn(label, detail) {
  console.log(`  [WARN] ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, detail) {
  console.log(`  [FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
}

function runQuiet(cmd, args) {
  try {
    const out = execFileSync(cmd, args, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000,
      windowsHide: true
    });
    return { ok: true, out: out.trim(), err: '' };
  } catch (err) {
    return {
      ok: false,
      out: typeof err?.stdout === 'string' ? err.stdout.trim() : '',
      err: typeof err?.stderr === 'string' ? err.stderr.trim() : (err instanceof Error ? err.message : String(err))
    };
  }
}

function isPortFree(port, host = '127.0.0.1') {
  return new Promise((resolvePort) => {
    const srv = createServer();
    srv.once('error', () => resolvePort(false));
    srv.once('listening', () => {
      srv.close(() => resolvePort(true));
    });
    srv.listen(port, host);
  });
}

async function probeHealth(url) {
  try {
    const started = Date.now();
    const res = await fetch(`${url}/api/v1/health`, {
      signal: AbortSignal.timeout(2000)
    });
    const ms = Date.now() - started;
    if (res.status === 401 || res.status === 403) {
      return { ok: true, authRequired: true, ms };
    }
    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: Boolean(data?.ok), data, ms };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  console.log('\nK-Comp Configurator — Environment Doctor\n');
  let fatalCount = 0;

  // 1. Node.js version
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
  if (nodeMajor >= 22) {
    ok('Node.js', `v${process.versions.node} (LTS >= 22)`);
  } else if (nodeMajor >= 20) {
    warn('Node.js', `v${process.versions.node} (frontend works; Node 22 LTS recommended for compile-service)`);
  } else {
    fail('Node.js', `v${process.versions.node} — please install Node.js 22 LTS`);
    fatalCount++;
  }

  // 2. node_modules installed
  const viteBin = resolve(ROOT, 'node_modules/vite/bin/vite.js');
  if (existsSync(viteBin)) {
    ok('Dependencies', 'node_modules installed');
  } else {
    fail('Dependencies', 'node_modules missing — run: npm ci');
    fatalCount++;
  }

  // 3. Vite dev port (5173)
  const port5173Free = await isPortFree(5173);
  if (port5173Free) {
    ok('Port 5173 (Vite)', 'available');
  } else {
    warn('Port 5173 (Vite)', 'already in use (Vite may already be running)');
  }

  // 4. Optional Docker & local compile image
  const dockerVer = runQuiet('docker', ['--version']);
  if (!dockerVer.ok) {
    warn('Docker (optional)', 'not installed — serverless mode (local .hex/.bin upload & Serial Monitor) works without Docker');
  } else {
    ok('Docker CLI', dockerVer.out);
    const daemon = runQuiet('docker', ['info', '--format', '{{.OSType}}']);
    if (!daemon.ok) {
      warn('Docker Daemon', 'not running — start Docker Desktop (Linux containers) if you want local 1-click Verify / Build & Flash');
    } else {
      const osType = daemon.out.toLowerCase();
      if (osType && osType !== 'linux') {
        warn('Docker Engine', `running in "${daemon.out}" mode — switch Docker Desktop to Linux containers`);
      } else {
        ok('Docker Engine', 'running (Linux containers)');
        const img = runQuiet('docker', ['image', 'inspect', LOCAL_IMAGE, '--format', '{{.Id}}']);
        if (img.ok) {
          ok('Local Compile Image', `${LOCAL_IMAGE} built and ready`);
        } else {
          warn('Local Compile Image', `${LOCAL_IMAGE} not built yet — run: npm run compiler:avr (fast ~1 min) or npm run compiler:build (AVR + ESP32-S3)`);
        }
      }
    }
  }

  // 5. Compile server live health check
  const health = await probeHealth(COMPILE_URL);
  if (health.ok) {
    if (health.authRequired) {
      ok('Compile Server', `reachable at ${COMPILE_URL} (${health.ms} ms, Bearer auth enabled)`);
    } else {
      const boards = Array.isArray(health.data?.boards) ? health.data.boards.join(', ') : '—';
      const ver = health.data?.serverVersion || '?';
      ok('Compile Server', `online at ${COMPILE_URL} (v${ver}, ${health.ms} ms, boards: ${boards})`);
    }
  } else {
    const port8787Free = await isPortFree(8787);
    if (port8787Free) {
      warn('Compile Server', `offline at ${COMPILE_URL} (run npm run dev:full or npm run compiler:up to start)`);
    } else {
      warn('Compile Server', `port 8787 is busy, but /api/v1/health did not respond (${health.message})`);
    }
  }

  console.log('');
  if (fatalCount > 0) {
    console.log(`Doctor finished with ${fatalCount} required fix(es) above.`);
    process.exit(1);
  }
  console.log('Ready! Next steps:');
  console.log('  • Start app (+ compile server if built): npm run dev:full');
  console.log('  • Run full quality gate (arch + tests + build): npm run check\n');
}

main();
