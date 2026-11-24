// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

export type DriverCompat = 'verified' | 'portable-untested' | 'avr-only' | 'unsupported';

export type CodeProfileId =
  | 'kcomp-avr'
  | 'generic-scaffold'
  | 'kcomp-portable'
  | 'oss-standard'
  | 'bare-metal'
  | 'python-node';

export interface CodeProfileMeta {
  id: CodeProfileId;
  labelKey: string;
  descKey: string;
  available: boolean;
  beta?: boolean;
  fileExt: string;
}
