#!/usr/bin/env node

/**
 * Phase 9 Task 1 — Local inventory worker (read-only, GET-only).
 *
 * Provides three GET-only routes backed by synthetic R2 fixture data:
 *   GET /:binding/list?prefix=...&cursor=...&limit=...
 *   GET /:binding/head/:key
 *   GET /:binding/get/:key
 *
 * Never writes to real Cloudflare or R2.  Used only for synthetic testing
 * and local verification.
 *
 * @module cloudflare-r2-inventory-local-worker
 */

import { createServer } from 'node:http';
import { Readable } from 'node:stream';

/**
 * Build a synthetic R2 store from a plain object of { key: { body, size, lastModified, etag } }.
 * @param {Record<string, object>} fixtures
 * @returns {object} store with list, head, get
 */
export function createSyntheticR2Store(fixtures = {}) {
  const entries = Object.entries(fixtures).map(([key, data]) => ({
    key,
    body: typeof data.body === 'string' ? data.body : String(data.body ?? ''),
    size: data.size ?? (typeof data.body === 'string' ? Buffer.byteLength(data.body) : 0),
    lastModified: data.lastModified ?? new Date().toISOString(),
    etag: data.etag ?? `"${Date.now()}"`,
  }));

  return {
    async list({ prefix = '', cursor, limit = 1000 } = {}) {
      let filtered = entries
        .filter((e) => e.key.startsWith(prefix))
        .sort((a, b) => a.key.localeCompare(b.key));

      if (cursor) {
        const idx = filtered.findIndex((e) => e.key === cursor);
        if (idx >= 0) filtered = filtered.slice(idx + 1);
      }

      const page = filtered.slice(0, limit);
      return {
        objects: page.map(({ key, size, lastModified, etag }) => ({
          key,
          size,
          lastModified,
          etag,
        })),
        truncated: filtered.length > limit,
        cursor: filtered.length > limit ? page[page.length - 1].key : undefined,
      };
    },

    async head(key) {
      const entry = entries.find((e) => e.key === key);
      if (!entry) return null;
      return { key: entry.key, size: entry.size, lastModified: entry.lastModified, etag: entry.etag };
    },

    async get(key) {
      const entry = entries.find((e) => e.key === key);
      if (!entry) return null;
      return {
        body: Readable.from(Buffer.from(entry.body, 'utf-8')),
        size: entry.size,
        lastModified: entry.lastModified,
        etag: entry.etag,
      };
    },
  };
}

/**
 * Start the local worker HTTP server.  Returns a server handle with a
 * `close()` method for test teardown.
 *
 * @param {object} options
 * @param {Map<string, object>} options.stores - binding name → synthetic R2 store
 * @param {number} [options.port=0] - 0 = OS-assigned ephemeral port
 * @returns {Promise<{ server: import('http').Server, port: number, url: string }>}
 */
export function startLocalWorker({ stores, port = 0 }) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const segments = url.pathname.split('/').filter(Boolean);

    if (segments.length < 2) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }

    const [binding, action, ...rest] = segments;
    const store = stores.get(binding);

    if (!store) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: `unknown binding: ${binding}` }));
      return;
    }

    try {
      if (action === 'list' && req.method === 'GET') {
        const prefix = url.searchParams.get('prefix') || '';
        const cursor = url.searchParams.get('cursor') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '1000', 10);
        const result = await store.list({ prefix, cursor, limit });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }

      if (action === 'head' && req.method === 'GET') {
        const key = rest.join('/');
        const result = await store.head(key);
        if (!result) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'not found' }));
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }

      if (action === 'get' && req.method === 'GET') {
        const key = rest.join('/');
        const result = await store.get(key);
        if (!result) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'not found' }));
          return;
        }
        res.writeHead(200, { 'content-type': 'application/octet-stream' });
        for await (const chunk of result.body) {
          res.write(chunk);
        }
        res.end();
        return;
      }

      res.writeHead(405, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'method not allowed' }));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        port: addr.port,
        url: `http://127.0.0.1:${addr.port}`,
      });
    });
    server.once('error', reject);
  });
}

/**
 * Create a remote-compatible R2 client backed by an HTTP URL (the local worker).
 * This adapter wraps the list/head/get protocol into the shape the collector expects.
 *
 * @param {string} baseUrl - e.g. http://127.0.0.1:PORT/BINDING
 * @returns {object} client compatible with collectPrefixInventory
 */
export function createHttpClient(baseUrl) {
  return {
    async list({ prefix, cursor, limit } = {}) {
      const params = new URLSearchParams();
      if (prefix) params.set('prefix', prefix);
      if (cursor) params.set('cursor', cursor);
      if (limit) params.set('limit', String(limit));
      const res = await fetch(`${baseUrl}/list?${params}`);
      if (!res.ok) throw new Error(`list failed: ${res.status}`);
      return res.json();
    },

    async head(key) {
      const res = await fetch(`${baseUrl}/head/${encodeURIComponent(key)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`head failed: ${res.status}`);
      return res.json();
    },

    async get(key) {
      const res = await fetch(`${baseUrl}/get/${encodeURIComponent(key)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`get failed: ${res.status}`);
      return { body: res.body };
    },
  };
}
