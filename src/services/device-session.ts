// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Persistent Device Session Controller (Survives Workspace Switches, Ringbuffers, History & Exports)
import type { McuArchitecture } from '../types';
import {
  SerialLogRingBuffer,
  SerialPlotRingBuffer,
  parseSerialPlotLine,
  type DeviceInfo,
  type SerialPlotSample,
  type SerialPortState
} from './device-transport';
import { WebSerialTransport, type WebSerialTransportOptions } from './web-serial-transport';
import { SimulatorTransport, type SimulatorContextSnapshot } from './simulator-transport';

export type LineEndingMode = 'lf' | 'crlf' | 'none';
export type DeviceTransportMode = 'none' | 'web-serial' | 'simulator';

export interface SerialLogEntry {
  readonly id: number;
  readonly timestampMs: number;
  readonly dir: 'rx' | 'tx' | 'sys' | 'err';
  readonly text: string;
}

export interface DeviceSessionSnapshot {
  readonly mode: DeviceTransportMode;
  readonly portState: SerialPortState;
  readonly deviceInfo: DeviceInfo | null;
  readonly baudRate: number;
  readonly paused: boolean;
  readonly showTimestamps: boolean;
  readonly lineEnding: LineEndingMode;
  readonly rxBytesTotal: number;
  readonly rxLinesTotal: number;
  readonly droppedLines: number;
  readonly lastError: string | null;
  readonly plotChannels: ReadonlyArray<string>;
  readonly latestSample: SerialPlotSample | null;
  readonly sampleCount: number;
}

export type DeviceSessionListener = (snapshot: DeviceSessionSnapshot) => void;

export const COMMON_BAUD_RATES: ReadonlyArray<number> = [
  9600,
  19200,
  38400,
  57600,
  115200,
  230400,
  250000,
  460800,
  921600
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

const EPOCH_ORIGIN_MS = Date.now() - (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : 0);

function monotonicNowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return EPOCH_ORIGIN_MS + performance.now();
  }
  return Date.now();
}

export function formatTimestampMs(tsMs: number): string {
  const d = new Date(tsMs);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
}

export class DeviceSessionController {
  private readonly maxLogEntries: number;
  private readonly rawRing: SerialLogRingBuffer;
  private readonly plotRing: SerialPlotRingBuffer;
  private entries: SerialLogEntry[] = [];
  private nextEntryId = 1;

  private mode: DeviceTransportMode = 'none';
  private portState: SerialPortState = 'disconnected';
  private deviceInfo: DeviceInfo | null = null;
  private baudRate = 115200;
  private paused = false;
  private showTimestamps = true;
  private lineEnding: LineEndingMode = 'lf';
  private rxBytesTotal = 0;
  private rxLinesTotal = 0;
  private lastError: string | null = null;

  private txHistory: string[] = [];
  private activeWebSerial: WebSerialTransport | null = null;
  private activeSimulator: SimulatorTransport | null = null;
  private transportUnsubs: Array<() => void> = [];
  private listeners = new Set<DeviceSessionListener>();

  constructor(maxLogEntries = 2000, maxPlotSamples = 6000) {
    this.maxLogEntries = Math.max(20, maxLogEntries);
    this.rawRing = new SerialLogRingBuffer(this.maxLogEntries);
    this.plotRing = new SerialPlotRingBuffer(maxPlotSamples);
  }

  getSnapshot(): DeviceSessionSnapshot {
    const samples = this.plotRing.getSamples();
    return {
      mode: this.mode,
      portState: this.portState,
      deviceInfo: this.deviceInfo ? { ...this.deviceInfo } : null,
      baudRate: this.baudRate,
      paused: this.paused,
      showTimestamps: this.showTimestamps,
      lineEnding: this.lineEnding,
      rxBytesTotal: this.rxBytesTotal,
      rxLinesTotal: this.rxLinesTotal,
      droppedLines: this.rawRing.dropped,
      lastError: this.lastError,
      plotChannels: this.plotRing.getChannels(),
      latestSample: samples.length ? samples[samples.length - 1] : null,
      sampleCount: samples.length
    };
  }

  isConnected(): boolean {
    return this.portState === 'monitoring';
  }

  getEntries(): ReadonlyArray<SerialLogEntry> {
    return this.entries;
  }

  getPlotSamples(): ReadonlyArray<SerialPlotSample> {
    return this.plotRing.getSamples();
  }

  getPlotChannels(): ReadonlyArray<string> {
    return this.plotRing.getChannels();
  }

  getTxHistory(): ReadonlyArray<string> {
    return this.txHistory;
  }

  subscribe(listener: DeviceSessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const fn of Array.from(this.listeners)) {
      fn(snap);
    }
  }

  private appendEntry(dir: SerialLogEntry['dir'], text: string, timestampMs: number = Date.now()): void {
    const entry: SerialLogEntry = {
      id: this.nextEntryId++,
      timestampMs,
      dir,
      text
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxLogEntries) {
      this.entries.splice(0, this.entries.length - this.maxLogEntries);
    }
    this.rawRing.pushLine(text);
  }

  private detachTransportListeners(): void {
    for (const unsub of this.transportUnsubs) {
      try { unsub(); } catch (_) {}
    }
    this.transportUnsubs = [];
  }

  setBaudRate(baudRate: number): void {
    if (!Number.isFinite(baudRate) || baudRate <= 0) return;
    this.baudRate = Math.round(baudRate);
    this.notify();
  }

  setPaused(paused: boolean): void {
    this.paused = Boolean(paused);
    this.notify();
  }

  togglePaused(): boolean {
    this.paused = !this.paused;
    this.notify();
    return this.paused;
  }

  setShowTimestamps(show: boolean): void {
    this.showTimestamps = Boolean(show);
    this.notify();
  }

  setLineEnding(mode: LineEndingMode): void {
    this.lineEnding = mode;
    this.notify();
  }

  private bindIncomingStreams(
    onLine: (fn: (line: string) => void) => () => void,
    onBytes: (fn: (n: number) => void) => () => void,
    onState: (fn: (ev: { current: SerialPortState; reason?: string }) => void) => () => void
  ): void {
    this.detachTransportListeners();

    this.transportUnsubs.push(onBytes((n) => {
      this.rxBytesTotal += n;
    }));

    this.transportUnsubs.push(onLine((line) => {
      if (this.paused) return;
      const now = monotonicNowMs();
      this.rxLinesTotal++;
      this.appendEntry('rx', line, Math.round(now));
      const sample = parseSerialPlotLine(line, now);
      if (sample) {
        this.plotRing.push(sample);
      }
      this.notify();
    }));

    this.transportUnsubs.push(onState((ev) => {
      this.portState = ev.current;
      if (ev.current === 'error') {
        this.lastError = ev.reason || 'Serial error';
        this.appendEntry('err', `[ERROR] ${this.lastError}`);
      } else if (ev.current === 'disconnected') {
        this.mode = 'none';
        this.deviceInfo = null;
        if (ev.reason) {
          this.appendEntry('sys', `[SYS] ${ev.reason}`);
        }
      }
      this.notify();
    }));
  }

  async connectWebSerial(baudRate: number = this.baudRate, opts: WebSerialTransportOptions = {}): Promise<DeviceInfo> {
    await this.disconnect();
    this.baudRate = Math.round(baudRate);
    this.lastError = null;

    const transport = new WebSerialTransport(opts);
    this.activeWebSerial = transport;
    this.mode = 'web-serial';
    this.bindIncomingStreams(
      (fn) => transport.onLine(fn),
      (fn) => transport.onBytesReceived(fn),
      (fn) => transport.onStateChange(fn)
    );

    try {
      const info = await transport.connect(this.baudRate);
      this.deviceInfo = info;
      this.portState = transport.getState();
      this.appendEntry('sys', `[SYS] Connected: ${info.portLabel} @ ${info.baudRate} baud`);
      this.notify();
      return info;
    } catch (err: unknown) {
      this.deviceInfo = null;
      this.portState = transport.getState();
      const isCancel = err instanceof Error && err.name === 'NotFoundError';
      if (isCancel) {
        this.mode = 'none';
      } else {
        this.lastError = err instanceof Error ? err.message : String(err);
      }
      this.notify();
      throw err;
    }
  }

  async connectSimulator(
    contextProvider: () => SimulatorContextSnapshot,
    baudRate: number = this.baudRate,
    intervalMs = 120
  ): Promise<DeviceInfo> {
    await this.disconnect();
    this.baudRate = Math.round(baudRate);
    this.lastError = null;

    const sim = new SimulatorTransport(contextProvider, intervalMs);
    this.activeSimulator = sim;
    this.mode = 'simulator';
    this.bindIncomingStreams(
      (fn) => sim.onLine(fn),
      (fn) => sim.onBytesReceived(fn),
      (fn) => sim.onStateChange(fn)
    );

    const info = await sim.connect(this.baudRate);
    this.deviceInfo = info;
    this.portState = sim.getState();
    this.notify();
    return info;
  }

  async disconnect(): Promise<void> {
    const wasConnected = this.portState === 'monitoring' || this.portState === 'connecting';
    const web = this.activeWebSerial;
    const sim = this.activeSimulator;
    this.activeWebSerial = null;
    this.activeSimulator = null;

    if (web) {
      try { await web.disconnect(); } catch (_) {}
    }
    if (sim) {
      try { await sim.disconnect(); } catch (_) {}
    }

    this.detachTransportListeners();
    this.mode = 'none';
    this.portState = 'disconnected';
    this.deviceInfo = null;
    if (wasConnected) {
      this.appendEntry('sys', '[SYS] Disconnected.');
    }
    this.notify();
  }

  async sendText(rawText: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to a serial device.');
    }
    const suffix = this.lineEnding === 'crlf' ? '\r\n' : (this.lineEnding === 'lf' ? '\n' : '');
    const payload = rawText + suffix;

    if (rawText.length > 0 && this.txHistory[this.txHistory.length - 1] !== rawText) {
      this.txHistory.push(rawText);
      if (this.txHistory.length > 50) this.txHistory.shift();
    }

    this.appendEntry('tx', rawText);
    if (this.mode === 'web-serial' && this.activeWebSerial) {
      await this.activeWebSerial.writeText(payload);
    } else if (this.mode === 'simulator' && this.activeSimulator) {
      await this.activeSimulator.writeText(payload);
    }
    this.notify();
  }

  async resetBoard(mcu: McuArchitecture): Promise<void> {
    if (!this.isConnected()) return;
    if (this.mode === 'web-serial' && this.activeWebSerial) {
      this.appendEntry('sys', `[SYS] Reset pulse sent (${mcu}).`);
      await this.activeWebSerial.resetBoard(mcu);
    } else if (this.mode === 'simulator' && this.activeSimulator) {
      await this.activeSimulator.resetBoard();
    }
    this.notify();
  }

  clear(): void {
    this.entries = [];
    this.rawRing.clear();
    this.plotRing.clear();
    this.rxBytesTotal = 0;
    this.rxLinesTotal = 0;
    this.notify();
  }

  exportLogText(): string {
    return this.entries
      .map((e) => {
        const prefix = this.showTimestamps ? `[${formatTimestampMs(e.timestampMs)}] ` : '';
        const tag = e.dir === 'tx' ? '> ' : '';
        return `${prefix}${tag}${e.text}`;
      })
      .join('\n');
  }

  exportPlotCsv(): string {
    const channels = this.plotRing.getChannels();
    const samples = this.plotRing.getSamples();
    if (!channels.length || !samples.length) return '';
    const header = ['timestamp_ms', ...channels].join(',');
    const rows = samples.map((s) => {
      const vals = channels.map((ch) => (ch in s.channels ? String(s.channels[ch]) : ''));
      return [String(s.timestampMs), ...vals].join(',');
    });
    return [header, ...rows].join('\n');
  }

  async resetForTests(): Promise<void> {
    await this.disconnect();
    this.clear();
    this.txHistory = [];
    this.paused = false;
    this.showTimestamps = true;
    this.lineEnding = 'lf';
    this.baudRate = 115200;
    this.lastError = null;
    this.listeners.clear();
  }
}

/** Application-wide singleton so active USB connections survive switching between Hardware and Device tabs. */
export const deviceSession = new DeviceSessionController();
