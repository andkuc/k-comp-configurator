// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Zero-Dependency Unified Dev Launcher (`npm run dev:full`): Auto-Starts Local Compile Container (if built) + Vite
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const COMPOSE_FILE = resolve(ROOT, 'server/compile-service/docker-compose.yml');
const LOCAL_IMAGE = 'k-comp-compile-server:local';
const HEALTH_URL = (process.env.COMPILE_SERVER_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '') + '/api/v1/health';
const VITE_BIN = resolve(ROOT, 'node_modules/vite/bin/vite.js');

function runQuiet(cmd, args) {
  try {
    execFileSync(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 8000,
      windowsHide: true
    });
    return true;
  } catch {
    return false;
  }
}

async function checkHealth() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1500) });
    if (res.status === 401 || res.status === 403) return { online: true, boards: [] };
    if (!res.ok) return { online: false, boards: [] };
    const data = await res.json();
    return { online: Boolean(data?.ok), boards: Array.isArray(data?.boards) ? data.boards : [] };
  } catch {
    return { online: false, boards: [] };
  }
}

async function ensureLocalCompileServer() {
  const already = await checkHealth();
  if (already.online) {
    console.log(`[dev:full] Compile server already running (${already.boards.join(', ') || 'auth protected'}).`);
    return;
  }

  if (!runQuiet('docker', ['info'])) {
    console.log('[dev:full] Docker Desktop not running — starting Vite in serverless mode (local .hex/.bin upload & Serial Monitor still work).');
    return;
  }

  if (!runQuiet('docker', ['image', 'inspect', LOCAL_IMAGE])) {
    console.log(`[dev:full] Local image "${LOCAL_IMAGE}" not built yet — starting Vite in serverless mode.`);
    console.log('[dev:full] Tip: Build once via "npm run compiler:avr" (fast ~1 min) or "npm run compiler:build" (AVR + ESP32-S3).');
    return;
  }

  console.log('[dev:full] Starting local compile-service container…');
  try {
    execFileSync('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d'], {
      stdio: 'inherit',
      cwd: ROOT
    });
  } catch {
    console.warn('[dev:full] Could not start compile container — continuing in serverless mode.');
    return;
  }

  for (let i = 0; i < 20; i++) {
    const st = await checkHealth();
    if (st.online) {
      console.log(`[dev:full] Compile server online at http://localhost:8787 (boards: ${st.boards.join(', ') || 'ready'}).`);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.warn('[dev:full] Compile container started, waiting on /api/v1/health timed out — check "npm run compiler:logs".');
}

async function main() {
  if (!existsSync(VITE_BIN)) {
    console.error('[dev:full] Missing node_modules/vite — please run "npm ci" first.');
    process.exit(1);
  }

  await ensureLocalCompileServer();

  const extraArgs = process.argv.slice(2);
  console.log('[dev:full] Starting Vite dev server…\n');
  const child = spawn(process.execPath, [VITE_BIN, ...extraArgs], {
    cwd: ROOT,
    stdio: 'inherit'
  });

  const forwardSignal = (sig) => {
    if (!child.killed) child.kill(sig);
  };
  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main();
