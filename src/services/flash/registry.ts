// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pluggable FlashStrategy Registry (STK500v1 for K-Comp V2 + Lazy EsptoolFlasher for ESP32-S3)
import type { BoardProfile } from '../../types';
import { EsptoolFlasher } from './esptool-flasher';
import { Stk500v1Flasher } from './stk500v1-flasher';
import type { FirmwareArtifact, FlashStrategy } from './types';

export class FlashStrategyRegistry {
  private strategies = new Map<string, FlashStrategy>();

  register(strategy: FlashStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  unregister(id: string): void {
    this.strategies.delete(id);
  }

  get(id: string): FlashStrategy | null {
    return this.strategies.get(id) ?? null;
  }

  list(): ReadonlyArray<FlashStrategy> {
    return Array.from(this.strategies.values());
  }

  resolve(board: BoardProfile, artifact: FirmwareArtifact): FlashStrategy | null {
    for (const strat of this.strategies.values()) {
      if (strat.supports(board, artifact)) return strat;
    }
    return null;
  }
}

export const flashStrategyRegistry = new FlashStrategyRegistry();
flashStrategyRegistry.register(new Stk500v1Flasher());
flashStrategyRegistry.register(new EsptoolFlasher());
