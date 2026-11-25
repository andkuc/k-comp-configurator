// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Constraint Rule: ADC2 + Active Wi-Fi Conflict Check with 1-Click Move-to-ADC1 Quick Fix
import { t } from '../../../i18n/index';
import type { BoardProfile, WarningItem } from '../../../types';
import { getCompDef, getDisplayLabel, isWifiRadioActive } from '../catalog-queries';
import { getSuitableBoardPins } from '../pin-allocator';
import type { HardwareConstraintRule, HardwareRuleContext } from './types';

export const adc2WifiConflictRule: HardwareConstraintRule = {
  id: 'adc2-wifi-conflict',
  appliesTo: (board: BoardProfile) => Boolean(board.capabilities.adc2WifiConflictPins?.length),
  evaluate(ctx: HardwareRuleContext): WarningItem[] {
    const adc2Set = new Set(ctx.board.capabilities.adc2WifiConflictPins || []);
    const adc1Set = new Set(ctx.board.capabilities.adc1Pins || []);
    if (!adc2Set.size || !isWifiRadioActive()) return [];

    const warns: WarningItem[] = [];
    for (const inst of ctx.active) {
      const def = getCompDef(inst.compId);
      if (!def) continue;
      for (const p of def.pins) {
        const bpId = inst.pinMap[p.id];
        if (bpId && p.role === 'ANALOG' && adc2Set.has(bpId)) {
          const safeAdc1 = getSuitableBoardPins(p, inst.instanceId, p.id, def)
            .find((c) => !c.takenBy && !c.onboardBy && !c.strapping && !c.isDefaultI2c && adc1Set.has(c.id));
          warns.push({
            critical: true,
            text: t('warn.adc2WifiConflict', { pin: bpId, name: getDisplayLabel(def) }),
            quickActions: safeAdc1 ? [{
              pinReassign: { instanceId: inst.instanceId, compPinId: p.id, newPinId: safeAdc1.id },
              label: t('warn.moveToAdc1Btn', { pin: safeAdc1.id })
            }] : [],
            target: { instanceId: inst.instanceId, pinId: bpId, onboardId: 'onboard_wifi', panIfOffscreen: true }
          });
        }
      }
    }
    return warns;
  }
};
