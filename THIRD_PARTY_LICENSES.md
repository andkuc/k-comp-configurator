# Third-Party Licenses & Notices

**K-Comp Configurator** itself (frontend source code under `src/`, vector graphics under `public/assets/`, and HTTP service wrapper under `server/compile-service/*.mjs`) is copyright (c) 2025–2026 **Andreas Kucher** and licensed under **PolyForm-Noncommercial-1.0.0** (see [LICENSE](LICENSE) and [NOTICE](NOTICE)).

This repository does **not** redistribute compiled third-party toolchains or prebuilt container images. Third-party components used at runtime or fetched locally by users are documented below under their own respective licenses.

---

## 1. Frontend Runtime Dependency (Bundled on Demand)

| Package | Version | License | Copyright / Upstream |
| :--- | :--- | :--- | :--- |
| `esptool-js` | `^0.5.0` | **Apache-2.0** | Espressif Systems (Shanghai) Co., Ltd. — https://github.com/espressif/esptool-js |

`esptool-js` is lazy-loaded strictly when flashing ESP32-S3 targets via Web Serial and remains licensed under the Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0).

---

## 2. Optional Local Compile Container (`server/compile-service/Dockerfile`)

When a user builds the optional compile container locally (`npm run compiler:avr` or `npm run compiler:build`), Docker downloads upstream open-source toolchains and board cores directly from their respective maintainers onto the user's own machine. These upstream components remain governed solely by their own licenses (and are **not** subject to the PolyForm Noncommercial terms of the K-Comp Configurator):

| Component | Upstream License | Source / Maintainer |
| :--- | :--- | :--- |
| `node:22-bookworm-slim` (Debian / Node.js) | MIT / GPL / LGPL (per Debian package) | Debian Project & OpenJS Foundation |
| `arduino-cli` | **GPL-3.0-only** | Arduino S.r.l. — https://github.com/arduino/arduino-cli |
| `arduino:avr` Core & `avr-gcc` | **LGPL-2.1-or-later** / **GPL-3.0** (with GCC Runtime Library Exception) | Arduino S.r.l. & GNU Project |
| `esp32:esp32` Core & `xtensa-gcc` | **LGPL-2.1-or-later** / **Apache-2.0** / **GPL-3.0** (with GCC Runtime Library Exception) | Espressif Systems — https://github.com/espressif/arduino-esp32 |
| `caddy:2-alpine` *(optional prod compose)* | **Apache-2.0** | Caddy Server — https://github.com/caddyserver/caddy |

> **Important for Self-Hosting / Redistribution:** Building the container locally for personal or internal educational use downloads upstream components directly to your host. If you ever redistribute a built container image publicly, you are responsible for complying with all upstream license obligations (including GPL-3.0 source availability requirements).

---

## 3. Trademark Notice

All third-party product names, logos, and trademarks mentioned in technical build recipes or documentation — including **Arduino®** (a registered trademark of Arduino S.r.l.), **ESP32™ / Espressif®** (trademarks of Espressif Systems), and **Docker®** — are the property of their respective owners. K-Comp Configurator is an independent project and is not affiliated with, sponsored by, or endorsed by any of those organizations.
