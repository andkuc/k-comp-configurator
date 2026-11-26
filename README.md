# K-Comp Configurator

**Version `0.4.3`** — A browser-based interactive multi-board hardware configurator, pin-constraint solver, flat-C scaffold generator, and student project charter tool for the **K-Comp** ecosystem (**K-Comp V2 / ATmega328P** and **ESP32-S3 DevKitC-1 N16R8**), built with **TypeScript, Vite, and Vitest**.

The application runs 100% client-side with zero runtime backend dependencies, lazy-loaded reference/locale chunks, and automated GitHub Actions CI & Pages deployment.

> **Companion Repository:** Hardware schematics, C/C++ libraries, and module manuals are maintained separately in [andkuc/k-comp](https://github.com/andkuc/k-comp).

---

## Key Features

### 1. Multi-Board Interactive Vector Workbench (`src/ui/workbench/`, `src/core/routing.ts`, `breadboard.ts`, `carrier-breadboard.ts`)
- **K-Comp V2 (ATmega328P, 5V):** Frameless PCB (`public/assets/kcomp-v2.svg`), click-on-PCB onboard peripherals (illuminated 0.96" OLED, mounted KY-023 joystick, LED, potentiometer, buttons, buzzer, ultrasonic & wireless slots), interactive `DIP S1`, board-mounted `HC-05`/`ESP-01`, smart free-pin `GND`/`5V` allocation, manual breadboard rail placement (`Board first` / `Breadboard` toggle), and automatic bottom-half 4+ I²C hub.
- **ESP32-S3 DevKitC-1 (N16R8, 3.3V):** 44-pin Inkscape-safe PCB (`public/assets/esp32-s3-devkit.svg`) mounted centered on a toggleable breadboard carrier by default (Left `+3.3V`/`GND`, Right `+5V`/`GND`, per-hole drag-to-rewire `1a–22j` & outer rails), 3.3V logic-level checks, strapping-pin & `ADC2`+Wi-Fi guards with **1-click Quick-Fix** buttons, and contextual **`HW-UART` vs. `SW-UART`** wire styling.
- **Inkscape-Safe SVG Export:** Full-opacity Dark Mode or WCAG-AA White Mode export with zero `<filter>` tags and UI controls cleanly stripped.

### 2. Clean Layered Architecture & Headless Domain Core (`src/boards/`, `src/core/`, `src/store/`, `src/services/`, `src/workspaces/`)
- **Declarative Board Profiles (`src/boards/`):** Complete electrical, capability, onboard, breadboard/carrier, and optional `mechanical` (mm outline, 2.54 mm headers, mounting holes, keep-out zones) specs per board.
- **Central `ProjectStore` & Typed `AppBus` (`src/store/`):** Single-pass `deriveWorkspace()` computing DIP states, UART channel assignments, warnings, SRAM/USB budgets, and a pure headless **`ElectricalNetlist`** (`src/core/netlist.ts`).
- **Extensible Code Profiles & Structure Blocks (`src/core/code-profiles.ts`, `codegen.ts`, `code-blocks.ts`):** Verified `kcomp-avr` headers on K-Comp V2, board-honest `generic-scaffold` + opt-in `kcomp-portable` (Beta) on ESP32-S3, future slots (`oss-standard`, `bare-metal`, `python-node`), 13 flat-C structure blocks, and on-demand lazy-loaded **52-library / 291-function `ƒx API`** & scrollable component guides.
- **Top-Level Workspace Shell & Future Service Contracts (`src/workspaces/`, `src/services/`):** Ready for upcoming **Program** (`ProgramIR` + Blockly + CodeMirror 6), **Device** (`DeviceTransport` Web Serial Monitor/Plotter + `CompilerProvider`), and **Shield PCB** (2-layer plug-in shields via `BoardProfile.mechanical` + `ElectricalNetlist`).

### 3. Lab Workflow, Fillable Project Charter & Persistence (`src/ui/modals/`, `src/ui/charter.ts`, `src/core/document.ts`)
- **Multi-Board Lab Sheet (Print / PDF):** Board-aware BOM (auto-detecting 3.3V↔5V level shifters and `M–F` / `M–M` / `F–F` / `Grove` jumper counts), `DIP S1` or Board Config summary, exact breadboard tie-point checklist, and sign-off fields.
- **Interactive Student Project Charter:** Fillable in-app team proposal (general info, pitch, user stories, functional scope, live auto-synced hardware & pin map, 8-package sprint estimator, optional Part 2 100-point grading rubric) saved in canonical **`kcomp-project/1`** `.kcomp.json` files and Deflate-compressed Base64URL **`#cfg=`** share links.
- **Themes & Lazy-Loaded i18n:** Dark Mode + WCAG-AA White Mode (`?theme=dark|light`) and 3 locales (`?lang=en|de|sq`, English default with German & Albanian loaded on demand).

---

## URL Parameters

| Parameter | Values | Effect |
| :--- | :--- | :--- |
| `board` | `kcomp-v2` (default), `esp32-s3-devkit` | Initial target microcontroller board |
| `carrier` | `breadboard` (default on ESP32), `standalone` | Initial breadboard carrier mode |
| `workspace` | `hardware` (default), `program`, `device`, `shield` | Initial top-level workspace view |
| `lang` | `en` (default), `de`, `sq` | Initial interface language |
| `theme` | `dark` (default), `light` / `white` | Initial color theme |
| `level` | `professional` (default), `intermediate`, `beginner` | Initial skill-level feature preset |
| `autosave` | `0` (default), `1` | Initial browser Auto-Save state |
| `#cfg=...` | Deflate + Base64URL `kcomp-project/1` payload | Restores wiring, board & filled Project Charter |

---

## Repository Structure

```text
k-comp-configurator/
├── .github/workflows/deploy.yml      # CI tests, strict typecheck, build & GitHub Pages deploy
├── index.html                        # Vite entrypoint, workspace shell & modals
├── package.json                      # TypeScript + Vite + Vitest toolchain
├── tsconfig.json / tsconfig.strict.json
├── vite.config.ts                    # Vite build (base: './', manualChunks) & Vitest jsdom
├── LICENSE / NOTICE / CITATION.cff / CONTRIBUTING.md
├── public/
│   ├── .nojekyll                     # Clean static deployment on GitHub Pages
│   └── assets/                       # kcomp-v2.svg, esp32-s3-devkit.svg & 47 component SVGs
└── src/
    ├── main.ts                       # Bootstrap, store/bus wiring & lazy UI loaders
    ├── types/                        # Strict shared TypeScript interfaces
    ├── boards/                       # Declarative board profiles (kcomp-v2, esp32-s3-devkit)
    ├── catalog/                      # Board-agnostic components.json & lazy API/guide loaders
    ├── core/                         # Pin solver, netlist, routing, breadboard, codegen, document
    ├── store/                        # Typed AppBus & single-pass ProjectStore
    ├── services/                     # CompilerProvider, DeviceTransport & ProgramIR contracts
    ├── workspaces/                   # Top-level Workspace Shell (Hardware/Program/Device/Shield)
    ├── i18n/                         # Pluggable locale registry (EN + lazy DE/SQ chunks)
    ├── styles/                       # 8 ordered modular CSS partials + style.css manifest
    ├── ui/                           # Modular workbench/, modals/, charter, inspector, api-browser
    └── __tests__/                    # 11 Vitest unit, integrity & architecture suites
```

---

## Local Development, Testing & GitHub Pages

Prerequisites: **Node.js 20+** (LTS recommended).

```bash
npm install
npm test                  # Run all 11 Vitest unit, integrity & architecture suites
npm run check:arch        # Verify layered boundaries, acyclic DAG & SPDX headers
npm run typecheck:strict  # Run strict TypeScript check across 75+ core/store/services/workspace/UI files
npm run build             # Full typecheck + strict check + code-split production build in dist/
npm run dev               # Start local Vite dev server with hot reload
```

For GitHub Pages, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. Every push to `main` runs `.github/workflows/deploy.yml` (`npm ci` → `npm test` → `npm run build` → Pages deploy).

---

## Author & License

- **Author:** Copyright (c) 2025–2026 **Andreas Kucher**
- **License (Configurator):** PolyForm Noncommercial License 1.0.0 (`PolyForm-Noncommercial-1.0.0`) — free for personal and noncommercial educational use; commercial use requires prior written permission. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
- **Companion Hardware & Docs Repository:** [andkuc/k-comp](https://github.com/andkuc/k-comp)

Built by Andreas Kucher with AI-assisted coding and documentation support (Google Gemini).
