# K-Comp Configurator

**Version `0.4.5`** — A browser-based interactive multi-board hardware configurator, pin-constraint solver, flat-C scaffold generator, USB serial monitor/plotter, and browser flasher for the **K-Comp** ecosystem (**K-Comp V2 / ATmega328P** and **ESP32-S3 DevKitC-1 N16R8**), built with **TypeScript, Vite, and Vitest**.

The web application runs 100% client-side with zero required backend (local `.hex`/`.bin` flashing, Web Serial monitor, live plotter, and FFT work directly in Chrome/Edge), plus an optional locally-built Docker compile server for 1-click **Verify** and **Build & Flash**.

> **Companion Repository:** Hardware schematics, C/C++ libraries, and module manuals are maintained separately in [andkuc/k-comp](https://github.com/andkuc/k-comp).

---

## Quick Start (3 Ways to Try It)

### 1. Instant Browser Use (Zero Installation)
Open the live GitHub Pages deployment directly in **Chrome** or **Edge** (for Web Serial / WebHID hardware access) — or any modern browser for hardware wiring, code generation, lab sheets, and the built-in Demo Stream:
- `https://andkuc.github.io/k-comp-configurator/`

### 2. Run Locally from This Repository (Node.js 22 LTS)
```bash
git clone https://github.com/andkuc/k-comp-configurator.git
cd k-comp-configurator
npm ci
npm run doctor      # Checks Node, dependencies, Docker & ports with clear hints
npm run dev:full    # Starts local compile server (if built) + Vite dev server
```
Open the URL printed by Vite (default `http://localhost:5173`). If Docker is not installed or stopped, `npm run dev:full` automatically starts in **serverless mode**.

### 3. Optional: Enable Local 1-Click Verify & Build & Flash (Docker)
Start **Docker Desktop** (Linux containers) or Docker Engine, then build the local compile container once from the repository root:
```bash
npm run compiler:avr     # Fast build (~1 min): K-Comp V2 (ATmega328P) only
# OR
npm run compiler:build   # Full build (~5–10 min once): K-Comp V2 + ESP32-S3
```
Then open **Project ▾ → ⚙ Settings → Build & Compile Servers**, select **Local (Docker)** (`http://localhost:8787`), and click **Test**. See [`server/compile-service/README.md`](server/compile-service/README.md) for full details.

---

## Common Commands (Repo Root)

All commands work identically in Windows PowerShell, macOS Zsh, and Linux Bash (and are also available via **VS Code → Tasks: Run Task**):

| Command | Purpose |
| :--- | :--- |
| `npm run doctor` | Verify Node version, installed packages, Docker daemon, ports & compile server health |
| `npm run dev:full` | 1-command local start (starts local compile container if built, then Vite) |
| `npm run dev` | Start Vite frontend dev server only |
| `npm run check` | Full local CI gate: `check:arch` → `test:all` → `build` (strict TS + production bundle) |
| `npm run test:all` | Run all frontend Vitest suites + zero-dep Node backend tests |
| `npm run check:arch` | Verify layer boundaries, acyclic module DAG & 100% SPDX headers |
| `npm run compiler:avr` | Fast local Docker build & start (K-Comp V2 / ATmega328P only) |
| `npm run compiler:build` | Full local Docker build & start (K-Comp V2 + ESP32-S3) |
| `npm run compiler:up` / `down` / `logs` | Start, stop, or tail logs of the local compile container |

---

## Key Features

### 1. Multi-Board Interactive Vector Workbench (`src/ui/workbench/`, `src/core/routing.ts`, `breadboard.ts`, `carrier-breadboard.ts`)
- **K-Comp V2 (ATmega328P, 5V):** Frameless PCB (`public/assets/kcomp-v2.svg`), click-on-PCB onboard peripherals (illuminated 0.96" OLED, mounted KY-023 joystick, LED, potentiometer, buttons, buzzer, ultrasonic & wireless slots), interactive `DIP S1`, AVR Timer1/Timer2 conflict guards with 1-click Quick-Fix, board-mounted `HC-05`/`ESP-01`, smart free-pin `GND`/`5V` allocation, manual breadboard rail placement, and automatic bottom-half 4+ I²C hub.
- **ESP32-S3 DevKitC-1 (N16R8, 3.3V):** 44-pin Inkscape-safe PCB (`public/assets/esp32-s3-devkit.svg`) on a toggleable breadboard carrier, 3.3V logic-level checks, strapping-pin & `ADC2`+Wi-Fi guards with **1-click Quick-Fix** buttons, and contextual `HW-UART` vs. `SW-UART` styling.
- **Inkscape-Safe SVG Export:** Full-opacity Dark Mode or WCAG-AA White Mode export with zero `<filter>` tags and UI controls cleanly stripped.

### 2. Device Workspace — Monitor, Live Plotter/FFT, Browser Flasher & Multi-Server Compile (`src/services/`, `src/workspaces/views/`)
- **Web Serial Monitor & Demo Simulator:** Exclusive port state machine, fixed-capacity ring buffers, line filtering, timestamps, quick-send parser chips, and `.txt`/`.csv` export.
- **HiDPI Canvas 2D Live Plotter & FFT:** Real-time multi-channel plotting (`key:value` & CSV), timebase/cursor Δt & BPM measurement, opt-in Radix-2 FFT spectrum with 50 Hz guide, and `.png` export.
- **Direct Browser Upload (Beta):** Native STK500v1 flasher for K-Comp V2 (with MCP2221 WebHID GP3 auto-reset & manual fallback) and lazy-loaded `esptool-js` flasher for ESP32-S3, plus built-in browser compatibility info modal (`ⓘ`).
- **Layer-0 Hardware Self-Test (`@KTEST`):** Standalone zero-library diagnostic sketch (`Wire.h` only) with deadman-guarded actuator pulse, I²C bus scan, alternate-address mismatch hints, and live pin readings.
- **Optional Multi-Server Compile Client:** `HttpCompilerProvider` (`/api/v1/health`, `/api/v1/compile`) with local-only `localStorage` server profiles, optional Bearer auth, explicit `?compiler=<url>` confirmation, LRU cache, Flash/RAM meters, and sanitized structured diagnostics.

### 3. Clean Layered Architecture, Lab Workflow & Persistence
- **Declarative Board Profiles & Constraint Rule Plugins (`src/boards/`, `src/core/hardware/rules/`):** Zero board-specific engine branches; pure headless `ElectricalNetlist` (`src/core/netlist.ts`) and `tsconfig.strict.json` (`strict: true`).
- **Lab Sheet, Fillable Project Charter & Persistence (`src/ui/modals/`, `src/ui/charter.ts`, `src/core/document.ts`):** Board-aware BOM, tie-point checklist, fillable team proposal saved in canonical `kcomp-project/1` `.kcomp.json` files and Deflate-compressed `#cfg=` links.
- **Themes, Skill Presets & Lazy-Loaded i18n:** Dark Mode + WCAG-AA White Mode, Beginner/Intermediate/Professional feature presets, and 3 locales (English default + lazy-loaded German & Albanian).

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
| `compiler` | `http(s)://...` | Pre-fills a compile server URL (requires explicit user confirmation) |
| `#cfg=...` | Deflate + Base64URL `kcomp-project/1` payload | Restores wiring, board & filled Project Charter |

---

## Repository Structure

```text
k-comp-configurator/
├── .github/workflows/
│   ├── deploy.yml                    # CI checks, strict typecheck, build & GitHub Pages deploy
│   └── compile-server.yml            # Zero-dep Node 22 tests for server/compile-service
├── .devcontainer/devcontainer.json   # Optional GitHub Codespaces setup
├── .vscode/tasks.json                # 1-click VS Code tasks (Doctor, Dev Full, Check All, Docker)
├── scripts/
│   ├── check-boundaries.mjs          # Layer boundary, acyclic DAG & SPDX guard
│   ├── doctor.mjs                    # Local environment & compile-server diagnostic
│   └── dev-full.mjs                  # Unified launcher (optional Docker + Vite)
├── server/compile-service/           # Optional local Zero-Dep Docker compile server
├── public/assets/                    # Board & component SVGs (Inkscape-safe, zero <filter>)
├── src/                              # TypeScript frontend (types, boards, core, store, services, workspaces, ui)
└── LICENSE / NOTICE / THIRD_PARTY_LICENSES.md / CITATION.cff / CONTRIBUTING.md
```

For GitHub Pages, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

---

## Author & License

- **Author:** Copyright (c) 2025–2026 **Andreas Kucher**
- **License (Configurator):** PolyForm Noncommercial License 1.0.0 (`PolyForm-Noncommercial-1.0.0`) — free for personal and noncommercial educational use; commercial use requires prior written permission. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
- **Companion Hardware & Docs Repository:** [andkuc/k-comp](https://github.com/andkuc/k-comp)

Built by Andreas Kucher with AI-assisted coding and documentation support (Google Gemini).
