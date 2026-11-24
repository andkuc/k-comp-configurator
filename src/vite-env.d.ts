// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
/// <reference types="vite/client" />

import type { BoardProfile, HooksRegistry, WorkbenchState } from './types';

declare global {
  interface Window {
    KCOMP_BOARD?: BoardProfile;
    __KCOMP_STATE?: WorkbenchState;
    __KCOMP_HOOKS?: HooksRegistry;
  }
}
