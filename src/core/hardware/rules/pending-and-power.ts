// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Constraint Rules: Pending/Unassigned Pins (Action Required) & 5V USB Power Budget Check
import { t } from '../../../i18n/index';
import type { ActiveComponentInstance, WarningItem, WarningQuickAction } from '../../../types';
import { getCompDef, getDisplayLabel } from '../catalog-queries';
import { getPendingPins } from '../pin-allocator';
import { computeUsbCurrent } from '../resources';
import type { HardwareConstraintRule, HardwareRuleContext } from './types';

export const pendingPinsRule: HardwareConstraintRule = {
  id: 'pending-unassigned-pins',
  evaluate(): WarningItem[] {
    const warns: WarningItem[] = [];
    const pending = getPendingPins();
    for (const pp of pending) {
      const capStr = (pp.pinSpec.allowedTypes || ['IO']).join('/');
      const seenOb = new Set<string>();
      const quickBtns: WarningQuickAction[] = [];
      for (const c of pp.eligibleOnboard) {
        if (!c.onboardBy || seenOb.has(c.onboardBy.onboardId)) continue;
        seenOb.add(c.onboardBy.onboardId);
        quickBtns.push({
          onboardId: c.onboardBy.onboardId,
          label: `${c.onboardBy.name}${c.onboardBy.dip ? ' (S1-' + c.onboardBy.dip + ')' : ''} → ${c.id}`
        });
      }
      const firstElig = pp.eligibleOnboard[0];
      warns.push({
        critical: true,
        actionNeeded: true,
        text: t('warn.actionNeeded', { name: getDisplayLabel(pp.def), pin: pp.pinSpec.id, caps: capStr }),
        quickActions: quickBtns.slice(0, 4),
        target: {
          instanceId: pp.inst.instanceId,
          pinId: firstElig ? firstElig.id : null,
          dipNum: firstElig && firstElig.onboardBy ? firstElig.onboardBy.dip : null,
          panIfOffscreen: true
        }
      });
    }
    return warns;
  }
};

export const usbPowerBudgetRule: HardwareConstraintRule = {
  id: 'usb-power-budget',
  evaluate(ctx: HardwareRuleContext): WarningItem[] {
    const cur = computeUsbCurrent();
    const maxMa = ctx.board.electrical.usbMaxMa;
    if (cur.total < Math.round(maxMa * 0.9)) return [];

    let topInst: ActiveComponentInstance | null = null;
    let topMa = -1;
    for (const inst of ctx.active) {
      const m = getCompDef(inst.compId)?.currentMa || 0;
      if (m > topMa) {
        topMa = m;
        topInst = inst;
      }
    }
    return [{
      critical: true,
      text: t('warn.usbPower', { total: cur.total, max: maxMa }),
      target: topInst ? { instanceId: topInst.instanceId, panIfOffscreen: true } : null
    }];
  }
};
