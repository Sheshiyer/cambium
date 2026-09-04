import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const TASTE_DIR = join(homedir(), '.hermes/skills/design-agent/references/taste');
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '9d7cec1b5a32b2df8c6cdc1321ccd00b';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const BUCKET = 'thoughtseed-context-projections';

if (!CF_API_TOKEN) {
  console.error('CLOUDFLARE_API_TOKEN required');
  process.exit(1);
}

async function uploadFile(category, filename) {
  const filePath = join(TASTE_DIR, category, filename);
  const content = readFileSync(filePath, 'utf8');
  const key = `taste/${category}/${filename}`;
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${BUCKET}/objects/${key}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'text/markdown; charset=utf-8',
    },
    body: content,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`R2 upload failed for ${key} (${res.status}): ${errText}`);
  }
}

async function main() {
  const allTasks = [];
  for (const cat of ['prompts', 'techniques', 'media-refs']) {
    const dir = join(TASTE_DIR, cat);
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    for (const f of files) {
      allTasks.push({ cat, f });
    }
  }

  console.log(`Starting concurrency upload of ${allTasks.length} blobs...`);
  const CONCURRENCY = 10;
  let completed = 0;

  for (let i = 0; i < allTasks.length; i += CONCURRENCY) {
    const batch = allTasks.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((t) => uploadFile(t.cat, t.f)));
    completed += batch.length;
    if (completed % 20 === 0 || completed === allTasks.length) {
      console.log(`Uploaded ${completed}/${allTasks.length} blobs...`);
    }
  }

  console.log(`✅ Synced all ${allTasks.length} blobs to r2://${BUCKET}/taste/`);
}

main().catch((err) => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
