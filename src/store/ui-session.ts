// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Ephemeral UI Session Store (Workspace, Active Node, Theme, Focus, Hover & Panel Flags)
import { appBus } from './bus';

export const DEFAULT_NODE_ID = 'node_0';

export interface UiSessionSnapshot {
  activeWorkspace: string;
  activeNodeId: string;
  theme: 'dark' | 'light';
  focusedId: string | null;
  hoveredNet: string | null;
  hoveredHwId: string | null;
  sidebarCollapsed: boolean;
  inspectorCollapsed: boolean;
  pinLegendCollapsed: boolean;
  wiringSubTab: 'modules' | 'pins';
  pinFilter: 'all' | 'used' | 'free';
  mobileView: string;
}

type UiSessionListener = (
  snapshot: Readonly<UiSessionSnapshot>,
  changedKeys: ReadonlyArray<keyof UiSessionSnapshot>
) => void;

function createDefaultSession(): UiSessionSnapshot {
  return {
    activeWorkspace: 'hardware',
    activeNodeId: DEFAULT_NODE_ID,
    theme: 'dark',
    focusedId: null,
    hoveredNet: null,
    hoveredHwId: null,
    sidebarCollapsed: false,
    inspectorCollapsed: false,
    pinLegendCollapsed: false,
    wiringSubTab: 'modules',
    pinFilter: 'all',
    mobileView: 'board'
  };
}

let session: UiSessionSnapshot = createDefaultSession();
const listeners = new Set<UiSessionListener>();

export const uiSessionStore = {
  get(): Readonly<UiSessionSnapshot> {
    return { ...session };
  },

  patch(partial: Partial<UiSessionSnapshot>): Readonly<UiSessionSnapshot> {
    const changed: Array<keyof UiSessionSnapshot> = [];
    const prevWorkspace = session.activeWorkspace;
    const prevNodeId = session.activeNodeId;

    for (const key of Object.keys(partial) as Array<keyof UiSessionSnapshot>) {
      const nextVal = partial[key];
      if (nextVal !== undefined && session[key] !== nextVal) {
        (session as Record<keyof UiSessionSnapshot, unknown>)[key] = nextVal;
        changed.push(key);
      }
    }

    if (changed.length > 0) {
      const snap = this.get();
      for (const fn of Array.from(listeners)) {
        fn(snap, changed);
      }
      if (changed.includes('activeWorkspace')) {
        appBus.emit('workspace:changed', {
          workspaceId: session.activeWorkspace,
          previousId: prevWorkspace
        });
      }
      if (changed.includes('activeNodeId')) {
        appBus.emit('node:changed', {
          nodeId: session.activeNodeId,
          previousNodeId: prevNodeId
        });
      }
    }
    return this.get();
  },

  setActiveNodeId(nodeId: string): string {
    const clean = (nodeId || '').trim() || DEFAULT_NODE_ID;
    this.patch({ activeNodeId: clean });
    return session.activeNodeId;
  },

  getActiveNodeId(): string {
    return session.activeNodeId;
  },

  subscribe(listener: UiSessionListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  reset(): void {
    session = createDefaultSession();
    listeners.clear();
  }
};
