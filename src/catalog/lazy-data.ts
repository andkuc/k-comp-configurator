// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// On-Demand Dynamic Loaders for Large Reference Datasets (library-api-data & component-guide-data)
import type { ComponentGuideEntry, LibraryApiEntry } from '../types';

let cachedLibraryApi: Record<string, LibraryApiEntry> | null = null;
let libraryApiPromise: Promise<Record<string, LibraryApiEntry>> | null = null;

let cachedComponentGuides: Record<string, ComponentGuideEntry> | null = null;
let componentGuidesPromise: Promise<Record<string, ComponentGuideEntry>> | null = null;

export function getCachedLibraryApi(): Record<string, LibraryApiEntry> | null {
  return cachedLibraryApi;
}

export async function loadLibraryApiData(): Promise<Record<string, LibraryApiEntry>> {
  if (cachedLibraryApi) return cachedLibraryApi;
  if (!libraryApiPromise) {
    libraryApiPromise = import('./library-api-data').then((mod) => {
      cachedLibraryApi = mod.LIBRARY_API;
      return cachedLibraryApi;
    });
  }
  return libraryApiPromise;
}

export function getCachedComponentGuides(): Record<string, ComponentGuideEntry> | null {
  return cachedComponentGuides;
}

export async function loadComponentGuides(): Promise<Record<string, ComponentGuideEntry>> {
  if (cachedComponentGuides) return cachedComponentGuides;
  if (!componentGuidesPromise) {
    componentGuidesPromise = import('./component-guide-data').then((mod) => {
      cachedComponentGuides = mod.COMPONENT_GUIDES;
      return cachedComponentGuides;
    });
  }
  return componentGuidesPromise;
}
