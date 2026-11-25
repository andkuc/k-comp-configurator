// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Constraint Rule: 3.3V Logic-Level Safety Guard & Dual-Rail Power Advisories
import { t } from '../../../i18n/index';
import type { WarningItem } from '../../../types';
import {
  getCompDef,
  getDisplayLabel,
  getInstancePowerRail,
  moduleRequires5vLogicWarning,
  moduleSupportsDualPower
} from '../catalog-queries';
import type { HardwareConstraintRule, HardwareRuleContext } from './types';

export const logicLevel3v3Rule: HardwareConstraintRule = {
  id: 'logic-level-3v3',
  evaluate(ctx: HardwareRuleContext): WarningItem[] {
    const warns: WarningItem[] = [];
    const is3v3Board = ctx.board.electrical.logicVoltage < 5;

    for (const inst of ctx.active) {
      const def = getCompDef(inst.compId);
      if (!def) continue;

      if (is3v3Board && moduleRequires5vLogicWarning(def)) {
        warns.push({
          critical: true,
          text: t('warn.logicLevel3v3', { name: getDisplayLabel(def), board: ctx.board.shortName }),
          target: { instanceId: inst.instanceId, panIfOffscreen: true }
        });
        continue;
      }

      if (moduleSupportsDualPower(def)) {
        const activeRail = getInstancePowerRail(inst);
        if (is3v3Board && activeRail === '5V') {
          warns.push({
            critical: false,
            advisory: true,
            text: t('warn.dualRail5vOn3v3', { name: getDisplayLabel(def), board: ctx.board.shortName }),
            target: { instanceId: inst.instanceId, panIfOffscreen: true }
          });
        } else if (!is3v3Board && activeRail === '3V3') {
          warns.push({
            critical: false,
            advisory: true,
            text: t('warn.dualRail3v3On5v', { name: getDisplayLabel(def), board: ctx.board.shortName }),
            target: { instanceId: inst.instanceId, panIfOffscreen: true }
          });
        }
      }
    }
    return warns;
  }
};
