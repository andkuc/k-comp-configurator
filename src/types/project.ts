// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { CodeProfileId } from './codegen';

export interface CodeBlockInstance {
  blockId: string;
  type: string;
  config: Record<string, any>;
}

export interface CodeBlockDef {
  type: string;
  group: 'flow' | 'time' | 'hw';
  icon: string;
  max: number;
  color: string;
  contextOnly?: boolean;
  defaultConfig: (existingCount: number) => Record<string, any>;
  sram: (cfg: Record<string, any>) => number;
  isVisible: () => boolean;
  isRecommended: () => boolean;
  hasWarning: (cfg: Record<string, any>) => string | null;
  summary: (cfg: Record<string, any>) => string;
}

/** Typed wire attachment target replacing legacy string-encoded breadboard flags */
export type PinAttachment =
  | { kind: 'board-pin' }
  | { kind: 'board-breadboard'; forceRail: true }
  | { kind: 'carrier-row'; holeIndex?: number }
  | { kind: 'carrier-rail'; railId: string; holeIndex?: number };

export interface ProposalWorkPackage {
  goal: string;
  hours: string;
  who: string;
}

export interface ProjectProposal {
  schoolYear: string;
  className: string;
  teamName: string;
  date: string;
  student1: string;
  student2: string;
  slogan: string;
  userStories: string;
  functionalScope: string;
  boardMods: string;
  workPackages: ProposalWorkPackage[];
  includeGrading: boolean;
}

export interface PlacedModuleRecord {
  compId: string;
  i2cHeader?: string | null;
  i2cAddrOverride?: string | null;
  pinMap: Record<string, string | null>;
  attachments?: Record<string, PinAttachment>;
  position?: { x: number; y: number; w?: number; h?: number } | null;
  rotation?: number;
}

export interface ProjectNode {
  id: string;
  boardId: string;
  codeProfile: CodeProfileId;
  carrierId: string | null;
  powerDistribution: 'smart' | 'rail';
  onboard: Record<string, boolean>;
  oledPaged: boolean;
  modules: PlacedModuleRecord[];
  codeBlocks: Array<{ type: string; config: Record<string, any> }>;
}

/** Reserved for future Multi-Node AI-Computing + MCU links (UART / I2C / Network) */
export interface InterNodeLink {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  bus: 'uart' | 'i2c' | 'usb' | 'wifi';
  label?: string;
}

export interface ProjectDocument {
  schema: 'kcomp-project/1';
  appVersion: string;
  name: string;
  nodes: ProjectNode[];
  links: InterNodeLink[];
  proposal?: ProjectProposal;
  uiPrefs: {
    wireMode: 'smart' | 'curved';
    snapToGrid: boolean;
    codeHints: boolean;
  };
  meta?: {
    generator: string;
    author: string;
    source: string;
  };
}
