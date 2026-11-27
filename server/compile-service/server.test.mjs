// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Deterministic Unit & HTTP Integration Tests for K-Comp Compile Service (Node 22 built-in node:test)
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { loadBoardsWhitelist, loadConfig } from './config.mjs';
import {
  assertSafeIncludes,
  buildCliCompileInvocation,
  collectArtifacts,
  parseGccDiagnostics,
  parseMemoryUsage,
  seedCoreCacheFromPrewarm,
  validateCompilePayload
} from './compiler-runner.mjs';
import { CompileCoordinator, computeBuildCacheKey, QueueFullError } from './queue-cache.mjs';
import { createCompileServer } from './server.mjs';

const SAMPLE_IHEX = [
  ':100000000C9434000C9446000C9446000C9446006A',
  ':00000001FF'
].join('\n');

async function startTestServer(opts = {}) {
  const config = loadConfig({
    PORT: '0',
    HOST: '127.0.0.1',
    MAX_CONCURRENT_BUILDS: String(opts.maxConcurrent ?? 2),
    MAX_QUEUE_LENGTH: String(opts.maxQueue ?? 4),
    MAX_BODY_BYTES: String(opts.maxBodyBytes ?? 65536),
    CORS_ORIGINS: opts.corsOrigins ?? '*',
    AUTH_TOKEN: opts.authToken ?? ''
  });
  const boardsMap = loadBoardsWhitelist(config.boardsFile);
  const instance = createCompileServer({
    config,
    boardsMap,
    librariesHash: opts.librariesHash ?? 'test-lib-hash-01',
    runner: opts.runner
  });

  await new Promise((resolve) => instance.server.listen(0, '127.0.0.1', resolve));
  const addr = instance.server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    baseUrl,
    instance,
    async close() {
      await new Promise((resolve) => instance.server.close(resolve));
    }
  };
}

describe('Boards Whitelist, Validation, Diagnostics Hygiene & Artifact Collector', () => {
  it('loads declarative boards.json whitelist for kcomp-v2 and esp32-s3-devkit', () => {
    const cfg = loadConfig({});
    const boards = loadBoardsWhitelist(cfg.boardsFile);
    assert.equal(boards.has('kcomp-v2'), true);
    assert.equal(boards.has('esp32-s3-devkit'), true);
    assert.equal(boards.get('kcomp-v2').artifactFormat, 'ihex');
    assert.equal(boards.get('esp32-s3-devkit').artifactFormat, 'esp-segments');
  });

  it('rejects unknown boardIds, unsafe filenames, and #include path traversal attempts', () => {
    const cfg = loadConfig({});
    const boards = loadBoardsWhitelist(cfg.boardsFile);

    assert.throws(
      () => validateCompilePayload({ boardId: 'evil:raw:fqbn', files: [{ path: 'main.ino', content: 'void setup(){}' }] }, boards),
      /Unsupported boardId/
    );
    assert.throws(
      () => validateCompilePayload({ boardId: 'kcomp-v2', files: [{ path: '../escape.ino', content: 'void setup(){}' }] }, boards),
      /Invalid source filename/
    );
    assert.throws(
      () => validateCompilePayload({ boardId: 'kcomp-v2', files: [{ path: 'payload.sh', content: 'echo hi' }] }, boards),
      /Invalid source filename/
    );
    assert.throws(
      () => assertSafeIncludes('main.ino', '#include "/etc/passwd"\nvoid setup(){}'),
      /Disallowed #include path/
    );
    assert.throws(
      () => assertSafeIncludes('main.ino', '#include "../../secrets.h"\nvoid setup(){}'),
      /Disallowed #include path/
    );
    assert.throws(
      () => assertSafeIncludes('main.ino', '#include "C:\\Windows\\win.ini"'),
      /Disallowed #include path/
    );

    const valid = validateCompilePayload(
      {
        boardId: 'kcomp-v2',
        codeProfile: 'kcomp-avr',
        files: [
          { path: 'main.ino', content: '#include <Wire.h>\n#include "helper.h"\nvoid setup(){}\nvoid loop(){}' },
          { path: 'helper.h', content: '#pragma once\ninline int add(int a, int b) { return a + b; }' }
        ]
      },
      boards
    );
    assert.equal(valid.boardId, 'kcomp-v2');
    assert.equal(valid.files.length, 2);
  });

  it('normalizes staging paths, filters internal vendor terms, and parses AVR/ESP32 memory usage', () => {
    const rawVendor = 'Ardu' + 'ino';
    const stderr = [
      `/tmp/kcomp-builds/job-abc/sketch_12ab/sketch_12ab.ino:12:5: error: '${rawVendor}.h': expected ';'`,
      `/tmp/kcomp-builds/job-abc/sketch_12ab/helper.h:4:2: warning: unused parameter 'x' (${rawVendor.toLowerCase()}-cli)`
    ].join('\n');

    const diags = parseGccDiagnostics(stderr, '/tmp/kcomp-builds/job-abc', 'main.ino', 'sketch_12ab');
    assert.equal(diags.length, 2);
    assert.deepEqual(diags[0], {
      severity: 'error',
      file: 'main.ino',
      line: 12,
      column: 5,
      message: "'mcu_core.h': expected ';'"
    });
    assert.equal(diags[1].file, 'helper.h');
    assert.equal(diags[1].message.includes('build-toolchain'), true);
    assert.equal(diags[1].message.toLowerCase().includes(rawVendor.toLowerCase()), false);

    const avrStdout = [
      'Sketch uses 3456 bytes (10%) of program storage space. Maximum is 32256 bytes.',
      'Global variables use 284 bytes (13%) of dynamic memory, leaving 1764 bytes for local variables. Maximum is 2048 bytes.'
    ].join('\n');
    const mem = parseMemoryUsage(avrStdout, { flashMax: 32256, ramMax: 2048 });
    assert.deepEqual(mem, { flashUsed: 3456, flashMax: 32256, ramUsed: 284, ramMax: 2048 });
  });

  it('collects IHEX (AVR) and multi-segment (ESP32-S3) artifacts plus optional ELF cleanly', async () => {
    const cfg = loadConfig({});
    const boards = loadBoardsWhitelist(cfg.boardsFile);
    const dir = await mkdtemp(join(tmpdir(), 'kcomp-art-test-'));
    try {
      await writeFile(join(dir, 'sketch_a1.ino.hex'), SAMPLE_IHEX, 'utf-8');
      await writeFile(join(dir, 'sketch_a1.ino.elf'), Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
      const avrArt = await collectArtifacts(dir, 'sketch_a1', boards.get('kcomp-v2'), { includeElf: true });
      assert.equal(avrArt.format, 'ihex');
      assert.equal(avrArt.rawHex, SAMPLE_IHEX);
      assert.equal(avrArt.segments.length, 1);
      assert.equal(avrArt.segments[0].offset, 0);
      assert.equal(Buffer.from(avrArt.elfBase64, 'base64')[0], 0x7f);

      await writeFile(join(dir, 'sketch_b2.ino.bootloader.bin'), Buffer.from([0xe9, 0x01, 0x02]));
      await writeFile(join(dir, 'sketch_b2.ino.partitions.bin'), Buffer.from([0xaa, 0x50, 0x00]));
      await writeFile(join(dir, 'boot_app0.bin'), Buffer.from([0x00, 0xff]));
      await writeFile(join(dir, 'sketch_b2.ino.bin'), Buffer.from([0xe9, 0x10, 0x20, 0x30]));
      const espArt = await collectArtifacts(dir, 'sketch_b2', boards.get('esp32-s3-devkit'));
      assert.equal(espArt.format, 'esp-segments');
      assert.deepEqual(
        espArt.segments.map((s) => [s.label, s.offset]),
        [
          ['bootloader', 0x0],
          ['partitions', 0x8000],
          ['boot_app0', 0xe000],
          ['app', 0x10000]
        ]
      );
      assert.equal(typeof espArt.segments[0].sha256, 'string');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('builds CLI invocation without deprecated --build-cache-path and isolates writable downloads/build dirs', () => {
    const cfg = loadConfig({
      ARDUINO_DATA_DIR: '/opt/kcomp-cli/data',
      ARDUINO_USER_DIR: '/opt/kcomp-cli/user'
    });
    const boards = loadBoardsWhitelist(cfg.boardsFile);
    const inv = buildCliCompileInvocation({
      config: cfg,
      target: boards.get('kcomp-v2'),
      workDir: '/tmp/kcomp-builds/job-1',
      sketchDir: '/tmp/kcomp-builds/job-1/sketch_a',
      outputDir: '/tmp/kcomp-builds/job-1/out',
      boardCoreCache: '/var/cache/kcomp-compile/core-cache/kcomp-v2'
    });
    assert.equal(inv.args.includes('--build-cache-path'), false);
    assert.equal(inv.args.includes('--build-path'), true);
    assert.equal(inv.env.ARDUINO_DIRECTORIES_DOWNLOADS, inv.downloadsDir);
    assert.equal(inv.env.ARDUINO_BUILD_CACHE_PATH, '/var/cache/kcomp-compile/core-cache/kcomp-v2');
    assert.equal(inv.env.ARDUINO_BUILD_CACHE_COMPILATIONS_BEFORE_PURGE, '0');
  });

  it('seeds writable core cache from read-only prewarm directory cleanly', async () => {
    const cfg = loadConfig({});
    const boards = loadBoardsWhitelist(cfg.boardsFile);
    const root = await mkdtemp(join(tmpdir(), 'kcomp-seed-test-'));
    try {
      const prewarmDir = join(root, 'prewarm');
      const runtimeCacheDir = join(root, 'runtime-cache');
      await mkdir(join(prewarmDir, 'kcomp-v2'), { recursive: true });
      await writeFile(join(prewarmDir, 'kcomp-v2', 'core.a'), 'prewarmed-avr', 'utf-8');

      const seeded = await seedCoreCacheFromPrewarm(
        { prewarmCacheDir: prewarmDir, coreCacheDir: runtimeCacheDir },
        boards
      );
      assert.equal(seeded, 1);
      const copied = await readFile(join(runtimeCacheDir, 'kcomp-v2', 'core.a'), 'utf-8');
      assert.equal(copied, 'prewarmed-avr');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('Single-Flight Request Coalescing, SHA-256 LRU Cache & Bounded Queue', () => {
  it('coalesces 5 concurrent identical builds into 1 runner execution and serves follow-ups from LRU cache', async () => {
    const coord = new CompileCoordinator({ maxConcurrent: 2, maxQueueLength: 4, maxCacheEntries: 8 });
    let execCount = 0;

    const key = computeBuildCacheKey({
      boardId: 'kcomp-v2',
      codeProfile: 'kcomp-avr',
      librariesHash: 'lib-v1',
      files: [{ path: 'main.ino', content: 'void setup(){} void loop(){}' }]
    });

    const slowBuild = async () => {
      execCount++;
      await new Promise((r) => setTimeout(r, 40));
      return {
        ok: true,
        cached: false,
        durationMs: 40,
        boardId: 'kcomp-v2',
        diagnostics: [],
        artifact: { format: 'ihex', filename: 'kcomp-v2.hex', rawHex: SAMPLE_IHEX, segments: [] }
      };
    };

    const results = await Promise.all([
      coord.run(key, slowBuild),
      coord.run(key, slowBuild),
      coord.run(key, slowBuild),
      coord.run(key, slowBuild),
      coord.run(key, slowBuild)
    ]);

    assert.equal(execCount, 1);
    assert.equal(results[0].ok, true);
    assert.equal(results.slice(1).every((r) => r.cached === true), true);

    // Follow-up hits LRU cache immediately with 0 additional executions
    const hit = await coord.run(key, slowBuild);
    assert.equal(execCount, 1);
    assert.equal(hit.cached, true);
    assert.equal(hit.durationMs, 0);
  });

  it('rejects distinct builds beyond maxConcurrent + maxQueueLength with QueueFullError (HTTP 429)', async () => {
    const coord = new CompileCoordinator({ maxConcurrent: 1, maxQueueLength: 1, maxCacheEntries: 8 });
    let releaseFirst;
    const gate = new Promise((resolve) => {
      releaseFirst = resolve;
    });

    const p1 = coord.run('key-1', async () => {
      await gate;
      return { ok: true, durationMs: 10, diagnostics: [], artifact: { format: 'ihex', filename: 'a.hex', rawHex: SAMPLE_IHEX, segments: [] } };
    });
    const p2 = coord.run('key-2', async () => ({
      ok: true,
      durationMs: 5,
      diagnostics: [],
      artifact: { format: 'ihex', filename: 'b.hex', rawHex: SAMPLE_IHEX, segments: [] }
    }));

    await assert.rejects(
      () => coord.run('key-3', async () => ({ ok: true, durationMs: 1, diagnostics: [] })),
      (err) => err instanceof QueueFullError && err.statusCode === 429
    );

    releaseFirst();
    await Promise.all([p1, p2]);
  });
});

describe('HTTP API /api/v1/health, /api/v1/compile, CORS + Chrome PNA & Bearer Auth', () => {
  it('handles OPTIONS preflight with Chrome Private Network Access header and GET /api/v1/health', async () => {
    const srv = await startTestServer({
      corsOrigins: 'https://andkuc.github.io',
      runner: { async compile() { return { ok: true, cached: false, durationMs: 1, diagnostics: [] }; } }
    });
    try {
      const preflight = await fetch(`${srv.baseUrl}/api/v1/compile`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://andkuc.github.io',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Private-Network': 'true'
        }
      });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://andkuc.github.io');
      assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true');

      const healthRes = await fetch(`${srv.baseUrl}/api/v1/health`, {
        headers: { Origin: 'https://andkuc.github.io' }
      });
      assert.equal(healthRes.status, 200);
      const health = await healthRes.json();
      assert.equal(health.ok, true);
      assert.equal(health.apiVersion, '1');
      assert.deepEqual(health.boards, ['kcomp-v2', 'esp32-s3-devkit']);
      assert.equal(health.librariesHash, 'test-lib-hash-01');
      assert.equal(health.authRequired, false);
      assert.equal(health.queue.maxConcurrent, 2);
    } finally {
      await srv.close();
    }
  });

  it('enforces Bearer token on /api/v1/* while keeping /healthz open for Docker HEALTHCHECK', async () => {
    let compileCalls = 0;
    const srv = await startTestServer({
      authToken: 'classroom-secret-99',
      runner: {
        async compile({ boardId }) {
          compileCalls++;
          return {
            ok: true,
            cached: false,
            durationMs: 33,
            boardId,
            diagnostics: [],
            memory: { flashUsed: 1500, flashMax: 32256, ramUsed: 180, ramMax: 2048 },
            artifact: { format: 'ihex', filename: 'kcomp-v2.hex', rawHex: SAMPLE_IHEX, segments: [] }
          };
        }
      }
    });

    try {
      // Docker liveness stays 200 without token
      const liveRes = await fetch(`${srv.baseUrl}/healthz`);
      assert.equal(liveRes.status, 200);

      // Missing/wrong token -> 401
      const noAuth = await fetch(`${srv.baseUrl}/api/v1/health`);
      assert.equal(noAuth.status, 401);
      const badAuth = await fetch(`${srv.baseUrl}/api/v1/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong-token' },
        body: JSON.stringify({ boardId: 'kcomp-v2', files: [{ path: 'main.ino', content: 'void setup(){}' }] })
      });
      assert.equal(badAuth.status, 401);

      // Valid token -> 200 + cached follow-up
      const payload = JSON.stringify({
        boardId: 'kcomp-v2',
        codeProfile: 'kcomp-avr',
        files: [{ path: 'main.ino', content: 'void setup(){} void loop(){}' }]
      });
      const ok1 = await fetch(`${srv.baseUrl}/api/v1/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer classroom-secret-99' },
        body: payload
      });
      assert.equal(ok1.status, 200);
      const body1 = await ok1.json();
      assert.equal(body1.ok, true);
      assert.equal(body1.cached, false);
      assert.equal(body1.artifact.format, 'ihex');
      assert.equal(compileCalls, 1);

      const ok2 = await fetch(`${srv.baseUrl}/api/v1/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer classroom-secret-99' },
        body: payload
      });
      const body2 = await ok2.json();
      assert.equal(body2.cached, true);
      assert.equal(compileCalls, 1);

      // Oversized payload -> 413
      const huge = await fetch(`${srv.baseUrl}/api/v1/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer classroom-secret-99' },
        body: JSON.stringify({ boardId: 'kcomp-v2', files: [{ path: 'main.ino', content: 'a'.repeat(70000) }] })
      });
      assert.equal(huge.status, 413);
    } finally {
      await srv.close();
    }
  });

  it('returns HTTP 429 with Retry-After when worker queue is saturated', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });

    const srv = await startTestServer({
      maxConcurrent: 1,
      maxQueue: 0,
      runner: {
        async compile({ boardId }) {
          await gate;
          return {
            ok: true,
            cached: false,
            durationMs: 20,
            boardId,
            diagnostics: [],
            artifact: { format: 'ihex', filename: 'kcomp-v2.hex', rawHex: SAMPLE_IHEX, segments: [] }
          };
        }
      }
    });

    try {
      const req1 = fetch(`${srv.baseUrl}/api/v1/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: 'kcomp-v2', files: [{ path: 'main.ino', content: 'void setup(){ /* 1 */ }' }] })
      });
      await new Promise((r) => setTimeout(r, 25));

      const req2 = await fetch(`${srv.baseUrl}/api/v1/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: 'kcomp-v2', files: [{ path: 'main.ino', content: 'void setup(){ /* 2 */ }' }] })
      });
      assert.equal(req2.status, 429);
      assert.equal(req2.headers.get('retry-after'), '3');

      release();
      const res1 = await req1;
      assert.equal(res1.status, 200);
    } finally {
      await srv.close();
    }
  });
});
