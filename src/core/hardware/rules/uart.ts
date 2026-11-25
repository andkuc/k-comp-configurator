// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Constraint Rule: Board-Aware HW-UART vs. SoftwareSerial Channel & Baud Validation
import { t } from '../../../i18n/index';
import type { WarningItem } from '../../../types';
import { computeUartAssignments, getCompDef, getDisplayLabel } from '../catalog-queries';
import type { HardwareConstraintRule, HardwareRuleContext } from './types';

export const uartConstraintRule: HardwareConstraintRule = {
  id: 'uart-channels',
  evaluate(ctx: HardwareRuleContext): WarningItem[] {
    const warns: WarningItem[] = [];
    const uartInsts = ctx.active.filter((i) => {
      const d = getCompDef(i.compId);
      return Boolean(d && (d.interface === 'UART' || d.onboardWirelessSlot));
    });
    const freeHwUarts = Math.max(0, (ctx.board.capabilities.hardwareUartCount || 1) - 1);

    if (freeHwUarts === 0 && uartInsts.length > 1) {
      const txOnlyIds = new Set(['ch9329']);
      const txInsts = uartInsts.filter((i) => txOnlyIds.has(i.compId));
      const rxInsts = uartInsts.filter((i) => !txOnlyIds.has(i.compId));
      if (txInsts.length > 0 && rxInsts.length <= 1) {
        const names = uartInsts.map((i) => getCompDef(i.compId)?.name || i.compId).join(' + ');
        const txName = getCompDef(txInsts[0].compId)?.name || 'CH9329';
        warns.push({
          critical: false,
          advisory: true,
          text: t('warn.multiUartTxOnly', { count: uartInsts.length, names, txName }),
          target: { instanceId: txInsts[0].instanceId, panIfOffscreen: true }
        });
      } else {
        warns.push({
          critical: true,
          text: t('warn.multiUart', { count: uartInsts.length }),
          target: { instanceId: (rxInsts[1] || uartInsts[1]).instanceId, panIfOffscreen: true }
        });
      }
    } else if (freeHwUarts > 0 && uartInsts.length > freeHwUarts) {
      const assigns = computeUartAssignments();
      const swInsts = uartInsts.filter((i) => assigns[i.instanceId]?.kind === 'sw');
      const highBaudOnSw = swInsts.find((i) => assigns[i.instanceId]?.highBaud);
      if (highBaudOnSw) {
        const defHb = getCompDef(highBaudOnSw.compId);
        warns.push({
          critical: true,
          text: t('warn.swUartHighBaud', {
            name: defHb ? getDisplayLabel(defHb) : highBaudOnSw.compId,
            baud: assigns[highBaudOnSw.instanceId].baud,
            max: freeHwUarts
          }),
          target: { instanceId: highBaudOnSw.instanceId, panIfOffscreen: true }
        });
      } else if (swInsts.length > 0) {
        const swNames = swInsts.map((i) => getDisplayLabel(getCompDef(i.compId))).join(' + ');
        warns.push({
          critical: false,
          advisory: true,
          text: t('warn.espSwUartAdvisory', {
            count: uartInsts.length,
            max: freeHwUarts,
            names: swNames
          }),
          target: { instanceId: swInsts[0].instanceId, panIfOffscreen: true }
        });
      }
    }
    return warns;
  }
};
