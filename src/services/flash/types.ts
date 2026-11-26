// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Canonical FirmwareArtifact, FlashStrategy & ResetStrategy Contracts (Open for Future Browser Emulator)
import type { BoardFlashProfile, BoardProfile, BoardResetStrategyId } from '../../types';
import type { FlashProgress, FlashSegment } from '../device-transport';
import type { WebSerialPortLike } from '../web-serial-types';
import type { WebHidNavigatorApi } from './web-hid-types';

export interface FirmwareSegment extends FlashSegment {
  label?: string;
  sha256?: string;
}

export interface IHexFirmwareArtifact {
  readonly format: 'ihex';
  readonly filename: string;
  readonly rawHex: string;
  readonly segments: ReadonlyArray<FirmwareSegment>;
  readonly byteLength: number;
  readonly boardId?: string;
  /** Optional ELF + symbol table kept open for future browser-emulator integration. */
  readonly elf?: Uint8Array;
  readonly symbols?: Readonly<Record<string, number>>;
}

export interface EspSegmentsFirmwareArtifact {
  readonly format: 'esp-segments';
  readonly filename: string;
  readonly segments: ReadonlyArray<FirmwareSegment>;
  readonly byteLength: number;
  readonly boardId?: string;
  readonly elf?: Uint8Array;
  readonly symbols?: Readonly<Record<string, number>>;
}

export type FirmwareArtifact = IHexFirmwareArtifact | EspSegmentsFirmwareArtifact;

export type FlashResetPreference = 'auto' | BoardResetStrategyId;

export interface FlashRunOptions {
  /** Whether to read back flash pages after programming (default: true). */
  verify?: boolean;
  /** Override reset chain ('auto' uses BoardProfile.flashProfile.resetChain). */
  resetPreference?: FlashResetPreference;
  /** Pre-flight hint from hardware configurator (e.g. K-Comp V2 S1-1 DIP is OFF). */
  autoResetDipOff?: boolean;
  /** Optional WebHID injection for deterministic unit tests. */
  hidApi?: WebHidNavigatorApi | null;
  /** Cooperative cancellation signal. */
  signal?: AbortSignal;
  /** Progress callback for UI progress bar & phase chips. */
  onProgress?: (progress: FlashProgress) => void;
  /** Human-readable status log lines forwarded into the Device Monitor log. */
  onLog?: (message: string, level?: 'sys' | 'err') => void;
}

export interface FlashResult {
  readonly ok: boolean;
  readonly strategyId: string;
  readonly bytesWritten: number;
  readonly verified: boolean;
  readonly resetUsed: BoardResetStrategyId | 'none';
  readonly durationMs: number;
  readonly chipSignature?: string;
}

export interface ResetContext {
  readonly port: WebSerialPortLike;
  readonly flashProfile: BoardFlashProfile;
  readonly autoResetDipOff: boolean;
  readonly hidApi?: WebHidNavigatorApi | null;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: FlashProgress) => void;
  readonly onLog?: (message: string, level?: 'sys' | 'err') => void;
}

export interface ResetAttemptResult {
  readonly strategyId: BoardResetStrategyId;
  readonly triggered: boolean;
  readonly requiresManualSyncWindow: boolean;
  readonly note?: string;
}

export interface ResetStrategy {
  readonly id: BoardResetStrategyId;
  canRun(ctx: ResetContext): boolean;
  trigger(ctx: ResetContext): Promise<ResetAttemptResult>;
}

export interface FlashStrategy {
  readonly id: string;
  readonly protocol: BoardFlashProfile['protocol'];
  supports(board: BoardProfile, artifact: FirmwareArtifact): boolean;
  flash(
    port: WebSerialPortLike,
    board: BoardProfile,
    artifact: FirmwareArtifact,
    options?: FlashRunOptions
  ): Promise<FlashResult>;
}

export function createAbortError(message = 'Flash operation aborted.'): Error {
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

export function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
