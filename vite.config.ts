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
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replace(/\\/g, '/');
          if (norm.includes('/src/catalog/library-api-data')) return 'chunk-library-api';
          if (norm.includes('/src/catalog/component-guide-data')) return 'chunk-component-guides';
          if (norm.includes('/src/i18n/de') || norm.includes('/src/i18n/block-guides-de')) return 'chunk-i18n-de';
          if (norm.includes('/src/i18n/sq') || norm.includes('/src/i18n/block-guides-sq')) return 'chunk-i18n-sq';
          if (norm.includes('/src/ui/charter')) return 'chunk-charter';
          if (norm.includes('/src/ui/block-guide')) return 'chunk-block-guide';
          if (norm.includes('/node_modules/esptool-js')) return 'chunk-esptool';
          return undefined;
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/__tests__/**/*.test.ts']
  }
});
