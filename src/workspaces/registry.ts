// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Top-Level Workspace Registry & Lazy Loader Table (Hardware | Program | Device | Shield PCB)
import type { WorkspaceDescriptor, WorkspaceId, WorkspaceLoader } from './types';

export type { WorkspaceDescriptor, WorkspaceId, WorkspaceLoader };

export const DEFAULT_WORKSPACE_ID: WorkspaceId = 'hardware';

export const WORKSPACES: WorkspaceDescriptor[] = [
  {
    id: 'hardware',
    icon: '⊞',
    labelKey: 'ws.hardware',
    titleKey: 'ws.hardwareTitle',
    status: 'active'
  },
  {
    id: 'program',
    icon: '◫',
    labelKey: 'ws.program',
    titleKey: 'ws.programTitle',
    status: 'preview',
    targetVersion: 'v0.5'
  },
  {
    id: 'device',
    icon: '⚡',
    labelKey: 'ws.device',
    titleKey: 'ws.deviceTitle',
    status: 'active'
  },
  {
    id: 'shield',
    icon: '⬡',
    labelKey: 'ws.shield',
    titleKey: 'ws.shieldTitle',
    status: 'preview',
    targetVersion: 'v0.6'
  }
];

const lazyLoaders = new Map<WorkspaceId, WorkspaceLoader>();

export function registerWorkspaceLoader(id: WorkspaceId, loader: WorkspaceLoader): void {
  lazyLoaders.set(id, loader);
}

export function getWorkspaceLoader(id: WorkspaceId): WorkspaceLoader | undefined {
  return lazyLoaders.get(id);
}

export function resetWorkspaceLoaders(): void {
  lazyLoaders.clear();
}

export function isValidWorkspaceId(id: string | null | undefined): id is WorkspaceId {
  return WORKSPACES.some((w) => w.id === id);
}

export function detectInitialWorkspaceId(): WorkspaceId {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get('workspace') || params.get('ws') || '').toLowerCase().trim();
    if (isValidWorkspaceId(raw)) return raw;
  } catch (_) {}
  return DEFAULT_WORKSPACE_ID;
}
