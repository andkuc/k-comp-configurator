// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Headless L0 Hardware Self-Test Protocol (@KTEST) Parser & Soll/Ist Evaluator
import type { McuArchitecture } from '../types';

export const KTEST_PREFIX = '@KTEST';

export interface SelfTestExpectedI2cDevice {
  readonly id: string;
  readonly label: string;
  readonly address: number;
  readonly addressHex: string;
  readonly alternateAddresses: ReadonlyArray<number>;
  readonly source: 'onboard' | 'external';
  readonly compId?: string;
}

export interface SelfTestPinCheck {
  readonly boardPinId: string;
  readonly mcuPinExpr: string;
  readonly label: string;
  readonly mode: 'analog' | 'digital-in' | 'digital-pullup';
  readonly source: 'onboard' | 'external';
}

export interface SelfTestActuatorCheck {
  readonly boardPinId: string;
  readonly mcuPinExpr: string;
  readonly label: string;
  readonly kind: 'led' | 'buzzer' | 'pwm';
  readonly source: 'onboard' | 'external';
}

export interface SelfTestDipRequirement {
  readonly dipId: number;
  readonly name: string;
  readonly pin: string;
  readonly expectedOn: boolean;
  readonly actualOn: boolean;
}

export interface SelfTestUnconnectedPin {
  readonly compName: string;
  readonly compPinId: string;
}

export interface SelfTestDeadmanPin {
  readonly boardPinId: string;
  readonly mcuPinExpr: string;
  readonly label: string;
  readonly activeLow: boolean;
}

export interface SelfTestSpec {
  readonly boardId: string;
  readonly boardName: string;
  readonly boardShortName: string;
  readonly mcu: McuArchitecture;
  readonly baudRate: number;
  readonly i2cPins: {
    readonly sda: string;
    readonly scl: string;
    readonly sdaExpr: string;
    readonly sclExpr: string;
  };
  readonly deadmanPin?: SelfTestDeadmanPin;
  readonly expectedI2c: ReadonlyArray<SelfTestExpectedI2cDevice>;
  readonly inputPins: ReadonlyArray<SelfTestPinCheck>;
  readonly actuators: ReadonlyArray<SelfTestActuatorCheck>;
  readonly dipChecks: ReadonlyArray<SelfTestDipRequirement>;
  readonly unconnectedPins: ReadonlyArray<SelfTestUnconnectedPin>;
}

export interface SelfTestFrame {
  readonly v: number;
  readonly board: string;
  readonly i2c: ReadonlyArray<number>;
  readonly pins: Readonly<Record<string, number>>;
  readonly act: boolean;
  readonly rawLine: string;
  readonly receivedAtMs: number;
}

export type SelfTestCheckStatus = 'pass' | 'fail' | 'warn' | 'info' | 'pending';

export interface SelfTestCheckItem {
  readonly id: string;
  readonly category: 'preflight' | 'i2c' | 'pin' | 'actuator';
  readonly label: string;
  readonly status: SelfTestCheckStatus;
  readonly detail: string;
  readonly hint?: string;
  readonly addressHex?: string;
  readonly value?: number;
}

export interface SelfTestEvaluation {
  readonly overall: 'pending' | 'pass' | 'warn' | 'fail';
  readonly passCount: number;
  readonly warnCount: number;
  readonly failCount: number;
  readonly boardMismatch: boolean;
  readonly frame: SelfTestFrame | null;
  readonly items: ReadonlyArray<SelfTestCheckItem>;
  readonly unexpectedI2c: ReadonlyArray<number>;
}

/** Formats a 7-bit I2C address as canonical uppercase hex (e.g. 60 -> "0x3C"). */
export function formatHexAddr(addr: number): string {
  const clamped = Math.max(0, Math.min(0x7f, Math.floor(addr)));
  return `0x${clamped.toString(16).toUpperCase().padStart(2, '0')}`;
}

/** Parses a 7-bit I2C address from hex string ("0x3C"), decimal string ("60"), or number. */
export function parseHexAddr(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 0x03 && raw <= 0x77 ? raw : null;
  }
  if (typeof raw !== 'string') return null;
  const clean = raw.trim();
  if (!clean) return null;
  let val: number;
  if (/^0x[0-9a-f]+$/i.test(clean)) {
    val = parseInt(clean.slice(2), 16);
  } else if (/^\d+$/.test(clean)) {
    val = parseInt(clean, 10);
  } else {
    return null;
  }
  return Number.isInteger(val) && val >= 0x03 && val <= 0x77 ? val : null;
}

/**
 * Parses a single `@KTEST {...}` serial line into a structured `SelfTestFrame`.
 * Tolerates surrounding whitespace and ignores non-`@KTEST` or malformed JSON lines safely.
 */
export function parseKTestLine(line: string, receivedAtMs: number = Date.now()): SelfTestFrame | null {
  if (!line) return null;
  const trimmed = line.trim();
  if (!trimmed.startsWith(KTEST_PREFIX)) return null;
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart === -1) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(jsonStart));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;

  const v = typeof obj.v === 'number' && Number.isFinite(obj.v) ? Math.floor(obj.v) : 1;
  const board = typeof obj.board === 'string' ? obj.board.trim() : '';

  const i2cSet = new Set<number>();
  if (Array.isArray(obj.i2c)) {
    for (const rawAddr of obj.i2c) {
      const addr = parseHexAddr(rawAddr as string | number);
      if (addr !== null) i2cSet.add(addr);
    }
  }
  const i2c = Array.from(i2cSet).sort((a, b) => a - b);

  const pins: Record<string, number> = {};
  if (obj.pins && typeof obj.pins === 'object' && !Array.isArray(obj.pins)) {
    for (const [k, rawVal] of Object.entries(obj.pins as Record<string, unknown>)) {
      if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
        pins[k] = rawVal;
      }
    }
  }

  const act = obj.act === true || obj.act === 1;

  return {
    v,
    board,
    i2c,
    pins,
    act,
    rawLine: trimmed,
    receivedAtMs
  };
}

/**
 * Deterministically evaluates an incoming `@KTEST` frame against the expected `SelfTestSpec`.
 * Detects missing I2C devices, address-switch mismatches (e.g. 0x77 found instead of 0x76),
 * unexpected bus responders, live pin readings, DIP switch conflicts, and unconnected pins.
 */
export function evaluateSelfTestReport(
  spec: SelfTestSpec,
  frame: SelfTestFrame | null
): SelfTestEvaluation {
  const items: SelfTestCheckItem[] = [];
  const boardMismatch = Boolean(frame && frame.board && frame.board !== spec.boardId);

  // 1. Pre-flight wiring & DIP checks (evaluated immediately even before a @KTEST frame arrives)
  for (const unconn of spec.unconnectedPins) {
    items.push({
      id: `preflight_unconn_${unconn.compName}_${unconn.compPinId}`,
      category: 'preflight',
      label: `${unconn.compName} (${unconn.compPinId})`,
      status: 'warn',
      detail: 'Unconnected required pin',
      hint: 'Assign a free board pin in the Hardware workspace before flashing.'
    });
  }

  for (const dip of spec.dipChecks) {
    if (dip.expectedOn !== dip.actualOn) {
      items.push({
        id: `preflight_dip_${dip.dipId}`,
        category: 'preflight',
        label: `DIP S1-${dip.dipId} (${dip.name})`,
        status: 'warn',
        detail: dip.expectedOn ? 'Must be ON' : 'Must be OFF',
        hint: `Set physical switch S1-${dip.dipId} (${dip.pin}) to ${dip.expectedOn ? 'ON' : 'OFF'}.`
      });
    }
  }

  if (boardMismatch && frame) {
    items.push({
      id: 'preflight_board_mismatch',
      category: 'preflight',
      label: 'Target Board ID',
      status: 'warn',
      detail: `Reported "${frame.board}", expected "${spec.boardId}"`,
      hint: 'Verify that the selected board in the top bar matches the connected USB device.'
    });
  }

  // 2. Expected I2C devices
  const foundSet = new Set<number>(frame ? frame.i2c : []);
  const accountedAddrs = new Set<number>();

  for (const dev of spec.expectedI2c) {
    if (!frame) {
      items.push({
        id: `i2c_${dev.id}`,
        category: 'i2c',
        label: dev.label,
        addressHex: dev.addressHex,
        status: 'pending',
        detail: `Expected @ ${dev.addressHex} (${spec.i2cPins.sda}/${spec.i2cPins.scl})`
      });
      continue;
    }

    if (foundSet.has(dev.address)) {
      accountedAddrs.add(dev.address);
      items.push({
        id: `i2c_${dev.id}`,
        category: 'i2c',
        label: dev.label,
        addressHex: dev.addressHex,
        status: 'pass',
        detail: `ACK @ ${dev.addressHex}`
      });
      continue;
    }

    const altHit = dev.alternateAddresses.find((alt) => foundSet.has(alt));
    if (altHit !== undefined) {
      accountedAddrs.add(altHit);
      const altHex = formatHexAddr(altHit);
      items.push({
        id: `i2c_${dev.id}`,
        category: 'i2c',
        label: dev.label,
        addressHex: dev.addressHex,
        status: 'warn',
        detail: `Expected ${dev.addressHex}, found ${altHex}`,
        hint: `Alternate address ${altHex} responded — check module SDO/AD0 address jumper or switch address in Wiring tab.`
      });
      continue;
    }

    items.push({
      id: `i2c_${dev.id}`,
      category: 'i2c',
      label: dev.label,
      addressHex: dev.addressHex,
      status: 'fail',
      detail: `No ACK @ ${dev.addressHex}`,
      hint: `Check power rail, GND, and ${spec.i2cPins.sda}/${spec.i2cPins.scl} wiring.`
    });
  }

  // 3. Unexpected I2C responders on the bus
  const unexpectedI2c: number[] = [];
  if (frame) {
    for (const addr of frame.i2c) {
      if (!accountedAddrs.has(addr)) {
        unexpectedI2c.push(addr);
        const hex = formatHexAddr(addr);
        items.push({
          id: `i2c_extra_${hex}`,
          category: 'i2c',
          label: `I2C Device ${hex}`,
          addressHex: hex,
          status: 'warn',
          detail: `Unexpected ACK @ ${hex}`,
          hint: 'Connected I2C device is not placed in the current Hardware configuration (or uses an alternate address).'
        });
      }
    }
  }

  // 4. Wired Input Pin Live Readings
  for (const pin of spec.inputPins) {
    if (!frame) {
      items.push({
        id: `pin_${pin.boardPinId}`,
        category: 'pin',
        label: `${pin.label} (${pin.boardPinId})`,
        status: 'pending',
        detail: pin.mode === 'analog' ? 'Analog input' : 'Digital input'
      });
      continue;
    }
    const val = frame.pins[pin.boardPinId];
    if (val !== undefined) {
      const valueText = pin.mode === 'analog' ? `ADC = ${val}` : (val === 0 ? 'LOW (0)' : 'HIGH (1)');
      items.push({
        id: `pin_${pin.boardPinId}`,
        category: 'pin',
        label: `${pin.label} (${pin.boardPinId})`,
        status: 'info',
        detail: valueText,
        value: val
      });
    } else {
      items.push({
        id: `pin_${pin.boardPinId}`,
        category: 'pin',
        label: `${pin.label} (${pin.boardPinId})`,
        status: 'pending',
        detail: 'No reading reported'
      });
    }
  }

  // 5. Deadman-Guarded Actuators
  for (const act of spec.actuators) {
    items.push({
      id: `act_${act.boardPinId}`,
      category: 'actuator',
      label: `${act.label} (${act.boardPinId})`,
      status: frame?.act ? 'pass' : 'info',
      detail: frame?.act ? 'Pulse triggered (safe timeout)' : 'Idle (deadman-guarded)'
    });
  }

  const passCount = items.filter((i) => i.status === 'pass').length;
  const warnCount = items.filter((i) => i.status === 'warn').length;
  const failCount = items.filter((i) => i.status === 'fail').length;

  let overall: SelfTestEvaluation['overall'];
  if (!frame) {
    overall = 'pending';
  } else if (failCount > 0) {
    overall = 'fail';
  } else if (warnCount > 0) {
    overall = 'warn';
  } else {
    overall = 'pass';
  }

  return {
    overall,
    passCount,
    warnCount,
    failCount,
    boardMismatch,
    frame,
    items,
    unexpectedI2c
  };
}
