// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Central ProjectStore Facade (Single-Pass Derived Hardware Cache, Multi-Node Graph & Reactive Subscriptions)
import type { InterNodeLink, ProjectDocument, ProjectNode } from '../types';
import { appBus, type DerivedWorkspace } from './bus';
import { deriveWorkspace } from './derived';
import { nodeGraphStore } from './nodes';
import { DEFAULT_NODE_ID, uiSessionStore, type UiSessionSnapshot } from './ui-session';
import { DEFAULT_SKILL_PRESET, SKILL_PRESETS, settingsStore, type FeatureKey, type FeatureSettings, type NamedSkillPreset, type SkillLevelPreset, type UserSettingsState } from './settings';

export { appBus, deriveWorkspace, nodeGraphStore, uiSessionStore, settingsStore, DEFAULT_NODE_ID, DEFAULT_SKILL_PRESET, SKILL_PRESETS };
export type { AppCommandMap, AppEventMap, DerivedWorkspace, ToastOptions } from './bus';
export type { UiSessionSnapshot, FeatureKey, FeatureSettings, NamedSkillPreset, SkillLevelPreset, UserSettingsState };

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
    ensureRecomputeWired();
    if (!latestDerived) {
      latestDerived = deriveWorkspace();
    }
    return latestDerived;
  },

  /** Multi-node foundation: returns the active ProjectNode ID (defaults to `node_0`). */
  getActiveNodeId(): string {
    return uiSessionStore.getActiveNodeId();
  },

  /** Multi-node foundation: switches the active ProjectNode ID and emits `node:changed`. */
  setActiveNodeId(nodeId: string): string {
    return uiSessionStore.setActiveNodeId(nodeId);
  },

  /** Multi-node graph accessors (delegated to nodeGraphStore). */
  listNodes(): ProjectNode[] {
    return nodeGraphStore.listNodes();
  },

  getNode(nodeId: string): ProjectNode | null {
    return nodeGraphStore.getNode(nodeId);
  },

  addNode(boardId: string, explicitId?: string): ProjectNode {
    return nodeGraphStore.addNode(boardId, explicitId);
  },

  removeNode(nodeId: string): boolean {
    const removed = nodeGraphStore.removeNode(nodeId);
    if (removed && uiSessionStore.getActiveNodeId() === nodeId) {
      const remaining = nodeGraphStore.listNodes();
      uiSessionStore.setActiveNodeId(remaining[0]?.id || DEFAULT_NODE_ID);
    }
    return removed;
  },

  getLinks(): InterNodeLink[] {
    return nodeGraphStore.getLinks();
  },

  setLinks(links: ReadonlyArray<InterNodeLink>): InterNodeLink[] {
    return nodeGraphStore.setLinks(links);
  },

  addLink(link: InterNodeLink): InterNodeLink {
    return nodeGraphStore.addLink(link);
  },

  removeLink(linkId: string): boolean {
    return nodeGraphStore.removeLink(linkId);
  },

  syncGraphFromDocument(doc: ProjectDocument): void {
    nodeGraphStore.syncFromDocument(doc);
  },

  /** Subscribes a view/service to every derived workspace update. */
  subscribe(listener: (derived: DerivedWorkspace) => void): () => void {
    ensureRecomputeWired();
    return appBus.on('workspace:updated', listener);
  },

  /** Resets bus listeners, command handlers, node graph, session state, and cached derivation (primarily for unit tests). */
  reset(): void {
    latestDerived = null;
    wiredRecompute = false;
    appBus.reset();
    uiSessionStore.reset();
    nodeGraphStore.reset();
    settingsStore.reset();
  }
};

ensureRecomputeWired();
