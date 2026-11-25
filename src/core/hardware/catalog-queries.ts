// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pure Component Catalog & Board-Aware Capability Queries (Optional Pins, I2C Addresses & Dual Power Rails)
import { state } from '../state';
import { tComp } from '../../i18n/index';
import { getActiveBoard } from '../../boards';
import type {
  ActiveComponentInstance,
  ComponentDef,
  ComponentPinSpec,
  PowerRailChoice,
  UartAssignment
} from '../../types';

const HIGH_BAUD_UART_IDS = new Set(['ld2410c', 'ld2450', 'as608']);

export function getCompDef(compId: string): ComponentDef | undefined {
  return state.catalog?.components.find((c) => c.id === compId);
}

export function countActiveByCompId(compId: string): number {
  return state.active.filter((a) => a.compId === compId).length;
}

export function getDisplayLabel(def: ComponentDef | null | undefined): string {
  if (!def) return '';
  return tComp(def, 'friendlyName') || def.friendlyName || def.name;
}

export function isOptionalPin(pinSpec: ComponentPinSpec | null | undefined): boolean {
  return Boolean(pinSpec && (pinSpec.tier === 'optional' || pinSpec.tier === 'config' || pinSpec.tier === 'unused'));
}

export function isConfigPin(pinSpec: ComponentPinSpec | null | undefined): boolean {
  return Boolean(pinSpec && pinSpec.tier === 'config');
}

export function isRequiredPin(pinSpec: ComponentPinSpec | null | undefined): boolean {
  return Boolean(pinSpec && !isOptionalPin(pinSpec));
}

export function canAddComponent(compId: string): boolean {
  const def = getCompDef(compId);
  if (!def) return false;
  const max = def.maxPerDesign ?? 1;
  return countActiveByCompId(compId) < max;
}

export function getInstanceAddress(inst: ActiveComponentInstance): string | null {
  const def = getCompDef(inst.compId);
  if (!def || !def.i2cAddr) return null;
  if (inst.i2cAddrOverride) return inst.i2cAddrOverride;
  if (inst.compId === 'tb6612fng') {
    const shields = state.active.filter((a) => a.compId === 'tb6612fng');
    return shields.findIndex((a) => a.instanceId === inst.instanceId) === 1
      ? (def.secondI2cAddr || '0x2F')
      : def.i2cAddr;
  }
  return def.i2cAddr;
}

export function getSupportedPowerRails(def: ComponentDef | null | undefined): PowerRailChoice[] {
  if (!def || def.id === 'dc-motor' || def.onboardWirelessSlot) return [];
  if (Array.isArray(def.supportedRails) && def.supportedRails.length > 0) {
    return [...def.supportedRails];
  }
  const v = String(def.voltage || '');
  const has3v3 = /3\.3V/i.test(v);
  const has5v = /5V/i.test(v);
  if (has3v3 && has5v) return ['3V3', '5V'];
  if (has3v3 && /ONLY|Logic/i.test(v)) return ['3V3'];
  if (has3v3) return ['3V3'];
  if (has5v) return ['5V'];
  return [];
}

export function moduleSupports3v3(def: ComponentDef | null | undefined): boolean {
  if (!def) return false;
  if (def.id === 'dc-motor') return true;
  return getSupportedPowerRails(def).includes('3V3');
}

export function moduleSupportsDualPower(def: ComponentDef | null | undefined): boolean {
  const rails = getSupportedPowerRails(def);
  return rails.includes('3V3') && rails.includes('5V');
}

export function getPrimaryPowerPin(def: ComponentDef | null | undefined): ComponentPinSpec | null {
  if (!def) return null;
  return def.pins.find(
    (p) => !isOptionalPin(p) && (p.role === 'POWER_5V' || p.role === 'POWER_3V3' || p.role === 'I2C_VCC')
  ) || null;
}

export function getInstancePowerRail(inst: ActiveComponentInstance): PowerRailChoice | null {
  const def = getCompDef(inst.compId);
  const pwrPin = getPrimaryPowerPin(def);
  if (!pwrPin) return null;
  const bpId = inst.pinMap[pwrPin.id];
  if (!bpId) return null;
  const caps = getActiveBoard().pins[bpId]?.caps || [];
  if (caps.includes('3V3')) return '3V3';
  if (caps.includes('5V')) return '5V';
  return null;
}

export function moduleRequires5vLogicWarning(def: ComponentDef | null | undefined): boolean {
  const board = getActiveBoard();
  if (!def || board.electrical.logicVoltage >= 5) return false;
  if (def.id === 'dc-motor' || def.onboardWirelessSlot) return false;
  return !moduleSupports3v3(def);
}

export function getUartDefaultBaud(compId: string): number {
  if (compId === 'ld2410c' || compId === 'ld2450') return 256000;
  if (compId === 'as608') return 57600;
  return 9600;
}

/**
 * Assigns each active UART module deterministically to a Hardware UART (HW-UART1 / HW-UART2 on ESP32-S3)
 * or Software UART (SW-UART fallback on 3rd+ ESP32-S3 UART or all external K-Comp V2 UARTs).
 * High-baud modules (LD2410C, LD2450, AS608) receive priority for hardware UART controllers.
 */
export function computeUartAssignments(): Record<string, UartAssignment> {
  const board = getActiveBoard();
  const freeHwUarts = Math.max(0, (board.capabilities.hardwareUartCount || 1) - 1);
  const uartInsts = state.active.filter((i) => {
    const d = getCompDef(i.compId);
    return Boolean(d && (d.interface === 'UART' || d.onboardWirelessSlot));
  });
  if (!uartInsts.length) return {};

  const ordered = [...uartInsts].sort((a, b) => {
    const ah = HIGH_BAUD_UART_IDS.has(a.compId) ? 0 : 1;
    const bh = HIGH_BAUD_UART_IDS.has(b.compId) ? 0 : 1;
    return ah - bh;
  });

  const out: Record<string, UartAssignment> = {};
  let hwNext = 1;
  let swNext = 1;

  for (const inst of ordered) {
    const highBaud = HIGH_BAUD_UART_IDS.has(inst.compId);
    const baud = getUartDefaultBaud(inst.compId);
    if (hwNext <= freeHwUarts) {
      const ch = hwNext++;
      out[inst.instanceId] = {
        kind: 'hw',
        channel: ch,
        shortTag: `HW-U${ch}`,
        badgeLabel: `HW-UART${ch}`,
        serialObj: `Serial${ch}`,
        highBaud,
        baud
      };
    } else {
      const ch = swNext++;
      out[inst.instanceId] = {
        kind: 'sw',
        channel: ch,
        shortTag: 'SW',
        badgeLabel: 'SW-UART',
        serialObj: swNext === 2 ? 'swSerial' : `swSerial${ch}`,
        highBaud,
        baud
      };
    }
  }
  return out;
}

export function isWifiRadioActive(): boolean {
  const board = getActiveBoard();
  if (!board.capabilities.hasWifi) return false;
  return !!state.onboard.onboard_wifi;
}
