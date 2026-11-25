// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { CodeProfileId } from './codegen';

export type McuArchitecture = 'atmega328p' | 'esp32s3' | 'multi-node';
export type I2CHeaderPinRole = 'VCC' | 'GND' | 'SCL' | 'SDA';

export interface BoardPin {
  label: string;
  group: string;
  pinNum?: string;
  caps: string[];
  shared?: boolean;
  freeDefault?: boolean;
  blocked?: boolean;
  blockedReason?: string;
  reason?: string;
  onboard?: string;
  onboardSlot?: string;
  dip?: number;
  note?: string;
  approach?: 'top' | 'bottom' | 'left' | 'right';
  adcChannel?: 'ADC1' | 'ADC2';
  strapping?: boolean;
  strappingNote?: string;
  capHint?: string;
  signalPin?: boolean;
  headerId?: string;
  headerRole?: I2CHeaderPinRole;
  x: number;
  y: number;
}

export interface DipSwitchSpec {
  id: number;
  pin: string;
  name: string;
  defaultOn: boolean;
  lockedOn?: boolean;
  onboardId?: string;
  note?: string;
}

export interface I2CHeaderSpec {
  label: string;
  locationKey?: string;
  supportsBreadboardHub?: boolean;
  VCC: string;
  GND: string;
  SCL: string;
  SDA: string;
}

export interface BoardCanvasPlacement {
  tx: number;
  ty: number;
  scale: number;
}

export interface BoardCarrierPowerRailSpec {
  id: string;
  side: 'left' | 'right';
  netId: string;
  label: string;
  color: string;
  stripeColor: string;
  x: number;
  ys: number[];
  feederPinId: string;
}

export interface BoardCarrierSpec {
  id: 'breadboard-center';
  defaultEnabled: boolean;
  localBounds: { minX: number; minY: number; maxX: number; maxY: number };
  canvasPlacement: BoardCanvasPlacement;
  leftHoleXs: number[];
  rightHoleXs: number[];
  rowYs: number[];
  powerRails: BoardCarrierPowerRailSpec[];
}

export interface BoardBreadboardSpec {
  cols: number;
  colX: number[];
  topY: number[];
  botY: number[];
}

export interface BoardOnboardZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  accent: string;
  flashRect?: { x: number; y: number; w: number; h: number };
}

export interface BoardOnboardPinBinding {
  pinId: string;
  roleLabel?: string;
  roleSuffix?: string;
  dip?: number | null;
  hardwired?: boolean;
}

export interface BoardOnboardPeripheral {
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
  i2cAddr?: string;
  conflictPins?: string[];
  conflictWarningKey?: string;
  pins?: BoardOnboardPinBinding[];
  isWifiRadio?: boolean;
  code?: Record<string, any>;
  codeFull?: Record<string, any>;
  codePaged?: Record<string, any>;
}

/** Optional mechanical geometry (in mm) for 2-layer plug-in shield PCB design & Gerber export */
export interface MechanicalHoleSpec {
  id: string;
  xMm: number;
  yMm: number;
  drillMm: number;
  plated?: boolean;
}

export interface MechanicalHeaderSpec {
  id: string;
  label: string;
  xMm: number;
  yMm: number;
  pitchMm: number;
  pinCount: number;
  orientationDeg: 0 | 90 | 180 | 270;
  pins: string[];
}

export interface MechanicalKeepOutZone {
  id: string;
  reason: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  side?: 'top' | 'bottom' | 'both';
}

export interface BoardMechanicalSpec {
  widthMm: number;
  heightMm: number;
  cornerRadiusMm?: number;
  origin?: 'top-left' | 'bottom-left';
  mountingHoles: MechanicalHoleSpec[];
  headers: MechanicalHeaderSpec[];
  keepOutZones?: MechanicalKeepOutZone[];
}

export interface BoardElectricalSpec {
  logicVoltage: 5 | 3.3;
  sramBytes: number;
  sramBaseOverheadBytes: number;
  flashBytes: number;
  psramBytes?: number;
  usbMaxMa: number;
  baseCurrentMa: number;
}

export interface BoardCapabilitiesSpec {
  hasPinMux: boolean;
  hardwareUartCount: number;
  strappingPins?: string[];
  adc1Pins?: string[];
  adc2WifiConflictPins?: string[];
  hasDipSwitches: boolean;
  hasBreadboard: boolean;
  hasWirelessSlot: boolean;
  hasOnboardPeripherals: boolean;
  hasWifi?: boolean;
}

export interface BoardPowerPinPriority {
  GND: string[];
  POWER_5V: string[];
  POWER_3V3: string[];
  RESET: string[];
}

export interface BoardTargetMeta {
  flashProtocol: 'stk500v1' | 'esptool' | 'none';
  defaultBaud: number;
}

export interface BoardProfile {
  id: string;
  name: string;
  shortName: string;
  badge: string;
  mcu: McuArchitecture;
  svgAsset: string;
  viewBox: { width: number; height: number };
  canvasPlacement: BoardCanvasPlacement;
  electrical: BoardElectricalSpec;
  capabilities: BoardCapabilitiesSpec;
  powerPinPriority: BoardPowerPinPriority;
  i2cHeaderOrder: string[];
  defaultI2cPins?: { sda: string; scl: string };
  i2cHeaders: Record<string, I2CHeaderSpec>;
  dipSwitches: DipSwitchSpec[];
  breadboard?: BoardBreadboardSpec;
  carrier?: BoardCarrierSpec;
  onboardZones?: BoardOnboardZone[];
  onboardPeripherals: BoardOnboardPeripheral[];
  defaultCodeProfile: CodeProfileId;
  supportedCodeProfiles: CodeProfileId[];
  targetMeta?: BoardTargetMeta;
  mechanical?: BoardMechanicalSpec;
  pins: Record<string, BoardPin>;
}
