// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pluggable DeviceTransport Contract (Web Serial Monitor, Live Plotter & Browser Flashers)

export type FlashProtocolId = 'stk500v1' | 'esptool' | 'none';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'flashing' | 'error';

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
  const tokens = clean.split(/[,;	\s]+/).filter(Boolean);
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
    // Non-numeric text token means this is a plain log message, not a pure plotter frame
    return null;
  }

  return Object.keys(channels).length > 0 ? { timestampMs, channels } : null;
}

export function isWebSerialAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}
