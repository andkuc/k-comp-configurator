// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// K-Comp Configurator — Shared Constants, Canvas Base Geometry & Version Metadata
export const ASSET_VERSION = '0.3.6';
export const APP_VERSION = '0.3.6';
export const COPYRIGHT_AUTHOR = 'Andreas Kucher';
export const COPYRIGHT_YEARS = '2025-2026';
export const COPYRIGHT_NOTICE = 'Copyright (c) 2025-2026 Andreas Kucher';
export const SPDX_LICENSE = 'PolyForm-Noncommercial-1.0.0';
export const LICENSE_URL = 'https://polyformproject.org/licenses/noncommercial/1.0.0/';
export const CONFIGURATOR_REPO_URL = 'https://github.com/andkuc/k-comp-configurator';
export const HARDWARE_REPO_URL = 'https://github.com/andkuc/k-comp';

export const SVG_NS = 'http://www.w3.org/2000/svg';
export const BASE_VB = { x: 0, y: 0, w: 1320, h: 690 };
export const GRID_SNAP = 12;
export const MAX_HISTORY = 40;

export function resolveAssetUrl(relPath: string): string {
  if (!relPath) return relPath;
  if (/^(?:https?:|data:|blob:|\/)/i.test(relPath)) return relPath;
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL)
    ? import.meta.env.BASE_URL
    : './';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return `${cleanBase}${relPath.replace(/^\.?\//, '')}`;
}
