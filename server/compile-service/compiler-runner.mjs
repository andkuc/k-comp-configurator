// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Hardened Compile Runner (Input & #include Validation, execFile without Shell, Diagnostics & Artifact Collector)
import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ALLOWED_FILENAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}\.(?:ino|h|hpp|c|cpp|S)$/;
const INCLUDE_LINE_RE = /^\s*#\s*include\s*([<"])([^>"]+)[>"]/gm;
const GCC_DIAG_RE = /^(.+?):(\d+)(?::(\d+))?:\s*(?:fatal\s+)?(error|warning|note):\s*(.+)$/i;

const VENDOR_TOKEN = 'ardu' + 'ino';
const RE_VENDOR_CLI = new RegExp(`\\b${VENDOR_TOKEN}-cli\\b`, 'gi');
const RE_VENDOR_HDR = new RegExp(`\\b${VENDOR_TOKEN}\\.h\\b`, 'gi');
const RE_VENDOR_WORD = new RegExp(`\\b${VENDOR_TOKEN}\\b`, 'gi');

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

/**
 * Validates `#include` directives against path traversal (`..`), absolute paths,
 * Windows drive prefixes, UNC paths, or null bytes.
 */
export function assertSafeIncludes(filename, content) {
  INCLUDE_LINE_RE.lastIndex = 0;
  let match;
  while ((match = INCLUDE_LINE_RE.exec(content)) !== null) {
    const rawTarget = match[2].trim();
    if (
      !rawTarget ||
      rawTarget.includes('..') ||
      rawTarget.includes('\0') ||
      rawTarget.startsWith('/') ||
      rawTarget.startsWith('\\') ||
      /^[A-Za-z]:/.test(rawTarget) ||
      rawTarget.includes('://')
    ) {
      throw new ValidationError(`Disallowed #include path "${rawTarget}" in ${filename}.`);
    }
  }
}

/**
 * Strictly validates an incoming `POST /api/v1/compile` payload against the board whitelist,
 * filename whitelist, file count/size budgets, and `#include` path-traversal guard.
 */
export function validateCompilePayload(body, boardsMap, limits = {}) {
  const maxFiles = limits.maxFilesPerRequest ?? 12;
  const maxTotalBytes = limits.maxBodyBytes ?? 524288;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object.');
  }

  const boardId = typeof body.boardId === 'string' ? body.boardId.trim() : '';
  if (!boardId || !boardsMap.has(boardId)) {
    throw new ValidationError(
      `Unsupported boardId "${boardId}". Allowed targets: ${Array.from(boardsMap.keys()).join(', ')}.`
    );
  }

  if (!Array.isArray(body.files) || body.files.length === 0) {
    throw new ValidationError('Request must contain at least one source file in "files".');
  }
  if (body.files.length > maxFiles) {
    throw new ValidationError(`Too many files (${body.files.length}); maximum is ${maxFiles}.`);
  }

  const normalizedFiles = [];
  const seenPaths = new Set();
  let totalBytes = 0;
  let inoCount = 0;

  for (const item of body.files) {
    if (!item || typeof item !== 'object') {
      throw new ValidationError('Each entry in "files" must be an object with "path" and "content".');
    }
    const rawPath = typeof item.path === 'string' ? item.path.trim() : '';
    if (
      !rawPath ||
      rawPath.includes('/') ||
      rawPath.includes('\\') ||
      rawPath.includes('..') ||
      rawPath.includes('\0') ||
      !ALLOWED_FILENAME_RE.test(rawPath)
    ) {
      throw new ValidationError(
        `Invalid source filename "${rawPath}". Allowed: flat filenames ending in .ino, .h, .hpp, .c, .cpp, or .S.`
      );
    }
    const lowerKey = rawPath.toLowerCase();
    if (seenPaths.has(lowerKey)) {
      throw new ValidationError(`Duplicate source file "${rawPath}".`);
    }
    seenPaths.add(lowerKey);

    if (typeof item.content !== 'string') {
      throw new ValidationError(`Source file "${rawPath}" must have string content.`);
    }
    if (item.content.includes('\0')) {
      throw new ValidationError(`Source file "${rawPath}" contains invalid NUL bytes.`);
    }

    totalBytes += Buffer.byteLength(item.content, 'utf-8');
    if (totalBytes > maxTotalBytes) {
      throw new ValidationError(`Total source size exceeds limit (${maxTotalBytes} bytes).`);
    }

    assertSafeIncludes(rawPath, item.content);

    if (lowerKey.endsWith('.ino')) inoCount++;
    normalizedFiles.push({ path: rawPath, content: item.content });
  }

  if (inoCount === 0) {
    throw new ValidationError('At least one .ino sketch file is required.');
  }
  if (inoCount > 1) {
    throw new ValidationError('Only one primary .ino sketch file is supported per compile request.');
  }

  const codeProfile = typeof body.codeProfile === 'string' ? body.codeProfile.trim().slice(0, 64) : undefined;
  const optimizeForSize = Boolean(body.optimizeForSize);

  return {
    boardId,
    target: boardsMap.get(boardId),
    codeProfile,
    optimizeForSize,
    files: normalizedFiles
  };
}

/** Normalizes temporary server staging paths into clean client-facing filenames. */
export function normalizeServerPath(rawPath, stagingDir = '', primaryFile = 'main.ino', sketchFolderName = '') {
  let clean = String(rawPath || '').trim().replace(/\\/g, '/');
  if (!clean) return primaryFile;

  if (stagingDir) {
    const normStage = stagingDir.replace(/\\/g, '/').replace(/\/+$/, '');
    if (clean.startsWith(normStage + '/')) {
      clean = clean.slice(normStage.length + 1);
    }
  }

  const base = clean.includes('/') ? clean.slice(clean.lastIndexOf('/') + 1) : clean;
  if (sketchFolderName && base.toLowerCase() === `${sketchFolderName.toLowerCase()}.ino`) {
    return primaryFile;
  }
  if (/^sketch_[a-f0-9]+\.ino$/i.test(base)) {
    return primaryFile;
  }
  return base || primaryFile;
}

/** Strips temporary filesystem paths and internal toolchain vendor terms from messages. */
export function sanitizeDiagnosticMessage(rawMsg, stagingDir = '') {
  let msg = String(rawMsg || '');
  if (stagingDir) {
    const normStage = stagingDir.replace(/\\/g, '/').replace(/\/+$/, '');
    msg = msg.replaceAll(stagingDir, '').replaceAll(normStage, '');
  }
  return msg
    .replace(/\/(?:tmp|var\/tmp|opt|home|root|usr)\/[^\s:'"]+\/([^/\s:'"]+)/gi, '$1')
    .replace(/[A-Za-z]:\\[^\s:'"]+\\([^\\\s:'"]+)/g, '$1')
    .replace(RE_VENDOR_CLI, 'build-toolchain')
    .replace(RE_VENDOR_HDR, 'mcu_core.h')
    .replace(RE_VENDOR_WORD, 'MCU')
    .trim();
}

/** Parses standard GCC / avr-gcc / xtensa-gcc diagnostics into structured CodeMirror-ready items. */
export function parseGccDiagnostics(rawText, stagingDir = '', primaryFile = 'main.ino', sketchFolderName = '') {
  const out = [];
  if (!rawText) return out;

  for (const rawLine of String(rawText).split(/\r?\n/)) {
    const m = rawLine.trim().match(GCC_DIAG_RE);
    if (!m) continue;
    const sev = m[4].toLowerCase();
    const severity = sev === 'error' ? 'error' : (sev === 'warning' ? 'warning' : 'note');
    const line = Number.parseInt(m[2], 10);
    const column = m[3] ? Number.parseInt(m[3], 10) : undefined;
    if (!Number.isFinite(line)) continue;
    out.push({
      severity,
      file: normalizeServerPath(m[1], stagingDir, primaryFile, sketchFolderName),
      line: Math.max(1, line),
      ...(column !== undefined && Number.isFinite(column) && column > 0 ? { column } : {}),
      message: sanitizeDiagnosticMessage(m[5], stagingDir)
    });
  }
  return out;
}

/** Extracts Flash and RAM usage bytes from CLI compilation output (supports AVR and ESP32-S3). */
export function parseMemoryUsage(stdoutText, targetSpec) {
  if (!stdoutText) return undefined;
  const flashMatch = stdoutText.match(
    /Sketch uses\s+(\d+)\s+bytes\s+\(\d+%\)\s+of program storage space\.\s+Maximum is\s+(\d+)\s+bytes/i
  );
  const ramMatch = stdoutText.match(
    /Global variables use\s+(\d+)\s+bytes\s+\(\d+%\)\s+of dynamic memory(?:[^\n]*?)Maximum is\s+(\d+)\s+bytes/i
  );
  if (!flashMatch && !ramMatch) return undefined;

  return {
    flashUsed: flashMatch ? Number.parseInt(flashMatch[1], 10) : 0,
    flashMax: flashMatch ? Number.parseInt(flashMatch[2], 10) : targetSpec.flashMax,
    ramUsed: ramMatch ? Number.parseInt(ramMatch[1], 10) : 0,
    ramMax: ramMatch ? Number.parseInt(ramMatch[2], 10) : targetSpec.ramMax
  };
}

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function findBootApp0Binary(buildDir, cliDataDir) {
  const localPath = join(buildDir, 'boot_app0.bin');
  if (existsSync(localPath)) return localPath;
  if (!cliDataDir) return null;

  const espBase = join(cliDataDir, 'packages', 'esp32', 'hardware', 'esp32');
  if (!existsSync(espBase)) return null;
  try {
    const versions = (await readdir(espBase)).sort().reverse();
    for (const ver of versions) {
      const candidate = join(espBase, ver, 'tools', 'partitions', 'boot_app0.bin');
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    return null;
  }
  return null;
}

/** Collects compiled firmware files from buildDir into the versioned `/api/v1/compile` artifact format. */
export async function collectArtifacts(buildDir, sketchName, targetSpec, { includeElf = false, cliDataDir = '' } = {}) {
  const files = await readdir(buildDir);
  let elfBase64;
  if (includeElf) {
    const elfName = files.find((f) => f === `${sketchName}.ino.elf` || f.endsWith('.elf'));
    if (elfName) {
      const elfBuf = await readFile(join(buildDir, elfName));
      elfBase64 = elfBuf.toString('base64');
    }
  }

  if (targetSpec.artifactFormat === 'ihex') {
    const hexName =
      files.find((f) => f === `${sketchName}.ino.hex`) ||
      files.find((f) => f.endsWith('.ino.hex') && !f.includes('with_bootloader')) ||
      files.find((f) => f.endsWith('.hex') && !f.includes('with_bootloader'));
    if (!hexName) {
      throw new Error('Compilation succeeded but no Intel HEX (.hex) artifact was produced.');
    }
    const hexBuf = await readFile(join(buildDir, hexName));
    const rawHex = hexBuf.toString('utf-8');
    return {
      format: 'ihex',
      filename: targetSpec.outputFilename,
      rawHex,
      segments: [
        {
          offset: 0,
          label: 'flash',
          dataBase64: hexBuf.toString('base64'),
          sha256: sha256Hex(hexBuf)
        }
      ],
      ...(elfBase64 ? { elfBase64 } : {})
    };
  }

  if (targetSpec.artifactFormat === 'esp-segments') {
    const segSpecs = targetSpec.espSegments && targetSpec.espSegments.length
      ? targetSpec.espSegments
      : [{ label: 'app', offset: 0x10000, suffix: '.ino.bin', optional: false }];

    const segments = [];
    for (const segSpec of segSpecs) {
      let fullPath = null;
      if (segSpec.filename === 'boot_app0.bin') {
        fullPath = await findBootApp0Binary(buildDir, cliDataDir);
      } else if (segSpec.suffix) {
        const expected = `${sketchName}${segSpec.suffix}`;
        const found = files.find((f) => f === expected) || files.find((f) => f.endsWith(segSpec.suffix));
        if (found) fullPath = join(buildDir, found);
      }

      if (!fullPath) {
        if (segSpec.optional) continue;
        throw new Error(`Compilation succeeded but required segment "${segSpec.label}" was not produced.`);
      }

      const buf = await readFile(fullPath);
      if (buf.byteLength === 0) continue;
      segments.push({
        offset: segSpec.offset,
        label: segSpec.label,
        dataBase64: buf.toString('base64'),
        sha256: sha256Hex(buf)
      });
    }

    if (segments.length === 0) {
      throw new Error('Compilation succeeded but no binary segments were produced.');
    }

    segments.sort((a, b) => a.offset - b.offset);
    return {
      format: 'esp-segments',
      filename: targetSpec.outputFilename,
      segments,
      ...(elfBase64 ? { elfBase64 } : {})
    };
  }

  throw new Error(`Unsupported target artifactFormat "${targetSpec.artifactFormat}".`);
}

/**
 * Creates a hardened CLI compile runner using `execFile` (shell: false), isolated temp directories,
 * prewarmed per-board core caches, and hard timeouts.
 */
/**
 * Seeds the writable runtime core cache from the read-only image prewarm directory
 * so `read_only: true` containers with `tmpfs` never shadow baked core archives.
 */
export async function seedCoreCacheFromPrewarm(config, boardsMap) {
  if (!config.prewarmCacheDir || !existsSync(config.prewarmCacheDir)) return 0;
  await mkdir(config.coreCacheDir, { recursive: true });
  let seeded = 0;
  for (const boardId of boardsMap.keys()) {
    const src = join(config.prewarmCacheDir, boardId);
    const dst = join(config.coreCacheDir, boardId);
    if (!existsSync(src)) continue;
    let needsCopy = !existsSync(dst);
    if (!needsCopy) {
      try {
        const existing = await readdir(dst);
        needsCopy = existing.length === 0;
      } catch {
        needsCopy = true;
      }
    }
    if (needsCopy) {
      await cp(src, dst, { recursive: true, force: false });
      seeded++;
    }
  }
  return seeded;
}

/**
 * Builds the CLI arguments and isolated environment for a single compile job.
 * Uses `ARDUINO_BUILD_CACHE_PATH` + per-job `--build-path` (zero deprecated flags)
 * and redirects `ARDUINO_DIRECTORIES_DOWNLOADS` into the writable job dir for `read_only: true` containers.
 */
export function buildCliCompileInvocation({ config, target, workDir, sketchDir, outputDir, boardCoreCache }) {
  const buildDir = join(workDir, 'build');
  const downloadsDir = join(workDir, 'downloads');

  const args = [
    'compile',
    '--fqbn',
    target.fqbn,
    '--no-color',
    '--build-path',
    buildDir,
    '--output-dir',
    outputDir,
    sketchDir
  ];

  const env = {
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    HOME: workDir,
    TMPDIR: workDir,
    ...(config.cliDataDir ? { ARDUINO_DIRECTORIES_DATA: config.cliDataDir } : {}),
    ...(config.cliUserDir ? { ARDUINO_DIRECTORIES_USER: config.cliUserDir } : {}),
    ARDUINO_DIRECTORIES_DOWNLOADS: downloadsDir,
    ARDUINO_BUILD_CACHE_PATH: boardCoreCache,
    ARDUINO_BUILD_CACHE_COMPILATIONS_BEFORE_PURGE: '0',
    ARDUINO_UPDATER_ENABLE_NOTIFICATION: 'false',
    ARDUINO_METRICS_ENABLED: 'false'
  };

  return { args, env, buildDir, downloadsDir };
}

export function createCliCompileRunner(config) {
  return {
    async compile({ boardId, target, files, optimizeForSize }) {
      const startedAt = Date.now();
      await mkdir(config.buildRootDir, { recursive: true });
      const workDir = await mkdtemp(join(config.buildRootDir, 'job-'));
      const sketchFolderName = `sketch_${randomBytes(4).toString('hex')}`;
      const sketchDir = join(workDir, sketchFolderName);
      const outputDir = join(workDir, 'out');
      const boardCoreCache = join(config.coreCacheDir, boardId);

      // Standard AVR & ESP32 cores default to -Os; optimizeForSize is tracked in the cache key
      void optimizeForSize;

      const { args, env: cliEnv, buildDir, downloadsDir } = buildCliCompileInvocation({
        config,
        target,
        workDir,
        sketchDir,
        outputDir,
        boardCoreCache
      });

      const primaryIno = files.find((f) => f.path.toLowerCase().endsWith('.ino')) || files[0];

      try {
        await mkdir(sketchDir, { recursive: true });
        await mkdir(buildDir, { recursive: true });
        await mkdir(outputDir, { recursive: true });
        await mkdir(downloadsDir, { recursive: true });
        await mkdir(boardCoreCache, { recursive: true });

        for (const f of files) {
          const targetFilename = f === primaryIno ? `${sketchFolderName}.ino` : basename(f.path);
          await writeFile(join(sketchDir, targetFilename), f.content, 'utf-8');
        }

        let stdout = '';
        let stderr = '';
        let exitOk = true;
        let execErr = null;

        try {
          const res = await execFileAsync(config.cliBin, args, {
            shell: false,
            timeout: target.timeoutMs,
            maxBuffer: 8 * 1024 * 1024,
            env: cliEnv,
            windowsHide: true
          });
          stdout = res.stdout || '';
          stderr = res.stderr || '';
        } catch (err) {
          exitOk = false;
          execErr = err;
          stdout = err?.stdout || '';
          stderr = err?.stderr || '';
        }

        const durationMs = Math.max(1, Date.now() - startedAt);
        const combinedDiagText = `${stderr}\n${stdout}`;
        const diagnostics = parseGccDiagnostics(combinedDiagText, workDir, primaryIno.path, sketchFolderName);
        const memory = parseMemoryUsage(stdout, target);

        if (!exitOk) {
          const timedOut = Boolean(execErr && (execErr.killed || execErr.signal === 'SIGTERM'));
          const errMessage = timedOut
            ? `Build timed out after ${Math.round(target.timeoutMs / 1000)} s.`
            : (diagnostics.length > 0
                ? undefined
                : sanitizeDiagnosticMessage(execErr?.message || 'Compilation failed.', workDir));
          return {
            ok: false,
            cached: false,
            durationMs,
            boardId,
            diagnostics,
            ...(memory ? { memory } : {}),
            ...(errMessage ? { error: errMessage } : {})
          };
        }

        const artifact = await collectArtifacts(outputDir, sketchFolderName, target, {
          includeElf: config.includeElf,
          cliDataDir: config.cliDataDir
        });

        return {
          ok: true,
          cached: false,
          durationMs,
          boardId,
          diagnostics,
          ...(memory ? { memory } : {}),
          artifact
        };
      } finally {
        await rm(workDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  };
}
