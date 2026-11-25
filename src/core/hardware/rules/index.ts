// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pluggable Hardware Constraint Rule Registry & Evaluator
import { state } from '../../state';
import { getActiveBoard } from '../../../boards';
import type { WarningItem } from '../../../types';
import { getExternalPinClaims } from '../pin-allocator';
import type { HardwareConstraintRule, HardwareRuleContext } from './types';
import { i2cCollisionRule } from './i2c-collision';
import { dcMotorDriverRule, onboardPeripheralConflictRule, wirelessSlotRule } from './onboard-conflict';
import { uartConstraintRule } from './uart';
import { logicLevel3v3Rule } from './voltage-level';
import { strappingPinRule } from './strapping';
import { adc2WifiConflictRule } from './adc2-wifi';
import { pendingPinsRule, usbPowerBudgetRule } from './pending-and-power';

export type { HardwareConstraintRule, HardwareRuleContext } from './types';
export {
  i2cCollisionRule,
  wirelessSlotRule,
  dcMotorDriverRule,
  onboardPeripheralConflictRule,
  uartConstraintRule,
  logicLevel3v3Rule,
  strappingPinRule,
  adc2WifiConflictRule,
  pendingPinsRule,
  usbPowerBudgetRule
};

export const DEFAULT_CONSTRAINT_RULES: ReadonlyArray<HardwareConstraintRule> = [
  i2cCollisionRule,
  wirelessSlotRule,
  dcMotorDriverRule,
  onboardPeripheralConflictRule,
  uartConstraintRule,
  logicLevel3v3Rule,
  strappingPinRule,
  adc2WifiConflictRule,
  pendingPinsRule,
  usbPowerBudgetRule
];

export function evaluateConstraintRules(
  ctx: HardwareRuleContext,
  rules: ReadonlyArray<HardwareConstraintRule> = DEFAULT_CONSTRAINT_RULES
): WarningItem[] {
  const warns: WarningItem[] = [];
  for (const rule of rules) {
    if (rule.appliesTo && !rule.appliesTo(ctx.board)) continue;
    const hits = rule.evaluate(ctx);
    if (hits.length) warns.push(...hits);
  }
  return warns;
}

export function computeCriticalWarnings(
  rules: ReadonlyArray<HardwareConstraintRule> = DEFAULT_CONSTRAINT_RULES
): WarningItem[] {
  const board = getActiveBoard();
  const ctx: HardwareRuleContext = {
    board,
    active: state.active,
    onboard: state.onboard,
    extClaims: getExternalPinClaims()
  };
  return evaluateConstraintRules(ctx, rules);
}
