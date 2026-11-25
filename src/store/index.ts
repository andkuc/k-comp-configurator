// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Central ProjectStore Facade (Single-Pass Derived Hardware Cache + Reactive Subscriptions)
import { appBus, type DerivedWorkspace } from './bus';
import { deriveWorkspace } from './derived';

export { appBus, deriveWorkspace };
export type { AppCommandMap, AppEventMap, DerivedWorkspace } from './bus';

let latestDerived: DerivedWorkspace | null = null;
let wiredRecompute = false;

function ensureRecomputeWired(): void {
  if (wiredRecompute) return;
  wiredRecompute = true;
  appBus.on('workspace:recompute', () => {
    projectStore.recompute();
  });
}

export const projectStore = {
  /** Recomputes all derived hardware models in a single pass and broadcasts `workspace:updated`. */
  recompute(): DerivedWorkspace {
    ensureRecomputeWired();
    const derived = deriveWorkspace();
    latestDerived = derived;
    appBus.emit('workspace:updated', derived);
    return derived;
  },

  /** Returns the latest cached DerivedWorkspace snapshot (computing on demand if not yet derived). */
  getDerived(): DerivedWorkspace {
    if (!latestDerived) {
      latestDerived = deriveWorkspace();
    }
    return latestDerived;
  },

  /** Subscribes a view/service to every derived workspace update. */
  subscribe(listener: (derived: DerivedWorkspace) => void): () => void {
    ensureRecomputeWired();
    return appBus.on('workspace:updated', listener);
  },

  /** Resets bus listeners, command handlers, and cached derivation (primarily for unit tests). */
  reset(): void {
    latestDerived = null;
    wiredRecompute = false;
    appBus.reset();
  }
};

ensureRecomputeWired();
