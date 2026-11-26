// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Skill-Level Presets (Beginner | Intermediate | Professional) & Granular Feature-Flag Store
import { appBus } from './bus';

export type SkillLevelPreset = 'beginner' | 'intermediate' | 'professional' | 'custom';
export type NamedSkillPreset = Exclude<SkillLevelPreset, 'custom'>;

export interface FeatureSettings {
  /** Hardware & Pin Mapping */
  optionalPins: boolean;
  powerRailSwitch: boolean;
  i2cAddressSwitch: boolean;
  advancedWireTools: boolean;
  /** Code & Reference */
  codeBlocks: boolean;
  apiBrowser: boolean;
  codeProfiles: boolean;
  /** Device & Telemetry */
  deviceWorkspace: boolean;
  plotterFft: boolean;
  /** Preview Workspaces */
  previewWorkspaces: boolean;
}

export type FeatureKey = keyof FeatureSettings;

export interface UserSettingsState {
  preset: SkillLevelPreset;
  features: FeatureSettings;
}

export const SETTINGS_STORAGE_KEY = 'kcomp_settings_v1';
export const DEFAULT_SKILL_PRESET: NamedSkillPreset = 'professional';

export const SKILL_PRESETS: Readonly<Record<NamedSkillPreset, Readonly<FeatureSettings>>> = {
  beginner: {
    optionalPins: false,
    powerRailSwitch: false,
    i2cAddressSwitch: false,
    advancedWireTools: false,
    codeBlocks: true,
    apiBrowser: true,
    codeProfiles: false,
    deviceWorkspace: true,
    plotterFft: false,
    previewWorkspaces: false
  },
  intermediate: {
    optionalPins: true,
    powerRailSwitch: false,
    i2cAddressSwitch: true,
    advancedWireTools: true,
    codeBlocks: true,
    apiBrowser: true,
    codeProfiles: false,
    deviceWorkspace: true,
    plotterFft: false,
    previewWorkspaces: false
  },
  professional: {
    optionalPins: true,
    powerRailSwitch: true,
    i2cAddressSwitch: true,
    advancedWireTools: true,
    codeBlocks: true,
    apiBrowser: true,
    codeProfiles: true,
    deviceWorkspace: true,
    plotterFft: true,
    previewWorkspaces: true
  }
};

export const FEATURE_KEYS: ReadonlyArray<FeatureKey> = [
  'optionalPins',
  'powerRailSwitch',
  'i2cAddressSwitch',
  'advancedWireTools',
  'codeBlocks',
  'apiBrowser',
  'codeProfiles',
  'deviceWorkspace',
  'plotterFft',
  'previewWorkspaces'
];

type SettingsListener = (state: Readonly<UserSettingsState>) => void;

function cloneFeatures(src: Readonly<FeatureSettings>): FeatureSettings {
  return { ...src };
}

export function detectMatchingPreset(features: Readonly<FeatureSettings>): SkillLevelPreset {
  for (const name of ['beginner', 'intermediate', 'professional'] as const) {
    const ref = SKILL_PRESETS[name];
    if (FEATURE_KEYS.every((k) => features[k] === ref[k])) {
      return name;
    }
  }
  return 'custom';
}

function isNamedPreset(val: string | null | undefined): val is NamedSkillPreset {
  return val === 'beginner' || val === 'intermediate' || val === 'professional';
}

function detectUrlPreset(): NamedSkillPreset | null {
  try {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get('level') || params.get('preset') || '').toLowerCase().trim();
    if (raw === 'pro') return 'professional';
    if (raw === 'inter' || raw === 'advanced') return 'intermediate';
    if (isNamedPreset(raw)) return raw;
  } catch (_) {}
  return null;
}

function loadPersistedSettings(): UserSettingsState {
  const fromUrl = detectUrlPreset();
  if (fromUrl) {
    return { preset: fromUrl, features: cloneFeatures(SKILL_PRESETS[fromUrl]) };
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { preset?: string; features?: Partial<Record<FeatureKey, unknown>> };
        const basePreset: NamedSkillPreset = isNamedPreset(parsed.preset) ? parsed.preset : DEFAULT_SKILL_PRESET;
        const merged = cloneFeatures(SKILL_PRESETS[basePreset]);
        if (parsed.features && typeof parsed.features === 'object') {
          for (const k of FEATURE_KEYS) {
            if (typeof parsed.features[k] === 'boolean') {
              merged[k] = parsed.features[k] as boolean;
            }
          }
        }
        return { preset: detectMatchingPreset(merged), features: merged };
      }
    }
  } catch (_) {}

  return {
    preset: DEFAULT_SKILL_PRESET,
    features: cloneFeatures(SKILL_PRESETS[DEFAULT_SKILL_PRESET])
  };
}

function persistSettings(next: Readonly<UserSettingsState>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    }
  } catch (_) {}
}

let currentState: UserSettingsState = {
  preset: DEFAULT_SKILL_PRESET,
  features: cloneFeatures(SKILL_PRESETS[DEFAULT_SKILL_PRESET])
};
const listeners = new Set<SettingsListener>();

function snapshot(): UserSettingsState {
  return {
    preset: currentState.preset,
    features: cloneFeatures(currentState.features)
  };
}

function broadcast(): void {
  const snap = snapshot();
  for (const fn of Array.from(listeners)) {
    fn(snap);
  }
  appBus.emit('settings:changed', { preset: snap.preset });
}

export const settingsStore = {
  /** Hydrates settings from `?level=` URL param or `localStorage` (called once at app startup). */
  init(): UserSettingsState {
    currentState = loadPersistedSettings();
    broadcast();
    return snapshot();
  },

  get(): Readonly<UserSettingsState> {
    return snapshot();
  },

  getPreset(): SkillLevelPreset {
    return currentState.preset;
  },

  getFeature(key: FeatureKey): boolean {
    return currentState.features[key];
  },

  applyPreset(preset: NamedSkillPreset, persist = true): UserSettingsState {
    currentState = {
      preset,
      features: cloneFeatures(SKILL_PRESETS[preset])
    };
    if (persist) persistSettings(currentState);
    broadcast();
    return snapshot();
  },

  setFeature(key: FeatureKey, enabled: boolean, persist = true): UserSettingsState {
    const nextVal = Boolean(enabled);
    if (currentState.features[key] === nextVal) return snapshot();
    const nextFeatures = cloneFeatures(currentState.features);
    nextFeatures[key] = nextVal;
    currentState = {
      preset: detectMatchingPreset(nextFeatures),
      features: nextFeatures
    };
    if (persist) persistSettings(currentState);
    broadcast();
    return snapshot();
  },

  subscribe(listener: SettingsListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Resets to default preset & clears listeners (primarily for unit tests). */
  reset(preset: NamedSkillPreset = DEFAULT_SKILL_PRESET): void {
    currentState = {
      preset,
      features: cloneFeatures(SKILL_PRESETS[preset])
    };
    listeners.clear();
  }
};
