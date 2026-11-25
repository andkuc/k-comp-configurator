// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pluggable CompilerProvider Contract (Docker Compile Server / Future Offline Desktop Wrapper)
import type { McuArchitecture } from '../types';

export interface CompileSourceFile {
  path: string;
  content: string;
}

export interface CompileRequest {
  boardId: string;
  mcu: McuArchitecture;
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

export interface CompileArtifact {
  format: 'hex' | 'bin';
  filename: string;
  data: Uint8Array;
  flashOffset?: number;
}

export interface CompileResult {
  ok: boolean;
  durationMs: number;
  diagnostics: CompileDiagnostic[];
  artifacts: CompileArtifact[];
  flashBytesUsed?: number;
  ramBytesUsed?: number;
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
