// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Declarative Pluggable Hardware Constraint Rule Interface
import type { ActiveComponentInstance, BoardProfile, PinClaim, WarningItem } from '../../../types';

export interface HardwareRuleContext {
  readonly board: BoardProfile;
  readonly active: ReadonlyArray<ActiveComponentInstance>;
  readonly onboard: Readonly<Record<string, boolean>>;
  readonly extClaims: Readonly<Record<string, PinClaim>>;
}

export interface HardwareConstraintRule {
  readonly id: string;
  readonly appliesTo?: (board: BoardProfile) => boolean;
  evaluate(ctx: HardwareRuleContext): WarningItem[];
}
