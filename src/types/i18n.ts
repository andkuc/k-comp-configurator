// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

export type LocaleCode = 'en' | 'de' | 'sq' | string;

export interface BlockGuideEntry {
  [key: string]: any;
}

export interface LocaleDefinition {
  code: string;
  label: string;
  nativeName: string;
  dir?: 'ltr' | 'rtl';
  strings: Record<string, string>;
  onboard?: Record<string, Record<string, string>>;
  dip?: Record<number, { name: string; short?: string }>;
  blockedPins?: Record<string, { short: string; long?: string }>;
  presets?: Record<string, { name: string; description?: string }>;
  categories?: Record<string, string>;
  components?: Record<string, Record<string, any>>;
  blockGuides?: Record<string, BlockGuideEntry>;
  [key: string]: any;
}
