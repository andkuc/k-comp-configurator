// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Constraint Rules: Wireless Slot Conflict, DC Motor Driver Check & Declarative Onboard Peripheral Pin Conflicts
import { t } from '../../../i18n/index';
import type { WarningItem } from '../../../types';
import { getCompDef } from '../catalog-queries';
import type { HardwareConstraintRule, HardwareRuleContext } from './types';

export const wirelessSlotRule: HardwareConstraintRule = {
  id: 'wireless-slot-conflict',
  evaluate(ctx: HardwareRuleContext): WarningItem[] {
    const wirelessInsts = ctx.active.filter((i) => getCompDef(i.compId)?.onboardWirelessSlot);
    if (wirelessInsts.length <= 1) return [];
    return [{
      critical: true,
      text: t('warn.wirelessConflict'),
      target: { instanceId: wirelessInsts[1].instanceId, onboardId: 'onboard_wireless', panIfOffscreen: true }
    }];
  }
};

export const dcMotorDriverRule: HardwareConstraintRule = {
  id: 'dc-motor-driver',
  evaluate(ctx: HardwareRuleContext): WarningItem[] {
    const dcMotorInst = ctx.active.find((i) => i.compId === 'dc-motor');
    if (!dcMotorInst || ctx.active.some((i) => i.compId === 'tb6612fng')) return [];
    return [{
      critical: true,
      text: t('warn.dcNeedsDriver'),
      target: { instanceId: dcMotorInst.instanceId, panIfOffscreen: true }
    }];
  }
};

export const onboardPeripheralConflictRule: HardwareConstraintRule = {
  id: 'onboard-peripheral-pin-conflict',
  evaluate(ctx: HardwareRuleContext): WarningItem[] {
    const warns: WarningItem[] = [];
    for (const ob of (ctx.board.onboardPeripherals || [])) {
      if (!ctx.onboard[ob.id] || !ob.conflictPins?.length) continue;
      const hitPin = ob.conflictPins.find((pid) => Boolean(ctx.extClaims[pid]));
      if (hitPin) {
        const claim = ctx.extClaims[hitPin];
        warns.push({
          critical: true,
          text: t(ob.conflictWarningKey || 'warn.ultrasonicConflict'),
          target: { instanceId: claim.instanceId, pinId: hitPin, onboardId: ob.id, panIfOffscreen: true }
        });
      }
    }
    return warns;
  }
};
