// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Persistent Device Session Controller (Survives Workspace Switches, Ringbuffers, History & Exports)
import type { BoardProfile, McuArchitecture } from '../types';
import {
  SerialLogRingBuffer,
  SerialPlotRingBuffer,
  parseSerialPlotLine,
  type DeviceInfo,
  type FlashProgress,
  type SerialPlotSample,
  type SerialPortState
} from './device-transport';
import {
  SimulatorFlasher,
  flashStrategyRegistry,
  isEspNativeUsbPort,
  isMcp2221UsbPort,
  triggerPairedMcp2221Reset,
  type FirmwareArtifact,
  type FlashResult,
  type FlashRunOptions,
  type FlashStrategy
} from './flash';
import { getNavigatorSerial, type WebSerialNavigatorApi } from './web-serial-types';
import { WebSerialTransport, type WebSerialTransportOptions } from './web-serial-transport';
import { SimulatorTransport, type SimulatorContextSnapshot } from './simulator-transport';
import { parseKTestLine, type SelfTestFrame } from './selftest-runner';

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
  readonly flashActive: boolean;
  readonly flashProgress: FlashProgress | null;
  readonly latestSelfTestFrame: SelfTestFrame | null;
}

export interface SessionFlashOptions extends FlashRunOptions {
  /** Optional custom strategy override (useful for deterministic unit tests). */
  strategy?: FlashStrategy;
  /** Optional Web Serial API injection when flashing directly without an open monitor. */
  serialApi?: WebSerialNavigatorApi | null;
  /** Optional step delay in ms for SimulatorFlasher (useful for fast unit tests). */
  simStepDelayMs?: number;
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
  private flashActive = false;
  private flashProgress: FlashProgress | null = null;
  private flashAbortController: AbortController | null = null;
  private latestSelfTestFrame: SelfTestFrame | null = null;

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
      sampleCount: samples.length,
      flashActive: this.flashActive,
      flashProgress: this.flashProgress ? { ...this.flashProgress } : null,
      latestSelfTestFrame: this.latestSelfTestFrame
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
      const ktest = parseKTestLine(line, Math.round(now));
      if (ktest) {
        this.latestSelfTestFrame = ktest;
      } else {
        const sample = parseSerialPlotLine(line, now);
        if (sample) {
          this.plotRing.push(sample);
        }
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

  logSystem(message: string): void {
    this.appendEntry('sys', message);
    this.notify();
  }

  logError(message: string): void {
    this.appendEntry('err', message);
    this.notify();
  }

  async resetBoard(mcu: McuArchitecture): Promise<void> {
    if (!this.isConnected()) return;
    if (this.mode === 'web-serial' && this.activeWebSerial) {
      const info = this.deviceInfo;
      if (info && isMcp2221UsbPort(info)) {
        try {
          const hidRes = await triggerPairedMcp2221Reset();
          if (hidRes.triggered) {
            this.appendEntry('sys', '[SYS] MCP2221 WebHID GP3 reset pulse sent (100 ms LOW -> HIGH -> GPIO_IN).');
            this.notify();
            return;
          }
          this.appendEntry('sys', `[SYS] ${hidRes.note || 'MCP2221 WebHID reset unavailable.'}`);
          this.notify();
          return;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.appendEntry('err', `[SYS] MCP2221 WebHID reset failed: ${msg}`);
          this.notify();
          return;
        }
      }
      this.appendEntry('sys', `[SYS] Reset pulse sent (${mcu}).`);
      await this.activeWebSerial.resetBoard(mcu);
    } else if (this.mode === 'simulator' && this.activeSimulator) {
      await this.activeSimulator.resetBoard();
    }
    this.notify();
  }

  cancelFlash(): void {
    if (this.flashAbortController && !this.flashAbortController.signal.aborted) {
      this.flashAbortController.abort();
      this.appendEntry('sys', '[FLASH] Cancellation requested…');
      this.notify();
    }
  }

  /**
   * Flashes a canonical FirmwareArtifact using an exclusive port lease:
   * - Active Web Serial monitor: `monitoring -> releasing -> flashing -> reconnecting -> monitoring`
   *   (keeps the existing SerialPort handle — zero second browser port dialog).
   * - Active Demo Simulator: suspends telemetry, runs deterministic SimulatorFlasher, resumes telemetry.
   * - Disconnected: requests one Web Serial port directly, flashes, and closes cleanly.
   */
  async flashArtifact(
    artifact: FirmwareArtifact,
    board: BoardProfile,
    opts: SessionFlashOptions = {}
  ): Promise<FlashResult> {
    if (this.flashActive) {
      throw new Error('A flash operation is already in progress.');
    }

    const abortController = new AbortController();
    const externalSignal = opts.signal;
    const onExternalAbort = (): void => abortController.abort();
    if (externalSignal) {
      if (externalSignal.aborted) abortController.abort();
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    this.flashActive = true;
    this.flashAbortController = abortController;
    this.lastError = null;
    this.flashProgress = { phase: 'reset', percent: 0, message: `Preparing ${artifact.filename}…` };
    this.appendEntry('sys', `[FLASH] Starting upload of ${artifact.filename} (${artifact.byteLength} B) to ${board.shortName}…`);
    this.notify();

    const runOpts: FlashRunOptions = {
      verify: opts.verify,
      resetPreference: opts.resetPreference,
      autoResetDipOff: opts.autoResetDipOff,
      hidApi: opts.hidApi,
      signal: abortController.signal,
      onProgress: (p) => {
        this.flashProgress = { ...p };
        opts.onProgress?.(p);
        this.notify();
      },
      onLog: (msg, level = 'sys') => {
        this.appendEntry(level === 'err' ? 'err' : 'sys', msg);
        opts.onLog?.(msg, level);
        this.notify();
      }
    };

    try {
      // Path A: Demo Simulator active -> deterministic SimulatorFlasher with exclusive lease
      if (this.mode === 'simulator' && this.activeSimulator && this.portState === 'monitoring') {
        const sim = this.activeSimulator;
        const simFlasher = new SimulatorFlasher({ stepDelayMs: opts.simStepDelayMs });
        await sim.suspendForFlash();
        try {
          return await simFlasher.flash(board, artifact, runOpts);
        } finally {
          await sim.resumeAfterFlash();
        }
      }

      // Resolve hardware FlashStrategy from registry (or test override)
      const strategy = opts.strategy ?? flashStrategyRegistry.resolve(board, artifact);
      if (!strategy) {
        throw new Error(
          `No browser flasher registered for ${board.shortName} (${board.flashProfile?.protocol ?? board.targetMeta?.flashProtocol ?? 'none'}) with ${artifact.format} artifact.`
        );
      }

      // Path B: Active Web Serial monitor -> exclusive port lease without second port picker
      if (this.mode === 'web-serial' && this.activeWebSerial && this.portState === 'monitoring') {
        const web = this.activeWebSerial;
        const { port, baudRate } = await web.suspendForFlash();
        let flashErr: unknown = null;
        let result: FlashResult | null = null;
        try {
          result = await strategy.flash(port, board, artifact, runOpts);
        } catch (err: unknown) {
          flashErr = err;
        } finally {
          const nativeEspUsb = isEspNativeUsbPort(port);
          if (nativeEspUsb && result?.ok) {
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
          const tolerateReenum = nativeEspUsb && Boolean(result?.ok);
          try {
            await web.resumeAfterFlash(baudRate, tolerateReenum);
          } catch (resumeErr: unknown) {
            if (tolerateReenum) {
              // Native ESP32-S3 USB-Serial/JTAG often re-enumerates after hard_reset — flash itself succeeded!
              this.lastError = null;
              this.appendEntry(
                'sys',
                '[FLASH] Native USB device restarted after flash — click Connect USB if monitor did not auto-reconnect.'
              );
              await this.disconnect();
            } else if (!flashErr) {
              flashErr = resumeErr;
            } else {
              this.appendEntry(
                'err',
                `[FLASH] Monitor resume failed: ${resumeErr instanceof Error ? resumeErr.message : String(resumeErr)}`
              );
            }
          }
        }
        if (flashErr) throw flashErr;
        return result!;
      }

      // Path C: Disconnected -> one-shot Web Serial port request for direct flash
      const api = opts.serialApi !== undefined ? opts.serialApi : getNavigatorSerial();
      if (!api) {
        throw new Error('Web Serial API is not supported in this browser.');
      }
      const port = await api.requestPort();
      this.portState = 'flashing';
      this.notify();
      try {
        return await strategy.flash(port, board, artifact, runOpts);
      } finally {
        this.portState = 'disconnected';
      }
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const isCancel = err instanceof Error && err.name === 'NotFoundError';
      if (isAbort) {
        this.appendEntry('sys', '[FLASH] Upload aborted.');
      } else if (isCancel) {
        this.appendEntry('sys', '[FLASH] Port selection canceled.');
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        this.lastError = msg;
        this.appendEntry('err', `[FLASH ERROR] ${msg}`);
      }
      throw err;
    } finally {
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
      this.flashActive = false;
      this.flashAbortController = null;
      this.notify();
    }
  }

  clearSelfTestFrame(): void {
    if (!this.latestSelfTestFrame) return;
    this.latestSelfTestFrame = null;
    this.notify();
  }

  clear(): void {
    this.entries = [];
    this.rawRing.clear();
    this.plotRing.clear();
    this.rxBytesTotal = 0;
    this.rxLinesTotal = 0;
    this.latestSelfTestFrame = null;
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
    if (this.flashAbortController) {
      this.flashAbortController.abort();
      this.flashAbortController = null;
    }
    this.flashActive = false;
    this.flashProgress = null;
    this.latestSelfTestFrame = null;
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
