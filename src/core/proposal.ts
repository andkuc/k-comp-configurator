// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Student Project Charter (Proposal) Canonical Data Model & Sprint Estimator
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

export function normalizeProposal(raw: unknown): ProjectProposal {
  const base = createEmptyProposal();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;

  const str = (v: unknown, maxLen = 2000): string => (typeof v === 'string' ? v.slice(0, maxLen) : '');

  if (typeof obj.schoolYear === 'string' && obj.schoolYear.trim()) {
    base.schoolYear = str(obj.schoolYear, 20);
  }
  base.className = str(obj.className, 32);
  base.teamName = str(obj.teamName, 64);
  base.date = str(obj.date, 32);
  base.student1 = str(obj.student1, 64);
  base.student2 = str(obj.student2, 64);
  base.slogan = str(obj.slogan, 240);
  base.userStories = str(obj.userStories, 2000);
  base.functionalScope = str(obj.functionalScope, 2000);
  base.boardMods = str(obj.boardMods, 1000);
  base.includeGrading = Boolean(obj.includeGrading);

  if (Array.isArray(obj.workPackages)) {
    for (let i = 0; i < base.workPackages.length; i++) {
      const item = obj.workPackages[i] as Record<string, unknown> | null | undefined;
      if (!item || typeof item !== 'object') continue;
      base.workPackages[i] = {
        goal: str(item.goal, 240),
        hours: str(item.hours, 12),
        who: str(item.who, 16) || CHARTER_WORK_PACKAGES[i].defaultWho
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

export function hasProposalContent(prop: ProjectProposal | null | undefined): boolean {
  if (!prop) return false;
  const p = normalizeProposal(prop);
  const defaultSy = getDefaultSchoolYear();

  if (p.schoolYear.trim() && p.schoolYear.trim() !== defaultSy) return true;
  if (
    p.className.trim() ||
    p.teamName.trim() ||
    p.date.trim() ||
    p.student1.trim() ||
    p.student2.trim() ||
    p.slogan.trim() ||
    p.userStories.trim() ||
    p.functionalScope.trim() ||
    p.boardMods.trim() ||
    p.includeGrading
  ) {
    return true;
  }

  for (let i = 0; i < p.workPackages.length; i++) {
    const w = p.workPackages[i];
    const defWho = CHARTER_WORK_PACKAGES[i].defaultWho;
    if ((w.goal || '').trim() || (w.hours || '').trim() || ((w.who || defWho).trim() !== defWho)) {
      return true;
    }
  }

  return false;
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
