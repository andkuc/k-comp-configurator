// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Zero-Dependency Compile Service Configuration, Declarative Board Whitelist & Libraries Fingerprint
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

function parseIntEnv(env, key, fallback, min, max) {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parseBoolEnv(env, key, fallback = false) {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const s = String(raw).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true;
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
  return fallback;
}

function parseCorsOrigins(raw) {
  if (!raw || String(raw).trim() === '*') {
    return { allowAll: true, origins: [] };
  }
  const origins = String(raw)
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (origins.length === 0) return { allowAll: true, origins: [] };
  return { allowAll: false, origins };
}

/** Loads runtime configuration from process.env (or a custom env object in unit tests). */
export function loadConfig(env = process.env) {
  const pkgPath = join(MODULE_DIR, 'package.json');
  let serverVersion = '0.4.5';
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    if (typeof pkg.version === 'string' && pkg.version) serverVersion = pkg.version;
  } catch {
    // Keep fallback version
  }

  return Object.freeze({
    host: (env.HOST || '0.0.0.0').trim(),
    port: parseIntEnv(env, 'PORT', 8787, 0, 65535),
    apiVersion: '1',
    serverVersion,
    boardsFile: resolve(env.BOARDS_FILE || join(MODULE_DIR, 'boards.json')),
    cliBin: (env.ARDUINO_CLI_BIN || 'arduino-cli').trim(),
    cliDataDir: env.ARDUINO_DATA_DIR ? resolve(env.ARDUINO_DATA_DIR) : '',
    cliUserDir: env.ARDUINO_USER_DIR ? resolve(env.ARDUINO_USER_DIR) : '',
    buildRootDir: resolve(env.BUILD_ROOT_DIR || join(tmpdir(), 'kcomp-builds')),
    coreCacheDir: resolve(env.CORE_CACHE_DIR || join(tmpdir(), 'kcomp-core-cache')),
    prewarmCacheDir: env.PREWARM_CACHE_DIR ? resolve(env.PREWARM_CACHE_DIR) : '',
    librariesHashFile: env.LIBRARIES_HASH_FILE ? resolve(env.LIBRARIES_HASH_FILE) : '',
    librariesHashOverride: (env.LIBRARIES_HASH || '').trim(),
    maxConcurrentBuilds: parseIntEnv(env, 'MAX_CONCURRENT_BUILDS', 2, 1, 16),
    maxQueueLength: parseIntEnv(env, 'MAX_QUEUE_LENGTH', 24, 0, 200),
    maxCacheEntries: parseIntEnv(env, 'MAX_CACHE_ENTRIES', 128, 1, 2048),
    maxBodyBytes: parseIntEnv(env, 'MAX_BODY_BYTES', 524288, 4096, 4194304),
    maxFilesPerRequest: parseIntEnv(env, 'MAX_FILES_PER_REQUEST', 12, 1, 32),
    cors: parseCorsOrigins(env.CORS_ORIGINS || '*'),
    authToken: (env.AUTH_TOKEN || '').trim(),
    includeElf: parseBoolEnv(env, 'INCLUDE_ELF', false)
  });
}

/**
 * Loads and validates the declarative target board whitelist (`boards.json`).
 * Clients only ever send canonical `boardId` strings; FQBNs stay strictly server-side.
 */
export function loadBoardsWhitelist(boardsFilePath) {
  const rawText = readFileSync(boardsFilePath, 'utf-8');
  const parsed = JSON.parse(rawText);
  if (!parsed || typeof parsed !== 'object' || !parsed.boards || typeof parsed.boards !== 'object') {
    throw new Error(`Invalid boards whitelist schema in ${boardsFilePath}`);
  }

  const map = new Map();
  for (const [boardId, spec] of Object.entries(parsed.boards)) {
    if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(boardId)) {
      throw new Error(`Invalid canonical boardId "${boardId}" in boards.json`);
    }
    if (!spec || typeof spec !== 'object') {
      throw new Error(`Invalid board entry for "${boardId}"`);
    }
    if (typeof spec.fqbn !== 'string' || !spec.fqbn.trim()) {
      throw new Error(`Missing fqbn for "${boardId}"`);
    }
    if (spec.artifactFormat !== 'ihex' && spec.artifactFormat !== 'esp-segments') {
      throw new Error(`Unsupported artifactFormat "${spec.artifactFormat}" for "${boardId}"`);
    }

    map.set(
      boardId,
      Object.freeze({
        id: boardId,
        label: typeof spec.label === 'string' ? spec.label : boardId,
        mcu: typeof spec.mcu === 'string' ? spec.mcu : '',
        core: typeof spec.core === 'string' ? spec.core : '',
        fqbn: spec.fqbn.trim(),
        artifactFormat: spec.artifactFormat,
        outputFilename:
          typeof spec.outputFilename === 'string' && spec.outputFilename.trim()
            ? spec.outputFilename.trim()
            : (spec.artifactFormat === 'ihex' ? `${boardId}.hex` : `${boardId}.bin`),
        flashMax: Number.isFinite(spec.flashMax) && spec.flashMax > 0 ? Math.floor(spec.flashMax) : 32256,
        ramMax: Number.isFinite(spec.ramMax) && spec.ramMax > 0 ? Math.floor(spec.ramMax) : 2048,
        timeoutMs: Number.isFinite(spec.timeoutMs) && spec.timeoutMs >= 5000 ? Math.floor(spec.timeoutMs) : 45000,
        espSegments: Array.isArray(spec.espSegments) ? Object.freeze(spec.espSegments.map((s) => Object.freeze({ ...s }))) : [],
        prewarmSketch: typeof spec.prewarmSketch === 'string' ? spec.prewarmSketch : 'void setup(){}\nvoid loop(){}\n'
      })
    );
  }

  if (map.size === 0) {
    throw new Error(`Boards whitelist ${boardsFilePath} contains zero targets.`);
  }
  return map;
}

function hashDirectoryEntries(rootDir, hash) {
  if (!rootDir || !existsSync(rootDir)) return;
  const walk = (dir) => {
    const entries = readdirSync(dir).sort();
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const full = join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
      } else if (st.isFile() && /\.(?:h|hpp|c|cpp|json|properties)$/i.test(entry)) {
        hash.update(full.slice(rootDir.length));
        hash.update('\0');
        hash.update(String(st.size));
        hash.update(':');
        hash.update(String(Math.floor(st.mtimeMs)));
        hash.update('\n');
      }
    }
  };
  walk(rootDir);
}

/**
 * Computes a deterministic short SHA-256 fingerprint covering boards.json + installed libraries.
 * Browser clients include `librariesHash` in their LRU cache key to auto-invalidate on updates.
 */
export function computeLibrariesHash(config, boardsMap) {
  if (config.librariesHashOverride) {
    return config.librariesHashOverride;
  }
  if (config.librariesHashFile && existsSync(config.librariesHashFile)) {
    const saved = readFileSync(config.librariesHashFile, 'utf-8').trim();
    if (saved) return saved;
  }

  const hash = createHash('sha256');
  hash.update(`v:${config.serverVersion}\n`);
  for (const [id, spec] of Array.from(boardsMap.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    hash.update(`${id}=${spec.fqbn}|${spec.artifactFormat}\n`);
  }
  if (config.cliUserDir) {
    hashDirectoryEntries(join(config.cliUserDir, 'libraries'), hash);
  }
  return hash.digest('hex').slice(0, 16);
}
