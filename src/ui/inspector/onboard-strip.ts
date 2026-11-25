// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Auto-Wrapping 2-Row ONBOARD Peripheral Strip & DIP Switch Renderer
import { state, $, escapeHtml, getActiveOnboardDefs } from '../../core/state';
import { getExternalPinClaims, toggleDipSwitch, toggleOnboardComponent } from '../../core/hardware';
import { t, tOnboard } from '../../i18n/index';
import { getActiveBoard } from '../../boards';
import { appBus } from '../../store/bus';
import type { DipSwitchState } from '../../types';

let onboardResizeObserver: ResizeObserver | null = null;
let onboardWrapRaf = 0;
let lastOnboardStripWidth = -1;

export function syncOnboardWrapLayout(force = false): void {
  const strip = $('#onboardStrip') as HTMLElement | null;
  if (!strip) return;
  const availW = Math.floor(strip.clientWidth);
  if (availW <= 0) return;
  if (!force && availW === lastOnboardStripWidth) return;
  lastOnboardStripWidth = availW;

  const pills = Array.from(strip.querySelectorAll<HTMLElement>('.ob-pill'));
  const brk = strip.querySelector<HTMLElement>('.ob-row-break');
  if (!pills.length || !brk) return;

  const gap = 5;
  const widths = pills.map((p) => Math.ceil(p.getBoundingClientRect().width));
  const totalW = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);

  if (totalW <= availW) {
    brk.classList.add('hidden');
    return;
  }

  let bestIdx = -1;
  let bestMax = Infinity;
  let r1 = 0;
  for (let i = 1; i < pills.length; i++) {
    r1 += widths[i - 1] + (i > 1 ? gap : 0);
    let r2 = 0;
    for (let j = i; j < pills.length; j++) {
      r2 += widths[j] + (j > i ? gap : 0);
    }
    const maxW = Math.max(r1, r2);
    if (r1 <= availW && r2 <= availW && maxW < bestMax) {
      bestMax = maxW;
      bestIdx = i;
    }
  }

  if (bestIdx > 0) {
    if (pills[bestIdx].previousElementSibling !== brk) {
      strip.insertBefore(brk, pills[bestIdx]);
    }
    brk.classList.remove('hidden');
  } else {
    brk.classList.add('hidden');
  }
}

function ensureOnboardResizeObserver(): void {
  if (onboardResizeObserver || typeof ResizeObserver === 'undefined') return;
  const strip = $('#onboardStrip') as HTMLElement | null;
  if (!strip) return;
  onboardResizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(onboardWrapRaf);
    onboardWrapRaf = requestAnimationFrame(() => syncOnboardWrapLayout(false));
  });
  onboardResizeObserver.observe(strip);
}

export function renderOnboardBar(dipStates: DipSwitchState[]): void {
  const strip = $('#onboardStrip') as HTMLElement | null;
  if (!strip) return;
  const dipById: Record<number, DipSwitchState> = {};
  dipStates.forEach((d) => { dipById[d.id] = d; });

  const board = getActiveBoard();
  const extClaims = getExternalPinClaims();
  const obDefs = getActiveOnboardDefs();
  const chips = obDefs.map((ob) => {
    const dip = ob.dip ? (dipById[ob.dip] || null) : null;
    const claimedPin = Array.isArray(ob.pins) ? ob.pins.find((p) => Boolean(extClaims[p.pinId])) : null;
    const extBlocked = Boolean((dip && dip.forcedOff) || claimedPin);
    const isOn = dip ? dip.on : (!extBlocked && !!state.onboard[ob.id]);
    const obName = tOnboard(ob, 'name');
    const obShort = tOnboard(ob, 'shortName') || obName;
    const tag = ob.dip
      ? `S1-${ob.dip}`
      : (ob.id === 'onboard_oled' ? (state.oledPaged ? t('bottom.oledShortPaged') : t('bottom.oledShortFull')) : (ob.pinInfo || '').split(' ')[0]);
    const blockReason = dip?.reason || (claimedPin ? extClaims[claimedPin.pinId].compName : '');
    const title = extBlocked
      ? t('onboard.disabledReason', { name: obName, reason: blockReason })
      : t('onboard.toggleTitle', { name: obName, pinInfo: ob.pinInfo || '', action: isOn ? t('onboard.actionDisable') : t('onboard.actionEnable') });

    return `
      <button class="ob-pill ${isOn ? 'active' : ''} ${extBlocked ? 'ext-blocked' : ''}"
              style="--ob-accent:${ob.accent || '#38bdf8'}"
              data-ob-toggle="${ob.id}" title="${escapeHtml(title)}">
        <span class="ob-dot"></span>
        <span>${escapeHtml(obShort)}</span>
        <span class="ob-dip-tag">${extBlocked ? 'EXT' : escapeHtml(tag)}</span>
      </button>`;
  });

  if (board.capabilities.hasWirelessSlot) {
    const wForcedOff = Boolean(dipById[7]?.forcedOff || dipById[8]?.forcedOff);
    const wActive = !wForcedOff && Boolean(dipById[7]?.on || dipById[8]?.on);
    chips.push(`
      <button class="ob-pill ${wActive ? 'active' : ''} ${wForcedOff ? 'ext-blocked' : ''}"
              style="--ob-accent:#c084fc"
              data-ob-toggle="onboard_wireless"
              title="${escapeHtml(wForcedOff ? t('onboard.wirelessBlocked') : t('onboard.wirelessTitle'))}">
        <span class="ob-dot"></span>
        <span>${escapeHtml(t('onboard.wireless'))}</span>
        <span class="ob-dip-tag">${wForcedOff ? 'EXT' : 'S1-7,8'}</span>
      </button>`);
  }

  strip.innerHTML = chips.join('') + '<span class="ob-row-break hidden" aria-hidden="true"></span>';
  strip.querySelectorAll<HTMLElement>('[data-ob-toggle]').forEach((btn) => {
    const obId = btn.dataset.obToggle;
    if (!obId) return;
    btn.addEventListener('click', () => toggleOnboardComponent(obId));
    btn.addEventListener('mouseenter', () => appBus.emit('hover:hw', { hwId: obId }));
    btn.addEventListener('mouseleave', () => appBus.emit('hover:hw', { hwId: null }));
  });
  ensureOnboardResizeObserver();
  syncOnboardWrapLayout(true);
}

export function renderDipStrip(dipStates: DipSwitchState[]): void {
  const strip = $('#dipStrip') as HTMLElement | null;
  if (!strip) return;
  strip.innerHTML = dipStates.map((d) =>
    `<button class="dip-pill ${d.on ? 'on' : 'off'} ${d.lockedOn ? 'locked' : ''}" data-dip-btn="${d.id}" title="S1-${d.id} (${d.pin}): ${escapeHtml(d.reason)}">${d.id}:${d.on ? 'ON' : 'OFF'}</button>`
  ).join('');
  strip.querySelectorAll<HTMLElement>('[data-dip-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dipId = parseInt(btn.dataset.dipBtn || '', 10);
      if (Number.isFinite(dipId)) toggleDipSwitch(dipId);
    });
  });
}
