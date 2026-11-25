// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Flat ESLint Configuration Enforcing Layered Architecture Boundaries (optional developer tool)
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**']
  },
  {
    files: ['src/core/**/*.ts', 'src/store/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/ui/**', '**/ui/*', '../ui', '../../ui'], message: 'Domain core and store must remain headless and never import UI modules.' },
          { group: ['**/workspaces/**', '**/workspaces/*', '../workspaces', '../../workspaces'], message: 'Domain core and store must never import Workspace Shell views.' }
        ]
      }]
    }
  },
  {
    files: ['src/boards/**/*.ts', 'src/types/**/*.ts', 'src/services/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/ui/**', '**/workspaces/**', '**/core/**', '**/store/**'], message: 'Declarative boards, types, and service contracts must stay decoupled from core/store/UI.' }
        ]
      }]
    }
  }
];
