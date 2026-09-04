#!/usr/bin/env node
/**
 * Cloudflare Vectorize Ingestion Script for Taste Cortex
 * Batches and embeds the 231 extracted taste blobs into Cloudflare Vectorize `taste-cortex`.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '9d7cec1b5a32b2df8c6cdc1321ccd00b';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const INDEX_NAME = 'taste-cortex';
const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';

if (!CF_API_TOKEN) {
  console.error('ERROR: CLOUDFLARE_API_TOKEN must be set.');
  process.exit(1);
}

const manifestPath = join(__dirname, '..', 'taste-blobs-manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`ERROR: Manifest not found at ${manifestPath}. Run export-taste-manifest.py first.`);
  process.exit(1);
}

const rawManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
console.log(`Loaded ${rawManifest.length} blobs from manifest.`);

// Ensure vector ID <= 64 bytes (Vectorize constraint)
function formatVectorId(rawId) {
  if (rawId.length <= 64) return rawId;
  const hash = createHash('md5').update(rawId).digest('hex').slice(0, 10);
  return `${rawId.slice(0, 53)}-${hash}`; // 53 + 1 + 10 = 64 bytes
}

async function getEmbeddings(texts) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${EMBED_MODEL}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: texts }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Workers AI error (${res.status}): ${err}`);
  }

  const json = await res.json();
  return json.result.data; // Array of 768-dim vectors
}

async function upsertVectors(vectors) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/vectorize/v2/indexes/${INDEX_NAME}/upsert`;
  const ndjsonLines = vectors.map((v) => JSON.stringify(v)).join('\n');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/x-ndjson',
    },
    body: ndjsonLines,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vectorize upsert error (${res.status}): ${err}`);
  }

  return await res.json();
}

async function run() {
  const BATCH_SIZE = 20;
  let processed = 0;

  for (let i = 0; i < rawManifest.length; i += BATCH_SIZE) {
    const chunk = rawManifest.slice(i, i + BATCH_SIZE);
    const texts = chunk.map((item) => item.text.slice(0, 2000));

    console.log(`Embedding batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} items)...`);
    const embeddings = await getEmbeddings(texts);

    const vectorizeItems = chunk.map((item, idx) => ({
      id: formatVectorId(item.id),
      values: embeddings[idx],
      metadata: {
        category: item.metadata.category,
        author: item.metadata.author,
        title: item.metadata.title,
        slug: item.metadata.slug,
        content_hash: item.metadata.content_hash,
      },
    }));

    console.log(`Upserting ${vectorizeItems.length} vectors to ${INDEX_NAME}...`);
    await upsertVectors(vectorizeItems);

    processed += chunk.length;
    console.log(`Progress: ${processed}/${rawManifest.length} ingested.`);
  }

  console.log(`\n✅ Ingestion complete! Total vectors in ${INDEX_NAME}: ${processed}`);
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
