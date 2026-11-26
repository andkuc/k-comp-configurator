// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pluggable CompilerProvider Contract (Multi-Segment Firmware Manifest, Diagnostics Parser & Build Cache Key)
import type { CodeProfileId, McuArchitecture } from '../types';

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
  flashBytesUsed?: number;
  ramBytesUsed?: number;
  cacheHit?: boolean;
  rawLog?: string;
}

export interface CompilerHealthStatus {
  online: boolean;
  providerName: string;
  version?: string;
  message?: string;
}

export interface CompilerProvider {
  readonly id: string;
  readonly name: string;
  checkHealth(): Promise<CompilerHealthStatus>;
  listSupportedBoards(): string[];
  compile(request: CompileRequest): Promise<CompileResult>;
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
 * Parses standard GCC / Clang / avr-gcc / xtensa-gcc compiler output lines
 * (`path:line:col: error|warning|note: message`) into structured CodeMirror-ready diagnostics.
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
    out.push({
      severity,
      file: m[1].trim(),
      line,
      ...(column !== undefined && Number.isFinite(column) ? { column } : {}),
      message: m[5].trim()
    });
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
