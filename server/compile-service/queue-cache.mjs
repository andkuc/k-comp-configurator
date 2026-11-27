// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Single-Flight Request Coalescing, SHA-256 Artifact LRU Cache & Bounded Build Worker Queue
import { createHash } from 'node:crypto';

export class QueueFullError extends Error {
  constructor(message = 'Compile queue is full. Please retry in a few seconds.') {
    super(message);
    this.name = 'QueueFullError';
    this.statusCode = 429;
  }
}

/**
 * Deterministic SHA-256 content-addressable build cache key.
 * Keys over boardId, codeProfile, optimization flag, librariesHash, and sorted source files.
 */
export function computeBuildCacheKey({ boardId, codeProfile = '', optimizeForSize = false, files = [], librariesHash = '' }) {
  const sortedFiles = [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => [f.path, f.content]);

  const canonical = JSON.stringify({
    b: boardId,
    p: codeProfile || '',
    o: Boolean(optimizeForSize),
    l: librariesHash || '',
    f: sortedFiles
  });

  return createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

/** Bounded in-memory LRU cache backed by Map insertion order. */
export class ArtifactLruCache {
  constructor(maxEntries = 128) {
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
    this.store = new Map();
  }

  get size() {
    return this.store.size;
  }

  has(key) {
    return this.store.has(key);
  }

  get(key) {
    const val = this.store.get(key);
    if (val === undefined) return undefined;
    this.store.delete(key);
    this.store.set(key, val);
    return val;
  }

  set(key, value) {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, value);
  }

  clear() {
    this.store.clear();
  }
}

/**
 * Coordinates classroom burst traffic cleanly:
 * 1. Instant SHA-256 LRU cache hits bypass the worker queue completely.
 * 2. Single-Flight coalescing merges concurrent identical builds into ONE execution.
 * 3. Bounded worker queue caps parallel builds (`maxConcurrent`) and rejects overflow with HTTP 429.
 */
export class CompileCoordinator {
  constructor({ maxConcurrent = 2, maxQueueLength = 24, maxCacheEntries = 128 } = {}) {
    this.maxConcurrent = Math.max(1, Math.floor(maxConcurrent));
    this.maxQueueLength = Math.max(0, Math.floor(maxQueueLength));
    this.cache = new ArtifactLruCache(maxCacheEntries);
    this.inFlight = new Map();
    this.queue = [];
    this.activeCount = 0;
  }

  getStats() {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueueLength: this.maxQueueLength,
      inFlight: this.inFlight.size,
      cacheSize: this.cache.size,
      cacheMax: this.cache.maxEntries
    };
  }

  clearCache() {
    this.cache.clear();
  }

  async run(cacheKey, taskFn, { bypassCache = false } = {}) {
    // 1. Check SHA-256 LRU cache first
    if (!bypassCache) {
      const hit = this.cache.get(cacheKey);
      if (hit) {
        return {
          ...hit,
          cached: true,
          durationMs: 0
        };
      }
    }

    // 2. Single-Flight coalescing: attach to an identical in-flight build
    if (!bypassCache && this.inFlight.has(cacheKey)) {
      const sharedResult = await this.inFlight.get(cacheKey);
      return {
        ...sharedResult,
        cached: true
      };
    }

    // 3. Enforce bounded queue limit before admitting a new distinct build
    if (this.activeCount >= this.maxConcurrent && this.queue.length >= this.maxQueueLength) {
      throw new QueueFullError(
        `Compile server queue is full (${this.activeCount}/${this.maxConcurrent} active, ${this.queue.length}/${this.maxQueueLength} queued).`
      );
    }

    const workPromise = this.#enqueue(taskFn)
      .then((result) => {
        if (result && result.ok && result.artifact) {
          this.cache.set(cacheKey, result);
        }
        return result;
      })
      .finally(() => {
        if (this.inFlight.get(cacheKey) === workPromise) {
          this.inFlight.delete(cacheKey);
        }
      });

    if (!bypassCache) {
      this.inFlight.set(cacheKey, workPromise);
    }

    return workPromise;
  }

  #enqueue(taskFn) {
    return new Promise((resolve, reject) => {
      const job = { taskFn, resolve, reject };
      if (this.activeCount < this.maxConcurrent) {
        this.#startJob(job);
      } else {
        this.queue.push(job);
      }
    });
  }

  #startJob(job) {
    this.activeCount++;
    Promise.resolve()
      .then(() => job.taskFn())
      .then(job.resolve, job.reject)
      .finally(() => {
        this.activeCount = Math.max(0, this.activeCount - 1);
        this.#drainQueue();
      });
  }

  #drainQueue() {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const nextJob = this.queue.shift();
      if (nextJob) this.#startJob(nextJob);
    }
  }
}
