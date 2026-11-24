// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

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

export interface ProjectExternalRecord {
  id: string;
  h?: string | null;
  p?: Record<string, string | null>;
  bb?: Record<string, boolean | string>;
  pos?: [number, number] | null;
  rot?: number;
}

export interface ProjectPayload {
  v?: number | string;
  b?: string;
  cp?: string;
  cr?: boolean;
  prm?: 'smart' | 'rail';
  target?: { boardId: string; codeProfile?: string; nodes?: Array<{ id: string; boardId: string; codeProfile?: string }> };
  appVersion?: string;
  author?: string;
  repo?: string;
  name?: string;
  ob?: Record<string, boolean>;
  op?: boolean;
  wm?: string;
  sg?: boolean;
  ch?: boolean;
  act: ProjectExternalRecord[];
  cb?: Array<{ t: string; c?: Record<string, any> }>;
  [key: string]: any;
}
