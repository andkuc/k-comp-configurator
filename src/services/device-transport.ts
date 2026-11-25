// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pluggable DeviceTransport Contract, Exclusive Serial Port State Machine & Non-Blocking Ringbuffers

export type FlashProtocolId = 'stk500v1' | 'esptool' | 'none';

/**
 * Explicit Web Serial port lifecycle preventing "Port is already open" races
 * when switching between Serial Monitor and Browser Flasher (STK500v1 / esptool-js).
 */
export type SerialPortState =
  | 'disconnected'
  | 'connecting'
  | 'monitoring'
  | 'releasing'
  | 'flashing'
  | 'reconnecting'
  | 'error';

/** Backward-compatible alias covering both legacy and explicit port states. */
export type ConnectionState = SerialPortState | 'connected';

export interface DeviceInfo {
  portLabel: string;
  usbVendorId?: number;
  usbProductId?: number;
  baudRate: number;
}

export interface FlashSegment {
  offset: number;
  data: Uint8Array;
}

export interface FlashProgress {
  phase: 'sync' | 'erase' | 'write' | 'verify' | 'reset';
  percent: number;
  message: string;
}

export interface DeviceTransport {
  readonly id: string;
  isSupported(): boolean;
  getState(): ConnectionState;
  connect(baudRate: number): Promise<DeviceInfo>;
  disconnect(): Promise<void>;
  writeText(text: string): Promise<void>;
  onLine(listener: (line: string) => void): () => void;
  flash(protocol: FlashProtocolId, segments: FlashSegment[], onProgress?: (p: FlashProgress) => void): Promise<void>;
}

export interface SerialPlotSample {
  timestampMs: number;
  channels: Record<string, number>;
}

const VALID_PORT_TRANSITIONS: Readonly<Record<SerialPortState, ReadonlyArray<SerialPortState>>> = {
  disconnected: ['connecting', 'flashing', 'error'],
  connecting: ['monitoring', 'disconnected', 'error'],
  monitoring: ['releasing', 'disconnected', 'error'],
  releasing: ['flashing', 'disconnected', 'error'],
  flashing: ['reconnecting', 'disconnected', 'error'],
  reconnecting: ['monitoring', 'disconnected', 'error'],
  error: ['disconnected', 'connecting']
};

export interface PortStateChangeEvent {
  previous: SerialPortState;
  current: SerialPortState;
  reason?: string;
}

/**
 * Deterministic exclusive-port state machine shared by Monitor & Flasher implementations.
 * Forces an explicit `monitoring -> releasing -> flashing -> reconnecting -> monitoring` handoff.
 */
export class SerialPortStateMachine {
  private current: SerialPortState = 'disconnected';
  private lastError: string | null = null;
  private listeners = new Set<(ev: PortStateChangeEvent) => void>();

  getState(): SerialPortState {
    return this.current;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  canTransition(next: SerialPortState): boolean {
    if (next === this.current) return true;
    return VALID_PORT_TRANSITIONS[this.current].includes(next);
  }

  transition(next: SerialPortState, reason?: string): SerialPortState {
    if (next === this.current) return this.current;
    if (!this.canTransition(next)) {
      throw new Error(`Invalid serial port state transition: ${this.current} -> ${next}`);
    }
    const previous = this.current;
    this.current = next;
    this.lastError = next === 'error' ? (reason || 'Serial port error') : null;
    const ev: PortStateChangeEvent = { previous, current: next, reason };
    for (const fn of Array.from(this.listeners)) {
      fn(ev);
    }
    return this.current;
  }

  onStateChange(listener: (ev: PortStateChangeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  reset(): void {
    this.current = 'disconnected';
    this.lastError = null;
    this.listeners.clear();
  }
}

/**
 * Fixed-capacity line ringbuffer for high-baudrate serial logs (up to 921600 baud on ESP32-S3)
 * preventing unbounded DOM/memory growth in browser monitors.
 */
export class SerialLogRingBuffer {
  private readonly capacity: number;
  private lines: string[] = [];
  private partial = '';
  private droppedCount = 0;

  constructor(capacity = 2000) {
    this.capacity = Math.max(10, Math.floor(capacity));
  }

  get maxLines(): number {
    return this.capacity;
  }

  get length(): number {
    return this.lines.length;
  }

  get dropped(): number {
    return this.droppedCount;
  }

  pushLine(line: string): void {
    this.lines.push(line);
    if (this.lines.length > this.capacity) {
      const overflow = this.lines.length - this.capacity;
      this.lines.splice(0, overflow);
      this.droppedCount += overflow;
    }
  }

  /** Appends an arbitrary UTF-8 stream chunk and returns the newly completed lines. */
  pushChunk(chunk: string): string[] {
    if (!chunk) return [];
    const normalized = (this.partial + chunk).replaceAll('\r\n', '\n').replaceAll('\r', '\n');
    const parts = normalized.split('\n');
    this.partial = parts.pop() ?? '';
    for (const line of parts) {
      this.pushLine(line);
    }
    return parts;
  }

  getLines(): ReadonlyArray<string> {
    return this.lines;
  }

  clear(): void {
    this.lines = [];
    this.partial = '';
    this.droppedCount = 0;
  }
}

/**
 * Fixed-capacity telemetry sample ringbuffer for Canvas 2D Live-Plotter views.
 */
export class SerialPlotRingBuffer {
  private readonly capacity: number;
  private samples: SerialPlotSample[] = [];
  private channelOrder: string[] = [];

  constructor(capacity = 600) {
    this.capacity = Math.max(10, Math.floor(capacity));
  }

  get length(): number {
    return this.samples.length;
  }

  push(sample: SerialPlotSample): void {
    for (const ch of Object.keys(sample.channels)) {
      if (!this.channelOrder.includes(ch)) {
        this.channelOrder.push(ch);
      }
    }
    this.samples.push(sample);
    if (this.samples.length > this.capacity) {
      this.samples.splice(0, this.samples.length - this.capacity);
    }
  }

  getChannels(): ReadonlyArray<string> {
    return this.channelOrder;
  }

  getSamples(): ReadonlyArray<SerialPlotSample> {
    return this.samples;
  }

  clear(): void {
    this.samples = [];
    this.channelOrder = [];
  }
}

/**
 * Pure parser for Live-Plotter serial telemetry lines.
 * Supports:
 *   - Named key:value pairs: "temp:23.4,hum:58.1" or "x=12 y=-4 z=980"
 *   - Plain numeric CSV/TSV: "512, 1023, 3.14" -> { ch1: 512, ch2: 1023, ch3: 3.14 }
 * Returns null for non-numeric log lines.
 */
export function parseSerialPlotLine(line: string, timestampMs: number = Date.now()): SerialPlotSample | null {
  const clean = line.trim();
  if (!clean) return null;

  const channels: Record<string, number> = {};
  const tokens = clean.split(/[,;\t\s]+/).filter(Boolean);
  let unnamedIdx = 1;

  for (const tok of tokens) {
    const kv = tok.match(/^([A-Za-z_][A-Za-z0-9_-]{0,23})[:=](-?\d+(?:\.\d+)?)$/);
    if (kv) {
      const val = Number(kv[2]);
      if (Number.isFinite(val)) {
        channels[kv[1]] = val;
        continue;
      }
    }
    if (/^-?\d+(?:\.\d+)?$/.test(tok)) {
      const val = Number(tok);
      if (Number.isFinite(val)) {
        channels[`ch${unnamedIdx++}`] = val;
        continue;
      }
    }
    return null;
  }

  return Object.keys(channels).length > 0 ? { timestampMs, channels } : null;
}

export function isWebSerialAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}
