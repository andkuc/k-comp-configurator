// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Deterministic SimulatorFlasher for Demo Mode, CI & AbortSignal Verification (Zero Hardware Required)
import type { BoardProfile } from '../../types';
import {
  sleepAbortable,
  throwIfAborted,
  type FirmwareArtifact,
  type FlashResult,
  type FlashRunOptions
} from './types';

export interface SimulatorFlasherOptions {
  stepDelayMs?: number;
}

export class SimulatorFlasher {
  readonly id = 'simulator-flasher';
  private readonly stepDelayMs: number;

  constructor(opts: SimulatorFlasherOptions = {}) {
    this.stepDelayMs = Math.max(1, opts.stepDelayMs ?? 45);
  }

  async flash(
    board: BoardProfile,
    artifact: FirmwareArtifact,
    options: FlashRunOptions = {}
  ): Promise<FlashResult> {
    const startedAt = Date.now();
    const verify = options.verify ?? true;
    const signal = options.signal;

    const steps: Array<{ phase: 'reset' | 'sync' | 'erase' | 'write' | 'verify'; pct: number; msg: string }> = [
      { phase: 'reset', pct: 8, msg: `[SIM] Resetting ${board.shortName} into bootloader…` },
      { phase: 'sync', pct: 18, msg: `[SIM] Bootloader synced (${board.flashProfile?.protocol ?? 'sim'}).` },
      { phase: 'erase', pct: 28, msg: `[SIM] Preparing flash pages for ${artifact.filename}…` },
      { phase: 'write', pct: 52, msg: `[SIM] Writing ${artifact.byteLength} B (50%)…` },
      { phase: 'write', pct: 76, msg: `[SIM] Writing ${artifact.byteLength} B (100%)…` }
    ];
    if (verify) {
      steps.push({ phase: 'verify', pct: 92, msg: `[SIM] Verifying ${artifact.byteLength} B checksum…` });
    }
    steps.push({ phase: 'reset', pct: 100, msg: `[SIM] Flash complete (${artifact.byteLength} B).` });

    for (const s of steps) {
      throwIfAborted(signal);
      options.onProgress?.({ phase: s.phase, percent: s.pct, message: s.msg });
      await sleepAbortable(this.stepDelayMs, signal);
    }

    options.onLog?.(
      `[SIM] Flashed ${artifact.filename} (${artifact.byteLength} B${verify ? ', verified' : ''}) to ${board.shortName}.`,
      'sys'
    );

    return {
      ok: true,
      strategyId: this.id,
      bytesWritten: artifact.byteLength,
      verified: verify,
      resetUsed: 'none',
      durationMs: Date.now() - startedAt,
      chipSignature: board.flashProfile?.signature
        ? board.flashProfile.signature.map((b) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`).join(' ')
        : undefined
    };
  }
}
