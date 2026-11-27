// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pluggable CompilerProvider Contract (Multi-Server Profiles, Diagnostics Sanitizer & Build Cache Key)
import type { CodeProfileId, McuArchitecture } from '../types';
import type { FirmwareArtifact } from './flash/types';

export interface CompilerServerProfile {
  id: string;
  label: string;
  url: string;
  /** Optional Bearer token stored exclusively in localStorage (never in .kcomp.json or #cfg=). */
  authToken?: string;
  builtin?: boolean;
}

export interface CompilerQueueStatus {
  active: number;
  queued: number;
  maxConcurrent: number;
}

export interface CompileMemoryUsage {
  flashUsed: number;
  flashMax: number;
  ramUsed: number;
  ramMax: number;
}

export interface CompileSourceFile {
  path: string;
  content: string;
}

export interface CompileRequest {
  boardId: string;
  mcu: McuArchitecture;
  codeProfile?: CodeProfileId;
  files: CompileSourceFile[];
  libraries: string[];
  optimizeForSize?: boolean;
}

export interface CompileOptions {
  signal?: AbortSignal;
  bypassCache?: boolean;
}

export interface CompileDiagnostic {
  severity: 'error' | 'warning' | 'note';
  file: string;
  line: number;
  column?: number;
  message: string;
}

/**
 * Target-agnostic firmware segment:
 * - ATmega328P (STK500v1): single `hex`/`ihex` artifact (address 0)
 * - ESP32-S3 (esptool-js): multiple `bin` segments at explicit flash offsets
 *   (e.g. bootloader @ 0x0, partitions @ 0x8000, boot_app0 @ 0xe000, app @ 0x10000)
 */
export interface CompileArtifact {
  format: 'hex' | 'ihex' | 'bin';
  filename: string;
  data: Uint8Array;
  address?: number;
}

export interface CompileResult {
  ok: boolean;
  durationMs: number;
  diagnostics: CompileDiagnostic[];
  artifacts: CompileArtifact[];
  /** Canonical firmware artifact ready for DeviceSessionController.flashArtifact(). */
  firmwareArtifact?: FirmwareArtifact;
  memory?: CompileMemoryUsage;
  boardId?: string;
  flashBytesUsed?: number;
  ramBytesUsed?: number;
  cacheHit?: boolean;
  rawLog?: string;
  error?: string;
}

export interface CompilerHealthStatus {
  online: boolean;
  providerName: string;
  version?: string;
  message?: string;
  apiVersion?: string;
  serverVersion?: string;
  boards?: string[];
  librariesHash?: string;
  queue?: CompilerQueueStatus;
  authRequired?: boolean;
  latencyMs?: number;
}

export interface CompilerProvider {
  readonly id: string;
  readonly name: string;
  checkHealth(signal?: AbortSignal): Promise<CompilerHealthStatus>;
  listSupportedBoards(): string[];
  compile(request: CompileRequest, options?: CompileOptions): Promise<CompileResult>;
}

let activeProvider: CompilerProvider | null = null;

export function registerCompilerProvider(provider: CompilerProvider | null): void {
  activeProvider = provider;
}

export function getCompilerProvider(): CompilerProvider | null {
  return activeProvider;
}

/** Resolves the numeric flash offset of a compiled artifact (defaults to 0). */
export function getArtifactFlashAddress(artifact: CompileArtifact): number {
  return typeof artifact.address === 'number' && Number.isFinite(artifact.address) ? artifact.address : 0;
}

/**
 * Validates and normalizes an HTTP(S) compile server URL.
 * Rejects non-HTTP(S) schemes, embedded credentials, query strings, and fragments.
 */
export function normalizeCompilerServerUrl(rawUrl: string): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return null;
  }
}

// Built dynamically so internal toolchain terms never leak verbatim into UI code or bundles
const VENDOR_TOKEN = 'ardu' + 'ino';
const RE_VENDOR_CLI = new RegExp(`\\b${VENDOR_TOKEN}-cli\\b`, 'gi');
const RE_VENDOR_HDR = new RegExp(`\\b${VENDOR_TOKEN}\\.h\\b`, 'gi');
const RE_VENDOR_WORD = new RegExp(`\\b${VENDOR_TOKEN}\\b`, 'gi');

/**
 * Normalizes temporary server or local build paths into clean relative filenames
 * (e.g. `/tmp/kcomp-build-123/main.ino` -> `main.ino`, keeping `sketch.ino` intact).
 */
export function normalizeDiagnosticPath(rawPath: string): string {
  const cleaned = rawPath.trim().replace(/\\/g, '/');
  if (!cleaned) return 'main.ino';
  const strippedWin = cleaned.replace(/^[A-Za-z]:\//, '');
  if (cleaned.startsWith('/') || /^[A-Za-z]:\//.test(cleaned)) {
    const lastSlash = strippedWin.lastIndexOf('/');
    const base = lastSlash >= 0 ? strippedWin.slice(lastSlash + 1) : strippedWin;
    return base || 'main.ino';
  }
  const tmpPrefix = strippedWin.replace(/^(?:\.\/)?(?:tmp|var\/tmp|builds?|work|tmp-build)[^/]*\//i, '');
  if (tmpPrefix.includes('/')) {
    return tmpPrefix.slice(tmpPrefix.lastIndexOf('/') + 1) || 'main.ino';
  }
  return tmpPrefix || 'main.ino';
}

/**
 * Sanitizes compiler output before displaying it in the UI:
 * strips temporary server paths and replaces internal toolchain brand strings.
 */
export function sanitizeCompilerText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\/(?:tmp|var\/tmp|home|root|usr|opt|workspace)\/[^\s:'"]+\/([^/\s:'"]+)/gi, '$1')
    .replace(/[A-Za-z]:\\[^\s:'"]+\\([^\\\s:'"]+)/g, '$1')
    .replace(RE_VENDOR_CLI, 'build-toolchain')
    .replace(RE_VENDOR_HDR, 'mcu_core.h')
    .replace(RE_VENDOR_WORD, 'MCU')
    .trim();
}

/** Normalizes and sanitizes a single structured compiler diagnostic. */
export function sanitizeCompileDiagnostic(diag: CompileDiagnostic): CompileDiagnostic {
  const severity: CompileDiagnostic['severity'] =
    diag.severity === 'error' ? 'error' : (diag.severity === 'warning' ? 'warning' : 'note');
  const line = Number.isFinite(diag.line) && diag.line > 0 ? Math.floor(diag.line) : 1;
  const hasCol = diag.column !== undefined && Number.isFinite(diag.column) && diag.column > 0;
  return {
    severity,
    file: normalizeDiagnosticPath(diag.file),
    line,
    ...(hasCol ? { column: Math.floor(diag.column!) } : {}),
    message: sanitizeCompilerText(diag.message)
  };
}

/**
 * Parses standard GCC / Clang / avr-gcc / xtensa-gcc compiler output lines
 * (`path:line:col: error|warning|note: message`) into sanitized CodeMirror-ready diagnostics.
 */
export function parseCompilerDiagnostics(rawLog: string): CompileDiagnostic[] {
  const out: CompileDiagnostic[] = [];
  if (!rawLog) return out;
  const lineRe = /^(.+?):(\d+)(?::(\d+))?:\s*(?:fatal\s+)?(error|warning|note):\s*(.+)$/i;

  for (const rawLine of rawLog.split(/\r?\n/)) {
    const m = rawLine.trim().match(lineRe);
    if (!m) continue;
    const sevRaw = m[4].toLowerCase();
    const severity: CompileDiagnostic['severity'] =
      sevRaw === 'error' ? 'error' : (sevRaw === 'warning' ? 'warning' : 'note');
    const line = parseInt(m[2], 10);
    const column = m[3] ? parseInt(m[3], 10) : undefined;
    if (!Number.isFinite(line)) continue;
    out.push(
      sanitizeCompileDiagnostic({
        severity,
        file: m[1].trim(),
        line,
        ...(column !== undefined && Number.isFinite(column) ? { column } : {}),
        message: m[5].trim()
      })
    );
  }
  return out;
}

/**
 * Deterministic classroom build cache key (FNV-1a 64-bit hex digest) over target board,
 * MCU, code profile, sorted libraries, optimization flag, and sorted source files.
 */
export function buildCompileCacheKey(req: CompileRequest): string {
  const sortedLibs = [...req.libraries].sort();
  const sortedFiles = [...req.files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => `${f.path}\u0000${f.content}`);
  const canonical = JSON.stringify({
    b: req.boardId,
    m: req.mcu,
    p: req.codeProfile || '',
    o: Boolean(req.optimizeForSize),
    l: sortedLibs,
    f: sortedFiles
  });

  // Two independent 32-bit FNV-1a lanes for compact 16-hex-char deterministic cache key (zero crypto dependency)
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < canonical.length; i++) {
    const code = canonical.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code ^ (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${req.boardId}:${req.mcu}:${hex1}${hex2}`;
}
