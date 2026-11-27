// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Interactive Settings Page Modal (Skill-Level Presets, Feature Toggles & Multi-Server Compile Profiles)
import { $, escapeHtml } from '../../core/state';
import {
  probeCompilerServer,
  type CompilerHealthStatus,
  type CompilerServerProfile
} from '../../services';
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

interface ProbeFeedback {
  serverId: string;
  loading: boolean;
  status?: CompilerHealthStatus;
}

let lastProbe: ProbeFeedback | null = null;
let addServerError: string | null = null;

function renderProbeFeedbackHtml(serverId: string): string {
  if (!lastProbe || lastProbe.serverId !== serverId) return '';
  if (lastProbe.loading) {
    return `<div class="settings-srv-probe is-loading">${escapeHtml(t('settings.compilerTesting'))}</div>`;
  }
  const st = lastProbe.status;
  if (!st) return '';
  if (st.online) {
    const boardsTxt = st.boards && st.boards.length ? st.boards.join(', ') : '—';
    const queueTxt = st.queue ? `${st.queue.active}/${st.queue.maxConcurrent}` : '—';
    const latencyTxt = st.latencyMs !== undefined ? `${st.latencyMs} ms` : '—';
    const verTxt = st.serverVersion ? ` · v${st.serverVersion}` : '';
    return `
      <div class="settings-srv-probe is-ok" role="status">
        <strong>● ${escapeHtml(t('settings.compilerOnline'))}${escapeHtml(verTxt)}</strong>
        <span>${escapeHtml(t('settings.compilerProbeMeta', { latency: latencyTxt, boards: boardsTxt, queue: queueTxt }))}</span>
      </div>`;
  }
  return `
    <div class="settings-srv-probe is-err" role="status">
      <strong>○ ${escapeHtml(t('settings.compilerOffline'))}</strong>
      <span>${escapeHtml(st.message || t('settings.compilerUnreachable'))}</span>
    </div>`;
}

function renderCompilerSectionHtml(
  servers: ReadonlyArray<CompilerServerProfile>,
  activeId: string | null
): string {
  const pendingUrl = settingsStore.getPendingCompilerUrl();
  const pendingHtml = pendingUrl
    ? `<div class="settings-srv-pending" role="status">
         <div class="settings-srv-pending-txt">
           <strong>${escapeHtml(t('compiler.urlConfirmTitle'))}</strong>
           <code>${escapeHtml(pendingUrl)}</code>
         </div>
         <div class="settings-srv-pending-actions">
           <button type="button" id="btnSettingsConfirmUrlSrv" class="btn btn-primary btn-sm">${escapeHtml(t('compiler.urlConfirmAccept'))}</button>
           <button type="button" id="btnSettingsDismissUrlSrv" class="btn btn-ghost btn-sm">${escapeHtml(t('compiler.urlConfirmDismiss'))}</button>
         </div>
       </div>`
    : '';

  const serverlessActive = activeId === null;
  const serverlessRow = `
    <div class="settings-srv-row ${serverlessActive ? 'is-active' : ''}">
      <label class="settings-srv-pick">
        <input type="radio" name="settingsCompilerServer" value="" ${serverlessActive ? 'checked' : ''} data-compiler-select="" />
        <span class="settings-srv-meta">
          <span class="settings-srv-name">${escapeHtml(t('settings.compilerNoneTitle'))}</span>
          <span class="settings-srv-url">${escapeHtml(t('settings.compilerNoneDesc'))}</span>
        </span>
      </label>
    </div>`;

  const serverRows = servers.map((srv) => {
    const isAct = activeId === srv.id;
    const lockBadge = srv.authToken
      ? `<span class="settings-tag is-adv" title="${escapeHtml(t('settings.compilerTokenSet'))}">🔑</span>`
      : '';
    const builtinBadge = srv.builtin
      ? `<span class="settings-tag is-beta">${escapeHtml(t('settings.compilerBuiltinTag'))}</span>`
      : '';
    const removeBtn = !srv.builtin
      ? `<button type="button" class="btn btn-ghost btn-sm" data-compiler-remove="${escapeHtml(srv.id)}" title="${escapeHtml(t('settings.compilerRemoveTitle'))}">✕</button>`
      : '';
    return `
      <div class="settings-srv-row ${isAct ? 'is-active' : ''}">
        <div class="settings-srv-main">
          <label class="settings-srv-pick">
            <input type="radio" name="settingsCompilerServer" value="${escapeHtml(srv.id)}" ${isAct ? 'checked' : ''} data-compiler-select="${escapeHtml(srv.id)}" />
            <span class="settings-srv-meta">
              <span class="settings-srv-name">${escapeHtml(srv.label)} ${builtinBadge} ${lockBadge}</span>
              <code class="settings-srv-url">${escapeHtml(srv.url)}</code>
            </span>
          </label>
          <div class="settings-srv-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-compiler-test="${escapeHtml(srv.id)}">${escapeHtml(t('settings.compilerTestBtn'))}</button>
            ${removeBtn}
          </div>
        </div>
        ${renderProbeFeedbackHtml(srv.id)}
      </div>`;
  }).join('');

  const errHtml = addServerError
    ? `<div class="settings-srv-form-err" role="alert">${escapeHtml(addServerError)}</div>`
    : '';

  return `
    <section class="settings-group settings-compiler-group">
      <h3 class="settings-group-title">${escapeHtml(t('settings.compilerHeading'))}</h3>
      <p class="settings-compiler-sub">${escapeHtml(t('settings.compilerDesc'))}</p>
      ${pendingHtml}
      <div class="settings-group-list settings-srv-list">
        ${serverlessRow}
        ${serverRows}
      </div>
      <form id="settingsCompilerAddForm" class="settings-srv-form" autocomplete="off">
        <div class="settings-srv-form-grid">
          <input type="text" id="settingsCompilerLabel" class="settings-input" placeholder="${escapeHtml(t('settings.compilerLabelPh'))}" aria-label="${escapeHtml(t('settings.compilerLabelPh'))}" />
          <input type="url" id="settingsCompilerUrl" class="settings-input" placeholder="${escapeHtml(t('settings.compilerUrlPh'))}" aria-label="${escapeHtml(t('settings.compilerUrlPh'))}" required />
          <input type="password" id="settingsCompilerToken" class="settings-input" placeholder="${escapeHtml(t('settings.compilerTokenPh'))}" aria-label="${escapeHtml(t('settings.compilerTokenPh'))}" />
          <button type="submit" id="btnSettingsCompilerAdd" class="btn btn-primary btn-sm">+ ${escapeHtml(t('settings.compilerAddBtn'))}</button>
        </div>
        ${errHtml}
        <div class="settings-srv-privacy">${escapeHtml(t('settings.compilerTokenLocalNote'))}</div>
      </form>
    </section>`;
}

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

  const compilerHtml = renderCompilerSectionHtml(cur.compilerServers, cur.activeCompilerServerId);

  body.innerHTML = `
    <div class="settings-section-head">
      <span>${escapeHtml(t('settings.presetsHeading'))}</span>
      ${customBadge}
    </div>
    <div class="settings-preset-grid" role="group" aria-label="${escapeHtml(t('settings.presetsHeading'))}">
      ${presetsHtml}
    </div>
    <div class="settings-groups-wrap">
      ${groupsHtml}
      ${compilerHtml}
    </div>
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

  body.querySelectorAll<HTMLInputElement>('[data-compiler-select]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const id = radio.dataset.compilerSelect || null;
      settingsStore.setActiveCompilerServer(id);
      renderSettingsModalBody();
    });
  });

  body.querySelectorAll<HTMLButtonElement>('[data-compiler-test]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.compilerTest;
      if (!id) return;
      const srv = settingsStore.getCompilerServers().find((s) => s.id === id);
      if (!srv) return;
      lastProbe = { serverId: id, loading: true };
      renderSettingsModalBody();
      void probeCompilerServer(srv).then((status) => {
        if (lastProbe?.serverId === id) {
          lastProbe = { serverId: id, loading: false, status };
          renderSettingsModalBody();
        }
      });
    });
  });

  body.querySelectorAll<HTMLButtonElement>('[data-compiler-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.compilerRemove;
      if (!id) return;
      if (lastProbe?.serverId === id) lastProbe = null;
      settingsStore.removeCompilerServer(id);
      renderSettingsModalBody();
    });
  });

  body.querySelector<HTMLButtonElement>('#btnSettingsConfirmUrlSrv')?.addEventListener('click', () => {
    settingsStore.confirmPendingCompilerUrl();
    renderSettingsModalBody();
  });

  body.querySelector<HTMLButtonElement>('#btnSettingsDismissUrlSrv')?.addEventListener('click', () => {
    settingsStore.dismissPendingCompilerUrl();
    renderSettingsModalBody();
  });

  body.querySelector<HTMLFormElement>('#settingsCompilerAddForm')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const labelEl = body.querySelector<HTMLInputElement>('#settingsCompilerLabel');
    const urlEl = body.querySelector<HTMLInputElement>('#settingsCompilerUrl');
    const tokenEl = body.querySelector<HTMLInputElement>('#settingsCompilerToken');
    const rawUrl = urlEl?.value || '';
    try {
      addServerError = null;
      settingsStore.addCompilerServer(
        {
          label: labelEl?.value || '',
          url: rawUrl,
          authToken: tokenEl?.value || undefined
        },
        true
      );
      renderSettingsModalBody();
    } catch {
      addServerError = t('settings.compilerInvalidUrl');
      renderSettingsModalBody();
    }
  });

  body.querySelector<HTMLButtonElement>('#btnSettingsResetDefault')?.addEventListener('click', () => {
    settingsStore.applyPreset(DEFAULT_SKILL_PRESET);
    renderSettingsModalBody();
  });
}

export function openSettingsModal(): void {
  addServerError = null;
  renderSettingsModalBody();
  ($('#settingsModal') as HTMLElement | null)?.classList.remove('hidden');
}

export function closeSettingsModal(): void {
  ($('#settingsModal') as HTMLElement | null)?.classList.add('hidden');
}
