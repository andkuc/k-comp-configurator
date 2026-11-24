// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { CatalogData, ComponentDef, ComponentPinSpec } from './catalog';
import type { DipSwitchSpec } from './board';
import type { CodeBlockInstance } from './project';
import type { CodeProfileId } from './codegen';

export interface ActiveComponentInstance {
  instanceId: string;
  compId: string;
  i2cHeader: string | null;
  pinMap: Record<string, string | null>;
  bbPins?: Record<string, boolean | string>;
  customPos: { x: number; y: number; w?: number; h?: number } | null;
  rotation: number;
}

export interface DipSwitchState extends DipSwitchSpec {
  on: boolean;
  forcedOff?: boolean;
  reason: string;
}

export interface FlashTargetOptions {
  instanceId?: string | null;
  pinId?: string | null;
  onboardId?: string | null;
  dipNum?: number | null;
  panIfOffscreen?: boolean;
}

export interface WarningQuickAction {
  onboardId: string;
  label: string;
}

export interface WarningItem {
  critical: boolean;
  advisory?: boolean;
  actionNeeded?: boolean;
  text: string;
  quickActions?: WarningQuickAction[];
  target?: FlashTargetOptions | null;
}

export interface SramBreakdown {
  used: number;
  total: number;
  breakdown: string[];
}

export interface UsbCurrentEstimate {
  total: number;
  base: number;
  onboardMa: number;
  extMa: number;
  breakdown: string[];
}

export interface PinClaim {
  instanceId: string;
  compName: string;
  compPinId: string;
}

export interface OnboardPinUsageEntry {
  onboardId: string;
  name: string;
  dip: number | null;
  color: string;
  lockedBySlot?: boolean;
  hardwired?: boolean;
}

export interface SuitableBoardPin {
  id: string;
  label: string;
  takenBy: PinClaim | null;
  onboardBy: OnboardPinUsageEntry | null;
  dip: number | null;
  shared: boolean;
  usageCount: number;
}

export interface PendingPinEntry {
  inst: ActiveComponentInstance;
  def: ComponentDef;
  pinSpec: ComponentPinSpec;
  eligibleOnboard: SuitableBoardPin[];
}

export interface ViewBoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorkbenchState {
  boardId: string;
  codeProfile: CodeProfileId;
  carrierEnabled: boolean;
  catalog: CatalogData | null;
  boardSvgEl: SVGGElement | null;
  projectName: string;
  theme: 'dark' | 'light';
  hoveredNet: string | null;
  svgCache: Map<string, SVGElement>;
  onboard: Record<string, boolean>;
  oledPaged: boolean;
  active: ActiveComponentInstance[];
  placedEntries: any[];
  breadboardRails: any[];
  carrierFeeders: any[];
  focusedId: string | null;
  search: string;
  groupMode: string;
  category: string;
  wireMode: string;
  powerRailMode: 'smart' | 'rail';
  snapToGrid: boolean;
  undoStack: string[];
  redoStack: string[];
  repoDocsMap: Map<string, any>;
  repoDocsLoaded: boolean;
  nextInst: number;
  vb: ViewBoxRect;
  panning: any;
  touchPointers: Map<number, { clientX: number; clientY: number }>;
  pinch: any;
  resizingSidebar: boolean;
  resizingInspector: boolean;
  resizingApi: boolean;
  sidebarCollapsed: boolean;
  inspectorCollapsed: boolean;
  pinFilter: string;
  wiringSubTab: string;
  pinLegendCollapsed: boolean;
  hoveredHwId: string | null;
  collapsedPinGroups: Set<string>;
  bootComplete: boolean;
  autoSaveEnabled: boolean;
  latestSketch: string;
  codeBlocks: CodeBlockInstance[];
  nextBlockInst: number;
  codeHints: boolean;
  blocksDrawerOpen: boolean;
  editingBlockId: string | null;
  openBlockInfo: string | null;
  apiDrawerOpen: boolean;
  apiShowAll: boolean;
  apiSearch: string;
  apiExpandedKey: string | null;
  repoDocsPromise: Promise<any> | null;
  openInfoCompId: string | null;
  suppressClick: boolean;
  dragComp: any;
  rotateComp: any;
  dragWire: any;
  mobileView: string;
  needsMobileFit: boolean;
  toastTimer: ReturnType<typeof setTimeout> | null;
}

export interface HooksRegistry {
  recomputeAndRender: () => void;
  pushUndoState: () => void;
  performUndo: () => void | Promise<void>;
  captureSnapshot: () => string;
  updateHistoryButtons: () => void;
  openComponentInfo: (compId: string) => void;
  openBlockInfo: (type: string) => void;
  openBlocksOverview: () => void;
  updateInfoModalDocLink: (def: ComponentDef) => void;
  showPinTooltip: (pinId: string, ev: any) => void;
  showCustomTooltip: (html: string, ev?: any) => void;
  moveTooltip: (ev: any) => void;
  hideTooltip: () => void;
  setHoveredNet: (netId: string | null) => void;
  applyViewBox: () => void;
  resetViewFit: () => void;
  zoomToBoard: () => void;
  loadPreset: (presetId: string) => void | Promise<void>;
  setHwHover: (hwId: string | null) => void;
  flashTarget: (opts?: FlashTargetOptions) => void;
  panToComponent: (instanceId: string) => void;
  switchBoard: (boardId: string, opts?: any) => void | Promise<void>;
}

export interface UartAssignment {
  kind: 'hw' | 'sw';
  channel: number;
  shortTag: string;
  badgeLabel: string;
  serialObj: string;
  highBaud: boolean;
  baud: number;
}
