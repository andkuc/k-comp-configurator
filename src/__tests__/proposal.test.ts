// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeEach, describe, expect, it } from 'vitest';
import { setActiveBoard } from '../boards';
import { CATALOG } from '../catalog';
import { state, hooks, getActiveOnboardDefs } from '../core/state';
import { initI18n } from '../i18n';
import { addComponent } from '../core/hardware';
import {
  computeProposalHours,
  createEmptyProposal,
  hasProposalContent,
  serializeProposalCompact
} from '../core/proposal';
import {
  applyProjectPayload,
  captureSnapshot,
  decodeBase64Url,
  encodeBase64Url,
  resetToNewDesign,
  restoreSnapshot,
  serializeProjectPayload
} from '../core/persistence';
import { openProjectCharter } from '../ui/charter';

function resetWorkbench(boardId = 'kcomp-v2') {
  initI18n();
  const board = setActiveBoard(boardId);
  state.boardId = board.id;
  state.codeProfile = board.defaultCodeProfile;
  state.carrierEnabled = !!board.carrier?.defaultEnabled;
  state.catalog = CATALOG;
  state.active = [];
  state.codeBlocks = [];
  state.projectName = '';
  state.proposal = createEmptyProposal();
  state.onboard = {};
  for (const ob of getActiveOnboardDefs()) state.onboard[ob.id] = false;
  if (board.capabilities.hasWirelessSlot) state.onboard.onboard_wireless = false;

  state.svgCache.clear();
  for (const comp of CATALOG.components) {
    state.svgCache.set(comp.svgFile, document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  }

  hooks.recomputeAndRender = () => {};
  hooks.pushUndoState = () => {};
  hooks.flashTarget = () => {};
  hooks.resetViewFit = () => {};
  hooks.applyViewBox = () => {};
  hooks.switchBoard = async (nextId: string) => {
    const b = setActiveBoard(nextId);
    state.boardId = b.id;
    state.codeProfile = b.defaultCodeProfile;
    state.carrierEnabled = !!b.carrier?.defaultEnabled;
  };
}

describe('Student Project Charter — Data Model, Persistence & Base64URL #cfg= Round-Trip', () => {
  beforeEach(() => resetWorkbench('kcomp-v2'));

  it('omits empty proposal from serialized payload so plain hardware #cfg= links stay compact', () => {
    expect(hasProposalContent(state.proposal)).toBe(false);
    expect(serializeProposalCompact(state.proposal)).toBeNull();
    const payload = serializeProjectPayload();
    expect(payload.pr).toBeUndefined();
  });

  it('round-trips full UTF-8 Project Charter + hardware cleanly via .kcomp.json and Base64URL #cfg=', async () => {
    state.projectName = 'Reaktions-Spiel';
    state.onboard.onboard_oled = true;
    state.onboard.onboard_buzzer = true;
    await addComponent('bmi160', { skipUndo: true });

    state.proposal.schoolYear = '2026/27';
    state.proposal.className = '1BH';
    state.proposal.teamName = 'K-Team Öl & Übung';
    state.proposal.date = '2026-11-25';
    state.proposal.student1 = 'Anna Müller';
    state.proposal.student2 = 'Ardit Çela';
    state.proposal.slogan = 'Schnelles Neigungs-Spiel mit OLED & Summer!';
    state.proposal.userStories = 'Als Spieler möchte ich akustisches Feedback, damit ich Treffer höre.';
    state.proposal.functionalScope = '- Timer 30s oben links\n- Neigung per BMI160';
    state.proposal.boardMods = '1x4 Buchsenleiste für I2C-Sensor';
    state.proposal.workPackages[0] = { goal: 'BMI160 am I2C testen', hours: '2.5', who: 'S1' };
    state.proposal.workPackages[1] = { goal: 'OLED & Summer testen', hours: '2', who: 'S2' };
    state.proposal.workPackages[5] = { goal: 'Master-Code mergen', hours: '4', who: 'BOTH' };
    state.proposal.includeGrading = true;

    // Verify sprint hours calculator
    const hrs = computeProposalHours(state.proposal);
    expect(hrs.s1Hours).toBe(2.5);
    expect(hrs.s2Hours).toBe(2);
    expect(hrs.bothHours).toBe(4);
    expect(hrs.totalTaskHours).toBe(8.5);
    expect(hrs.totalPersonHours).toBe(12.5);
    expect(hrs.overLimitIndices).toEqual([]);

    // Base64URL round-trip (exact mechanism used by #cfg= share links!)
    const encoded = encodeBase64Url(JSON.stringify(serializeProjectPayload()));
    expect(encoded).not.toMatch(/[+/=]/);
    const decodedPayload = JSON.parse(decodeBase64Url(encoded));
    expect(decodedPayload.pr).toBeDefined();

    // Reset state completely, then restore from decoded Base64URL payload
    resetToNewDesign({ silent: true });
    expect(hasProposalContent(state.proposal)).toBe(false);

    await applyProjectPayload(decodedPayload, false);
    expect(state.projectName).toBe('Reaktions-Spiel');
    expect(state.proposal.student1).toBe('Anna Müller');
    expect(state.proposal.student2).toBe('Ardit Çela');
    expect(state.proposal.teamName).toBe('K-Team Öl & Übung');
    expect(state.proposal.slogan).toBe('Schnelles Neigungs-Spiel mit OLED & Summer!');
    expect(state.proposal.functionalScope).toContain('Neigung per BMI160');
    expect(state.proposal.workPackages[0].goal).toBe('BMI160 am I2C testen');
    expect(state.proposal.workPackages[0].hours).toBe('2.5');
    expect(state.proposal.workPackages[5].who).toBe('BOTH');
    expect(state.proposal.includeGrading).toBe(true);
    expect(state.active).toHaveLength(1);
  });

  it('preserves proposal edits across Undo/Redo snapshots and flags work packages > 10 h', async () => {
    state.proposal.student1 = 'Max';
    state.proposal.workPackages[2] = { goal: 'Huge task', hours: '12', who: 'S1' };
    expect(computeProposalHours(state.proposal).overLimitIndices).toEqual([2]);

    const snap = captureSnapshot();
    state.proposal.student1 = 'Changed';
    await restoreSnapshot(snap);
    expect(state.proposal.student1).toBe('Max');
    expect(state.proposal.workPackages[2].hours).toBe('12');
  });

  it('renders fillable Project Charter UI with live DOM input binding & Part 2 toggle', async () => {
    document.body.innerHTML = `
      <div id="printModal" class="hidden">
        <button id="btnPrintTabLab"></button>
        <button id="btnPrintTabCharter"></button>
        <button id="btnPrintShareLink" class="hidden"></button>
        <h2 id="printModalHeading"></h2>
        <p id="printModalSubtitle"></p>
        <div id="printSheet"></div>
      </div>`;

    await addComponent('bmi160', { skipUndo: true });
    openProjectCharter();

    const s1Input = document.querySelector('[data-ch-field="student1"]') as HTMLInputElement;
    expect(s1Input).not.toBeNull();
    s1Input.value = 'Lukas';
    s1Input.dispatchEvent(new Event('input'));
    expect(state.proposal.student1).toBe('Lukas');
    expect(document.querySelector('[data-ch-print="student1"]')?.textContent).toBe('Lukas');

    const wpGoal = document.querySelector('[data-wp-idx="0"][data-wp-field="goal"]') as HTMLInputElement;
    wpGoal.value = 'Test BMI160 tilt';
    wpGoal.dispatchEvent(new Event('input'));
    expect(state.proposal.workPackages[0].goal).toBe('Test BMI160 tilt');

    const chk = document.querySelector('#chkCharterPart2') as HTMLInputElement;
    expect(document.querySelector('#charterPart2Box')?.classList.contains('hidden')).toBe(true);
    chk.checked = true;
    chk.dispatchEvent(new Event('change'));
    expect(state.proposal.includeGrading).toBe(true);
    expect(document.querySelector('#charterPart2Box')?.classList.contains('hidden')).toBe(false);

    document.body.innerHTML = '';
  });
});
