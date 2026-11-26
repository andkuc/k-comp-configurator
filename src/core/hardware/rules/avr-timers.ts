// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Constraint Rule: ATmega328P Hardware Timer1 & Timer2 Conflict Guard (Servo, 433MHz RH_ASK, Buzzer tone(), PWM & IR-TX)
import { t } from '../../../i18n/index';
import type { BoardProfile, WarningItem, WarningQuickAction } from '../../../types';
import { getCompDef, getDisplayLabel } from '../catalog-queries';
import { getSuitableBoardPins } from '../pin-allocator';
import type { HardwareConstraintRule, HardwareRuleContext } from './types';

export const AVR_TIMER1_SERVO_IDS: ReadonlySet<string> = new Set(['sg90-180', 'sg90-360', 'hcsr04-sg90']);
export const AVR_TIMER1_RF433_IDS: ReadonlySet<string> = new Set(['rf433-tx', 'rf433-rx']);
export const AVR_TIMER1_PWM_PINS: ReadonlySet<string> = new Set(['D9', 'D10']);
export const AVR_TIMER2_PWM_PINS: ReadonlySet<string> = new Set(['D3', 'D11']);

export function isAnalogWritePwmConsumer(compId: string): boolean {
  return !AVR_TIMER1_SERVO_IDS.has(compId) && compId !== 'ir-tx';
}

export const avrHardwareTimerRule: HardwareConstraintRule = {
  id: 'avr-hardware-timers',
  appliesTo: (board: BoardProfile) => board.mcu === 'atmega328p',
  evaluate(ctx: HardwareRuleContext): WarningItem[] {
    const warns: WarningItem[] = [];

    const servoInsts = ctx.active.filter((i) => AVR_TIMER1_SERVO_IDS.has(i.compId));
    const rf433Insts = ctx.active.filter((i) => AVR_TIMER1_RF433_IDS.has(i.compId));
    const irTxInst = ctx.active.find((i) => i.compId === 'ir-tx') || null;
    const buzzerActive = Boolean(ctx.onboard.onboard_buzzer);

    const timer1OwnerInst = servoInsts[0] || rf433Insts[0] || null;
    const timer1Claimed = Boolean(timer1OwnerInst);

    // 1. CRITICAL: Servo (Timer1) + 433 MHz RH_ASK (Timer1) ISR collision (TIMER1_COMPA_vect)
    if (servoInsts.length > 0 && rf433Insts.length > 0) {
      const servoLbl = getDisplayLabel(getCompDef(servoInsts[0].compId));
      const rfLbl = getDisplayLabel(getCompDef(rf433Insts[0].compId));
      warns.push({
        critical: true,
        text: t('warn.avrTimer1ServoRf', { servo: servoLbl, rf: rfLbl }),
        target: { instanceId: rf433Insts[0].instanceId, panIfOffscreen: true }
      });
    }

    // Helper: pick the best free PWM pin avoiding busy hardware timers
    const findSafePwmPin = (
      instId: string,
      compPinId: string,
      avoidPins: ReadonlySet<string>
    ): string | null => {
      const inst = ctx.active.find((i) => i.instanceId === instId);
      const def = inst ? getCompDef(inst.compId) : null;
      const pSpec = def?.pins.find((p) => p.id === compPinId);
      if (!def || !pSpec) return null;

      const cands = getSuitableBoardPins(pSpec, instId, compPinId, def);
      // Prefer a free pin avoiding BOTH busy timers first, then fallback to avoiding only the conflicting timer
      const strictSafe = cands.find((c) => {
        if (c.takenBy || c.onboardBy) return false;
        if (avoidPins.has(c.id)) return false;
        if (timer1Claimed && AVR_TIMER1_PWM_PINS.has(c.id)) return false;
        if (buzzerActive && AVR_TIMER2_PWM_PINS.has(c.id)) return false;
        return true;
      });
      if (strictSafe) return strictSafe.id;

      const looseSafe = cands.find((c) => !c.takenBy && !c.onboardBy && !avoidPins.has(c.id));
      return looseSafe ? looseSafe.id : null;
    };

    // 2. CRITICAL: Timer1 seized (Servo or 433 MHz RH_ASK) disables analogWrite() PWM on ~D9 / ~D10
    if (timer1Claimed && timer1OwnerInst) {
      const ownerName = getDisplayLabel(getCompDef(timer1OwnerInst.compId));
      for (const inst of ctx.active) {
        if (!isAnalogWritePwmConsumer(inst.compId)) continue;
        const def = getCompDef(inst.compId);
        if (!def) continue;
        for (const p of def.pins) {
          if (p.role !== 'PWM') continue;
          const bpId = inst.pinMap[p.id];
          if (!bpId || !AVR_TIMER1_PWM_PINS.has(bpId)) continue;

          const safePin = findSafePwmPin(inst.instanceId, p.id, AVR_TIMER1_PWM_PINS);
          const quickActions: WarningQuickAction[] = safePin
            ? [{
                pinReassign: { instanceId: inst.instanceId, compPinId: p.id, newPinId: safePin },
                label: t('warn.moveToPinBtn', { pin: safePin })
              }]
            : [];

          warns.push({
            critical: true,
            text: t('warn.avrTimer1Pwm', {
              name: getDisplayLabel(def),
              pin: bpId,
              owner: ownerName
            }),
            quickActions,
            target: { instanceId: inst.instanceId, pinId: bpId, panIfOffscreen: true }
          });
        }
      }
    }

    // 3. CRITICAL: Onboard Buzzer (tone() on Timer2) disables analogWrite() PWM on ~D3 / ~D11
    let hasTimer2PwmUser = false;
    for (const inst of ctx.active) {
      if (!isAnalogWritePwmConsumer(inst.compId)) continue;
      const def = getCompDef(inst.compId);
      if (!def) continue;
      for (const p of def.pins) {
        if (p.role !== 'PWM') continue;
        const bpId = inst.pinMap[p.id];
        if (!bpId || !AVR_TIMER2_PWM_PINS.has(bpId)) continue;
        hasTimer2PwmUser = true;

        if (!buzzerActive) continue;
        const safePin = findSafePwmPin(inst.instanceId, p.id, AVR_TIMER2_PWM_PINS);
        const quickActions: WarningQuickAction[] = [];
        if (safePin) {
          quickActions.push({
            pinReassign: { instanceId: inst.instanceId, compPinId: p.id, newPinId: safePin },
            label: t('warn.moveToPinBtn', { pin: safePin })
          });
        } else {
          quickActions.push({
            onboardId: 'onboard_buzzer',
            label: 'Buzzer (S1-6)'
          });
        }

        warns.push({
          critical: true,
          text: t('warn.avrTimer2BuzzerPwm', {
            name: getDisplayLabel(def),
            pin: bpId
          }),
          quickActions,
          target: { instanceId: inst.instanceId, pinId: bpId, onboardId: 'onboard_buzzer', panIfOffscreen: true }
        });
      }
    }

    // 4. ADVISORY: IR-TX alongside Timer2 users (Buzzer or ~D3/~D11 PWM)
    // kcomp_ir_transmitter.h uses bit-banging (Timer2-safe), whereas third-party IRremote claims Timer2!
    if (irTxInst && (buzzerActive || hasTimer2PwmUser)) {
      warns.push({
        critical: false,
        advisory: true,
        text: t('warn.avrTimer2IrTxAdvisory'),
        target: {
          instanceId: irTxInst.instanceId,
          ...(buzzerActive ? { onboardId: 'onboard_buzzer' } : {}),
          panIfOffscreen: true
        }
      });
    }

    return warns;
  }
};
