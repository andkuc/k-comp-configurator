// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Constraint Rule: I2C Bus Address Collision Detection
import { t } from '../../../i18n/index';
import type { WarningItem } from '../../../types';
import { getCompDef, getInstanceAddress } from '../catalog-queries';
import type { HardwareConstraintRule, HardwareRuleContext } from './types';

export const i2cCollisionRule: HardwareConstraintRule = {
  id: 'i2c-address-collision',
  evaluate(ctx: HardwareRuleContext): WarningItem[] {
    const warns: WarningItem[] = [];
    const addrMap: Record<string, string[]> = {};
    const addrInst: Record<string, string | null> = {};

    for (const ob of (ctx.board.onboardPeripherals || [])) {
      if (ob.i2cAddr && ctx.onboard[ob.id]) {
        if (!addrMap[ob.i2cAddr]) addrMap[ob.i2cAddr] = [];
        addrMap[ob.i2cAddr].push(ob.shortName || ob.name);
        if (addrInst[ob.i2cAddr] === undefined) addrInst[ob.i2cAddr] = null;
      }
    }

    for (const inst of ctx.active) {
      const addr = getInstanceAddress(inst);
      const def = getCompDef(inst.compId);
      if (addr && def) {
        if (!addrMap[addr]) addrMap[addr] = [];
        addrMap[addr].push(def.name);
        addrInst[addr] = inst.instanceId;
      }
    }

    for (const [addr, names] of Object.entries(addrMap)) {
      if (names.length > 1) {
        const hitInst = addrInst[addr];
        warns.push({
          critical: true,
          text: t('warn.i2cCollision', { addr, names: names.join(' + ') }),
          target: hitInst ? { instanceId: hitInst, panIfOffscreen: true } : { onboardId: 'onboard_oled' }
        });
      }
    }
    return warns;
  }
};
