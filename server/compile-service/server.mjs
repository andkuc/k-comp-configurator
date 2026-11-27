// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Zero-Dependency HTTP Compile Server (/api/v1/health, /api/v1/compile, CORS + Chrome PNA, Bearer Auth)
import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLibrariesHash, loadBoardsWhitelist, loadConfig } from './config.mjs';
import { createCliCompileRunner, seedCoreCacheFromPrewarm, validateCompilePayload, ValidationError } from './compiler-runner.mjs';
import { CompileCoordinator, computeBuildCacheKey, QueueFullError } from './queue-cache.mjs';

class PayloadTooLargeError extends Error {
  constructor(limitBytes) {
    super(`Request body exceeds maximum size of ${limitBytes} bytes.`);
    this.name = 'PayloadTooLargeError';
    this.statusCode = 413;
  }
}

function isOriginAllowed(origin, corsConfig) {
  if (!origin) return corsConfig.allowAll ? '*' : null;
  if (corsConfig.allowAll) return '*';
  const clean = origin.replace(/\/+$/, '');
  return corsConfig.origins.includes(clean) ? origin : null;
}

function applySecurityAndCorsHeaders(req, res, corsConfig) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  const origin = req.headers.origin;
  const allowedOrigin = isOriginAllowed(origin, corsConfig);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    if (allowedOrigin !== '*') {
      res.setHeader('Vary', 'Origin');
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Chrome Private Network Access (PNA): allows HTTPS origins (e.g. GitHub Pages) to call localhost / LAN compile servers
  if (req.method === 'OPTIONS' || req.headers['access-control-request-private-network'] === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders
  });
  res.end(body);
}

function verifyBearerToken(req, expectedToken) {
  if (!expectedToken) return true;
  const auth = req.headers.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
    return false;
  }
  const provided = auth.slice(7).trim();
  const a = Buffer.from(provided, 'utf-8');
  const b = Buffer.from(expectedToken, 'utf-8');
  if (a.byteLength !== b.byteLength) return false;
  return timingSafeEqual(a, b);
}

function readJsonBody(req, maxBodyBytes) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let total = 0;
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      rejectBody(err);
    };

    req.on('data', (chunk) => {
      if (settled) return;
      total += chunk.byteLength;
      if (total > maxBodyBytes) {
        req.resume();
        fail(new PayloadTooLargeError(maxBodyBytes));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) {
        rejectBody(new ValidationError('Empty JSON request body.'));
        return;
      }
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        rejectBody(new ValidationError('Malformed JSON in request body.'));
      }
    });

    req.on('error', (err) => fail(err));
  });
}

/**
 * Factory creating a testable, zero-dependency HTTP compile server instance.
 */
export function createCompileServer(options = {}) {
  const config = options.config || loadConfig();
  const boardsMap = options.boardsMap || loadBoardsWhitelist(config.boardsFile);
  const librariesHash = options.librariesHash || computeLibrariesHash(config, boardsMap);
  const runner = options.runner || createCliCompileRunner(config);
  const coordinator =
    options.coordinator ||
    new CompileCoordinator({
      maxConcurrent: config.maxConcurrentBuilds,
      maxQueueLength: config.maxQueueLength,
      maxCacheEntries: config.maxCacheEntries
    });

  const boardIds = Array.from(boardsMap.keys());
  const authRequired = Boolean(config.authToken);

  const server = createServer(async (req, res) => {
    applySecurityAndCorsHeaders(req, res, config.cors);

    if (req.method === 'OPTIONS') {
      if (!config.cors.allowAll && req.headers.origin && !isOriginAllowed(req.headers.origin, config.cors)) {
        res.writeHead(403);
        res.end();
        return;
      }
      res.writeHead(204);
      res.end();
      return;
    }

    const urlPath = (req.url || '/').split('?')[0];

    // Lightweight unauthenticated liveness endpoint for Docker HEALTHCHECK & reverse proxies
    if (urlPath === '/healthz' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, serverVersion: config.serverVersion });
      return;
    }

    // Versioned API: GET /api/v1/health
    if (urlPath === '/api/v1/health') {
      if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'Method not allowed. Use GET.' });
        return;
      }
      if (!verifyBearerToken(req, config.authToken)) {
        sendJson(res, 401, {
          ok: false,
          authRequired: true,
          error: 'Unauthorized: valid Authorization Bearer token required.'
        });
        return;
      }
      const q = coordinator.getStats();
      sendJson(res, 200, {
        ok: true,
        apiVersion: config.apiVersion,
        serverVersion: config.serverVersion,
        boards: boardIds,
        librariesHash,
        queue: {
          active: q.active,
          queued: q.queued,
          maxConcurrent: q.maxConcurrent
        },
        authRequired
      });
      return;
    }

    // Versioned API: POST /api/v1/compile
    if (urlPath === '/api/v1/compile') {
      if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'Method not allowed. Use POST.' });
        return;
      }
      if (!verifyBearerToken(req, config.authToken)) {
        sendJson(res, 401, {
          ok: false,
          error: 'Unauthorized: valid Authorization Bearer token required.'
        });
        return;
      }

      try {
        const body = await readJsonBody(req, config.maxBodyBytes);
        const validated = validateCompilePayload(body, boardsMap, {
          maxFilesPerRequest: config.maxFilesPerRequest,
          maxBodyBytes: config.maxBodyBytes
        });

        const cacheKey = computeBuildCacheKey({
          boardId: validated.boardId,
          codeProfile: validated.codeProfile,
          optimizeForSize: validated.optimizeForSize,
          files: validated.files,
          librariesHash
        });

        const result = await coordinator.run(cacheKey, () => runner.compile(validated));
        sendJson(res, 200, result);
      } catch (err) {
        if (err instanceof PayloadTooLargeError) {
          sendJson(res, 413, { ok: false, error: err.message });
          return;
        }
        if (err instanceof ValidationError) {
          sendJson(res, 400, { ok: false, error: err.message });
          return;
        }
        if (err instanceof QueueFullError) {
          sendJson(res, 429, { ok: false, error: err.message }, { 'Retry-After': '3' });
          return;
        }
        sendJson(res, 500, {
          ok: false,
          error: err instanceof Error ? err.message : 'Internal compile server error.'
        });
      }
      return;
    }

    sendJson(res, 404, { ok: false, error: `Unknown endpoint: ${urlPath}` });
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  return { server, config, boardsMap, librariesHash, coordinator };
}

const isDirectEntry =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectEntry) {
  const { server, config, boardsMap, librariesHash } = createCompileServer();
  seedCoreCacheFromPrewarm(config, boardsMap)
    .then((seeded) => {
      if (seeded > 0) {
        console.log(`[k-comp-compile-service] Seeded prewarmed core cache for ${seeded} target(s).`);
      }
    })
    .catch((err) => {
      console.warn('[k-comp-compile-service] Core cache seed warning:', err instanceof Error ? err.message : String(err));
    });
  server.listen(config.port, config.host, () => {
    const boardsList = Array.from(boardsMap.keys()).join(', ');
    console.log(
      `[k-comp-compile-service] v${config.serverVersion} listening on http://${config.host}:${config.port} ` +
        `(boards: ${boardsList} | libs: ${librariesHash} | maxConcurrent: ${config.maxConcurrentBuilds} | auth: ${config.authToken ? 'bearer' : 'open'})`
    );
  });

  const shutdown = (signal) => {
    console.log(`[k-comp-compile-service] Received ${signal}, shutting down gracefully…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
