# K-Comp Configurator

**Version `0.1.0`** — A zero-dependency, browser-based interactive hardware configurator, pin-constraint solver, and flat-C `.ino` scaffold generator for the **K-Comp V2** (ATmega328P, 16 MHz, 2 KB SRAM) single-board computer.

Engineered with native ES modules and declarative JSON/SVG assets, the configurator runs 100% client-side with no build step, bundler, or backend, and deploys directly to GitHub Pages.

> **Companion Repository:** Hardware designs, C/C++ libraries, and module manuals are maintained separately in [andkuc/k-comp](https://github.com/andkuc/k-comp).

---

## Key Features

### 1. Interactive Vector Workbench (`js/modules/workbench.js`, `routing.js`, `breadboard.js`)
- **Realistic K-Comp V2 PCB (`assets/kcomp-v2.svg`):** Interactive onboard peripherals (mounted 0.96" OLED with live illuminated ON state, mounted KY-023 Analog Joystick, LED, Potentiometer, START/SELECT buttons, Buzzer, Ultrasonic slot, Wireless slot) directly clickable on the PCB or via the auto-wrapping `ONBOARD` strip, synced with interactive `DIP S1` switches.
- **Direct Onboard Wireless Mounting:** Placing `HC-05` or `ESP-01` mounts the module to scale directly onto its physical K-Comp Wireless slot without synthetic jumper wires.
- **Draggable & Rotatable External Modules:** 43 external modules with standalone Inkscape-safe SVGs, 12 px snap-to-grid positioning (`Alt` bypasses grid), free & 90° rotation with cohesive upside-down titlebar flipping, and direct drag-to-rewire pin handles.
- **Smart Routing & Automatic Breadboard Allocation:** Overlap-minimized orthogonal perimeter routing (with curved fallback), electrical net hover highlighting, smart free-pin GND/5V allocation across board headers before creating top-half breadboard rails, and automatic bottom-half I²C bus expansion for 4+ I²C modules.
- **Inkscape-Safe SVG Export:** Full-opacity export in Dark Mode or WCAG-AA White Mode with zero `<filter>` tags and UI controls cleanly stripped.

### 2. Hardware Constraint Engine (`js/modules/hardware.js`, `js/board-pinmap.js`)
- **Clean Blank Board Start:** Every new board starts with all onboard peripherals disabled (`false`); active onboard hardware is never silently disabled by external modules.
- **Electrical & Bus Checks:** Validates pin capabilities (`DIGITAL`, `PWM`, `ANALOG`, `INT`, `I2C_*`), reserved pins (`D0`/`D1` USB, `A1`/`A2` joystick), I²C address collisions, `SoftwareSerial` multi-UART listening constraints, 5V USB current budget (`500 mA`), and **2 KB SRAM** usage with per-component breakdown tooltips and OLED Full/Paged mode switching.

### 3. `.ino` Code Generator, Structure Blocks & `ƒx API` (`codegen.js`, `code-blocks.js`, `api-browser.js`)
- **Fail-Fast `.ino` Scaffolding:** Unselectable line numbers, section jump bar (`#include` / `setup()` / `loop()`), VS Code Dark+/Light+ syntax highlighting, and bidirectional code ↔ board hover highlighting.
- **13 Flat-C Structure Blocks (`+ Blocks`):** Array-free architectural patterns (EVA functions, FSM, timers, button callbacks, OLED Grid, char parser, context blocks) with inline config editors and an illustrated SVG technique guide (`block-guide.js`).
- **Integrated `ƒx API` Reference (`library-api-data.js`):** 52 libraries / 291 functions with click-to-copy calls, headers, `struct` fields, and `#define` constants — available both in the resizable `Code (.ino)` split drawer and inline inside each component's scrollable info popup (`component-guide-data.js`).

### 4. Lab Workflow, Persistence & i18n (`modals.js`, `persistence.js`, `js/i18n/`)
- **Scrollable Component Info Guides:** Prominent module SVG preview, electrical principle explanation, visual signal-flow chain, live compatible K-Comp pin matrix, classroom pitfalls, and expandable library API reference.
- **Hardware Lab Sheet (Print / PDF):** A4 pre-flight sheet with wiring diagram, Bill of Materials (BOM), exact jumper counts (M–F, M–M, Grove & colors), `DIP S1` table, and sign-off fields.
- **Persistence & Sharing:** Toggleable browser Auto-Save (default `OFF`, `?autosave=1/0`), Undo/Redo (`Ctrl+Z`/`Y`), `.kcomp.json` project save/load, Base64URL `#cfg=` deep links, and live PDF auto-discovery from `andkuc/k-comp/docs/ModuleDocumentation`.
- **Themes & Languages:** Dark Mode + WCAG-AA White Mode (`?theme=dark|light`) and 3 locales (`?lang=en|de|sq`).

---

## URL Parameters

| Parameter | Values | Effect |
| :--- | :--- | :--- |
| `lang` | `en` (default), `de`, `sq` | Initial interface language |
| `theme` | `dark` (default), `light` / `white` | Initial color theme |
| `autosave` | `0` (default), `1` | Initial browser Auto-Save state |
| `#cfg=...` | Base64URL payload | Restores a shared workbench configuration |

---

## Repository Structure

```text
k-comp-configurator/
├── index.html                        # Application shell, SVG workbench mount & modals
├── LICENSE / NOTICE                  # PolyForm Noncommercial 1.0.0 license & attribution notice
├── CITATION.cff / CONTRIBUTING.md    # Citation metadata & contribution guidelines
├── css/style.css                     # Dark/Light tokens, responsive mobile shell & print styles
├── data/components.json              # Declarative catalog (8 onboard, 43 external, 2 presets)
├── assets/
│   ├── kcomp-v2.svg                  # K-Comp V2 vector PCB artwork
│   └── components/*.svg              # 47 standalone Inkscape-safe component & accessory SVGs
└── js/
    ├── board-pinmap.js               # PCB pin coordinates, caps, I²C headers & DIP S1 map
    ├── main.js                       # ES module entrypoint & acyclic hook registration
    ├── modules/                      # 16 focused zero-dependency ES modules
    └── i18n/                         # Pluggable locale registry (EN, DE, SQ)
```

---

## Local Development & GitHub Pages

Because native ES modules (`<script type="module">`) and `fetch()` require HTTP(S), serve locally over HTTP:

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

For GitHub Pages, publish directly from the `main` branch (`/ (root)`). The included `.nojekyll` file ensures static files deploy without Jekyll processing.

---

## Author & License

- **Author:** Copyright (c) 2025–2026 **Andreas Kucher**
- **License (Configurator):** PolyForm Noncommercial License 1.0.0 (`PolyForm-Noncommercial-1.0.0`) — free for personal and noncommercial educational use; commercial use requires prior written permission. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
- **Companion Hardware & Docs Repository:** [andkuc/k-comp](https://github.com/andkuc/k-comp)
