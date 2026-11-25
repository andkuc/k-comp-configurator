// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Constraint Rule: Strapping-Pin Boot Advisory with 1-Click Safe-GPIO Quick Fix
import { t } from '../../../i18n/index';
import type { BoardProfile, WarningItem } from '../../../types';
import { getCompDef, getDisplayLabel } from '../catalog-queries';
import { getSuitableBoardPins } from '../pin-allocator';
import type { HardwareConstraintRule, HardwareRuleContext } from './types';

export const strappingPinRule: HardwareConstraintRule = {
  id: 'strapping-pins',
  appliesTo: (board: BoardProfile) => Boolean(board.capabilities.strappingPins?.length),
  evaluate(ctx: HardwareRuleContext): WarningItem[] {
    const strappingSet = new Set(ctx.board.capabilities.strappingPins || []);
    if (!strappingSet.size) return [];

    const warns: WarningItem[] = [];
    for (const inst of ctx.active) {
      const def = getCompDef(inst.compId);
      if (!def) continue;
      for (const p of def.pins) {
        const bpId = inst.pinMap[p.id];
        if (bpId && strappingSet.has(bpId)) {
          const safeCand = getSuitableBoardPins(p, inst.instanceId, p.id, def)
            .find((c) => !c.takenBy && !c.onboardBy && !c.strapping && !c.isDefaultI2c);
          warns.push({
            critical: false,
            advisory: true,
            text: t('warn.strappingPin', { pin: bpId, name: getDisplayLabel(def) }),
            quickActions: safeCand ? [{
              pinReassign: { instanceId: inst.instanceId, compPinId: p.id, newPinId: safeCand.id },
              label: t('warn.moveToPinBtn', { pin: safeCand.id })
            }] : [],
            target: { instanceId: inst.instanceId, pinId: bpId, panIfOffscreen: true }
          });
        }
      }
    }
    return warns;
  }
};
