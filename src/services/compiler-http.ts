// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Headless Multi-Server HttpCompilerProvider (/api/v1/health & /api/v1/compile, LRU Cache, Base64->FirmwareArtifact)
import {
  buildCompileCacheKey,
  normalizeCompilerServerUrl,
  parseCompilerDiagnostics,
  sanitizeCompileDiagnostic,
  sanitizeCompilerText,
  type CompileArtifact,
  type CompileDiagnostic,
  type CompileMemoryUsage,
  type CompileOptions,
  type CompileRequest,
  type CompileResult,
  type CompilerHealthStatus,
  type CompilerProvider,
  type CompilerQueueStatus,
  type CompilerServerProfile
} from './compiler-provider';
import {
  createAbortError,
  createEspMultiSegmentArtifact,
  createIHexArtifact,
  type FirmwareArtifact,
  type FirmwareSegment
} from './flash';

export interface ApiV1HealthResponse {
  ok: boolean;
  apiVersion?: string;
  serverVersion?: string;
  boards?: string[];
  librariesHash?: string;
  queue?: CompilerQueueStatus;
  authRequired?: boolean;
  error?: string;
}

export interface ApiV1ArtifactSegment {
  offset: number;
  label?: string;
  dataBase64: string;
  sha256?: string;
}

export interface ApiV1ArtifactPayload {
  format: 'ihex' | 'esp-segments';
  filename: string;
  rawHex?: string;
  segments: ApiV1ArtifactSegment[];
  /** Reserved optional fields for future browser-emulator integration. */
  elfBase64?: string;
  symbols?: Record<string, number>;
}

export interface ApiV1CompileResponse {
  ok: boolean;
  cached?: boolean;
  durationMs?: number;
  boardId?: string;
  diagnostics?: CompileDiagnostic[];
  memory?: CompileMemoryUsage;
  artifact?: ApiV1ArtifactPayload;
  rawLog?: string;
  error?: string;
}

export interface HttpCompilerProviderOptions {
  profile: CompilerServerProfile;
  fetchImpl?: typeof fetch;
  healthTimeoutMs?: number;
  compileTimeoutMs?: number;
  maxCacheEntries?: number;
}

const DEFAULT_HEALTH_TIMEOUT_MS = 5000;
const DEFAULT_COMPILE_TIMEOUT_MS = 90000;
const DEFAULT_MAX_CACHE_ENTRIES = 16;

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Pure zero-dependency Base64 decoder (works identically in Browser, jsdom & Node). */
export function decodeBase64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/\s+/g, '');
  if (!clean) return new Uint8Array(0);
  if (typeof atob === 'function') {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i) & 0xff;
    }
    return out;
  }

  // Fallback pure decoder
  const len = clean.length;
  const pad = clean.endsWith('==') ? 2 : (clean.endsWith('=') ? 1 : 0);
  const out = new Uint8Array(Math.floor((len * 3) / 4) - pad);
  let outIdx = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = BASE64_ALPHABET.indexOf(clean[i]);
    const c1 = BASE64_ALPHABET.indexOf(clean[i + 1]);
    const c2 = clean[i + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(clean[i + 2]);
    const c3 = clean[i + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(clean[i + 3]);
    const triplet = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (outIdx < out.length) out[outIdx++] = (triplet >> 16) & 0xff;
    if (outIdx < out.length) out[outIdx++] = (triplet >> 8) & 0xff;
    if (outIdx < out.length) out[outIdx++] = triplet & 0xff;
  }
  return out;
}

function bytesToUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder === 'function') {
    return new TextDecoder().decode(bytes);
  }
  let out = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function sanitizeSymbolsMap(raw?: Record<string, number>): Readonly<Record<string, number>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      clean[k] = v;
    }
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

/**
 * Converts a versioned `/api/v1/compile` artifact payload (Base64 segments / rawHex)
 * into a canonical `FirmwareArtifact` plus `CompileArtifact[]` entries.
 */
export function decodeApiArtifactToFirmwareArtifact(
  payload: ApiV1ArtifactPayload,
  boardId?: string
): { firmwareArtifact: FirmwareArtifact; artifacts: CompileArtifact[] } {
  const filename = payload.filename || (payload.format === 'ihex' ? 'firmware.hex' : 'firmware.bin');
  const elf = payload.elfBase64 ? decodeBase64ToBytes(payload.elfBase64) : undefined;
  const symbols = sanitizeSymbolsMap(payload.symbols);

  if (payload.format === 'ihex') {
    let rawHex = typeof payload.rawHex === 'string' ? payload.rawHex : '';
    if (!rawHex && Array.isArray(payload.segments) && payload.segments.length > 0) {
      rawHex = bytesToUtf8(decodeBase64ToBytes(payload.segments[0].dataBase64));
    }
    const base = createIHexArtifact(rawHex, filename, boardId);
    const firmwareArtifact: FirmwareArtifact = {
      ...base,
      ...(elf ? { elf } : {}),
      ...(symbols ? { symbols } : {})
    };
    const rawHexBytes =
      typeof TextEncoder === 'function'
        ? new TextEncoder().encode(firmwareArtifact.rawHex)
        : new Uint8Array(firmwareArtifact.rawHex.length);
    return {
      firmwareArtifact,
      artifacts: [
        {
          format: 'ihex',
          filename: firmwareArtifact.filename,
          data: rawHexBytes,
          address: 0
        }
      ]
    };
  }

  if (payload.format === 'esp-segments') {
    const rawSegs = Array.isArray(payload.segments) ? payload.segments : [];
    const segments: FirmwareSegment[] = rawSegs.map((seg) => ({
      offset: seg.offset,
      data: decodeBase64ToBytes(seg.dataBase64),
      ...(seg.label ? { label: seg.label } : {}),
      ...(seg.sha256 ? { sha256: seg.sha256 } : {})
    }));
    const base = createEspMultiSegmentArtifact(segments, filename, boardId);
    const firmwareArtifact: FirmwareArtifact = {
      ...base,
      ...(elf ? { elf } : {}),
      ...(symbols ? { symbols } : {})
    };
    const artifacts: CompileArtifact[] = firmwareArtifact.segments.map((seg) => ({
      format: 'bin',
      filename: seg.label ? `${seg.label}.bin` : firmwareArtifact.filename,
      data: seg.data,
      address: seg.offset
    }));
    return { firmwareArtifact, artifacts };
  }

  throw new Error(`Unsupported artifact format returned by compile server: ${String((payload as { format?: unknown }).format)}`);
}

function createTimedSignal(
  timeoutMs: number,
  externalSignal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void; wasTimeout: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = (): void => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(100, timeoutMs));

  return {
    signal: controller.signal,
    wasTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  };
}

function normalizeMemoryUsage(raw?: CompileMemoryUsage): CompileMemoryUsage | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  if (
    typeof raw.flashUsed === 'number' &&
    typeof raw.flashMax === 'number' &&
    typeof raw.ramUsed === 'number' &&
    typeof raw.ramMax === 'number'
  ) {
    return {
      flashUsed: Math.max(0, Math.round(raw.flashUsed)),
      flashMax: Math.max(1, Math.round(raw.flashMax)),
      ramUsed: Math.max(0, Math.round(raw.ramUsed)),
      ramMax: Math.max(1, Math.round(raw.ramMax))
    };
  }
  return undefined;
}

export class HttpCompilerProvider implements CompilerProvider {
  public readonly id: string;
  public readonly name: string;

  private readonly profile: CompilerServerProfile;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly healthTimeoutMs: number;
  private readonly compileTimeoutMs: number;
  private readonly maxCacheEntries: number;

  private supportedBoards: string[] = [];
  private librariesHash = 'unknown';
  private lastHealth: CompilerHealthStatus | null = null;
  private readonly cache = new Map<string, CompileResult>();

  constructor(options: HttpCompilerProviderOptions) {
    const normalized = normalizeCompilerServerUrl(options.profile.url);
    if (!normalized) {
      throw new Error(`Invalid compile server URL: "${options.profile.url}"`);
    }
    this.profile = { ...options.profile, url: normalized };
    this.id = this.profile.id;
    this.name = this.profile.label || normalized;
    this.baseUrl = normalized;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.healthTimeoutMs = options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;
    this.compileTimeoutMs = options.compileTimeoutMs ?? DEFAULT_COMPILE_TIMEOUT_MS;
    this.maxCacheEntries = Math.max(1, options.maxCacheEntries ?? DEFAULT_MAX_CACHE_ENTRIES);
  }

  getProfile(): CompilerServerProfile {
    return { ...this.profile };
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getLastHealth(): CompilerHealthStatus | null {
    return this.lastHealth ? { ...this.lastHealth } : null;
  }

  getLibrariesHash(): string {
    return this.librariesHash;
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  clearCache(): void {
    this.cache.clear();
  }

  listSupportedBoards(): string[] {
    return [...this.supportedBoards];
  }

  private buildHeaders(includeJsonContentType: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json'
    };
    if (includeJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.profile.authToken && this.profile.authToken.trim()) {
      headers.Authorization = `Bearer ${this.profile.authToken.trim()}`;
    }
    return headers;
  }

  private buildFullCacheKey(req: CompileRequest): string {
    return `${this.id}::${this.librariesHash}::${buildCompileCacheKey(req)}`;
  }

  private getCached(key: string): CompileResult | null {
    const hit = this.cache.get(key);
    if (!hit) return null;
    // Refresh LRU recency
    this.cache.delete(key);
    this.cache.set(key, hit);
    return {
      ...hit,
      cacheHit: true,
      durationMs: 0
    };
  }

  private putCached(key: string, result: CompileResult): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, result);
  }

  async checkHealth(signal?: AbortSignal): Promise<CompilerHealthStatus> {
    const started = Date.now();
    const timed = createTimedSignal(this.healthTimeoutMs, signal);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/v1/health`, {
        method: 'GET',
        headers: this.buildHeaders(false),
        signal: timed.signal
      });
      const latencyMs = Math.max(0, Date.now() - started);

      if (res.status === 401 || res.status === 403) {
        const status: CompilerHealthStatus = {
          online: false,
          providerName: this.name,
          authRequired: true,
          latencyMs,
          message: `HTTP ${res.status}: Authentication required or invalid Bearer token.`
        };
        this.lastHealth = status;
        return status;
      }

      if (!res.ok) {
        const status: CompilerHealthStatus = {
          online: false,
          providerName: this.name,
          latencyMs,
          message: `HTTP ${res.status} (${res.statusText || 'Health check failed'})`
        };
        this.lastHealth = status;
        return status;
      }

      const data = (await res.json()) as ApiV1HealthResponse;
      const boards = Array.isArray(data.boards)
        ? data.boards.filter((b): b is string => typeof b === 'string' && b.length > 0)
        : [];
      const nextLibHash = typeof data.librariesHash === 'string' && data.librariesHash ? data.librariesHash : 'unknown';

      if (this.librariesHash !== 'unknown' && nextLibHash !== this.librariesHash) {
        this.cache.clear();
      }
      this.librariesHash = nextLibHash;
      this.supportedBoards = boards;

      const status: CompilerHealthStatus = {
        online: Boolean(data.ok),
        providerName: this.name,
        version: data.serverVersion || data.apiVersion,
        apiVersion: data.apiVersion,
        serverVersion: data.serverVersion,
        boards,
        librariesHash: nextLibHash,
        queue: data.queue,
        authRequired: Boolean(data.authRequired),
        latencyMs,
        ...(data.error ? { message: sanitizeCompilerText(data.error) } : {})
      };
      this.lastHealth = status;
      return status;
    } catch (err: unknown) {
      const latencyMs = Math.max(0, Date.now() - started);
      if (signal?.aborted) {
        throw createAbortError('Health check aborted.');
      }
      const msg = timed.wasTimeout()
        ? `Server timed out after ${this.healthTimeoutMs} ms.`
        : sanitizeCompilerText(err instanceof Error ? err.message : String(err));
      const status: CompilerHealthStatus = {
        online: false,
        providerName: this.name,
        latencyMs,
        message: msg || 'Compile server unreachable.'
      };
      this.lastHealth = status;
      return status;
    } finally {
      timed.cleanup();
    }
  }

  async compile(request: CompileRequest, options: CompileOptions = {}): Promise<CompileResult> {
    if (options.signal?.aborted) {
      throw createAbortError('Compilation aborted.');
    }

    const cacheKey = this.buildFullCacheKey(request);
    if (!options.bypassCache) {
      const cached = this.getCached(cacheKey);
      if (cached) return cached;
    }

    const started = Date.now();
    const timed = createTimedSignal(this.compileTimeoutMs, options.signal);

    try {
      // Declarative API contract: send canonical boardId & source files only (never raw FQBN or flags)
      const bodyPayload = {
        boardId: request.boardId,
        ...(request.codeProfile ? { codeProfile: request.codeProfile } : {}),
        files: request.files.map((f) => ({ path: f.path, content: f.content })),
        optimizeForSize: Boolean(request.optimizeForSize)
      };

      const res = await this.fetchImpl(`${this.baseUrl}/api/v1/compile`, {
        method: 'POST',
        headers: this.buildHeaders(true),
        body: JSON.stringify(bodyPayload),
        signal: timed.signal
      });

      const elapsedMs = Math.max(0, Date.now() - started);

      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          durationMs: elapsedMs,
          boardId: request.boardId,
          diagnostics: [],
          artifacts: [],
          error: `HTTP ${res.status}: Authentication required or invalid Bearer token.`
        };
      }

      if (res.status === 429) {
        return {
          ok: false,
          durationMs: elapsedMs,
          boardId: request.boardId,
          diagnostics: [],
          artifacts: [],
          error: 'HTTP 429: Compile server queue is full — please retry in a few seconds.'
        };
      }

      let data: ApiV1CompileResponse | null = null;
      try {
        data = (await res.json()) as ApiV1CompileResponse;
      } catch {
        data = null;
      }

      if (!res.ok && (!data || typeof data.ok !== 'boolean')) {
        return {
          ok: false,
          durationMs: elapsedMs,
          boardId: request.boardId,
          diagnostics: [],
          artifacts: [],
          error: sanitizeCompilerText(data?.error || `HTTP ${res.status}: Compile request failed.`)
        };
      }

      const payload = data!;
      const rawDiagnostics = Array.isArray(payload.diagnostics)
        ? payload.diagnostics.map((d) => sanitizeCompileDiagnostic(d))
        : (payload.rawLog ? parseCompilerDiagnostics(payload.rawLog) : []);
      const memory = normalizeMemoryUsage(payload.memory);
      const durationMs = typeof payload.durationMs === 'number' && Number.isFinite(payload.durationMs)
        ? Math.max(0, Math.round(payload.durationMs))
        : elapsedMs;

      let firmwareArtifact: FirmwareArtifact | undefined;
      let artifacts: CompileArtifact[] = [];
      if (payload.ok && payload.artifact) {
        const decoded = decodeApiArtifactToFirmwareArtifact(payload.artifact, payload.boardId || request.boardId);
        firmwareArtifact = decoded.firmwareArtifact;
        artifacts = decoded.artifacts;
      }

      const result: CompileResult = {
        ok: Boolean(payload.ok),
        durationMs,
        boardId: payload.boardId || request.boardId,
        diagnostics: rawDiagnostics,
        artifacts,
        ...(firmwareArtifact ? { firmwareArtifact } : {}),
        ...(memory ? { memory, flashBytesUsed: memory.flashUsed, ramBytesUsed: memory.ramUsed } : {}),
        cacheHit: Boolean(payload.cached),
        ...(payload.rawLog ? { rawLog: sanitizeCompilerText(payload.rawLog) } : {}),
        ...(payload.error ? { error: sanitizeCompilerText(payload.error) } : {})
      };

      if (result.ok && result.firmwareArtifact) {
        this.putCached(cacheKey, result);
      }

      return result;
    } catch (err: unknown) {
      if (options.signal?.aborted) {
        throw createAbortError('Compilation aborted.');
      }
      const elapsedMs = Math.max(0, Date.now() - started);
      const message = timed.wasTimeout()
        ? `Compilation timed out after ${Math.round(this.compileTimeoutMs / 1000)} s.`
        : sanitizeCompilerText(err instanceof Error ? err.message : String(err));
      return {
        ok: false,
        durationMs: elapsedMs,
        boardId: request.boardId,
        diagnostics: [],
        artifacts: [],
        error: message || 'Compile server unreachable.'
      };
    } finally {
      timed.cleanup();
    }
  }
}

export function createHttpCompilerProvider(
  profile: CompilerServerProfile,
  opts: Omit<HttpCompilerProviderOptions, 'profile'> = {}
): HttpCompilerProvider {
  return new HttpCompilerProvider({ profile, ...opts });
}

/** One-shot health probe for testing a server profile inside the Settings modal. */
export async function probeCompilerServer(
  profile: CompilerServerProfile,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<CompilerHealthStatus> {
  try {
    const provider = new HttpCompilerProvider({
      profile,
      fetchImpl: opts.fetchImpl,
      healthTimeoutMs: opts.timeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS
    });
    return await provider.checkHealth(opts.signal);
  } catch (err: unknown) {
    return {
      online: false,
      providerName: profile.label || profile.url,
      message: err instanceof Error ? err.message : String(err)
    };
  }
}
