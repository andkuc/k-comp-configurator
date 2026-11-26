// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Lazy-Loaded esptool-js FlashStrategy Wrapper for ESP32-S3 (UART-Bridge & Native USB-Serial/JTAG)
import type { BoardProfile } from '../../types';
import type { WebSerialPortLike } from '../web-serial-types';
import { md5Hex, uint8ArrayToBinaryString } from './esp-binary';
import {
  throwIfAborted,
  type FirmwareArtifact,
  type FlashResult,
  type FlashRunOptions,
  type FlashStrategy
} from './types';

export const ESPRESSIF_USB_VID = 0x303a;

export interface EsptoolTerminalLike {
  clean(): void;
  writeLine(data: string): void;
  write(data: string): void;
}

export interface EsptoolTransportLike {
  disconnect(): Promise<void>;
}

export interface EsptoolWriteFlashOptionsLike {
  fileArray: Array<{ data: string; address: number }>;
  flashSize: string;
  flashMode: string;
  flashFreq: string;
  eraseAll: boolean;
  compress: boolean;
  reportProgress?: (fileIndex: number, written: number, total: number) => void;
  calculateMD5Hash?: (image: string) => string;
}

export interface EsptoolLoaderLike {
  main(mode?: string): Promise<string>;
  writeFlash(options: EsptoolWriteFlashOptionsLike): Promise<void>;
  after?(mode?: string, reboot?: boolean): Promise<void>;
  hardReset?(): Promise<void>;
}

export interface EsptoolLoaderInitLike {
  transport: EsptoolTransportLike;
  baudrate: number;
  romBaudrate?: number;
  terminal?: EsptoolTerminalLike;
  enableTracing?: boolean;
}

export interface EsptoolModuleLike {
  Transport: new (device: WebSerialPortLike, tracing?: boolean) => EsptoolTransportLike;
  ESPLoader: new (options: EsptoolLoaderInitLike) => EsptoolLoaderLike;
}

export type EsptoolModuleLoader = () => Promise<EsptoolModuleLike>;

/** Strictly lazy dynamic import of esptool-js (0 KB impact on Hardware Workbench). */
export const defaultEsptoolLoader: EsptoolModuleLoader = async () => {
  const mod = await import('esptool-js');
  return mod as unknown as EsptoolModuleLike;
};

/** Returns true when the connected Web Serial port is an Espressif native USB-Serial/JTAG controller. */
export function isEspNativeUsbPort(port: WebSerialPortLike): boolean {
  const info = typeof port.getInfo === 'function' ? port.getInfo() : {};
  return info.usbVendorId === ESPRESSIF_USB_VID;
}

export interface EsptoolFlasherOptions {
  loader?: EsptoolModuleLoader;
  romBaudrate?: number;
}

export class EsptoolFlasher implements FlashStrategy {
  readonly id = 'esptool';
  readonly protocol = 'esptool' as const;
  private readonly loadEsptool: EsptoolModuleLoader;
  private readonly romBaudrate: number;

  constructor(options: EsptoolFlasherOptions = {}) {
    this.loadEsptool = options.loader ?? defaultEsptoolLoader;
    this.romBaudrate = options.romBaudrate ?? 115200;
  }

  supports(board: BoardProfile, artifact: FirmwareArtifact): boolean {
    const proto = board.flashProfile?.protocol ?? board.targetMeta?.flashProtocol;
    return proto === 'esptool' && artifact.format === 'esp-segments';
  }

  async flash(
    port: WebSerialPortLike,
    board: BoardProfile,
    artifact: FirmwareArtifact,
    options: FlashRunOptions = {}
  ): Promise<FlashResult> {
    if (artifact.format !== 'esp-segments') {
      throw new Error(`EsptoolFlasher requires an esp-segments artifact (got "${artifact.format}").`);
    }
    if (!artifact.segments.length) {
      throw new Error('ESP firmware artifact contains no segments.');
    }

    const profile = board.flashProfile ?? {
      protocol: 'esptool' as const,
      uploadBaud: 460800,
      flashSizeBytes: 16777216,
      defaultAppOffset: 0x10000,
      chipFamily: 'ESP32-S3',
      resetChain: ['cdc-dtr-rts', 'manual'] as const,
      acceptedFileExtensions: ['.bin'] as const,
      supportsVerify: true
    };

    // Validate flash capacity bounds before touching USB port or loading esptool-js
    let totalBytes = 0;
    for (const seg of artifact.segments) {
      const segEnd = seg.offset + seg.data.byteLength;
      if (segEnd > profile.flashSizeBytes) {
        throw new Error(
          `Firmware segment at 0x${seg.offset.toString(16)} (${seg.data.byteLength} B) exceeds flash capacity of ${board.shortName} (${profile.flashSizeBytes} B).`
        );
      }
      totalBytes += seg.data.byteLength;
    }

    const startedAt = Date.now();
    const signal = options.signal;
    const verify = options.verify ?? true;
    const emitProgress = options.onProgress;
    const emitLog = options.onLog;
    const manualReset = options.resetPreference === 'manual';
    const nativeUsb = isEspNativeUsbPort(port);

    throwIfAborted(signal);
    emitProgress?.({ phase: 'reset', percent: 3, message: 'Loading ESP flasher module…' });

    const { Transport, ESPLoader } = await this.loadEsptool();
    throwIfAborted(signal);

    if (nativeUsb) {
      emitLog?.('[FLASH] Native ESP32-S3 USB-Serial/JTAG port detected (0x303A).', 'sys');
    }

    const transport = new Transport(port, false);
    let terminalBuf = '';
    const flushTerminalLine = (raw: string): void => {
      const clean = raw.replace(/\r/g, '').trim();
      if (!clean) return;
      emitLog?.(`[ESPTOOL] ${clean}`, 'sys');
    };

    const terminal: EsptoolTerminalLike = {
      clean() {
        terminalBuf = '';
      },
      writeLine(data: string) {
        flushTerminalLine(data);
      },
      write(data: string) {
        terminalBuf += data;
        const parts = terminalBuf.split('\n');
        terminalBuf = parts.pop() ?? '';
        for (const p of parts) flushTerminalLine(p);
      }
    };

    const resetMode = manualReset ? 'no_reset' : 'default_reset';
    if (manualReset) {
      const hint = 'Manual bootloader mode: hold BOOT, tap RESET, then release BOOT…';
      emitProgress?.({ phase: 'reset', percent: 8, message: hint });
      emitLog?.(`[FLASH] ${hint}`, 'sys');
    } else {
      emitProgress?.({ phase: 'sync', percent: 8, message: `Connecting to ${board.shortName} ROM bootloader…` });
    }

    const esploader = new ESPLoader({
      transport,
      baudrate: profile.uploadBaud,
      romBaudrate: this.romBaudrate,
      terminal,
      enableTracing: false
    });

    try {
      // 1. Connect, sync, load RAM stub & detect chip
      const detectedChip = await esploader.main(resetMode);
      throwIfAborted(signal);

      const chipLabel = (detectedChip || '').trim();
      if (profile.chipFamily) {
        const expectedNorm = profile.chipFamily.toUpperCase();
        const actualNorm = chipLabel.toUpperCase();
        if (!actualNorm.includes(expectedNorm)) {
          throw new Error(
            `Target chip mismatch: board expects ${profile.chipFamily}, but bootloader reported "${chipLabel || 'unknown'}".`
          );
        }
      }
      emitLog?.(`[FLASH] Connected to ${chipLabel || board.shortName} @ ${profile.uploadBaud} baud.`, 'sys');
      emitProgress?.({ phase: 'erase', percent: 18, message: `Preparing ${artifact.segments.length} flash segment(s)…` });

      // 2. Build binary-string fileArray + weighted byte progress across all segments
      const segmentSizes = artifact.segments.map((s) => s.data.byteLength);
      const cumulativeBefore: number[] = [];
      let acc = 0;
      for (const sz of segmentSizes) {
        cumulativeBefore.push(acc);
        acc += sz;
      }

      const fileArray = artifact.segments.map((seg) => ({
        address: seg.offset,
        data: uint8ArrayToBinaryString(seg.data)
      }));

      await esploader.writeFlash({
        fileArray,
        flashSize: 'keep',
        flashMode: 'keep',
        flashFreq: 'keep',
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          if (signal?.aborted) return;
          const prevBytes = cumulativeBefore[fileIndex] ?? 0;
          const segBytes = segmentSizes[fileIndex] ?? Math.max(1, total);
          const fracInSeg = total > 0 ? Math.min(1, written / total) : 1;
          const overallBytes = Math.min(totalBytes, prevBytes + Math.round(fracInSeg * segBytes));
          const pct = Math.round(20 + (overallBytes / Math.max(1, totalBytes)) * 74);
          const segMeta = artifact.segments[fileIndex];
          const offsetHex = segMeta ? `0x${segMeta.offset.toString(16)}` : `#${fileIndex + 1}`;
          emitProgress?.({
            phase: 'write',
            percent: Math.min(94, pct),
            message: `Writing segment ${fileIndex + 1}/${artifact.segments.length} @ ${offsetHex} (${Math.round(fracInSeg * 100)}%)…`
          });
        },
        ...(verify ? { calculateMD5Hash: (image: string) => md5Hex(image) } : {})
      });

      throwIfAborted(signal);

      if (verify) {
        emitProgress?.({ phase: 'verify', percent: 96, message: 'MD5 flash verification complete.' });
      }

      // 3. Hard reset MCU out of ROM bootloader into freshly flashed application
      emitProgress?.({ phase: 'reset', percent: 98, message: 'Resetting ESP32-S3 into application…' });
      if (typeof esploader.after === 'function') {
        await esploader.after('hard_reset', true);
      } else if (typeof esploader.hardReset === 'function') {
        await esploader.hardReset();
      }

      if (terminalBuf.trim()) flushTerminalLine(terminalBuf);
      emitProgress?.({ phase: 'reset', percent: 100, message: `Flash complete (${totalBytes} B).` });
      emitLog?.(
        `[FLASH] Uploaded ${totalBytes} B across ${artifact.segments.length} segment(s)${verify ? ' (MD5 verified)' : ''}.`,
        'sys'
      );

      return {
        ok: true,
        strategyId: this.id,
        bytesWritten: totalBytes,
        verified: verify,
        resetUsed: manualReset ? 'manual' : 'cdc-dtr-rts',
        durationMs: Date.now() - startedAt,
        chipSignature: chipLabel || profile.chipFamily
      };
    } finally {
      try {
        await transport.disconnect();
      } catch (_) {}
    }
  }
}
