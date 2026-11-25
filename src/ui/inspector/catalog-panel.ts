// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Left Component Catalog Panel (Topic/Bus Grouping, Filtering, Portrait Module Cards & Quick Locate)
import { resolveAssetUrl } from '../../core/constants';
import { state, $, escapeHtml, isMobileViewport, setMobileView } from '../../core/state';
import { addComponent, countActiveByCompId, getDisplayLabel } from '../../core/hardware';
import { t, tComp, tCategory } from '../../i18n/index';
import { appBus } from '../../store/bus';
import { uiSessionStore } from '../../store/ui-session';

export function renderCategoryTabs(): void {
  const field: 'topic' | 'category' = state.groupMode === 'topic' ? 'topic' : 'category';
  const components = state.catalog?.components || [];
  const rawCats = [...new Set(components.map((c) => c[field]).filter((v): v is string => Boolean(v)))];
  const cats = ['All', ...rawCats];
  if (!cats.includes(state.category)) state.category = 'All';

  document.querySelectorAll<HTMLElement>('.grp-mode-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.groupMode === state.groupMode);
  });

  const container = $('#categoryTabs') as HTMLElement | null;
  if (!container) return;
  container.innerHTML = cats.map((c) =>
    `<button class="cat-btn ${state.category === c ? 'active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(tCategory(c))}</button>`
  ).join('');
  container.querySelectorAll<HTMLElement>('.cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.category = btn.dataset.cat || 'All';
      renderCategoryTabs();
      renderCatalogList();
    });
  });
}

export function badgeClass(iface: string): string {
  if (iface.includes('I2C')) return 'badge-i2c';
  if (iface.includes('UART') || iface.includes('SLOT')) return 'badge-uart';
  if (iface.includes('PWM')) return 'badge-pwm';
  if (iface.includes('ANALOG')) return 'badge-analog';
  if (iface.includes('DRIVER')) return 'badge-warn';
  return '';
}

export function shortInterfaceLabel(iface: string): string {
  if (iface === 'ONBOARD SLOT') return t('iface.slot');
  if (iface === 'DRIVER ONLY') return t('iface.driver');
  if (iface === 'INTERRUPT') return 'INT';
  if (iface === 'ANALOG / DIG') return 'ANALOG';
  if (iface === 'PWM / DIG') return 'PWM';
  return iface;
}

export function renderCatalogList(): void {
  const q = state.search.trim().toLowerCase();
  const field: 'topic' | 'category' = state.groupMode === 'topic' ? 'topic' : 'category';
  const components = state.catalog?.components || [];
  const list = components.filter((c) => {
    if (state.category !== 'All' && c[field] !== state.category) return false;
    if (!q) return true;
    const infoTxt = c.studentInfo ? String(c.studentInfo.whatItDoes || '') : '';
    const locSub = tComp(c, 'subtitle');
    const locName = getDisplayLabel(c);
    return `${locName} ${locSub} ${c.friendlyName || ''} ${c.name} ${c.subtitle || ''} ${c.topic || ''} ${c.interface} ${c.i2cAddr || ''} ${infoTxt}`.toLowerCase().includes(q);
  });

  const container = $('#catalogList') as HTMLElement | null;
  if (!container) return;
  container.innerHTML = list.map((c) => {
    const cnt = countActiveByCompId(c.id);
    const max = c.maxPerDesign ?? 1;
    const maxed = cnt >= max;
    const btnText = maxed ? (max === 1 ? '✓' : `${cnt}/${max}`) : (cnt ? `${cnt}/${max}` : '+');
    const roleTitle = getDisplayLabel(c);
    const limitTitle = maxed
      ? t('catalog.maxTitle', { max, reason: tComp(c, 'maxReason') || t('catalog.limitReached') })
      : t('catalog.addTitle', { role: roleTitle, model: c.name });
    const secondBadge = c.protoArea
      ? `<span class="badge badge-proto" title="${escapeHtml(tComp(c, 'protoNote') || t('catalog.protoFallback'))}">PROTO</span>`
      : (c.i2cAddr
          ? `<span class="badge">${c.i2cAddr}</span>`
          : ((c.voltage || '').includes('ONLY') ? `<span class="badge badge-warn">3.3V!</span>` : ''));

    const activeCountChip = cnt
      ? `<span class="cat-active-qty" title="${escapeHtml(t('catalog.placedCount', { count: cnt }))}">×${cnt}</span>`
      : '';
    const locateBtn = cnt
      ? `<button class="cat-locate-btn" type="button" data-cat-locate="${c.id}" title="${escapeHtml(t('catalog.locateTitle', { role: roleTitle }))}" aria-label="${escapeHtml(t('catalog.locateTitle', { role: roleTitle }))}">⌖</button>`
      : '';

    return `
      <div class="cat-item ${cnt ? 'added' : ''} ${maxed ? 'maxed' : ''}" data-add="${c.id}" title="${escapeHtml(limitTitle)}">
        <div class="cat-card-top">
          <div class="cat-badges-inline">
            <span class="badge ${badgeClass(c.interface)}">${shortInterfaceLabel(c.interface)}</span>
            ${secondBadge}
          </div>
          <div class="cat-card-actions">
            ${locateBtn}
            <button class="cat-info-btn" type="button" data-info="${c.id}" title="${escapeHtml(t('catalog.infoTitle', { role: roleTitle }))}">i</button>
            <button class="cat-add-btn" type="button" aria-label="${escapeHtml(t('catalog.addAria', { role: roleTitle }))}">${btnText}</button>
          </div>
        </div>
        <div class="cat-thumb-stage">
          <img class="cat-thumb" src="${resolveAssetUrl(c.svgFile)}" alt="${escapeHtml(roleTitle)}" loading="lazy" />
        </div>
        <div class="cat-meta">
          <div class="cat-role">${escapeHtml(roleTitle)}${activeCountChip}</div>
          <div class="cat-model">${escapeHtml(c.name)}</div>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll<HTMLElement>('.cat-locate-btn').forEach((btn) => {
    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      const cid = btn.dataset.catLocate;
      if (!cid) return;
      const matches = state.active.filter((i) => i.compId === cid);
      if (!matches.length) return;
      const curIdx = matches.findIndex((i) => i.instanceId === state.focusedId);
      const next = matches[(curIdx + 1) % matches.length];
      state.focusedId = next.instanceId;
      uiSessionStore.patch({ focusedId: next.instanceId });
      if (isMobileViewport()) setMobileView('board');
      appBus.emit('workspace:recompute');
      appBus.emit('target:flash', { instanceId: next.instanceId, panIfOffscreen: true });
    });
  });

  container.querySelectorAll<HTMLElement>('.cat-info-btn').forEach((btn) => {
    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      const cid = btn.dataset.info;
      if (cid) appBus.emit('modal:openComponentInfo', { compId: cid });
    });
  });

  container.querySelectorAll<HTMLElement>('.cat-item').forEach((item) => {
    const cid = item.dataset.add;
    if (!cid) return;
    item.addEventListener('click', (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('.cat-info-btn') || target?.closest('.cat-locate-btn')) return;
      void addComponent(cid);
    });
    if (item.classList.contains('added')) {
      item.addEventListener('mouseenter', () => appBus.emit('hover:hw', { hwId: cid }));
      item.addEventListener('mouseleave', () => appBus.emit('hover:hw', { hwId: null }));
    }
  });
}
