import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const kinds = { products: 'product', drafts: 'draft', repositories: 'repository',
  hosts: 'host', boards: 'board', ideas: 'idea', editorial: 'editorial', workItems: 'workItem' };
const hash = value => createHash('sha256').update(value).digest('hex');

function repository(value, provenance = false) {
  if (typeof value !== 'string') return null;
  const pattern = provenance
    ? /^repo:([\w.-]+\/[\w.-]+)(?:\/[^?#\s]*)?$/
    : /^(?:https:\/\/github\.com\/)?([\w.-]+\/[\w.-]+)\/?$/;
  const match = pattern.exec(value);
  if (!match) return null;
  const name = match[1].replace(/\.git$/, '').toLowerCase();
  return name.split('/').every(part => part !== '.' && part !== '..') ? name : null;
}

/** Source associations only. Does not issue mapping receipts or operational joins. */
export function censusFieldReport(snapshot, catalogRecords) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
    || typeof snapshot.observedAt !== 'string'
    || !Array.isArray(snapshot.products) || !Array.isArray(snapshot.drafts)) {
    throw Error('Invalid source snapshot');
  }
  const repoIndex = new Map(), workIds = new Set();
  for (const { workId, provenance } of catalogRecords) {
    if (typeof workId !== 'string' || !Array.isArray(provenance) || workIds.has(workId)) {
      throw Error('Invalid catalog identity');
    }
    workIds.add(workId);
    for (const ref of provenance) {
      const name = repository(ref, true);
      if (!name) continue;
      if (!repoIndex.has(name)) repoIndex.set(name, new Set());
      repoIndex.get(name).add(workId);
    }
  }
  const summary = { total: 0, missingId: 0, fallbackDisagreements: 0,
    duplicateSnapshotKeys: 0, duplicateOperationKeys: 0,
    exactCanonicalRecordIds: 0, candidateRows: 0, ambiguousRows: 0, unresolvedRows: 0 };
  const groups = {}, candidates = [], snapshotKeys = new Set(), operationKeys = new Set();
  for (const [group, kind] of Object.entries(kinds)) {
    const rows = snapshot[group] ?? [];
    if (!Array.isArray(rows)) throw Error('Invalid source collection');
    groups[group] = rows.length;
    for (const [i, row] of rows.entries()) {
      if (!row || typeof row !== 'object' || Array.isArray(row)
        || (row.id !== undefined && (typeof row.id !== 'string' || !row.id))) {
        throw Error('Invalid source record');
      }
      summary.total++;
      if (!row.id) summary.missingId++;
      const snapshotKey = `${kind}:${row.id || `${kind}-${i}`}`;
      const operationKey = `${kind}:${row.id || row.full_name || row.name}`;
      if (snapshotKey !== operationKey) summary.fallbackDisagreements++;
      if (snapshotKeys.has(snapshotKey)) summary.duplicateSnapshotKeys++;
      if (operationKeys.has(operationKey)) summary.duplicateOperationKeys++;
      snapshotKeys.add(snapshotKey); operationKeys.add(operationKey);
      if (workIds.has(row.id)) summary.exactCanonicalRecordIds++;
      const refs = [row.repository, ...(kind === 'repository' ? [row.full_name, row.id] : [])];
      const matches = new Set(), evidence = new Set();
      for (const ref of refs) {
        const name = repository(ref);
        for (const workId of repoIndex.get(name) ?? []) { matches.add(workId); evidence.add(name); }
      }
      if (matches.size) {
        summary.candidateRows++;
        if (matches.size > 1) summary.ambiguousRows++;
        // Explicit stable IDs only. Missing-ID records remain findings, not migration mappings.
        if (row.id && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,299}$/.test(row.id)) {
          candidates.push({ sourceRecordId: `${kind}:${row.id}`,
            repositoryEvidence: [...evidence].sort(), candidateWorkIds: [...matches].sort(),
            status: matches.size > 1 ? 'multiple-project-candidates' : 'source-association-candidate' });
        }
      } else summary.unresolvedRows++;
    }
  }
  candidates.sort((a, b) => a.sourceRecordId.localeCompare(b.sourceRecordId, 'en'));
  const identityHolds = summary.missingId > 0 || summary.fallbackDisagreements > 0
    || summary.duplicateSnapshotKeys > 0 || summary.duplicateOperationKeys > 0;
  return { schema: 'cambium.field-report-project-census.v1', authority: 'source-association-candidates-only',
    operationalAdmission: 'none', identityReviewRequired: identityHolds,
    groups, summary, candidates };
}

async function main(args) {
  if (args.length !== 2 || args[0] !== '--snapshot') throw Error('Use --snapshot FILE');
  const file = resolve(args[1]);
  const info = await stat(file);
  if (!info.isFile() || info.size > 32 * 1024 * 1024) throw Error('Snapshot exceeds input limit');
  const bytes = await readFile(file);
  if (bytes.length > 32 * 1024 * 1024) throw Error('Snapshot exceeds input limit');
  const { RAW_SAPLINGS, RAW_PROGRAMS } = await import('../workers/quests/src/portfolio-catalog-data.ts');
  const catalog = [...RAW_SAPLINGS.map(row => ({ workId: row[0], provenance: row[5] })),
    ...RAW_PROGRAMS.map(row => ({ workId: row[0], provenance: row[6] }))];
  const report = censusFieldReport(JSON.parse(bytes), catalog);
  console.log(JSON.stringify({ ...report, sourceSnapshotSha256: hash(bytes),
    catalogInputSha256: hash(JSON.stringify(catalog)), catalogInput: 'working-action-catalog',
    catalogRecordCount: catalog.length }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(() => {
    // Never echo source bodies, file paths or parser input in diagnostics.
    console.error('Field Report census failed: check arguments, snapshot shape, size and catalog identities.');
    process.exitCode = 1;
  });
}
