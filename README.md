# K-Comp Configurator

**Version `0.2.0`** — A browser-based interactive hardware configurator, pin-constraint solver, and flat-C `.ino` scaffold generator for the **K-Comp** ecosystem (supporting **K-Comp V2 / ATmega328P** and **ESP32-S3 DevKitC-1 N16R8** via declarative board profiles and extensible code profiles), built with **TypeScript, Vite, and Vitest**.

The application runs 100% client-side with zero runtime backend dependencies and deploys automatically to GitHub Pages.

> **Companion Repository:** Hardware designs, C/C++ libraries, and module manuals are maintained separately in [andkuc/k-comp](https://github.com/andkuc/k-comp).

---

## Key Features

### 1. Interactive Vector Workbench (`src/ui/workbench.ts`, `src/core/routing.ts`, `src/core/breadboard.ts`)
- **Realistic K-Comp V2 PCB (`public/assets/kcomp-v2.svg`):** Interactive onboard peripherals (mounted 0.96" OLED with live illuminated ON state, mounted KY-023 Analog Joystick, LED, Potentiometer, START/SELECT buttons, Buzzer, Ultrasonic slot, Wireless slot) directly clickable on the PCB or via the auto-wrapping 2-row `ONBOARD` strip, synced with interactive `DIP S1` switches.
- **Direct Onboard Wireless Mounting:** Placing `HC-05` or `ESP-01` mounts the module to scale directly onto its physical K-Comp Wireless slot without synthetic jumper wires.
- **Draggable & Rotatable External Modules:** 43 external modules with standalone Inkscape-safe SVGs, 12 px snap-to-grid positioning (`Alt` bypasses grid), free & 90° rotation with cohesive upside-down titlebar flipping, and direct drag-to-rewire pin handles.
- **Smart Routing & Automatic Breadboard Allocation:** Overlap-minimized orthogonal perimeter routing (with curved fallback), electrical net hover highlighting, smart free-pin GND/5V allocation across board headers before creating top-half breadboard rails, and automatic bottom-half I²C bus expansion for 4+ I²C modules.
- **Inkscape-Safe SVG Export:** Full-opacity export in Dark Mode or WCAG-AA White Mode with zero `<filter>` tags and UI controls cleanly stripped.

### 2. Hardware Constraint Engine (`src/core/hardware.ts`, `src/boards/kcomp-v2/pinmap.ts`)
- **Clean Blank Board Start:** Every new board starts with all onboard peripherals disabled (`false`); active onboard hardware is never silently disabled by external modules.
- **Electrical & Bus Checks:** Validates pin capabilities (`DIGITAL`, `PWM`, `ANALOG`, `INT`, `I2C_*`), reserved pins (`D0`/`D1` USB, `A1`/`A2` joystick), I²C address collisions, differentiated `SoftwareSerial` multi-UART listening constraints, 5V USB current budget (`500 mA`), and **2 KB SRAM** usage with per-component breakdown tooltips and OLED Full/Paged mode switching.

### 3. `.ino` Code Generator, Structure Blocks & `ƒx API` (`src/core/codegen.ts`, `src/core/code-blocks.ts`, `src/ui/api-browser.ts`)
- **Fail-Fast `.ino` Scaffolding:** Unselectable line numbers, section jump bar (`#include` / `setup()` / `loop()`), VS Code Dark+/Light+ syntax highlighting, and bidirectional code ↔ board hover highlighting.
- **13 Flat-C Structure Blocks (`+ Blocks`):** Array-free architectural patterns (EVA functions, FSM, timers, button callbacks, OLED Grid, char parser, context blocks) with inline config editors and an illustrated SVG technique guide (`src/ui/block-guide.ts`).
- **Integrated `ƒx API` Reference (`src/catalog/library-api-data.ts`):** 52 libraries / 291 functions with click-to-copy calls, headers, `struct` fields, and `#define` constants — available both in the resizable `Code (.ino)` split drawer and inline inside each component's scrollable info popup (`src/catalog/component-guide-data.ts`).

### 4. Lab Workflow, Persistence & i18n (`src/ui/modals.ts`, `src/core/persistence.ts`, `src/i18n/`)
- **Scrollable Component Info Guides:** Prominent module SVG preview, electrical principle explanation, visual signal-flow chain, live compatible K-Comp pin matrix, classroom pitfalls, and expandable library API reference.
- **Hardware Lab Sheet (Print / PDF):** A4 pre-flight sheet with wiring diagram, Bill of Materials (BOM), exact jumper counts (M–F, M–M, Grove & colors), `DIP S1` table, and sign-off fields.
- **Persistence & Sharing:** Toggleable browser Auto-Save (default `OFF`, `?autosave=1/0`), Undo/Redo (`Ctrl+Z`/`Y`), `.kcomp.json` project save/load, Base64URL `#cfg=` deep links, and live PDF auto-discovery from `andkuc/k-comp/docs/ModuleDocumentation`.
- **Themes & Languages:** Dark Mode + WCAG-AA White Mode (`?theme=dark|light`) and 3 locales (`?lang=en|de|sq`).

---

## URL Parameters

| Parameter | Values | Effect |
| :--- | :--- | :--- |
| `board` | `kcomp-v2` (default), `esp32-s3-devkit` | Initial target microcontroller board |
| `lang` | `en` (default), `de`, `sq` | Initial interface language |
| `theme` | `dark` (default), `light` / `white` | Initial color theme |
| `autosave` | `0` (default), `1` | Initial browser Auto-Save state |
| `#cfg=...` | Base64URL payload | Restores a shared workbench configuration |

---

## Repository Structure

```text
k-comp-configurator/
├── .github/workflows/deploy.yml      # CI test, build & GitHub Pages deployment
├── index.html                        # Vite entrypoint, SVG workbench mount & modals
├── package.json / tsconfig.json      # TypeScript + Vite + Vitest toolchain config
├── vite.config.ts                    # Vite build (base: './') & Vitest jsdom config
├── LICENSE / NOTICE                  # PolyForm Noncommercial 1.0.0 license & attribution notice
├── CITATION.cff / CONTRIBUTING.md    # Citation metadata & contribution guidelines
├── public/
│   ├── .nojekyll                     # Ensures static assets deploy cleanly on GitHub Pages
│   └── assets/
│       ├── kcomp-v2.svg              # K-Comp V2 vector PCB artwork
│       └── components/*.svg          # 47 standalone Inkscape-safe component & accessory SVGs
└── src/
    ├── main.ts                       # Application bootstrap & acyclic hook registration
    ├── styles/style.css              # Dark/Light tokens, responsive mobile shell & print styles
    ├── types/                        # Shared TypeScript interfaces (board, catalog, state, project, i18n)
    ├── boards/                       # Board registry & K-Comp V2 pinout profile
    ├── catalog/                      # Declarative component catalog JSON, ƒx API & guide datasets
    ├── core/                         # Pin solver, breadboard, routing, codegen, blocks, persistence
    ├── i18n/                         # Pluggable locale registry (EN, DE, SQ)
    ├── ui/                           # Workbench SVG renderer, inspector, API drawer, modals & guides
    └── __tests__/                    # Vitest unit tests for hardware constraints & codegen
```

---

## Local Development, Testing & GitHub Pages

Prerequisites: **Node.js 20+** (LTS recommended).

```bash
npm install
npm run dev       # Start local Vite dev server with hot reload
npm test          # Run Vitest unit tests
npm run build     # Type-check (tsc --noEmit) & create production bundle in dist/
npm run preview   # Preview the production dist/ build locally
```

For GitHub Pages, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. Every push to `main` runs `.github/workflows/deploy.yml` (`npm ci` → `npm test` → `npm run build` → Pages deploy).

---

## Author & License

- **Author:** Copyright (c) 2025–2026 **Andreas Kucher**
- **License (Configurator):** PolyForm Noncommercial License 1.0.0 (`PolyForm-Noncommercial-1.0.0`) — free for personal and noncommercial educational use; commercial use requires prior written permission. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
- **Companion Hardware & Docs Repository:** [andkuc/k-comp](https://github.com/andkuc/k-comp)

Built by Andreas Kucher with AI-assisted coding and documentation support (Google Gemini).
