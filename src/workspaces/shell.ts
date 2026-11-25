// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Top-Level Workspace Shell with Strict Module Lifecycle (mount/unmount/onProjectChange/onActiveNodeChange) & Lazy Loading
import { $, escapeHtml } from '../core/state';
import { appBus, projectStore, uiSessionStore, type DerivedWorkspace } from '../store';
import { deviceSession } from '../services';
import { t } from '../i18n/index';
import {
  DEFAULT_WORKSPACE_ID,
  WORKSPACES,
  detectInitialWorkspaceId,
  getWorkspaceLoader,
  isValidWorkspaceId,
  resetWorkspaceLoaders,
  type WorkspaceId
} from './registry';
import type { WorkspaceContext, WorkspaceModule } from './types';
import { createProgramWorkspaceModule } from './views/program-view';
import { createDeviceWorkspaceModule } from './views/device-view';
import { createShieldWorkspaceModule } from './views/shield-view';

let activeWorkspaceId: WorkspaceId = DEFAULT_WORKSPACE_ID;
let mountedModule: WorkspaceModule | null = null;
let mountedContainer: HTMLElement | null = null;
let nodeBusUnsub: (() => void) | null = null;
let deviceStatusUnsub: (() => void) | null = null;
let lastDeviceConnected = false;

const builtinModules = new Map<WorkspaceId, WorkspaceModule>();
const customModules = new Map<WorkspaceId, WorkspaceModule>();
const pendingLoads = new Map<WorkspaceId, Promise<WorkspaceModule | null>>();

function getOrCreateBuiltinModule(wsId: WorkspaceId): WorkspaceModule | null {
  if (wsId === 'hardware') return null;
  const existing = builtinModules.get(wsId);
  if (existing) return existing;
  let mod: WorkspaceModule;
  if (wsId === 'program') mod = createProgramWorkspaceModule();
  else if (wsId === 'device') mod = createDeviceWorkspaceModule();
  else mod = createShieldWorkspaceModule();
  builtinModules.set(wsId, mod);
  return mod;
}

function createWorkspaceContext(derivedOverride?: DerivedWorkspace): WorkspaceContext {
  return {
    getDerived: () => derivedOverride || projectStore.getDerived(),
    getActiveNodeId: () => projectStore.getActiveNodeId(),
    switchWorkspace: (id: WorkspaceId) => activateWorkspace(id),
    openHardwareCodeTab: () => {
      setActiveWorkspace('hardware');
      const codeTab = document.querySelector<HTMLElement>('.itab[data-tab="tabCode"]');
      if (codeTab) codeTab.click();
    },
    t
  };
}

function ensureNodeChangeListener(): void {
  if (!nodeBusUnsub) {
    nodeBusUnsub = appBus.on('node:changed', ({ nodeId }) => {
      if (mountedModule?.onActiveNodeChange) {
        mountedModule.onActiveNodeChange(nodeId);
      }
    });
  }
  if (!deviceStatusUnsub) {
    lastDeviceConnected = deviceSession.isConnected();
    deviceStatusUnsub = deviceSession.subscribe((snap) => {
      const nowConnected = snap.portState === 'monitoring';
      if (nowConnected !== lastDeviceConnected) {
        lastDeviceConnected = nowConnected;
        renderWorkspaceSwitcher();
      }
    });
  }
}

function unmountCurrentModule(): void {
  if (mountedModule) {
    mountedModule.unmount();
    mountedModule = null;
    mountedContainer = null;
  }
}

export function registerWorkspaceModule(mod: WorkspaceModule): void {
  customModules.set(mod.id, mod);
}

export function getActiveWorkspace(): WorkspaceId {
  return activeWorkspaceId;
}

export function renderWorkspaceSwitcher(): void {
  const slot = $('#workspaceSwitchSlot') as HTMLElement | null;
  if (!slot) return;
  const devLive = deviceSession.isConnected();
  slot.innerHTML = WORKSPACES.map((w) => {
    const isActive = w.id === activeWorkspaceId;
    const isLiveDev = w.id === 'device' && devLive;
    const tagHtml = isLiveDev
      ? `<span class="ws-live-dot" aria-hidden="true"></span>`
      : (w.status === 'preview' && w.targetVersion
          ? `<span class="ws-ver-dot" aria-hidden="true"></span>`
          : '');
    return `
      <button type="button"
              class="ws-tab-btn ${isActive ? 'active' : ''} ${w.status === 'preview' ? 'is-preview' : ''} ${isLiveDev ? 'is-live' : ''}"
              data-ws-id="${w.id}"
              role="tab"
              aria-selected="${String(isActive)}"
              title="${escapeHtml(t(w.titleKey))}">
        <span class="ws-tab-ico" aria-hidden="true">${w.icon}</span>
        <span class="ws-tab-lbl">${escapeHtml(t(w.labelKey))}</span>
        ${tagHtml}
      </button>`;
  }).join('');

  slot.querySelectorAll<HTMLElement>('[data-ws-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.wsId;
      if (target) void activateWorkspace(target);
    });
  });
}

function mountResolvedModule(stage: HTMLElement, mod: WorkspaceModule, derived?: DerivedWorkspace): void {
  ensureNodeChangeListener();
  if (mountedModule === mod && mountedContainer === stage) {
    if (mod.onProjectChange) {
      mod.onProjectChange(derived || projectStore.getDerived());
    } else {
      mod.mount(stage, createWorkspaceContext(derived));
    }
    return;
  }
  unmountCurrentModule();
  mod.mount(stage, createWorkspaceContext(derived));
  mountedModule = mod;
  mountedContainer = stage;
}

export function renderActiveWorkspaceStage(derived?: DerivedWorkspace): void {
  const hwMain = $('#workspace') as HTMLElement | null;
  const stage = $('#workspaceStage') as HTMLElement | null;
  if (!hwMain || !stage) return;

  const isHardware = activeWorkspaceId === 'hardware';
  hwMain.classList.toggle('hidden', !isHardware);
  stage.classList.toggle('hidden', isHardware);
  document.body.setAttribute('data-workspace', activeWorkspaceId);

  if (isHardware) {
    unmountCurrentModule();
    return;
  }

  const mod = customModules.get(activeWorkspaceId) || getOrCreateBuiltinModule(activeWorkspaceId);
  if (mod) {
    mountResolvedModule(stage, mod, derived);
  }
}

export function setActiveWorkspace(nextId: string): WorkspaceId {
  const resolved: WorkspaceId = isValidWorkspaceId(nextId) ? nextId : DEFAULT_WORKSPACE_ID;
  activeWorkspaceId = resolved;
  uiSessionStore.patch({ activeWorkspace: resolved });
  renderWorkspaceSwitcher();
  renderActiveWorkspaceStage();
  return activeWorkspaceId;
}

export async function activateWorkspace(nextId: string): Promise<WorkspaceId> {
  const resolved: WorkspaceId = isValidWorkspaceId(nextId) ? nextId : DEFAULT_WORKSPACE_ID;
  activeWorkspaceId = resolved;
  uiSessionStore.patch({ activeWorkspace: resolved });
  renderWorkspaceSwitcher();

  if (resolved !== 'hardware' && !customModules.has(resolved)) {
    const loader = getWorkspaceLoader(resolved);
    if (loader) {
      let loadPromise = pendingLoads.get(resolved);
      if (!loadPromise) {
        loadPromise = loader()
          .then((mod) => {
            customModules.set(resolved, mod);
            pendingLoads.delete(resolved);
            return mod;
          })
          .catch((err: unknown) => {
            pendingLoads.delete(resolved);
            console.warn(`Failed to lazy-load workspace "${resolved}":`, err);
            return null;
          });
        pendingLoads.set(resolved, loadPromise);
      }
      await loadPromise;
    }
  }

  if (activeWorkspaceId === resolved) {
    renderActiveWorkspaceStage();
  }
  return activeWorkspaceId;
}

export function initWorkspaceShell(): WorkspaceId {
  ensureNodeChangeListener();
  activeWorkspaceId = detectInitialWorkspaceId();
  uiSessionStore.patch({ activeWorkspace: activeWorkspaceId });
  renderWorkspaceSwitcher();
  renderActiveWorkspaceStage();
  return activeWorkspaceId;
}

export function resetWorkspaceShell(): void {
  unmountCurrentModule();
  if (nodeBusUnsub) {
    nodeBusUnsub();
    nodeBusUnsub = null;
  }
  if (deviceStatusUnsub) {
    deviceStatusUnsub();
    deviceStatusUnsub = null;
  }
  lastDeviceConnected = false;
  builtinModules.clear();
  customModules.clear();
  pendingLoads.clear();
  resetWorkspaceLoaders();
  activeWorkspaceId = DEFAULT_WORKSPACE_ID;
}
