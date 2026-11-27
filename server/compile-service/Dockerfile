# SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Multi-Stage Offline-Capable Compile Server Image (Node 22 LTS + Pinned AVR & ESP32-S3 Cores + K-Comp Libraries + Core Prewarm)

FROM node:22-bookworm-slim AS toolchain-builder

ARG ARDUINO_CLI_VERSION=1.1.1
ARG AVR_CORE_VERSION=1.8.6
ARG ESP32_CORE_VERSION=3.1.1
ARG KCOMP_LIBS_REPO=https://github.com/andkuc/k-comp.git
ARG KCOMP_LIBS_REF=main
ARG INSTALL_ESP32_CORE=true

ENV DEBIAN_FRONTEND=noninteractive \
    ARDUINO_DIRECTORIES_DATA=/opt/kcomp-cli/data \
    ARDUINO_DIRECTORIES_DOWNLOADS=/tmp/cli-downloads \
    ARDUINO_DIRECTORIES_USER=/opt/kcomp-cli/user \
    ARDUINO_UPDATER_ENABLE_NOTIFICATION=false \
    ARDUINO_METRICS_ENABLED=false

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      python3 \
      python3-serial \
      tar \
      xz-utils \
    && rm -rf /var/lib/apt/lists/*

# 1. Install pinned arduino-cli binary (amd64 / arm64)
RUN ARCH="$(dpkg --print-architecture)" \
    && case "$ARCH" in \
         amd64) CLI_ARCH="Linux_64bit" ;; \
         arm64) CLI_ARCH="Linux_ARM64" ;; \
         *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;; \
       esac \
    && curl -fsSL "https://downloads.arduino.cc/arduino-cli/arduino-cli_${ARDUINO_CLI_VERSION}_${CLI_ARCH}.tar.gz" \
       -o /tmp/arduino-cli.tar.gz \
    && tar -xzf /tmp/arduino-cli.tar.gz -C /usr/local/bin arduino-cli \
    && chmod +x /usr/local/bin/arduino-cli \
    && rm -f /tmp/arduino-cli.tar.gz \
    && mkdir -p /opt/kcomp-cli/data /opt/kcomp-cli/user/libraries /opt/kcomp-cli/prewarm-cache

# 2. Install pinned AVR & ESP32-S3 cores
RUN arduino-cli config init --overwrite \
    && arduino-cli config add board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_index.json \
    && arduino-cli core update-index \
    && arduino-cli core install "arduino:avr@${AVR_CORE_VERSION}" \
    && if [ "$INSTALL_ESP32_CORE" = "true" ]; then \
         arduino-cli core install "esp32:esp32@${ESP32_CORE_VERSION}"; \
       fi \
    && rm -rf /tmp/cli-downloads

# 3. Bake K-Comp C/C++ libraries from andkuc/k-comp into /opt/kcomp-cli/user/libraries
RUN git clone --depth 1 --branch "${KCOMP_LIBS_REF}" "${KCOMP_LIBS_REPO}" /tmp/kcomp-repo \
    && if [ -d /tmp/kcomp-repo/libraries ]; then \
         cp -r /tmp/kcomp-repo/libraries/* /opt/kcomp-cli/user/libraries/; \
       fi \
    && rm -rf /tmp/kcomp-repo

# 4. Copy service files & prewarm core build caches declaratively from boards.json
WORKDIR /app
COPY package.json boards.json config.mjs prewarm.mjs ./

RUN PREWARM_LIST="$(if [ "$INSTALL_ESP32_CORE" = "true" ]; then echo ""; else echo "kcomp-v2"; fi)" \
    && PREWARM_BOARDS="$PREWARM_LIST" \
       CORE_CACHE_DIR=/opt/kcomp-cli/prewarm-cache \
       ARDUINO_DATA_DIR=/opt/kcomp-cli/data \
       ARDUINO_USER_DIR=/opt/kcomp-cli/user \
       LIBRARIES_HASH_FILE=/opt/kcomp-cli/.libraries-hash \
       node prewarm.mjs

# ---------------------------------------------------------------------------
# Stage 2: Lean Hardened Runtime Image (Zero External npm Packages, Non-Root)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

# Note: K-Comp service wrapper (/app/*.mjs) is PolyForm-Noncommercial-1.0.0; locally fetched upstream
# toolchains and cores remain under their own licenses (GPL-3.0 / LGPL-2.1 / Apache-2.0 — see THIRD_PARTY_LICENSES.md).
LABEL org.opencontainers.image.title="K-Comp Compile Server (Local Build)" \
      org.opencontainers.image.description="Local zero-dependency HTTP compile server for K-Comp Configurator (ATmega328P & ESP32-S3)" \
      org.opencontainers.image.authors="Andreas Kucher" \
      org.opencontainers.image.source="https://github.com/andkuc/k-comp-configurator"

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      python3 \
      python3-serial \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 kcomp \
    && useradd --uid 10001 --gid 10001 --shell /usr/sbin/nologin --create-home kcomp

COPY --from=toolchain-builder /usr/local/bin/arduino-cli /usr/local/bin/arduino-cli
COPY --from=toolchain-builder /opt/kcomp-cli /opt/kcomp-cli

WORKDIR /app
COPY package.json boards.json config.mjs queue-cache.mjs compiler-runner.mjs server.mjs ./

RUN mkdir -p /tmp/kcomp-builds /var/cache/kcomp-compile/core-cache \
    && chown -R kcomp:kcomp /var/cache/kcomp-compile /tmp/kcomp-builds \
    && chmod -R a+rX /opt/kcomp-cli /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    ARDUINO_CLI_BIN=/usr/local/bin/arduino-cli \
    ARDUINO_DATA_DIR=/opt/kcomp-cli/data \
    ARDUINO_USER_DIR=/opt/kcomp-cli/user \
    ARDUINO_DIRECTORIES_DOWNLOADS=/tmp/kcomp-builds/downloads \
    PREWARM_CACHE_DIR=/opt/kcomp-cli/prewarm-cache \
    CORE_CACHE_DIR=/var/cache/kcomp-compile/core-cache \
    BUILD_ROOT_DIR=/tmp/kcomp-builds \
    LIBRARIES_HASH_FILE=/opt/kcomp-cli/.libraries-hash \
    MAX_CONCURRENT_BUILDS=2 \
    MAX_QUEUE_LENGTH=24 \
    MAX_CACHE_ENTRIES=128 \
    CORS_ORIGINS=*

USER kcomp
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8787/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.mjs"]
