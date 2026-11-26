// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Zero-Dependency STK500v1 / Optiboot Browser Flasher for K-Comp V2 (ATmega328P)
import type { BoardProfile } from '../../types';
import type { WebSerialPortLike } from '../web-serial-types';
import { sliceSegmentsIntoPages } from './intel-hex';
import { executeResetCascade } from './reset-strategies';
import {
  createAbortError,
  sleepAbortable,
  throwIfAborted,
  type FirmwareArtifact,
  type FlashResult,
  type FlashRunOptions,
  type FlashStrategy,
  type ResetAttemptResult
} from './types';

export const STK_OK = 0x10;
export const STK_INSYNC = 0x14;
export const CRC_EOP = 0x20;
export const STK_GET_SYNC = 0x30;
export const STK_ENTER_PROGMODE = 0x50;
export const STK_LEAVE_PROGMODE = 0x51;
export const STK_LOAD_ADDRESS = 0x55;
export const STK_PROG_PAGE = 0x64;
export const STK_READ_PAGE = 0x74;
export const STK_READ_SIGN = 0x75;
export const STK_MEMTYPE_FLASH = 0x46; // 'F'

export interface Stk500v1TimingConfig {
  syncTimeoutAutoMs?: number;
  syncTimeoutManualMs?: number;
  commandTimeoutMs?: number;
  syncRetryDelayMs?: number;
  syncRetryDelayAutoMs?: number;
  syncConfirmSettleMs?: number;
}

function bytesToHex(bytes: ReadonlyArray<number> | Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

/**
 * Single-reader background byte pump over Web Serial ReadableStream.
 * Guarantees only one `reader.read()` is active at any time so read timeouts never drop bytes.
 */
class BufferedSerialReader {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly pumpPromise: Promise<void>;
  private queue: number[] = [];
  private active = true;
  private streamDone = false;
  private streamError: Error | null = null;
  private notifyData: (() => void) | null = null;
  private rxSample: number[] = [];
  private rxTotal = 0;

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader();
    this.pumpPromise = this.runPump();
  }

  private wakeWaiter(): void {
    const fn = this.notifyData;
    if (fn) {
      this.notifyData = null;
      fn();
    }
  }

  private async runPump(): Promise<void> {
    try {
      while (this.active) {
        const { value, done } = await this.reader.read();
        if (done) {
          this.streamDone = true;
          this.wakeWaiter();
          break;
        }
        if (value && value.byteLength > 0) {
          for (let i = 0; i < value.byteLength; i++) {
            const b = value[i];
            this.queue.push(b);
            this.rxTotal++;
            if (this.rxSample.length < 16) this.rxSample.push(b);
          }
          this.wakeWaiter();
        }
      }
    } catch (err: unknown) {
      if (this.active) {
        this.streamError = err instanceof Error ? err : new Error(String(err));
        this.wakeWaiter();
      }
    }
  }

  drainBuffered(): number {
    const dropped = this.queue.length;
    this.queue.length = 0;
    return dropped;
  }

  getRxDiagnostics(): { totalBytes: number; sampleHex: string } {
    return { totalBytes: this.rxTotal, sampleHex: bytesToHex(this.rxSample) };
  }

  private waitForMoreData(timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
    if (timeoutMs <= 0) return Promise.resolve(false);
    return new Promise<boolean>((resolve, reject) => {
      let settled = false;
      const finish = (gotData: boolean, err?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.notifyData === onData) this.notifyData = null;
        signal?.removeEventListener('abort', onAbort);
        if (err) reject(err);
        else resolve(gotData);
      };
      const onData = (): void => finish(true);
      const onAbort = (): void => finish(false, createAbortError());
      const timer = setTimeout(() => finish(false), timeoutMs);

      this.notifyData = onData;
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  /**
   * Scans the incoming byte stream for the exact 2-byte Optiboot sync reply [0x14, 0x10].
   * Resilient against leading 0x00 reset-glitch bytes or running-sketch ASCII noise,
   * and NEVER drops trailing bytes if a timeout fires right as [0x14, 0x10] arrives.
   */
  async waitForSyncAck(timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
    throwIfAborted(signal);
    const deadline = Date.now() + timeoutMs;

    while (true) {
      throwIfAborted(signal);
      if (this.streamError) throw this.streamError;

      // Scan buffered bytes for [STK_INSYNC, STK_OK]
      for (let i = 0; i + 1 < this.queue.length; i++) {
        if (this.queue[i] === STK_INSYNC && this.queue[i + 1] === STK_OK) {
          this.queue.splice(0, i + 2);
          return true;
        }
      }

      // Discard leading noise while preserving a trailing STK_INSYNC byte if it might start [0x14, 0x10]
      if (this.queue.length > 1) {
        const last = this.queue[this.queue.length - 1];
        this.queue = last === STK_INSYNC ? [STK_INSYNC] : [];
      } else if (this.queue.length === 1 && this.queue[0] !== STK_INSYNC) {
        this.queue.length = 0;
      }

      if (this.streamDone) {
        throw new Error('Serial stream closed unexpectedly during STK500v1 sync.');
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) return false;

      const gotData = await this.waitForMoreData(remaining, signal);
      if (!gotData) return false;
    }
  }

  async readExact(
    count: number,
    timeoutMs: number,
    signal?: AbortSignal,
    opName = 'command'
  ): Promise<Uint8Array> {
    throwIfAborted(signal);
    const deadline = Date.now() + timeoutMs;

    while (this.queue.length < count) {
      throwIfAborted(signal);
      if (this.streamError) {
        throw this.streamError;
      }
      if (this.streamDone) {
        throw new Error(`Serial stream closed unexpectedly during ${opName}.`);
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        const partialHex = bytesToHex(this.queue.slice(0, 16));
        throw new Error(
          `STK500v1 read timeout during ${opName} (${timeoutMs} ms: expected ${count} B, got ${this.queue.length} B${partialHex ? ` [${partialHex}]` : ''}).`
        );
      }

      const gotData = await this.waitForMoreData(remaining, signal);
      if (!gotData && this.queue.length < count) {
        const partialHex = bytesToHex(this.queue.slice(0, 16));
        throw new Error(
          `STK500v1 read timeout during ${opName} (${timeoutMs} ms: expected ${count} B, got ${this.queue.length} B${partialHex ? ` [${partialHex}]` : ''}).`
        );
      }
    }

    return new Uint8Array(this.queue.splice(0, count));
  }

  async dispose(): Promise<void> {
    this.active = false;
    this.wakeWaiter();
    try { await this.reader.cancel(); } catch (_) {}
    try { await this.pumpPromise; } catch (_) {}
    try { this.reader.releaseLock(); } catch (_) {}
  }
}

function formatSignatureHex(sig: Uint8Array | readonly [number, number, number]): string {
  return Array.from(sig)
    .map((b) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`)
    .join(' ');
}

export class Stk500v1Flasher implements FlashStrategy {
  readonly id = 'stk500v1';
  readonly protocol = 'stk500v1' as const;
  private readonly timing: Required<Stk500v1TimingConfig>;

  constructor(timing: Stk500v1TimingConfig = {}) {
    this.timing = {
      syncTimeoutAutoMs: timing.syncTimeoutAutoMs ?? 2500,
      syncTimeoutManualMs: timing.syncTimeoutManualMs ?? 8000,
      commandTimeoutMs: timing.commandTimeoutMs ?? 1200,
      syncRetryDelayMs: timing.syncRetryDelayMs ?? 360,
      syncRetryDelayAutoMs: timing.syncRetryDelayAutoMs ?? timing.syncRetryDelayMs ?? 360,
      syncConfirmSettleMs: timing.syncConfirmSettleMs ?? 10
    };
  }

  supports(board: BoardProfile, artifact: FirmwareArtifact): boolean {
    const proto = board.flashProfile?.protocol ?? board.targetMeta?.flashProtocol;
    return proto === 'stk500v1' && artifact.format === 'ihex';
  }

  async flash(
    port: WebSerialPortLike,
    board: BoardProfile,
    artifact: FirmwareArtifact,
    options: FlashRunOptions = {}
  ): Promise<FlashResult> {
    if (artifact.format !== 'ihex') {
      throw new Error(`Stk500v1Flasher requires an Intel HEX artifact (got "${artifact.format}").`);
    }

    const profile = board.flashProfile ?? {
      protocol: 'stk500v1' as const,
      uploadBaud: 115200,
      fallbackUploadBauds: [57600] as const,
      flashSizeBytes: 32256,
      pageSizeBytes: 128,
      signature: [0x1e, 0x95, 0x0f] as const,
      resetChain: ['mcp2221-webhid', 'cdc-dtr', 'manual'] as const,
      acceptedFileExtensions: ['.hex', '.ihex'] as const,
      supportsVerify: true
    };

    const pageSize = profile.pageSizeBytes ?? 128;
    const pages = sliceSegmentsIntoPages(artifact.segments, pageSize, 0xff);
    const maxFlashEnd = pages.length ? pages[pages.length - 1].address + pageSize : 0;
    if (maxFlashEnd > profile.flashSizeBytes) {
      throw new Error(
        `Firmware image (${maxFlashEnd} B) exceeds available flash memory on ${board.shortName} (${profile.flashSizeBytes} B).`
      );
    }

    const startedAt = Date.now();
    const verify = options.verify ?? true;
    const signal = options.signal;
    const emitProgress = options.onProgress;
    const emitLog = options.onLog;

    const baudCandidates: number[] = [profile.uploadBaud];
    for (const fb of profile.fallbackUploadBauds ?? []) {
      if (Number.isFinite(fb) && fb > 0 && !baudCandidates.includes(fb)) {
        baudCandidates.push(fb);
      }
    }

    const diagSummary: string[] = [];

    for (let baudIdx = 0; baudIdx < baudCandidates.length; baudIdx++) {
      const baud = baudCandidates[baudIdx];
      throwIfAborted(signal);

      emitProgress?.({
        phase: 'reset',
        percent: 2,
        message: baudIdx === 0
          ? `Opening port at ${baud} baud…`
          : `Retrying bootloader sync at fallback ${baud} baud…`
      });
      if (baudIdx > 0) {
        emitLog?.(`[FLASH] No STK500v1 sync at ${baudCandidates[baudIdx - 1]} baud — retrying at ${baud} baud…`, 'sys');
      }

      await port.open({ baudRate: baud });
      if (!port.readable || !port.writable) {
        try { await port.close(); } catch (_) {}
        throw new Error('Serial port opened without readable/writable streams.');
      }

      const reader = new BufferedSerialReader(port.readable);
      const writer = port.writable.getWriter();

      const writeBytes = async (payload: Uint8Array): Promise<void> => {
        throwIfAborted(signal);
        await writer.write(payload);
      };

      const expectAck = async (opName: string): Promise<void> => {
        const resp = await reader.readExact(2, this.timing.commandTimeoutMs, signal, opName);
        if (resp[0] !== STK_INSYNC || resp[1] !== STK_OK) {
          throw new Error(
            `STK500v1 protocol mismatch during ${opName}: expected [14 10], got [${bytesToHex(resp)}].`
          );
        }
      };

      try {
        // 1. Trigger 3-stage reset cascade (MCP2221 WebHID -> CDC DTR -> Manual RESET)
        const resetRes: ResetAttemptResult = await executeResetCascade(
          {
            port,
            flashProfile: profile,
            autoResetDipOff: Boolean(options.autoResetDipOff),
            hidApi: options.hidApi,
            signal,
            onProgress: emitProgress,
            onLog: emitLog
          },
          options.resetPreference ?? 'auto'
        );

        // 2. Two-stage glitch-tolerant STK_GET_SYNC loop (initial [14 10] + drain + confirmation STK_GET_SYNC)
        const syncWindowMs = resetRes.requiresManualSyncWindow
          ? this.timing.syncTimeoutManualMs
          : this.timing.syncTimeoutAutoMs;
        const syncDeadline = Date.now() + syncWindowMs;
        let synced = false;
        let attempt = 0;

        reader.drainBuffered();
        while (!synced && Date.now() < syncDeadline) {
          throwIfAborted(signal);
          attempt++;
          emitProgress?.({
            phase: 'sync',
            percent: Math.min(14, 6 + attempt),
            message: resetRes.requiresManualSyncWindow
              ? `Press RESET now (${baud} baud, ${Math.max(1, Math.ceil((syncDeadline - Date.now()) / 1000))} s left)…`
              : `Syncing with bootloader @ ${baud} baud (attempt ${attempt})…`
          });
          await writeBytes(new Uint8Array([STK_GET_SYNC, CRC_EOP]));
          const pollStep = resetRes.requiresManualSyncWindow
            ? this.timing.syncRetryDelayMs
            : this.timing.syncRetryDelayAutoMs;
          const waitMs = Math.min(pollStep, Math.max(15, syncDeadline - Date.now()));
          const gotFirst = await reader.waitForSyncAck(waitMs, signal);
          if (!gotFirst) continue;

          // Flush any duplicate queued [14 10] echoes, then confirm Optiboot is solidly in command phase
          if (this.timing.syncConfirmSettleMs > 0) {
            await sleepAbortable(this.timing.syncConfirmSettleMs, signal);
          }
          reader.drainBuffered();
          await writeBytes(new Uint8Array([STK_GET_SYNC, CRC_EOP]));
          const confirmWait = Math.min(350, Math.max(80, syncDeadline - Date.now()));
          const confirmed = await reader.waitForSyncAck(confirmWait, signal);
          if (confirmed) {
            synced = true;
            break;
          }
          emitLog?.(`[FLASH] Initial sync reply seen on attempt ${attempt}, confirmation timed out — retrying…`, 'sys');
        }

        if (!synced) {
          const diag = reader.getRxDiagnostics();
          const diagNote = diag.totalBytes > 0
            ? `${baud} baud: ${diag.totalBytes} RX byte(s) [${diag.sampleHex}]`
            : `${baud} baud: 0 RX bytes`;
          diagSummary.push(diagNote);
          emitLog?.(`[FLASH] Sync timeout (${diagNote}).`, 'sys');
          if (baudIdx + 1 < baudCandidates.length) {
            continue;
          }
          throw new Error(
            `Optiboot bootloader did not respond to STK500v1 sync (${diagSummary.join('; ')}). Check USB cable, S1-1 Auto-Reset DIP switch, or tap RESET during the sync window.`
          );
        }

        reader.drainBuffered();
        emitLog?.(`[FLASH] Bootloader synced & confirmed @ ${baud} baud in ${attempt} attempt(s).`, 'sys');

        // 3. Enter programming mode
        await writeBytes(new Uint8Array([STK_ENTER_PROGMODE, CRC_EOP]));
        await expectAck('STK_ENTER_PROGMODE');
        emitLog?.('[FLASH] Entered Optiboot programming mode (STK_ENTER_PROGMODE OK).', 'sys');

        // 4. Verify MCU signature (0x1E 0x95 0x0F for ATmega328P)
        await writeBytes(new Uint8Array([STK_READ_SIGN, CRC_EOP]));
        const signResp = await reader.readExact(5, this.timing.commandTimeoutMs, signal, 'STK_READ_SIGN');
        if (signResp[0] !== STK_INSYNC || signResp[4] !== STK_OK) {
          throw new Error(`STK500v1 failed to read MCU signature (got [${bytesToHex(signResp)}]).`);
        }
        const actualSig = signResp.subarray(1, 4);
        const chipSignature = formatSignatureHex(actualSig);
        if (profile.signature) {
          const expected = profile.signature;
          if (actualSig[0] !== expected[0] || actualSig[1] !== expected[1] || actualSig[2] !== expected[2]) {
            throw new Error(
              `MCU signature mismatch: expected ${formatSignatureHex(expected)} (${board.shortName}), got ${chipSignature}.`
            );
          }
        }
        emitLog?.(`[FLASH] MCU signature verified: ${chipSignature}`, 'sys');

        // 5. Program 128-byte flash pages (address sent as 16-bit word address!)
        const writeRangeStart = 18;
        const writeRangeSpan = verify ? 52 : 76;

        for (let i = 0; i < pages.length; i++) {
          throwIfAborted(signal);
          const page = pages[i];
          const wordAddr = page.address >>> 1;
          await writeBytes(new Uint8Array([STK_LOAD_ADDRESS, wordAddr & 0xff, (wordAddr >>> 8) & 0xff, CRC_EOP]));
          await expectAck(`STK_LOAD_ADDRESS @ 0x${page.address.toString(16)}`);

          const frame = new Uint8Array(4 + page.data.byteLength + 1);
          frame[0] = STK_PROG_PAGE;
          frame[1] = (page.data.byteLength >>> 8) & 0xff;
          frame[2] = page.data.byteLength & 0xff;
          frame[3] = STK_MEMTYPE_FLASH;
          frame.set(page.data, 4);
          frame[frame.byteLength - 1] = CRC_EOP;

          await writeBytes(frame);
          await expectAck(`STK_PROG_PAGE @ 0x${page.address.toString(16)}`);

          const pct = Math.round(writeRangeStart + ((i + 1) / Math.max(1, pages.length)) * writeRangeSpan);
          emitProgress?.({
            phase: 'write',
            percent: pct,
            message: `Writing flash page ${i + 1}/${pages.length} (${(i + 1) * pageSize} B)…`
          });
        }

        // 6. Optional read-back verify
        if (verify) {
          const verifyStart = 70;
          const verifySpan = 25;
          for (let i = 0; i < pages.length; i++) {
            throwIfAborted(signal);
            const page = pages[i];
            const wordAddr = page.address >>> 1;
            await writeBytes(new Uint8Array([STK_LOAD_ADDRESS, wordAddr & 0xff, (wordAddr >>> 8) & 0xff, CRC_EOP]));
            await expectAck(`STK_LOAD_ADDRESS (verify) @ 0x${page.address.toString(16)}`);

            await writeBytes(
              new Uint8Array([
                STK_READ_PAGE,
                (page.data.byteLength >>> 8) & 0xff,
                page.data.byteLength & 0xff,
                STK_MEMTYPE_FLASH,
                CRC_EOP
              ])
            );
            const readResp = await reader.readExact(
              page.data.byteLength + 2,
              this.timing.commandTimeoutMs,
              signal,
              `STK_READ_PAGE @ 0x${page.address.toString(16)}`
            );
            if (readResp[0] !== STK_INSYNC || readResp[readResp.byteLength - 1] !== STK_OK) {
              throw new Error(`STK500v1 framing error while verifying page @ 0x${page.address.toString(16)}.`);
            }
            for (let b = 0; b < page.data.byteLength; b++) {
              if (readResp[1 + b] !== page.data[b]) {
                const absAddr = page.address + b;
                throw new Error(
                  `Flash verify mismatch at 0x${absAddr.toString(16)}: expected 0x${page.data[b].toString(16)}, read 0x${readResp[1 + b].toString(16)}.`
                );
              }
            }
            const pct = Math.round(verifyStart + ((i + 1) / Math.max(1, pages.length)) * verifySpan);
            emitProgress?.({
              phase: 'verify',
              percent: pct,
              message: `Verifying flash page ${i + 1}/${pages.length}…`
            });
          }
        }

        // 7. Leave programming mode (Optiboot watchdog jumps into user application)
        await writeBytes(new Uint8Array([STK_LEAVE_PROGMODE, CRC_EOP]));
        await expectAck('STK_LEAVE_PROGMODE');

        const bytesWritten = pages.length * pageSize;
        emitProgress?.({ phase: 'reset', percent: 100, message: `Flash complete (${artifact.byteLength} B).` });
        emitLog?.(
          `[FLASH] Uploaded ${artifact.byteLength} B @ ${baud} baud (${pages.length} pages${verify ? ', verified' : ''}).`,
          'sys'
        );

        return {
          ok: true,
          strategyId: this.id,
          bytesWritten,
          verified: verify,
          resetUsed: resetRes.strategyId,
          durationMs: Date.now() - startedAt,
          chipSignature
        };
      } finally {
        try { writer.releaseLock(); } catch (_) {}
        await reader.dispose();
        try { await port.close(); } catch (_) {}
      }
    }

    throw new Error('Optiboot bootloader did not respond to STK500v1 sync.');
  }
}
