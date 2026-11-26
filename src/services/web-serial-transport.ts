// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Native Browser Web Serial DeviceTransport with Exclusive Port State Machine & Safe DTR/RTS Reset
import type { McuArchitecture } from '../types';
import {
  SerialPortStateMachine,
  isWebSerialAvailable,
  type DeviceInfo,
  type DeviceTransport,
  type FlashProgress,
  type FlashProtocolId,
  type FlashSegment,
  type PortStateChangeEvent,
  type SerialPortState
} from './device-transport';
import {
  getNavigatorSerial,
  identifyUsbSerialChip,
  type WebSerialNavigatorApi,
  type WebSerialPortLike
} from './web-serial-types';

export interface WebSerialTransportOptions {
  serialApi?: WebSerialNavigatorApi | null;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class WebSerialTransport implements DeviceTransport {
  readonly id = 'web-serial';
  private readonly injectedApi?: WebSerialNavigatorApi | null;
  private readonly stateMachine = new SerialPortStateMachine();
  private port: WebSerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private readLoopPromise: Promise<void> | null = null;
  private readActive = false;
  private lineBuffer = '';
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();
  private lineListeners = new Set<(line: string) => void>();
  private byteListeners = new Set<(byteCount: number) => void>();
  private deviceInfo: DeviceInfo | null = null;
  private disconnectHandler: (() => void) | null = null;

  constructor(opts: WebSerialTransportOptions = {}) {
    this.injectedApi = opts.serialApi;
  }

  private resolveSerialApi(): WebSerialNavigatorApi | null {
    if (this.injectedApi !== undefined) return this.injectedApi;
    return getNavigatorSerial();
  }

  isSupported(): boolean {
    if (this.injectedApi !== undefined) return this.injectedApi !== null;
    return isWebSerialAvailable();
  }

  getState(): SerialPortState {
    return this.stateMachine.getState();
  }

  getLastError(): string | null {
    return this.stateMachine.getLastError();
  }

  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo ? { ...this.deviceInfo } : null;
  }

  onStateChange(listener: (ev: PortStateChangeEvent) => void): () => void {
    return this.stateMachine.onStateChange(listener);
  }

  onBytesReceived(listener: (byteCount: number) => void): () => void {
    this.byteListeners.add(listener);
    return () => {
      this.byteListeners.delete(listener);
    };
  }

  onLine(listener: (line: string) => void): () => void {
    this.lineListeners.add(listener);
    return () => {
      this.lineListeners.delete(listener);
    };
  }

  private emitLine(line: string): void {
    for (const fn of Array.from(this.lineListeners)) {
      fn(line);
    }
  }

  private emitBytes(count: number): void {
    for (const fn of Array.from(this.byteListeners)) {
      fn(count);
    }
  }

  private consumeChunk(chunk: Uint8Array): void {
    if (!chunk.byteLength) return;
    this.emitBytes(chunk.byteLength);
    const decoded = this.decoder.decode(chunk, { stream: true });
    if (!decoded) return;
    const normalized = (this.lineBuffer + decoded).replaceAll('\r\n', '\n').replaceAll('\r', '\n');
    const parts = normalized.split('\n');
    this.lineBuffer = parts.pop() ?? '';
    for (const line of parts) {
      this.emitLine(line);
    }
  }

  private startReadLoop(port: WebSerialPortLike): void {
    if (!port.readable) return;
    this.readActive = true;
    this.decoder = new TextDecoder();
    this.lineBuffer = '';

    const run = async (): Promise<void> => {
      while (this.readActive && port.readable) {
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        let streamEnded = false;
        try {
          reader = port.readable.getReader();
          this.reader = reader;
          while (this.readActive) {
            const { value, done } = await reader.read();
            if (done) {
              streamEnded = true;
              break;
            }
            if (value) this.consumeChunk(value);
          }
        } catch (err: unknown) {
          if (this.readActive) {
            const msg = err instanceof Error ? err.message : String(err);
            if (this.stateMachine.canTransition('error')) {
              this.stateMachine.transition('error', msg);
            }
          }
          break;
        } finally {
          if (reader) {
            try { reader.releaseLock(); } catch (_) {}
          }
          if (this.reader === reader) {
            this.reader = null;
          }
        }
        if (!this.readActive || streamEnded) break;
      }
    };

    this.readLoopPromise = run();
  }

  async connect(baudRate: number): Promise<DeviceInfo> {
    const api = this.resolveSerialApi();
    if (!api) {
      throw new Error('Web Serial API is not supported in this browser.');
    }

    if (this.stateMachine.getState() !== 'disconnected' && this.stateMachine.getState() !== 'error') {
      await this.disconnect();
    }

    this.stateMachine.transition('connecting');
    try {
      const port = await api.requestPort();
      await port.open({ baudRate });

      const rawInfo = typeof port.getInfo === 'function' ? port.getInfo() : {};
      const label = identifyUsbSerialChip(rawInfo.usbVendorId, rawInfo.usbProductId);
      const info: DeviceInfo = {
        portLabel: label,
        usbVendorId: rawInfo.usbVendorId,
        usbProductId: rawInfo.usbProductId,
        baudRate
      };

      this.port = port;
      this.deviceInfo = info;

      const onPortDisconnect = (): void => {
        if (this.port === port) {
          void this.handleUnexpectedDisconnect();
        }
      };
      this.disconnectHandler = onPortDisconnect;
      port.addEventListener?.('disconnect', onPortDisconnect);

      this.stateMachine.transition('monitoring');
      this.startReadLoop(port);
      return info;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isUserCancel = err instanceof Error && err.name === 'NotFoundError';
      if (isUserCancel) {
        this.stateMachine.transition('disconnected', 'Port selection canceled');
      } else {
        this.stateMachine.transition('error', msg);
      }
      throw err;
    }
  }

  private async handleUnexpectedDisconnect(): Promise<void> {
    this.readActive = false;
    if (this.reader) {
      try { await this.reader.cancel(); } catch (_) {}
    }
    this.port = null;
    this.deviceInfo = null;
    if (this.stateMachine.canTransition('disconnected')) {
      this.stateMachine.transition('disconnected', 'USB device unplugged');
    }
  }

  async disconnect(): Promise<void> {
    const port = this.port;
    this.readActive = false;

    if (this.stateMachine.getState() === 'monitoring' && this.stateMachine.canTransition('releasing')) {
      this.stateMachine.transition('releasing');
    }

    if (this.reader) {
      try { await this.reader.cancel(); } catch (_) {}
    }
    if (this.readLoopPromise) {
      try { await this.readLoopPromise; } catch (_) {}
      this.readLoopPromise = null;
    }

    if (port) {
      if (this.disconnectHandler) {
        port.removeEventListener?.('disconnect', this.disconnectHandler);
        this.disconnectHandler = null;
      }
      try { await port.close(); } catch (_) {}
    }

    this.port = null;
    this.deviceInfo = null;
    this.lineBuffer = '';

    if (this.stateMachine.canTransition('disconnected')) {
      this.stateMachine.transition('disconnected');
    }
  }

  async writeText(text: string): Promise<void> {
    if (!this.port || !this.port.writable || this.stateMachine.getState() !== 'monitoring') {
      throw new Error('Serial port is not open for writing.');
    }
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(this.encoder.encode(text));
    } finally {
      writer.releaseLock();
    }
  }

  /**
   * Triggers a clean MCU reset via DTR/RTS control lines.
   * - ATmega328P (K-Comp V2 S1-1 Auto-Reset): brief DTR low pulse
   * - ESP32-S3: RTS pulse with DTR deasserted so GPIO0 stays HIGH (normal run boot, not ROM download!)
   */
  async resetBoard(mcu: McuArchitecture): Promise<void> {
    if (!this.port || typeof this.port.setSignals !== 'function' || this.stateMachine.getState() !== 'monitoring') {
      return;
    }
    if (mcu === 'esp32s3') {
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: true });
      await sleepMs(90);
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
    } else {
      await this.port.setSignals({ dataTerminalReady: false });
      await sleepMs(80);
      await this.port.setSignals({ dataTerminalReady: true });
    }
  }

  /**
   * Releases active reader/writer locks and closes the underlying port for flashing,
   * while preserving the granted WebSerialPortLike handle for seamless monitor resumption
   * (zero second browser port-picker dialog).
   */
  async suspendForFlash(): Promise<{ port: WebSerialPortLike; baudRate: number }> {
    if (!this.port || this.stateMachine.getState() !== 'monitoring') {
      throw new Error('Cannot suspend serial monitor: port is not actively monitoring.');
    }
    const port = this.port;
    const baudRate = this.deviceInfo?.baudRate ?? 115200;

    this.stateMachine.transition('releasing', 'Suspending monitor for flash');
    this.readActive = false;

    if (this.reader) {
      try { await this.reader.cancel(); } catch (_) {}
    }
    if (this.readLoopPromise) {
      try { await this.readLoopPromise; } catch (_) {}
      this.readLoopPromise = null;
    }

    try { await port.close(); } catch (_) {}
    await sleepMs(80);
    this.stateMachine.transition('flashing', 'Flashing firmware');
    return { port, baudRate };
  }

  /** Reopens the preserved port handle after flashing and resumes the Serial Monitor read loop. */
  async resumeAfterFlash(baudRate: number, tolerateReenumeration = false): Promise<void> {
    if (!this.port) {
      if (this.stateMachine.canTransition('disconnected')) {
        this.stateMachine.transition('disconnected', 'Port handle lost during flash');
      }
      return;
    }
    const port = this.port;
    if (this.stateMachine.getState() === 'flashing') {
      this.stateMachine.transition('reconnecting', 'Resuming serial monitor');
    }
    try {
      await port.open({ baudRate });
      if (this.deviceInfo) {
        this.deviceInfo = { ...this.deviceInfo, baudRate };
      }
      this.stateMachine.transition('monitoring', 'Monitor resumed after flash');
      this.startReadLoop(port);
    } catch (err: unknown) {
      if (tolerateReenumeration) {
        if (this.stateMachine.canTransition('disconnected')) {
          this.stateMachine.transition('disconnected');
        }
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (this.stateMachine.canTransition('error')) {
        this.stateMachine.transition('error', `Failed to reopen monitor after flash: ${msg}`);
      }
      throw err;
    }
  }

  async flash(
    _protocol: FlashProtocolId,
    _segments: FlashSegment[],
    _onProgress?: (p: FlashProgress) => void
  ): Promise<void> {
    throw new Error('Use DeviceSessionController.flashArtifact() or a FlashStrategy via suspendForFlash()/resumeAfterFlash().');
  }
}
