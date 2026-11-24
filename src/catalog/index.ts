// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { CatalogData } from '../types';
import rawCatalog from './components.json';

export const CATALOG: CatalogData = rawCatalog as unknown as CatalogData;
