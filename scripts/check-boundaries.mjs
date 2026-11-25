// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Zero-Dependency Architectural Boundary, Acyclic DAG, SPDX & Policy Verification Script
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = resolve(ROOT, 'src');

function walkTsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkTsFiles(full, out);
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out.sort();
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), spec);
  for (const cand of [base, `${base}.ts`, join(base, 'index.ts')]) {
    try {
      if (statSync(cand).isFile()) return cand;
    } catch (_) {}
  }
  return null;
}

function extractRelativeImports(code) {
  const specs = [];
  const re = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const spec = m[1] || m[2];
    if (spec && spec.startsWith('.')) specs.push(spec);
  }
  return specs;
}

function getLayer(relPath) {
  const norm = relPath.replaceAll('\\', '/');
  if (norm.startsWith('src/__tests__/')) return 'test';
  const parts = norm.split('/');
  return parts[1] || 'root';
}

// Strict dependency boundaries: lower domain/data layers must NEVER import UI or Workspaces
const FORBIDDEN_LAYER_DEPS = {
  types: new Set(['boards', 'catalog', 'core', 'store', 'services', 'i18n', 'workspaces', 'ui']),
  boards: new Set(['catalog', 'core', 'store', 'services', 'i18n', 'workspaces', 'ui']),
  catalog: new Set(['boards', 'core', 'store', 'services', 'i18n', 'workspaces', 'ui']),
  services: new Set(['core', 'store', 'i18n', 'workspaces', 'ui']),
  core: new Set(['workspaces', 'ui']),
  store: new Set(['workspaces', 'ui'])
};

const files = walkTsFiles(SRC_DIR);
const errors = [];
const graph = new Map();

for (const file of files) {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  const code = readFileSync(file, 'utf-8');
  const layer = getLayer(rel);

  // 1. SPDX license header check (except vite-env.d.ts)
  if (!rel.endsWith('vite-env.d.ts')) {
    if (!code.includes('SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0')) {
      errors.push(`[SPDX] Missing SPDX-License-Identifier header in ${rel}`);
    }
  }

  // 2. Zero window.* legacy globals
  if (/window\.(?:KCOMP_|__KCOMP_)/.test(code)) {
    errors.push(`[GLOBALS] Legacy window.KCOMP_/__KCOMP_ global found in ${rel}`);
  }

  // 3. Import boundary & resolution checks
  const specs = extractRelativeImports(code);
  const targets = [];
  for (const spec of specs) {
    if (spec.endsWith('.css') || spec.endsWith('.json')) continue;
    const resolved = resolveImport(file, spec);
    if (!resolved) {
      errors.push(`[IMPORT] Unresolved relative import "${spec}" in ${rel}`);
      continue;
    }
    const targetRel = relative(ROOT, resolved).replaceAll('\\', '/');
    const targetLayer = getLayer(targetRel);
    targets.push(targetRel);

    const forbidden = FORBIDDEN_LAYER_DEPS[layer];
    if (forbidden && forbidden.has(targetLayer)) {
      errors.push(`[BOUNDARY] Layer "${layer}" (${rel}) must not import layer "${targetLayer}" (${targetRel})`);
    }
  }
  if (layer !== 'test') {
    graph.set(rel, targets);
  }
}

// 4. Acyclic Module Graph (DAG) check across non-test runtime modules
const stateMap = new Map(); // 0=unvisited, 1=visiting, 2=done
const stack = [];
function dfs(node) {
  stateMap.set(node, 1);
  stack.push(node);
  for (const next of graph.get(node) || []) {
    if (!graph.has(next)) continue;
    const st = stateMap.get(next) || 0;
    if (st === 1) {
      const idx = stack.indexOf(next);
      const cycle = [...stack.slice(idx), next].join(' -> ');
      errors.push(`[CYCLE] Circular module dependency detected: ${cycle}`);
    } else if (st === 0) {
      dfs(next);
    }
  }
  stack.pop();
  stateMap.set(node, 2);
}

for (const node of graph.keys()) {
  if (!stateMap.get(node)) dfs(node);
}

if (errors.length > 0) {
  console.error(`Architecture check failed with ${errors.length} violation(s):`);
  for (const err of errors) console.error('  -', err);
  process.exit(1);
}

console.log(`Architecture check PASSED: ${files.length} TS files verified (0 boundary violations, 0 cycles, 100% SPDX).`);
