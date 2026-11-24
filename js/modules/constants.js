// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// K-Comp Configurator — Shared Constants, Geometry & Version Metadata
export const ASSET_VERSION = '0.1.0';
export const APP_VERSION = '0.1.0';
export const COPYRIGHT_AUTHOR = 'Andreas Kucher';
export const COPYRIGHT_YEARS = '2025-2026';
export const COPYRIGHT_NOTICE = 'Copyright (c) 2025-2026 Andreas Kucher';
export const SPDX_LICENSE = 'PolyForm-Noncommercial-1.0.0';
export const LICENSE_URL = 'https://polyformproject.org/licenses/noncommercial/1.0.0/';
export const CONFIGURATOR_REPO_URL = 'https://github.com/andkuc/k-comp-configurator';
export const HARDWARE_REPO_URL = 'https://github.com/andkuc/k-comp';

export const SVG_NS = 'http://www.w3.org/2000/svg';
export const BASE_VB = { x: 0, y: 0, w: 1320, h: 690 };
export const BOARD_TX = 354;
export const BOARD_TY = 134;
export const BOARD_SCALE = 1.15;
export const BOARD_RIGHT = BOARD_TX + 532 * BOARD_SCALE;   // ~965.8
export const BOARD_BOTTOM = BOARD_TY + 358 * BOARD_SCALE;  // ~545.7
export const GRID_SNAP = 12;
export const MAX_HISTORY = 40;

// Exact red Prototyping Area (Breadboard) hole coordinates from assets/kcomp-v2.svg (rect212 & line213..line220)
export const BB_COLS = 16;
export const BB_COL_X = Array.from({ length: BB_COLS }, (_, i) => 293.5 + i * 9.5);
export const BB_TOP_Y = [24, 36, 48, 58];
export const BB_BOT_Y = [78, 90, 102, 112];
