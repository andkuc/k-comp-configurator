// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

function copyRootLegalFiles() {
  return {
    name: 'kcomp-copy-legal-files',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      for (const file of ['LICENSE', 'NOTICE']) {
        const src = resolve(__dirname, file);
        if (existsSync(src)) {
          copyFileSync(src, resolve(distDir, file));
        }
      }
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [copyRootLegalFiles()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/__tests__/**/*.test.ts']
  }
});
