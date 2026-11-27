// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Build-Time Core Prewarm & Libraries Hash Generator (Reads Declarative boards.json)
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeLibrariesHash, loadBoardsWhitelist, loadConfig } from './config.mjs';

const config = loadConfig();
const boardsMap = loadBoardsWhitelist(config.boardsFile);
const filterRaw = (process.env.PREWARM_BOARDS || '').trim();
const allowedSet = filterRaw ? new Set(filterRaw.split(',').map((s) => s.trim()).filter(Boolean)) : null;

const workRoot = mkdtempSync(join(tmpdir(), 'kcomp-prewarm-'));
try {
  for (const [boardId, target] of boardsMap.entries()) {
    if (allowedSet && !allowedSet.has(boardId)) continue;
    const sketchName = `prewarm_${boardId.replace(/[^a-z0-9]/gi, '_')}`;
    const sketchDir = join(workRoot, sketchName);
    const buildDir = join(workRoot, `build_${boardId}`);
    const outDir = join(workRoot, `out_${boardId}`);
    const downloadsDir = join(workRoot, 'downloads');
    const coreCache = join(config.coreCacheDir, boardId);

    mkdirSync(sketchDir, { recursive: true });
    mkdirSync(buildDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });
    mkdirSync(downloadsDir, { recursive: true });
    mkdirSync(coreCache, { recursive: true });

    writeFileSync(join(sketchDir, `${sketchName}.ino`), target.prewarmSketch, 'utf-8');
    console.log(`[prewarm] Precompiling core cache for "${boardId}" (${target.fqbn})…`);

    execFileSync(
      config.cliBin,
      [
        'compile',
        '--fqbn',
        target.fqbn,
        '--no-color',
        '--build-path',
        buildDir,
        '--output-dir',
        outDir,
        sketchDir
      ],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          ...(config.cliDataDir ? { ARDUINO_DIRECTORIES_DATA: config.cliDataDir } : {}),
          ...(config.cliUserDir ? { ARDUINO_DIRECTORIES_USER: config.cliUserDir } : {}),
          ARDUINO_DIRECTORIES_DOWNLOADS: downloadsDir,
          ARDUINO_BUILD_CACHE_PATH: coreCache,
          ARDUINO_BUILD_CACHE_COMPILATIONS_BEFORE_PURGE: '0',
          ARDUINO_UPDATER_ENABLE_NOTIFICATION: 'false',
          ARDUINO_METRICS_ENABLED: 'false'
        }
      }
    );
  }

  const hash = computeLibrariesHash(config, boardsMap);
  if (config.librariesHashFile) {
    writeFileSync(config.librariesHashFile, `${hash}\n`, 'utf-8');
    console.log(`[prewarm] Wrote librariesHash=${hash} to ${config.librariesHashFile}`);
  } else {
    console.log(`[prewarm] Computed librariesHash=${hash}`);
  }
} finally {
  rmSync(workRoot, { recursive: true, force: true });
}
