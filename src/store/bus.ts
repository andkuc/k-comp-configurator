// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Strictly Typed Application Event & Command Bus
import type {
  BoardProfile,
  ComponentDef,
  DipSwitchState,
  ElectricalNetlist,
  FlashTargetOptions,
  SramBreakdown,
  UartAssignment,
  UsbCurrentEstimate,
  WarningItem
} from '../types';

export interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

export interface DerivedWorkspace {
  board: BoardProfile;
  dipStates: DipSwitchState[];
  uartAssignments: Record<string, UartAssignment>;
  warnings: WarningItem[];
  sram: SramBreakdown;
  usbCurrent: UsbCurrentEstimate;
  netlist: ElectricalNetlist;
}

export interface AppEventMap {
  'workspace:recompute': void;
  'workspace:updated': DerivedWorkspace;
  'workspace:changed': { workspaceId: string; previousId: string };
  'node:changed': { nodeId: string; previousNodeId: string };
  'ui:toast': { msg: string; opts?: ToastOptions | null };
  'codeblock:spotlight': { blockId: string | null };
  'history:push': void;
  'history:undo': void;
  'history:updateButtons': void;
  'viewport:applyViewBox': void;
  'viewport:resetFit': void;
  'viewport:zoomToBoard': void;
  'viewport:panToComponent': { instanceId: string };
  'hover:net': { netId: string | null };
  'hover:hw': { hwId: string | null };
  'target:flash': FlashTargetOptions;
  'tooltip:showPin': { pinId: string; ev: unknown };
  'tooltip:showCustom': { html: string; ev?: unknown };
  'tooltip:move': { ev: unknown };
  'tooltip:hide': void;
  'modal:openComponentInfo': { compId: string };
  'modal:openBlockInfo': { type: string };
  'modal:openBlocksOverview': void;
  'modal:updateInfoDocLink': { def: ComponentDef };
  'preset:load': { presetId: string };
}

export interface AppCommandMap {
  'board:switch': {
    req: { boardId: string; opts?: Record<string, unknown> };
    res: Promise<void> | void;
  };
  'history:captureSnapshot': {
    req: void;
    res: string;
  };
}

type EventListener<T> = (payload: T) => void;
type CommandHandler<Req, Res> = (req: Req) => Res;

class TypedAppBus {
  private listeners = new Map<keyof AppEventMap, Set<EventListener<any>>>();
  private handlers = new Map<keyof AppCommandMap, CommandHandler<any, any>>();

  on<K extends keyof AppEventMap>(event: K, fn: EventListener<AppEventMap[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
    return () => {
      set?.delete(fn);
    };
  }

  emit<K extends keyof AppEventMap>(
    ...args: AppEventMap[K] extends void ? [event: K] : [event: K, payload: AppEventMap[K]]
  ): void {
    const [event, payload] = args as [K, AppEventMap[K]];
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    for (const fn of Array.from(set)) {
      fn(payload);
    }
  }

  handle<K extends keyof AppCommandMap>(
    cmd: K,
    handler: CommandHandler<AppCommandMap[K]['req'], AppCommandMap[K]['res']>
  ): () => void {
    this.handlers.set(cmd, handler);
    return () => {
      if (this.handlers.get(cmd) === handler) {
        this.handlers.delete(cmd);
      }
    };
  }

  invoke<K extends keyof AppCommandMap>(
    ...args: AppCommandMap[K]['req'] extends void
      ? [cmd: K]
      : [cmd: K, req: AppCommandMap[K]['req']]
  ): AppCommandMap[K]['res'] | undefined {
    const [cmd, req] = args as [K, AppCommandMap[K]['req']];
    const handler = this.handlers.get(cmd);
    if (!handler) return undefined;
    return handler(req) as AppCommandMap[K]['res'];
  }

  reset(): void {
    this.listeners.clear();
    this.handlers.clear();
  }
}

export const appBus = new TypedAppBus();
