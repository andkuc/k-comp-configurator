// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

export interface OnboardCodeSnippet {
  includes?: string[];
  defines?: string[];
  globals?: string[];
  setup?: string[];
  loop?: string[];
  helpers?: string[];
}

export interface OnboardDef {
  id: string;
  name: string;
  shortName?: string;
  pinInfo?: string;
  defaultEnabled?: boolean;
  hardwired?: boolean;
  sram: number;
  sramPaged?: number;
  modeToggle?: boolean;
  dip?: number | null;
  accent?: string;
  currentMa?: number;
  code?: OnboardCodeSnippet;
  codeFull?: OnboardCodeSnippet;
  codePaged?: OnboardCodeSnippet;
  [key: string]: any;
}

export type PinTier = 'required' | 'optional' | 'config' | 'unused';
export type PowerRailChoice = '3V3' | '5V';

export interface I2CAddrOption {
  addr: string;
  configPin?: string;
  tieTo?: 'GND' | 'VCC' | 'NONE';
  note?: string;
}

export interface ComponentPinSpec {
  id: string;
  label?: string;
  role?: string;
  tier?: PinTier;
  color?: string;
  selectable?: boolean;
  fixedPin?: string;
  defaultPin?: string;
  allowedTypes?: string[];
  preferred?: string[];
  codeKey?: string;
  note?: string;
  [key: string]: any;
}

export interface ComponentCodeSpec {
  includes?: string[];
  defines?: string[];
  globals?: string[];
  setup?: string[];
  loop?: string[];
  helpers?: string[];
  [key: string]: any;
}

export interface ComponentDef {
  id: string;
  name: string;
  friendlyName?: string;
  subtitle?: string;
  category: string;
  topic?: string;
  interface: string;
  voltage?: string;
  supportedRails?: PowerRailChoice[];
  i2cAddr?: string | null;
  secondI2cAddr?: string | null;
  i2cAddrOptions?: I2CAddrOption[];
  sram?: number;
  currentMa?: number;
  i2cHeaderSelectable?: boolean;
  onboardWirelessSlot?: boolean;
  protoArea?: boolean;
  maxPerDesign?: number;
  maxReason?: string;
  pins: ComponentPinSpec[];
  warnings?: string[];
  code?: ComponentCodeSpec;
  svgFile: string;
  viewBox?: [number, number] | number[];
  pinAnchors?: Record<string, { x: number; y: number }>;
  docUrl?: string;
  docKeywords?: string[];
  docExclude?: string[];
  studentInfo?: Record<string, any>;
  accessories?: Array<Record<string, any>>;
  [key: string]: any;
}

export interface PresetExternalItem {
  id: string;
  i2cHeader?: string;
  pinOverrides?: Record<string, string>;
}

export interface PresetDef {
  id: string;
  boardId?: string;
  name: string;
  description: string;
  onboard: Record<string, boolean>;
  oledPaged?: boolean;
  external: PresetExternalItem[];
}

export interface CatalogData {
  version: string;
  docsRepoApi?: string;
  docsRepoBlobBase?: string;
  docsRepoTreeApi?: string;
  components: ComponentDef[];
  presets: PresetDef[];
}

export interface LocalizedText {
  en: string;
  de?: string;
  sq?: string;
  [lang: string]: string | undefined;
}

export interface LibraryApiFunction {
  sig: string;
  call: string;
  phase?: string;
  desc: LocalizedText;
}

export interface LibraryApiEntry {
  header: string;
  headerPaged?: string;
  verified?: boolean;
  macros?: string[];
  fields?: string[];
  functions: LibraryApiFunction[];
}

export interface ComponentGuideEntry {
  [key: string]: any;
}
