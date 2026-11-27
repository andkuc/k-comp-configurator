# K-Comp Compile Service

Zero-dependency **Node.js 22 LTS** HTTP compile server for the **K-Comp Configurator** (`v0.4.5+`).  
Enables 1-click **Verify** and **Build & Flash** directly from the browser for **K-Comp V2** (ATmega328P, Intel HEX) and **ESP32-S3 DevKitC-1** (multi-segment `.bin`), while keeping the serverless local `.hex`/`.bin` upload mode 100% optional.

> **Local Build Policy:** Container images are built **locally on your machine** from the included `Dockerfile` (no prebuilt third-party binaries are redistributed by this repository). See [THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md) for upstream toolchain licenses.

---

## Architecture Highlights

- **Zero External npm Dependencies:** Built exclusively on Node 22 built-ins (`node:http`, `node:crypto`, `node:child_process`, `node:fs/promises`, `node:test`).
- **Declarative Target Whitelist (`boards.json`):** Clients send only a canonical `boardId` (`kcomp-v2`, `esp32-s3-devkit`), never raw FQBNs or compiler flags. Adding a new board requires only one entry in `boards.json`.
- **3-Stage Caching + Single-Flight Coalescing:**
  1. **Build-Time Core Prewarm:** Cores and libraries are precompiled into the local image (`prewarm.mjs`) — 100% offline at runtime.
  2. **Server Single-Flight & SHA-256 LRU Cache:** Identical concurrent requests coalesce into a single build; subsequent identical builds return in `< 5 ms`.
  3. **Browser In-Memory LRU Cache:** Keyed by source digest + `librariesHash` from `/api/v1/health`.
- **Container Hardening:** Non-root user (`uid 10001`), `read_only: true` root filesystem with `noexec,nosuid` `tmpfs`, `execFile` with `shell: false`, strict filename whitelist, `#include` path-traversal guard, bounded worker queue (`HTTP 429`), CORS + Chrome Private Network Access (`Access-Control-Allow-Private-Network: true`).

---

## Quick Start (from Repository Root)

Make sure **Docker Desktop** (Linux containers) or Docker Engine is running, then run from the repository root:

```bash
# Fast local build (~1 min, K-Comp V2 / ATmega328P only)
npm run compiler:avr

# Full local build (~5–10 min once, K-Comp V2 + ESP32-S3)
npm run compiler:build

# Start / stop / inspect logs later (reuses already-built local image)
npm run compiler:up
npm run compiler:down
npm run compiler:logs

# Check environment & health in one command
npm run doctor
```

Then open K-Comp Configurator → **Settings (⚙)** → **Build & Compile Servers** → select **Local (Docker)** (`http://localhost:8787`) and click **Test**.

---

## Optional: Self-Hosted HTTPS with Caddy (Private Lab Server)

1. Point a DNS record (e.g. `compile.example.org`) to your host with ports `80` and `443` open.
2. Copy `.env.example` to `.env` inside `server/compile-service/` and set `COMPILE_DOMAIN`, `CORS_ORIGINS`, and a strong `AUTH_TOKEN`.
3. Build and start locally on that host:
   ```bash
   cd server/compile-service
   docker compose -f docker-compose.prod.yml up --build -d
   ```
4. Share a confirmation link with users:  
   `https://andkuc.github.io/k-comp-configurator/?compiler=https://compile.example.org`  
   *(Users must explicitly confirm the server URL before any source code is sent; Bearer tokens are stored only in browser `localStorage`, never in project files or URLs. Caddy access logs are discarded by default for privacy.)*

---

## Versioned HTTP API (`/api/v1/`)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/healthz` | `GET` | Lightweight unauthenticated liveness check (`{ ok, serverVersion }`) for Docker `HEALTHCHECK`. |
| `/api/v1/health` | `GET` | Returns `{ ok, apiVersion, serverVersion, boards[], librariesHash, queue: { active, queued, maxConcurrent }, authRequired }`. |
| `/api/v1/compile` | `POST` | Request `{ boardId, codeProfile?, files: [{ path, content }], optimizeForSize? }` → Response `{ ok, cached, durationMs, boardId, diagnostics[], memory?, artifact? }`. |

---

## Configuration (Environment Variables)

See [`.env.example`](.env.example) for a ready-to-copy template:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `HOST` / `PORT` | `0.0.0.0` / `8787` | Listen address and port. |
| `AUTH_TOKEN` | *(empty)* | Optional Bearer token required for `/api/v1/*` (`Authorization: Bearer <token>`). |
| `CORS_ORIGINS` | `*` | `*` or comma-separated origin allowlist (e.g. `https://andkuc.github.io,http://localhost:5173`). |
| `MAX_CONCURRENT_BUILDS` | `2` | Maximum simultaneous build processes. |
| `MAX_QUEUE_LENGTH` | `24` | Maximum queued distinct builds before returning `HTTP 429`. |
| `MAX_CACHE_ENTRIES` | `128` | Maximum SHA-256 cached build results in memory. |
| `MAX_BODY_BYTES` | `524288` | Maximum JSON request size in bytes (512 KiB). |
| `INCLUDE_ELF` | `false` | When `true`, attaches optional `elfBase64` to artifacts (reserved for future emulator integration). |

---

## Running Automated Tests

Requires **Node.js 22 LTS** (no `npm install` needed):

```bash
npm run test:backend
# or directly:
node --test server/compile-service/server.test.mjs
```

---

## License

Service code (`server/compile-service/*.mjs`, `boards.json`) is copyright (c) 2025–2026 **Andreas Kucher** under **PolyForm-Noncommercial-1.0.0**. Upstream toolchains fetched locally during `docker build` remain governed by their own licenses — see [THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md).
