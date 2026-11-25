// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Footer Resource Gauges (SRAM / 5V USB Current), Clickable Warnings Bar & Canvas Tooltips
import { state, $, escapeHtml, formatRamAmount } from '../../core/state';
import {
  getExternalPinClaims,
  getOnboardPinUsage,
  reassignComponentPin,
  toggleOnboardComponent
} from '../../core/hardware';
import { t, tBlockedPin } from '../../i18n/index';
import { getActiveBoard } from '../../boards';
import { appBus } from '../../store/bus';
import { uiSessionStore } from '../../store/ui-session';
import type { SramBreakdown, UsbCurrentEstimate, WarningItem } from '../../types';

export function renderSram(sramInfo: SramBreakdown | number | null | undefined): void {
  const isObj = typeof sramInfo === 'object' && sramInfo !== null;
  const used = isObj ? sramInfo.used : Number(sramInfo || 0);
  const total = isObj ? sramInfo.total : getActiveBoard().electrical.sramBytes;
  const breakdown = isObj && Array.isArray(sramInfo.breakdown) ? sramInfo.breakdown : [];
  const pct = Math.min(100, Math.round((used / total) * 100));
  const pill = $('#sramText') as HTMLElement | null;
  if (pill) {
    const lvl = pct >= 85 ? 'danger' : pct >= 70 ? 'warn' : 'ok';
    pill.innerHTML = `<span class="gauge-lbl">SRAM ${pct}%</span><span class="gauge-track"><span class="gauge-fill is-${lvl}" style="width:${pct}%"></span></span>`;
    const fmt = formatRamAmount(used, total);
    const head = total >= 16384
      ? `RAM: ${fmt.usedStr} / ${fmt.totalStr} (${pct}%)`
      : t('bottom.sramTitle', { used, total });
    pill.title = breakdown.length ? `${head}\n${breakdown.join('\n')}` : head;
    pill.className = 'sram-pill has-gauge' + (lvl !== 'ok' ? ' ' + lvl : '');
  }

  const oledBtn = $('#btnOledMode') as HTMLElement | null;
  if (oledBtn) {
    const oledOn = getActiveBoard().onboardPeripherals.some((o) => o.modeToggle && state.onboard[o.id]);
    oledBtn.classList.toggle('hidden', !oledOn);
    if (oledOn) {
      const suggest = !state.oledPaged && pct >= 70;
      oledBtn.textContent = state.oledPaged ? t('bottom.oledPaged') : (suggest ? t('bottom.oledSuggest') : t('bottom.oledFull'));
      oledBtn.className = 'btn-oled-mode' + (state.oledPaged ? ' is-paged' : (suggest ? ' suggest-paged' : ''));
      oledBtn.title = state.oledPaged ? t('bottom.oledPagedTitle') : t('bottom.oledFullTitle');
    }
  }
}

export function renderCurrent(cur: UsbCurrentEstimate): void {
  const pill = $('#currentText') as HTMLElement | null;
  if (!pill) return;
  const maxMa = getActiveBoard().electrical.usbMaxMa;
  const pct = Math.min(100, Math.round((cur.total / maxMa) * 100));
  const lvl = cur.total >= 450 ? 'danger' : cur.total >= 350 ? 'warn' : 'ok';
  pill.innerHTML = `<span class="gauge-lbl">5V ~${cur.total}mA</span><span class="gauge-track"><span class="gauge-fill is-${lvl}" style="width:${pct}%"></span></span>`;
  pill.title = `${t('bottom.currentTitle', { total: cur.total, max: maxMa })}\n${cur.breakdown.join('\n')}`;
  pill.className = 'sram-pill current-pill has-gauge' + (lvl !== 'ok' ? ' ' + lvl : '');
}

export function renderWarnings(warns: WarningItem[]): void {
  const bar = $('#warningsBar') as HTMLElement | null;
  if (!bar) return;
  if (!warns.length) {
    bar.classList.add('hidden');
    bar.classList.remove('is-advisory-only');
    return;
  }
  bar.classList.remove('hidden');
  bar.classList.toggle('is-advisory-only', warns.every((w) => !!w.advisory));
  bar.innerHTML = warns.map((w, idx) => {
    const quickHtml = (w.quickActions && w.quickActions.length)
      ? w.quickActions.map((qa) => qa.pinReassign
          ? `<button class="warn-quick-btn" type="button" data-quick-inst="${escapeHtml(qa.pinReassign.instanceId)}" data-quick-cpin="${escapeHtml(qa.pinReassign.compPinId)}" data-quick-npin="${escapeHtml(qa.pinReassign.newPinId)}">${escapeHtml(qa.label)}</button>`
          : `<button class="warn-quick-btn" type="button" data-quick-free="${escapeHtml(qa.onboardId || '')}">${escapeHtml(t('warn.disableBtn', { label: qa.label }))}</button>`
        ).join('')
      : '';
    const hasTarget = !!w.target;
    const locateHint = hasTarget ? ` title="${escapeHtml(t('warn.clickToLocate'))}"` : '';
    const jumpIcon = hasTarget ? `<span class="warn-locate-ico" aria-hidden="true">⌖</span>` : '';
    const ico = w.actionNeeded ? '⚡' : (w.advisory ? 'ℹ' : '⚠');
    const cls = `warn-item${w.actionNeeded ? ' action-needed' : ''}${w.advisory ? ' is-advisory' : ''}${hasTarget ? ' is-clickable' : ''}`;
    return `<div class="${cls}" data-warn-idx="${idx}"${locateHint}><span>${ico}</span><span class="warn-text">${escapeHtml(w.text)}</span>${quickHtml}${jumpIcon}</div>`;
  }).join('');

  bar.querySelectorAll<HTMLElement>('[data-quick-free]').forEach((btn) => {
    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      const obId = btn.dataset.quickFree;
      if (obId) toggleOnboardComponent(obId);
    });
  });

  bar.querySelectorAll<HTMLElement>('[data-quick-npin]').forEach((btn) => {
    btn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      const inst = btn.dataset.quickInst;
      const cpin = btn.dataset.quickCpin;
      const npin = btn.dataset.quickNpin;
      if (inst && cpin && npin) reassignComponentPin(inst, cpin, npin);
    });
  });

  bar.querySelectorAll<HTMLElement>('.warn-item.is-clickable').forEach((row) => {
    row.addEventListener('click', (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('[data-quick-free]') || target?.closest('[data-quick-npin]')) return;
      const idx = parseInt(row.dataset.warnIdx || '-1', 10);
      const w = warns[idx];
      if (!w || !w.target) return;
      if (w.target.instanceId) {
        state.focusedId = w.target.instanceId;
        uiSessionStore.patch({ focusedId: w.target.instanceId });
        appBus.emit('workspace:recompute');
      }
      appBus.emit('target:flash', w.target);
    });
  });
}

export function showPinTooltip(pinId: string, ev: unknown): void {
  const meta = getActiveBoard().pins[pinId];
  if (!meta) return;
  const ext = getExternalPinClaims()[pinId];
  const ob = getOnboardPinUsage()[pinId];
  let status = t('tip.pinFree');
  if (meta.blocked) {
    status = t('tip.pinReserved', { reason: escapeHtml(tBlockedPin(pinId, true)) });
  } else if (ext) {
    status = t('tip.pinWired', { comp: escapeHtml(ext.compName), pin: escapeHtml(ext.compPinId) });
  } else if (ob) {
    const hint = ob.dip ? t('tip.hintDip', { dip: ob.dip }) : t('tip.hintChip');
    status = t('tip.pinOnboard', { name: escapeHtml(ob.name), hint });
  }
  showCustomTooltip(`<strong>${escapeHtml(meta.label)}</strong><br>${status}`, ev);
}

export function showCustomTooltip(html: string, ev?: unknown): void {
  const tip = $('#boardTooltip') as HTMLElement | null;
  if (!tip) return;
  tip.innerHTML = html;
  tip.classList.remove('hidden');
  moveTooltip(ev);
}

export function moveTooltip(ev: unknown): void {
  const wrapEl = $('#canvasWrapper') as HTMLElement | null;
  const tip = $('#boardTooltip') as HTMLElement | null;
  if (!wrapEl || !tip || !ev || typeof ev !== 'object') return;
  const coords = ev as { clientX?: number; clientY?: number };
  if (typeof coords.clientX !== 'number' || typeof coords.clientY !== 'number') return;
  const wrap = wrapEl.getBoundingClientRect();
  tip.style.left = `${Math.min(wrap.width - 235, Math.max(8, coords.clientX - wrap.left + 14))}px`;
  tip.style.top = `${Math.min(wrap.height - 85, Math.max(8, coords.clientY - wrap.top + 14))}px`;
}

export function hideTooltip(): void {
  const tip = $('#boardTooltip') as HTMLElement | null;
  if (tip) tip.classList.add('hidden');
}
