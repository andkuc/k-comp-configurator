// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Student Project Charter (Proposal) Data Model, Compact Base64URL Serialization & Sprint Estimator
import type { ProjectProposal, ProposalWorkPackage } from '../types';

export interface WorkPackageTemplate {
  id: number;
  phaseKey: 'setup' | 'merge' | 'finals';
  taskKey: string;
  goalPlaceholderKey: string;
  defaultWho: 'S1' | 'S2' | 'BOTH';
}

export const CHARTER_WORK_PACKAGES: WorkPackageTemplate[] = [
  { id: 1, phaseKey: 'setup',  taskKey: 'charter.wp1Task', goalPlaceholderKey: 'charter.wp1Ph', defaultWho: 'S1' },
  { id: 2, phaseKey: 'setup',  taskKey: 'charter.wp2Task', goalPlaceholderKey: 'charter.wp2Ph', defaultWho: 'S2' },
  { id: 3, phaseKey: 'setup',  taskKey: 'charter.wp3Task', goalPlaceholderKey: 'charter.wp3Ph', defaultWho: 'S1' },
  { id: 4, phaseKey: 'setup',  taskKey: 'charter.wp4Task', goalPlaceholderKey: 'charter.wp4Ph', defaultWho: 'S2' },
  { id: 5, phaseKey: 'merge',  taskKey: 'charter.wp5Task', goalPlaceholderKey: 'charter.wp5Ph', defaultWho: 'BOTH' },
  { id: 6, phaseKey: 'merge',  taskKey: 'charter.wp6Task', goalPlaceholderKey: 'charter.wp6Ph', defaultWho: 'BOTH' },
  { id: 7, phaseKey: 'finals', taskKey: 'charter.wp7Task', goalPlaceholderKey: 'charter.wp7Ph', defaultWho: 'BOTH' },
  { id: 8, phaseKey: 'finals', taskKey: 'charter.wp8Task', goalPlaceholderKey: 'charter.wp8Ph', defaultWho: 'BOTH' }
];

export function getDefaultSchoolYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  const startYear = now.getMonth() >= 8 ? y : y - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}/${endShort}`;
}

export function createEmptyProposal(): ProjectProposal {
  return {
    schoolYear: getDefaultSchoolYear(),
    className: '',
    teamName: '',
    date: '',
    student1: '',
    student2: '',
    slogan: '',
    userStories: '',
    functionalScope: '',
    boardMods: '',
    workPackages: CHARTER_WORK_PACKAGES.map((wp) => ({
      goal: '',
      hours: '',
      who: wp.defaultWho
    })),
    includeGrading: false
  };
}

export function normalizeProposal(raw: any): ProjectProposal {
  const base = createEmptyProposal();
  if (!raw || typeof raw !== 'object') return base;

  const str = (v: any, maxLen = 2000) => (typeof v === 'string' ? v.slice(0, maxLen) : '');
  const pick = (longKey: string, shortKey: string, fallback = '', maxLen = 2000) => {
    if (typeof raw[longKey] === 'string') return str(raw[longKey], maxLen);
    if (typeof raw[shortKey] === 'string') return str(raw[shortKey], maxLen);
    return fallback;
  };

  base.schoolYear = pick('schoolYear', 'sy', base.schoolYear, 20);
  base.className = pick('className', 'cl', '', 32);
  base.teamName = pick('teamName', 'tm', '', 64);
  base.date = pick('date', 'dt', '', 32);
  base.student1 = pick('student1', 's1', '', 64);
  base.student2 = pick('student2', 's2', '', 64);
  base.slogan = pick('slogan', 'sl', '', 240);
  base.userStories = pick('userStories', 'us', '', 2000);
  base.functionalScope = pick('functionalScope', 'fs', '', 2000);
  base.boardMods = pick('boardMods', 'bm', '', 1000);
  base.includeGrading = !!(raw.includeGrading ?? raw.gr);

  if (Array.isArray(raw.workPackages)) {
    for (let i = 0; i < base.workPackages.length; i++) {
      const item = raw.workPackages[i];
      if (!item || typeof item !== 'object') continue;
      base.workPackages[i] = {
        goal: str(item.goal, 240),
        hours: str(item.hours, 12),
        who: str(item.who, 16) || CHARTER_WORK_PACKAGES[i].defaultWho
      };
    }
  } else if (raw.wp && typeof raw.wp === 'object') {
    for (let i = 0; i < base.workPackages.length; i++) {
      const tup = raw.wp[String(i)];
      if (!Array.isArray(tup)) continue;
      base.workPackages[i] = {
        goal: str(tup[0], 240),
        hours: str(tup[1], 12),
        who: str(tup[2], 16) || CHARTER_WORK_PACKAGES[i].defaultWho
      };
    }
  }

  return base;
}

export function cloneProposal(prop: ProjectProposal | null | undefined): ProjectProposal {
  const p = normalizeProposal(prop);
  return {
    ...p,
    workPackages: p.workPackages.map((w) => ({ ...w }))
  };
}

/**
 * Serializes a ProjectProposal into a compact JSON object for .kcomp.json and Base64URL #cfg= links.
 * Returns null if the student has not filled out any proposal fields (keeps #cfg= links short!).
 */
export function serializeProposalCompact(prop: ProjectProposal | null | undefined): Record<string, any> | null {
  if (!prop) return null;
  const p = normalizeProposal(prop);
  const out: Record<string, any> = {};
  const defaultSy = getDefaultSchoolYear();

  const addStr = (key: string, val: string) => {
    const trimmed = val.trim();
    if (trimmed) out[key] = val;
  };

  if (p.schoolYear.trim() && p.schoolYear.trim() !== defaultSy) out.sy = p.schoolYear.trim();
  addStr('cl', p.className);
  addStr('tm', p.teamName);
  addStr('dt', p.date);
  addStr('s1', p.student1);
  addStr('s2', p.student2);
  addStr('sl', p.slogan);
  addStr('us', p.userStories);
  addStr('fs', p.functionalScope);
  addStr('bm', p.boardMods);
  if (p.includeGrading) out.gr = 1;

  const wpOut: Record<string, [string, string, string]> = {};
  for (let i = 0; i < p.workPackages.length; i++) {
    const w = p.workPackages[i];
    const defWho = CHARTER_WORK_PACKAGES[i].defaultWho;
    const g = (w.goal || '').trim();
    const h = (w.hours || '').trim();
    const who = (w.who || defWho).trim();
    if (g || h || who !== defWho) {
      wpOut[String(i)] = [w.goal || '', h, who];
    }
  }
  if (Object.keys(wpOut).length) out.wp = wpOut;

  if (!Object.keys(out).length) return null;
  // Always keep schoolYear explicit once any field is filled so archival charters preserve their year
  if (!out.sy && p.schoolYear.trim()) out.sy = p.schoolYear.trim();
  return out;
}

export function hasProposalContent(prop: ProjectProposal | null | undefined): boolean {
  return serializeProposalCompact(prop) !== null;
}

export interface ProposalHoursSummary {
  s1Hours: number;
  s2Hours: number;
  bothHours: number;
  totalTaskHours: number;
  totalPersonHours: number;
  overLimitIndices: number[];
}

export function computeProposalHours(prop: ProjectProposal): ProposalHoursSummary {
  let s1Hours = 0;
  let s2Hours = 0;
  let bothHours = 0;
  const overLimitIndices: number[] = [];

  (prop.workPackages || []).forEach((w: ProposalWorkPackage, idx: number) => {
    const raw = String(w.hours || '').replace(',', '.').trim();
    const val = parseFloat(raw);
    if (!Number.isFinite(val) || val <= 0) return;
    if (val > 10) overLimitIndices.push(idx);
    if (w.who === 'S1') s1Hours += val;
    else if (w.who === 'S2') s2Hours += val;
    else bothHours += val;
  });

  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    s1Hours: round1(s1Hours),
    s2Hours: round1(s2Hours),
    bothHours: round1(bothHours),
    totalTaskHours: round1(s1Hours + s2Hours + bothHours),
    totalPersonHours: round1(s1Hours + s2Hours + bothHours * 2),
    overLimitIndices
  };
}
