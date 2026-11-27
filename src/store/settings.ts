// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Skill-Level Presets (Beginner | Intermediate | Professional), Feature Flags & Compiler Server Profile Store
import {
  normalizeCompilerServerUrl,
  type CompilerServerProfile
} from '../services/compiler-provider';
import { appBus } from './bus';

export type { CompilerServerProfile };

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
  /** Local-only compile server profiles (stored in localStorage, never in .kcomp.json or #cfg=). */
  compilerServers: CompilerServerProfile[];
  /** Active compile server profile ID, or null for serverless (local .hex/.bin upload only) mode. */
  activeCompilerServerId: string | null;
}

export const SETTINGS_STORAGE_KEY = 'kcomp_settings_v1';
export const DEFAULT_SKILL_PRESET: NamedSkillPreset = 'professional';

export const DEFAULT_LOCAL_COMPILER_SERVER: Readonly<CompilerServerProfile> = {
  id: 'local-docker',
  label: 'Local (Docker)',
  url: 'http://localhost:8787',
  builtin: true
};

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

function cloneServers(src: ReadonlyArray<CompilerServerProfile>): CompilerServerProfile[] {
  return src.map((s) => ({
    id: s.id,
    label: s.label,
    url: s.url,
    ...(s.authToken ? { authToken: s.authToken } : {}),
    ...(s.builtin ? { builtin: true } : {})
  }));
}

function defaultServers(): CompilerServerProfile[] {
  return [{ ...DEFAULT_LOCAL_COMPILER_SERVER }];
}

function sanitizePersistedServers(raw: unknown): CompilerServerProfile[] {
  const out: CompilerServerProfile[] = [];
  const seenIds = new Set<string>();

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : '';
      const rawUrl = typeof obj.url === 'string' ? obj.url : '';
      const normUrl = normalizeCompilerServerUrl(rawUrl);
      if (!id || !normUrl || seenIds.has(id)) continue;
      seenIds.add(id);
      const label = typeof obj.label === 'string' && obj.label.trim() ? obj.label.trim() : normUrl;
      const authToken = typeof obj.authToken === 'string' && obj.authToken.trim() ? obj.authToken.trim() : undefined;
      const builtin = id === DEFAULT_LOCAL_COMPILER_SERVER.id || obj.builtin === true;
      out.push({
        id,
        label,
        url: normUrl,
        ...(authToken ? { authToken } : {}),
        ...(builtin ? { builtin: true } : {})
      });
    }
  }

  if (!seenIds.has(DEFAULT_LOCAL_COMPILER_SERVER.id)) {
    out.unshift({ ...DEFAULT_LOCAL_COMPILER_SERVER });
  }
  return out;
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

/**
 * Safely parses a `?compiler=<url>` query parameter into a normalized HTTP(S) URL.
 * Never activates or persists the server automatically — requires explicit user confirmation.
 */
export function parseCompilerUrlParam(search?: string): string | null {
  try {
    const rawSearch = search !== undefined ? search : (typeof window !== 'undefined' ? window.location.search : '');
    if (!rawSearch) return null;
    const params = new URLSearchParams(rawSearch);
    const raw = params.get('compiler');
    if (!raw) return null;
    return normalizeCompilerServerUrl(raw);
  } catch {
    return null;
  }
}

function deriveLabelFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host || url;
  } catch {
    return url;
  }
}

function loadPersistedSettings(): UserSettingsState {
  const fromUrl = detectUrlPreset();
  let servers = defaultServers();
  let activeServerId: string | null = null;
  let preset: SkillLevelPreset = DEFAULT_SKILL_PRESET;
  let features = cloneFeatures(SKILL_PRESETS[DEFAULT_SKILL_PRESET]);

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          preset?: string;
          features?: Partial<Record<FeatureKey, unknown>>;
          compilerServers?: unknown;
          activeCompilerServerId?: unknown;
        };
        servers = sanitizePersistedServers(parsed.compilerServers);
        if (typeof parsed.activeCompilerServerId === 'string') {
          const exists = servers.some((s) => s.id === parsed.activeCompilerServerId);
          activeServerId = exists ? parsed.activeCompilerServerId : null;
        }
        const basePreset: NamedSkillPreset = isNamedPreset(parsed.preset) ? parsed.preset : DEFAULT_SKILL_PRESET;
        const merged = cloneFeatures(SKILL_PRESETS[basePreset]);
        if (parsed.features && typeof parsed.features === 'object') {
          for (const k of FEATURE_KEYS) {
            if (typeof parsed.features[k] === 'boolean') {
              merged[k] = parsed.features[k] as boolean;
            }
          }
        }
        preset = detectMatchingPreset(merged);
        features = merged;
      }
    }
  } catch (_) {}

  if (fromUrl) {
    preset = fromUrl;
    features = cloneFeatures(SKILL_PRESETS[fromUrl]);
  }

  return {
    preset,
    features,
    compilerServers: servers,
    activeCompilerServerId: activeServerId
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
  features: cloneFeatures(SKILL_PRESETS[DEFAULT_SKILL_PRESET]),
  compilerServers: defaultServers(),
  activeCompilerServerId: null
};
let pendingCompilerUrl: string | null = null;
const listeners = new Set<SettingsListener>();

function snapshot(): UserSettingsState {
  return {
    preset: currentState.preset,
    features: cloneFeatures(currentState.features),
    compilerServers: cloneServers(currentState.compilerServers),
    activeCompilerServerId: currentState.activeCompilerServerId
  };
}

function broadcast(compilerChanged = false): void {
  const snap = snapshot();
  for (const fn of Array.from(listeners)) {
    fn(snap);
  }
  appBus.emit('settings:changed', { preset: snap.preset });
  if (compilerChanged) {
    appBus.emit('compiler:changed', { serverId: snap.activeCompilerServerId });
  }
}

export const settingsStore = {
  /** Hydrates settings from `?level=` / `?compiler=` URL params or `localStorage` (called once at app startup). */
  init(): UserSettingsState {
    currentState = loadPersistedSettings();
    const urlCompiler = parseCompilerUrlParam();
    const activeUrl = this.getActiveCompilerServer()?.url || null;
    pendingCompilerUrl = urlCompiler && urlCompiler !== activeUrl ? urlCompiler : null;
    broadcast(true);
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
      ...currentState,
      preset,
      features: cloneFeatures(SKILL_PRESETS[preset])
    };
    if (persist) persistSettings(currentState);
    broadcast(false);
    return snapshot();
  },

  setFeature(key: FeatureKey, enabled: boolean, persist = true): UserSettingsState {
    const nextVal = Boolean(enabled);
    if (currentState.features[key] === nextVal) return snapshot();
    const nextFeatures = cloneFeatures(currentState.features);
    nextFeatures[key] = nextVal;
    currentState = {
      ...currentState,
      preset: detectMatchingPreset(nextFeatures),
      features: nextFeatures
    };
    if (persist) persistSettings(currentState);
    broadcast(false);
    return snapshot();
  },

  getCompilerServers(): CompilerServerProfile[] {
    return cloneServers(currentState.compilerServers);
  },

  getActiveCompilerServerId(): string | null {
    return currentState.activeCompilerServerId;
  },

  getActiveCompilerServer(): CompilerServerProfile | null {
    if (!currentState.activeCompilerServerId) return null;
    const found = currentState.compilerServers.find((s) => s.id === currentState.activeCompilerServerId);
    return found ? { ...found } : null;
  },

  setActiveCompilerServer(serverId: string | null, persist = true): UserSettingsState {
    const nextId =
      serverId && currentState.compilerServers.some((s) => s.id === serverId)
        ? serverId
        : null;
    if (currentState.activeCompilerServerId === nextId) return snapshot();
    currentState = {
      ...currentState,
      activeCompilerServerId: nextId
    };
    if (persist) persistSettings(currentState);
    broadcast(true);
    return snapshot();
  },

  addCompilerServer(
    input: { label: string; url: string; authToken?: string; id?: string },
    activate = true,
    persist = true
  ): CompilerServerProfile {
    const normUrl = normalizeCompilerServerUrl(input.url);
    if (!normUrl) {
      throw new Error(`Invalid compile server URL: "${input.url}"`);
    }
    const cleanLabel = input.label.trim() || deriveLabelFromUrl(normUrl);
    const cleanToken = input.authToken?.trim() || undefined;
    const baseId = input.id?.trim() || `srv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    let uniqueId = baseId;
    let suffix = 2;
    while (currentState.compilerServers.some((s) => s.id === uniqueId)) {
      uniqueId = `${baseId}_${suffix++}`;
    }

    const profile: CompilerServerProfile = {
      id: uniqueId,
      label: cleanLabel,
      url: normUrl,
      ...(cleanToken ? { authToken: cleanToken } : {})
    };
    currentState = {
      ...currentState,
      compilerServers: [...cloneServers(currentState.compilerServers), profile],
      activeCompilerServerId: activate ? profile.id : currentState.activeCompilerServerId
    };
    if (persist) persistSettings(currentState);
    broadcast(true);
    return { ...profile };
  },

  updateCompilerServer(
    serverId: string,
    patch: { label?: string; url?: string; authToken?: string },
    persist = true
  ): CompilerServerProfile | null {
    const idx = currentState.compilerServers.findIndex((s) => s.id === serverId);
    if (idx === -1) return null;
    const existing = currentState.compilerServers[idx];
    const nextUrl = patch.url !== undefined ? normalizeCompilerServerUrl(patch.url) : existing.url;
    if (!nextUrl) {
      throw new Error(`Invalid compile server URL: "${patch.url}"`);
    }
    const nextLabel = patch.label !== undefined ? (patch.label.trim() || deriveLabelFromUrl(nextUrl)) : existing.label;
    const nextToken = patch.authToken !== undefined
      ? (patch.authToken.trim() || undefined)
      : existing.authToken;

    const updated: CompilerServerProfile = {
      id: existing.id,
      label: nextLabel,
      url: nextUrl,
      ...(nextToken ? { authToken: nextToken } : {}),
      ...(existing.builtin ? { builtin: true } : {})
    };
    const nextList = cloneServers(currentState.compilerServers);
    nextList[idx] = updated;
    currentState = {
      ...currentState,
      compilerServers: nextList
    };
    if (persist) persistSettings(currentState);
    broadcast(true);
    return { ...updated };
  },

  removeCompilerServer(serverId: string, persist = true): UserSettingsState {
    const target = currentState.compilerServers.find((s) => s.id === serverId);
    if (!target || target.builtin) return snapshot();
    const nextList = cloneServers(currentState.compilerServers).filter((s) => s.id !== serverId);
    const nextActive = currentState.activeCompilerServerId === serverId ? null : currentState.activeCompilerServerId;
    currentState = {
      ...currentState,
      compilerServers: nextList,
      activeCompilerServerId: nextActive
    };
    if (persist) persistSettings(currentState);
    broadcast(true);
    return snapshot();
  },

  getPendingCompilerUrl(): string | null {
    return pendingCompilerUrl;
  },

  setPendingCompilerUrl(rawUrl: string | null): void {
    pendingCompilerUrl = rawUrl ? normalizeCompilerServerUrl(rawUrl) : null;
    broadcast(false);
  },

  confirmPendingCompilerUrl(customLabel?: string, persist = true): CompilerServerProfile | null {
    if (!pendingCompilerUrl) return null;
    const url = pendingCompilerUrl;
    pendingCompilerUrl = null;
    const existing = currentState.compilerServers.find((s) => s.url === url);
    if (existing) {
      currentState = {
        ...currentState,
        activeCompilerServerId: existing.id
      };
      if (persist) persistSettings(currentState);
      broadcast(true);
      return { ...existing };
    }
    return this.addCompilerServer(
      { label: customLabel?.trim() || deriveLabelFromUrl(url), url },
      true,
      persist
    );
  },

  dismissPendingCompilerUrl(): void {
    if (!pendingCompilerUrl) return;
    pendingCompilerUrl = null;
    broadcast(false);
  },

  subscribe(listener: SettingsListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Resets to default preset, default local server profile, serverless mode & clears listeners (primarily for unit tests). */
  reset(preset: NamedSkillPreset = DEFAULT_SKILL_PRESET): void {
    currentState = {
      preset,
      features: cloneFeatures(SKILL_PRESETS[preset]),
      compilerServers: defaultServers(),
      activeCompilerServerId: null
    };
    pendingCompilerUrl = null;
    listeners.clear();
  }
};
