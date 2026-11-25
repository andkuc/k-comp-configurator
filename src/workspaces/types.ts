// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Strict Top-Level Workspace Module Lifecycle Contracts (Hardware | Program | Device | Shield PCB)
import type { DerivedWorkspace } from '../store/bus';

export type WorkspaceId = 'hardware' | 'program' | 'device' | 'shield';

export interface WorkspaceDescriptor {
  id: WorkspaceId;
  icon: string;
  labelKey: string;
  titleKey: string;
  status: 'active' | 'preview';
  targetVersion?: string;
}

export interface WorkspaceContext {
  getDerived: () => DerivedWorkspace;
  getActiveNodeId: () => string;
  switchWorkspace: (id: WorkspaceId) => Promise<WorkspaceId>;
  openHardwareCodeTab: () => void;
  t: (key: string, params?: Record<string, unknown> | null) => string;
}

export interface WorkspaceModule {
  readonly id: WorkspaceId;
  mount(container: HTMLElement, ctx: WorkspaceContext): void;
  unmount(): void;
  onProjectChange?(derived: DerivedWorkspace): void;
  onActiveNodeChange?(nodeId: string): void;
}

export type WorkspaceLoader = () => Promise<WorkspaceModule>;
