# Contributing to K-Comp Configurator

Thank you for helping improve the **K-Comp Configurator**!

## Scope of This Repository
This repository (`andkuc/k-comp-configurator`) contains **only the client-side web configurator** (UI, pin-constraint engine, SVG workbench, `.ino` scaffold generator, unit tests, and i18n dictionaries).
Hardware schematics, Gerber files, C/C++ libraries, and module manuals live in the separate companion repository [andkuc/k-comp](https://github.com/andkuc/k-comp).

## Authorship & License Grant for Contributions
This repository is licensed under the **PolyForm Noncommercial License 1.0.0** (`PolyForm-Noncommercial-1.0.0`). By submitting a pull request, patch, translation, or SVG asset, you confirm that:

1. **Original Work:** The contribution is your own original work or you have full legal permission to submit it.
2. **Stewardship Grant:** You grant **Andreas Kucher** a perpetual, worldwide, non-exclusive, royalty-free, irrevocable copyright license to use, modify, redistribute, and sublicense your contribution as part of the K-Comp Configurator (under `PolyForm-Noncommercial-1.0.0` as well as future releases).
3. **Attribution:** Contributors are credited in Git history and release notes while overall project authorship remains with Andreas Kucher.

## Technical Guidelines
- Keep the codebase cleanly layered (`src/types`, `src/boards`, `src/catalog`, `src/core`, `src/i18n`, `src/ui`, `public/assets`) with a strictly acyclic module graph.
- Run `npm test` and `npm run build` before opening a pull request.
- Keep all SVGs **Inkscape-safe** (zero `<filter>` elements).
- Synchronize all 3 locales (`en`, `de`, `sq`) and both themes (Dark Mode & WCAG-AA White Mode).
- Preserve SPDX headers (`SPDX-FileCopyrightText` / `SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0`) on source files.
