// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Interactive Settings Page Modal (Skill-Level Presets & Individual Feature Toggles)
import { $, escapeHtml } from '../../core/state';
import {
  DEFAULT_SKILL_PRESET,
  settingsStore,
  type FeatureKey,
  type NamedSkillPreset
} from '../../store/settings';
import { t } from '../../i18n/index';

interface PresetCardMeta {
  id: NamedSkillPreset;
  icon: string;
  titleKey: string;
  descKey: string;
}

interface FeatureRowMeta {
  key: FeatureKey;
  labelKey: string;
  descKey: string;
  tag?: 'advanced' | 'beta';
}

interface FeatureGroupMeta {
  titleKey: string;
  items: FeatureRowMeta[];
}

const PRESET_CARDS: ReadonlyArray<PresetCardMeta> = [
  { id: 'beginner',     icon: '🌱', titleKey: 'settings.presetBeginner',     descKey: 'settings.presetBeginnerDesc' },
  { id: 'intermediate', icon: '🔧', titleKey: 'settings.presetIntermediate', descKey: 'settings.presetIntermediateDesc' },
  { id: 'professional', icon: '🚀', titleKey: 'settings.presetPro',          descKey: 'settings.presetProDesc' }
];

const FEATURE_GROUPS: ReadonlyArray<FeatureGroupMeta> = [
  {
    titleKey: 'settings.groupHardware',
    items: [
      { key: 'optionalPins',      labelKey: 'settings.featOptionalPins',      descKey: 'settings.featOptionalPinsDesc',      tag: 'advanced' },
      { key: 'powerRailSwitch',   labelKey: 'settings.featPowerRail',         descKey: 'settings.featPowerRailDesc',         tag: 'advanced' },
      { key: 'i2cAddressSwitch',  labelKey: 'settings.featI2cAddr',           descKey: 'settings.featI2cAddrDesc',           tag: 'advanced' },
      { key: 'advancedWireTools', labelKey: 'settings.featWireTools',         descKey: 'settings.featWireToolsDesc' }
    ]
  },
  {
    titleKey: 'settings.groupCode',
    items: [
      { key: 'codeBlocks',        labelKey: 'settings.featCodeBlocks',        descKey: 'settings.featCodeBlocksDesc' },
      { key: 'apiBrowser',        labelKey: 'settings.featApiBrowser',        descKey: 'settings.featApiBrowserDesc' },
      { key: 'codeProfiles',      labelKey: 'settings.featCodeProfiles',      descKey: 'settings.featCodeProfilesDesc',      tag: 'beta' }
    ]
  },
  {
    titleKey: 'settings.groupDevice',
    items: [
      { key: 'deviceWorkspace',   labelKey: 'settings.featDeviceWs',          descKey: 'settings.featDeviceWsDesc' },
      { key: 'plotterFft',        labelKey: 'settings.featPlotterFft',        descKey: 'settings.featPlotterFftDesc',        tag: 'advanced' },
      { key: 'previewWorkspaces', labelKey: 'settings.featPreviewWs',         descKey: 'settings.featPreviewWsDesc',         tag: 'beta' }
    ]
  }
];

export function renderSettingsModalBody(): void {
  const body = $('#settingsModalBody') as HTMLElement | null;
  if (!body) return;
  const cur = settingsStore.get();

  const presetsHtml = PRESET_CARDS.map((p) => {
    const active = cur.preset === p.id;
    return `
      <button type="button"
              class="settings-preset-card ${active ? 'active' : ''}"
              data-settings-preset="${p.id}"
              aria-pressed="${String(active)}">
        <div class="sp-card-top">
          <span class="sp-card-ico" aria-hidden="true">${p.icon}</span>
          <strong>${escapeHtml(t(p.titleKey))}</strong>
          ${active ? '<span class="sp-card-check" aria-hidden="true">✓</span>' : ''}
        </div>
        <span class="sp-card-desc">${escapeHtml(t(p.descKey))}</span>
      </button>`;
  }).join('');

  const customBadge = cur.preset === 'custom'
    ? `<span class="settings-custom-pill">${escapeHtml(t('settings.presetCustom'))}</span>`
    : '';

  const groupsHtml = FEATURE_GROUPS.map((grp) => {
    const rows = grp.items.map((item) => {
      const on = cur.features[item.key];
      const tagHtml = item.tag === 'advanced'
        ? `<span class="settings-tag is-adv">${escapeHtml(t('settings.tagAdvanced'))}</span>`
        : (item.tag === 'beta'
            ? `<span class="settings-tag is-beta">${escapeHtml(t('settings.tagBeta'))}</span>`
            : '');
      return `
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-title">
              <span>${escapeHtml(t(item.labelKey))}</span>
              ${tagHtml}
            </div>
            <div class="settings-row-desc">${escapeHtml(t(item.descKey))}</div>
          </div>
          <button type="button"
                  class="settings-switch ${on ? 'is-on' : ''}"
                  role="switch"
                  aria-checked="${String(on)}"
                  aria-label="${escapeHtml(t(item.labelKey))}"
                  data-settings-feature="${item.key}">
            <span class="settings-switch-thumb" aria-hidden="true"></span>
          </button>
        </div>`;
    }).join('');
    return `
      <section class="settings-group">
        <h3 class="settings-group-title">${escapeHtml(t(grp.titleKey))}</h3>
        <div class="settings-group-list">${rows}</div>
      </section>`;
  }).join('');

  body.innerHTML = `
    <div class="settings-section-head">
      <span>${escapeHtml(t('settings.presetsHeading'))}</span>
      ${customBadge}
    </div>
    <div class="settings-preset-grid" role="group" aria-label="${escapeHtml(t('settings.presetsHeading'))}">
      ${presetsHtml}
    </div>
    <div class="settings-groups-wrap">${groupsHtml}</div>
    <div class="settings-foot-row">
      <span class="settings-foot-note">${escapeHtml(t('settings.autoSavedNote'))}</span>
      <button type="button" id="btnSettingsResetDefault" class="btn btn-ghost btn-sm">${escapeHtml(t('settings.resetBtn'))}</button>
    </div>`;

  body.querySelectorAll<HTMLButtonElement>('[data-settings-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.settingsPreset;
      if (p === 'beginner' || p === 'intermediate' || p === 'professional') {
        settingsStore.applyPreset(p);
        renderSettingsModalBody();
      }
    });
  });

  body.querySelectorAll<HTMLButtonElement>('[data-settings-feature]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.settingsFeature as FeatureKey | undefined;
      if (!k) return;
      settingsStore.setFeature(k, !settingsStore.getFeature(k));
      renderSettingsModalBody();
    });
  });

  body.querySelector<HTMLButtonElement>('#btnSettingsResetDefault')?.addEventListener('click', () => {
    settingsStore.applyPreset(DEFAULT_SKILL_PRESET);
    renderSettingsModalBody();
  });
}

export function openSettingsModal(): void {
  renderSettingsModalBody();
  ($('#settingsModal') as HTMLElement | null)?.classList.remove('hidden');
}

export function closeSettingsModal(): void {
  ($('#settingsModal') as HTMLElement | null)?.classList.add('hidden');
}
