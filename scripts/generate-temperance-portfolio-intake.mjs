#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { chmodSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const SCHEMA = 'temperance.portfolio-intake.v1';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const digest = (value) => createHash('sha256').update(canonical(value)).digest('hex');
const sorted = (items) => [...new Set(items)].sort();
const safeId = (value) => String(value ?? '').replace(/[^a-zA-Z0-9:._-]/g, '-');

function githubName(origin) {
  if (typeof origin !== 'string') return null;
  const match = origin.match(/^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i);
  return match ? match[1].toLowerCase() : null;
}

function workObjectCategory(ids) {
  const kinds = sorted(ids.map((id) => id.split(':')[0]));
  if (kinds.length !== 1) return kinds.length ? 'mixed-workobject' : 'unresolved';
  return { branch: 'client-branch', sapling: 'sapling', program: 'program' }[kinds[0]] ?? 'unresolved';
}

function mappingEvidence(queue, liveByName) {
  const evidence = new Map();
  const add = (name, workId, batch) => {
    const live = liveByName.get(name.toLowerCase());
    if (!live || !/^\w+:[\w.-]+$/.test(workId)) return;
    const found = evidence.get(live.id) ?? { workIds: new Set(), batches: new Set() };
    found.workIds.add(workId);
    found.batches.add(batch);
    evidence.set(live.id, found);
  };
  for (const batch of queue.batches ?? []) {
    for (const row of batch.rows ?? []) {
      if (row.repository && row.repositoryId) {
        const live = liveByName.get(row.repository.toLowerCase());
        if (live?.id === row.repositoryId && row.targetWorkId) add(row.repository, row.targetWorkId, batch.batchId);
      }
      for (const assignment of row.resolvedAssignments ?? []) {
        for (const ref of assignment.repositoryRefs ?? []) {
          const name = [...liveByName.keys()].filter((candidate) => ref.toLowerCase() === candidate || ref.toLowerCase().startsWith(`${candidate}/`)).sort((a, b) => b.length - a.length)[0];
          if (name) add(name, assignment.workId, batch.batchId);
        }
      }
    }
    for (const cluster of batch.clusters ?? []) {
      for (const assignment of cluster.resolvedAssignments ?? []) {
        for (const ref of assignment.repositoryRefs ?? []) {
          const name = [...liveByName.keys()].filter((candidate) => ref.toLowerCase() === candidate || ref.toLowerCase().startsWith(`${candidate}/`)).sort((a, b) => b.length - a.length)[0];
          if (name) add(name, assignment.workId, batch.batchId);
        }
      }
    }
  }
  return evidence;
}

function boardEvidence(boardItems) {
  const byName = new Map();
  for (const item of boardItems) {
    if (item.scanError) continue;
    const board = item.board;
    if (!board || typeof board.id !== 'string' || !/^https:\/\/github\.com\//.test(board.url ?? '')) continue;
    for (const name of item.repositories ?? []) {
      const key = String(name).replace(/^https:\/\/github\.com\//, '').toLowerCase();
      if (!/^[\w.-]+\/[\w.-]+$/.test(key)) continue;
      const boards = byName.get(key) ?? new Map();
      boards.set(board.id, { id: board.id, title: board.title, url: board.url });
      byName.set(key, boards);
    }
  }
  return byName;
}

function localState(localRepos, worktrees, repoName) {
  const matches = localRepos.filter((item) => githubName(item.origin) === repoName);
  if (!matches.length) return { review: { state: 'remote-only', reason: 'no-matching-local-origin' }, freshness: 'fresh' };
  const commonDirs = new Set(matches.map((item) => item.common_dir));
  const trees = worktrees.filter((item) => commonDirs.has(item.common_dir));
  if (trees.some((tree) => tree.status === 'scan-error')) return { review: { state: 'scan-error', reason: 'local-status-incomplete' }, freshness: 'unavailable' };
  if (trees.some((tree) => tree.status === 'dirty' || (tree.changes ?? []).length > 0)) return { review: { state: 'changes-held', reason: 'uncommitted-changes-require-review' }, freshness: 'fresh' };
  if (trees.some((tree) => tree.status === 'missing')) return { review: { state: 'missing-worktree', reason: 'registered-path-missing' }, freshness: 'unavailable' };
  if (!trees.length) return { review: { state: 'unscanned', reason: 'no-worktree-status' }, freshness: 'unavailable' };
  return { review: { state: 'clean', reason: 'local-status-observed' }, freshness: 'fresh' };
}

function rootEntries(rootMap, observedAt, holds) {
  const result = [];
  for (const portfolio of rootMap.portfolios ?? []) {
    const portfolioId = safeId(portfolio.portfolioId);
    for (const folder of portfolio.folders ?? []) {
      const ids = sorted((folder.workIds ?? []).filter((id) => /^\w+:[\w.-]+$/.test(id)));
      const hold = holds.get(`${portfolioId}/${folder.folder}`);
      result.push({
        id: `root:${portfolioId}:${safeId(folder.folder)}`,
        category: folder.status?.includes('hold') ? 'unresolved' : (folder.proposedKind ?? 'unresolved'),
        workObjects: ids,
        repository: null,
        boards: [],
        pullRequests: [],
        review: hold ? { state: 'ownership-held', reason: hold.reason } : { state: 'mapping-proposal', reason: 'root-map-proposal-needs-git-match' },
        admission: { state: 'hold', reason: hold?.reason ?? 'repository-identity-not-verified' },
        freshness: { observedAt, status: 'unavailable' },
      });
    }
    for (const folder of portfolio.archivedProjects ?? []) {
      result.push({ id: `archive:${portfolioId}:${safeId(folder)}`, category: 'archive', workObjects: [], repository: null, boards: [], pullRequests: [], review: { state: 'archived', reason: 'root-map-archive' }, admission: { state: 'hold', reason: 'archive-not-enrollable' }, freshness: { observedAt, status: 'unavailable' } });
    }
    for (const folder of portfolio.infrastructure ?? []) {
      result.push({ id: `infrastructure:${portfolioId}:${safeId(folder)}`, category: 'infrastructure', workObjects: [], repository: null, boards: [], pullRequests: [], review: { state: 'mapped-context', reason: 'root-map-infrastructure' }, admission: { state: 'hold', reason: 'repository-identity-not-verified' }, freshness: { observedAt, status: 'unavailable' } });
    }
  }
  return result;
}

function repoProjection(repo) {
  if (!repo) return null;
  const [owner, name] = repo.nameWithOwner.split('/');
  return { id: repo.id, owner, name, url: repo.url };
}

function worktreeReview(tree) {
  if (tree.status === 'scan-error') return { state: 'scan-error', reason: 'local-status-incomplete' };
  if (tree.status === 'missing') return { state: 'missing-worktree', reason: 'registered-path-missing' };
  if (tree.status === 'dirty' || (tree.changes ?? []).length) return { state: 'changes-held', reason: 'uncommitted-changes-require-review' };
  return { state: 'clean', reason: 'local-status-observed' };
}

function manualAssociationEvidence({ manualAssociations, audit, rootMap, liveById, holdByFolder }) {
  const byCommonDir = new Map();
  const usedRepositoryIds = new Set();
  for (const association of manualAssociations.associations) {
    const local = audit.repositories.filter((item) => item.common_dir === association.git_common_dir);
    const repo = liveById.get(association.repositoryId);
    const root = rootMap.portfolios.find((portfolio) => portfolio.portfolioId === association.portfolioId)?.folders?.find((folder) => folder.folder === association.folder);
    const receipt = association.sourceReceipt;
    const owner = association.ownerDecision;
    const pr = receipt?.pull_request;
    const matchingPr = (audit.open_prs ?? []).filter((item) => item.url === pr && item.repository?.nameWithOwner?.toLowerCase() === repo?.nameWithOwner?.toLowerCase());
    if (
      typeof association.git_common_dir !== 'string' || byCommonDir.has(association.git_common_dir) ||
      usedRepositoryIds.has(association.repositoryId) || local.length !== 1 || local[0].origin || !repo || !root ||
      holdByFolder.has(`${association.portfolioId}/${association.folder}`) ||
      !Array.isArray(association.workObjects) || !association.workObjects.length ||
      association.workObjects.some((id) => !root.workIds?.includes(id)) ||
      association.nameWithOwner?.toLowerCase() !== repo.nameWithOwner.toLowerCase() ||
      !Number.isInteger(association.repositoryDatabaseId) || association.repositoryDatabaseId <= 0 ||
      repo.databaseId !== association.repositoryDatabaseId || repo.isPrivate !== true ||
      receipt?.schema !== 'temperance.local-source-intake-receipt.v1' ||
      receipt.destination_repository?.id !== association.repositoryDatabaseId ||
      receipt.destination_repository?.nameWithOwner?.toLowerCase() !== repo.nameWithOwner.toLowerCase() ||
      receipt.destination_repository?.private !== true ||
      receipt.source_remote_at_capture != null || receipt.original_tree_preserved !== true ||
      !local[0].known_paths?.includes(receipt.source_local_path) ||
      !local[0].local_branches?.some((branch) => branch.head === receipt.source_git_head) ||
      owner?.status !== 'confirmed-first-party' ||
      typeof receipt.user_ownership_decision !== 'string' || !receipt.user_ownership_decision.trim() ||
      owner.statementDigest !== digest(receipt.user_ownership_decision) ||
      typeof pr !== 'string' || !pr.startsWith(`${repo.url}/pull/`) ||
      !/^[1-9][0-9]*$/.test(pr.slice(`${repo.url}/pull/`.length)) ||
      matchingPr.length !== 1 || !/^[a-f0-9]{40}$/.test(receipt.pr_head ?? '') ||
      matchingPr[0].head_sha !== receipt.pr_head
    ) throw new Error('invalid, ambiguous, or mismatched manual association');
    byCommonDir.set(association.git_common_dir, { association, repo, root, receipt });
    usedRepositoryIds.add(association.repositoryId);
  }
  return byCommonDir;
}

export function buildPortfolioIntake({ rootMap, mappingQueue, audit, boardItems = [], enrollments = { schema: 'temperance.project-enrollments.v1', enrollments: [] }, admissionEvidence = { schema: 'temperance.enrollment-audit.v1', rows: [] }, holds = { schema: 'temperance.portfolio-holds.v1', holds: [] }, manualAssociations = { schema: 'temperance.portfolio-manual-associations.v1', associations: [] }, asOf }) {
  if (rootMap?.schema !== 'thoughtseed.portfolio-root-map.v1' || !Array.isArray(rootMap.portfolios)) throw new Error('invalid root map');
  if (!Array.isArray(mappingQueue?.batches)) throw new Error('invalid mapping queue');
  if (audit?.schema !== 'temperance.portfolio-audit.v1' || !Array.isArray(audit.repositories) || !Array.isArray(audit.worktrees)) throw new Error('invalid private audit');
  if (enrollments?.schema !== 'temperance.project-enrollments.v1' || !Array.isArray(enrollments.enrollments)) throw new Error('invalid enrollment baseline');
  if (admissionEvidence?.schema !== 'temperance.enrollment-audit.v1' || !Array.isArray(admissionEvidence.rows)) throw new Error('invalid admission evidence');
  if (holds?.schema !== 'temperance.portfolio-holds.v1' || !Array.isArray(holds.holds)) throw new Error('invalid hold policy');
  if (manualAssociations?.schema !== 'temperance.portfolio-manual-associations.v1' || !Array.isArray(manualAssociations.associations)) throw new Error('invalid manual associations');
  const generatedAt = audit.generated_at;
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('invalid audit timestamp');
  const effectiveAsOf = asOf ?? generatedAt;
  if (!Number.isFinite(Date.parse(effectiveAsOf))) throw new Error('invalid as-of timestamp');
  const isStale = Date.parse(effectiveAsOf) - Date.parse(generatedAt) > 7 * 24 * 60 * 60 * 1000;
  const manualObservedAt = audit.delta_provenance?.observed_at ?? generatedAt;
  const manualObservationStale = Date.parse(effectiveAsOf) - Date.parse(manualObservedAt) > 7 * 24 * 60 * 60 * 1000;
  const holdByFolder = new Map();
  for (const hold of holds.holds) {
    const key = `${hold.portfolioId}/${hold.folder}`;
    const folder = rootMap.portfolios.find((portfolio) => portfolio.portfolioId === hold.portfolioId)?.folders?.find((item) => item.folder === hold.folder);
    if (!folder || holdByFolder.has(key) || !['source-ownership-overlap-review'].includes(hold.reason) || !Array.isArray(hold.workObjects) || hold.workObjects.some((id) => !folder.workIds?.includes(id))) throw new Error('invalid or duplicate reviewed hold');
    holdByFolder.set(key, hold);
  }
  const holdForLocal = (local) => {
    const path = local?.known_paths?.[0];
    if (typeof path !== 'string') return null;
    const folderName = path.split('/').filter(Boolean).at(-1);
    const matches = [...holdByFolder.values()].filter((hold) => hold.folder === folderName);
    return matches.length === 1 ? matches[0] : null;
  };
  const live = Object.values(audit.github_repositories ?? {}).flat();
  const liveByName = new Map();
  const liveById = new Map();
  for (const repo of live) {
    if (!repo.id || !/^[\w.-]+\/[\w.-]+$/.test(repo.nameWithOwner ?? '') || !/^https:\/\/github\.com\//.test(repo.url ?? '')) throw new Error('invalid GitHub repository evidence');
    const key = repo.nameWithOwner.toLowerCase();
    if (liveByName.has(key) && liveByName.get(key).id !== repo.id) throw new Error('conflicting repository identity');
    liveByName.set(key, repo);
    liveById.set(repo.id, repo);
  }
  const mappings = mappingEvidence(mappingQueue, liveByName);
  const associationsByCommonDir = manualAssociationEvidence({ manualAssociations, audit, rootMap, liveById, holdByFolder });
  const associationByRepositoryId = new Map([...associationsByCommonDir.values()].map((item) => [item.repo.id, item]));
  const boardsByName = boardEvidence(boardItems);
  const entries = rootEntries(rootMap, generatedAt, holdByFolder);
  for (const repo of liveById.values()) {
    const name = repo.nameWithOwner.toLowerCase();
    const association = associationByRepositoryId.get(repo.id);
    const workObjects = sorted([...(mappings.get(repo.id)?.workIds ?? []), ...(association?.association.workObjects ?? [])]);
    const local = association ? localState([{ ...audit.repositories.find((item) => item.common_dir === association.association.git_common_dir), origin: repo.url }], audit.worktrees, name) : localState(audit.repositories, audit.worktrees, name);
    const category = workObjects.length ? workObjectCategory(workObjects) : repo.isFork ? 'third-party' : repo.isArchived ? 'archive' : 'unresolved';
    const review = workObjects.length ? local.review : { state: 'mapping-held', reason: repo.isFork ? 'fork-reference-only' : 'workobject-unresolved' };
    entries.push({
      id: `github:${repo.id}`, category, workObjects,
      repository: repoProjection(repo),
      boards: [...(boardsByName.get(name)?.values() ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
      pullRequests: (audit.open_prs ?? []).filter((pr) => String(pr.repository?.nameWithOwner ?? pr.repository).toLowerCase() === name && Number.isInteger(pr.number) && /^https:\/\/github\.com\//.test(pr.url ?? '')).map((pr) => ({ number: pr.number, url: pr.url })).sort((a, b) => a.number - b.number).slice(0, 50),
      review,
      admission: { state: 'hold', reason: association ? 'source-pr-review-required' : local.review.state === 'remote-only' ? 'no-verified-local-identity' : 'manual-enrollment-required' },
      freshness: { observedAt: association ? manualObservedAt : generatedAt, status: local.freshness === 'fresh' && isStale ? 'stale' : local.freshness },
    });
  }
  for (const { association, repo } of associationsByCommonDir.values()) {
    const rootEntry = entries.find((entry) => entry.id === `root:${safeId(association.portfolioId)}:${safeId(association.folder)}`);
    const repositoryEntry = entries.find((entry) => entry.id === `github:${repo.id}`);
    rootEntry.repository = repoProjection(repo);
    rootEntry.boards = repositoryEntry.boards;
    rootEntry.pullRequests = repositoryEntry.pullRequests;
    rootEntry.review = { state: 'manual-association-reviewed', reason: 'owner-confirmed-source-pr-open' };
    rootEntry.admission = { state: 'hold', reason: 'source-pr-review-required' };
    rootEntry.freshness = { observedAt: manualObservedAt, status: manualObservationStale ? 'stale' : 'fresh' };
  }
  for (const local of audit.repositories) {
    const name = githubName(local.origin);
    if ((name && liveByName.has(name)) || associationsByCommonDir.has(local.common_dir)) continue;
    const hold = holdForLocal(local);
    const commonDirs = new Set([local.common_dir]);
    const trees = audit.worktrees.filter((item) => commonDirs.has(item.common_dir));
    const status = trees.some((tree) => tree.status === 'scan-error') ? 'unavailable' : isStale ? 'stale' : 'unavailable';
    entries.push({ id: `local-unmatched:${digest(local.common_dir).slice(0, 20)}`, category: hold?.category ?? 'unresolved', workObjects: hold?.workObjects ?? [], repository: null, boards: [], pullRequests: [], review: { state: 'identity-held', reason: hold?.reason ?? (name ? 'origin-not-in-authenticated-inventory' : 'origin-unavailable') }, admission: { state: 'hold', reason: hold?.reason ?? 'repository-identity-not-verified' }, freshness: { observedAt: generatedAt, status } });
  }
  const localByCommonDir = new Map(audit.repositories.map((local) => [local.common_dir, local]));
  const repositoryEntryById = new Map(entries.filter((entry) => entry.id.startsWith('github:')).map((entry) => [entry.repository.id, entry]));
  const admissionByEnrollment = new Map();
  for (const record of admissionEvidence.rows) {
    if (typeof record.observed_enrollment_id !== 'string' || admissionByEnrollment.has(record.observed_enrollment_id) || !['admitted', 'held'].includes(record.status) || !/^[a-z_]+$/.test(record.reason_code ?? '')) throw new Error('invalid admission evidence record');
    admissionByEnrollment.set(record.observed_enrollment_id, record);
  }
  for (const tree of audit.worktrees) {
    const local = localByCommonDir.get(tree.common_dir);
    const hold = holdForLocal(local);
    const association = associationsByCommonDir.get(tree.common_dir);
    const repo = association?.repo ?? liveByName.get(githubName(local?.origin));
    const repositoryEntry = repositoryEntryById.get(repo?.id);
    const workObjects = sorted([...(mappings.get(repo?.id)?.workIds ?? []), ...(hold?.workObjects ?? []), ...(association?.association.workObjects ?? [])]);
    const review = worktreeReview(tree);
    entries.push({
      id: `worktree:${digest(tree.path).slice(0, 20)}`,
      category: hold?.category ?? (repo ? (workObjects.length ? workObjectCategory(workObjects) : repo.isFork ? 'third-party' : 'unresolved') : 'unresolved'),
      workObjects,
      repository: repoProjection(repo),
      boards: repositoryEntry?.boards ?? [], pullRequests: repositoryEntry?.pullRequests ?? [], review,
      admission: { state: 'hold', reason: association ? 'source-pr-review-required' : hold?.reason ?? 'manual-enrollment-required' },
      freshness: { observedAt: generatedAt, status: review.state === 'scan-error' || review.state === 'missing-worktree' ? 'unavailable' : isStale ? 'stale' : 'fresh' },
    });
  }
  const itemsByUrl = new Map(boardItems.map((item) => [item.board?.url, item]));
  for (const project of audit.github_projects ?? []) {
    const item = itemsByUrl.get(project.url);
    const board = item?.board;
    if (!board) continue;
    entries.push({
      id: `board:${board.id}`, category: 'github-project-board', workObjects: [], repository: null,
      boards: [{ id: board.id, title: board.title, url: board.url }], pullRequests: [],
      review: { state: item.scanError ? 'scan-error' : 'mapped-context', reason: item.scanError ? 'board-items-unavailable' : 'authenticated-board-observed' },
      admission: { state: 'hold', reason: 'board-linkage-is-not-enrollment' },
      freshness: { observedAt: generatedAt, status: item.scanError ? 'unavailable' : isStale ? 'stale' : 'fresh' },
    });
  }
  for (const enrollment of enrollments.enrollments) {
    if (typeof enrollment.enrollment_id !== 'string' || typeof enrollment.git_common_dir !== 'string') throw new Error('invalid enrollment record');
    const local = localByCommonDir.get(enrollment.git_common_dir);
    const repo = liveByName.get(githubName(local?.origin));
    const repoIdMatches = repo && enrollment.repository_id?.toLowerCase() === `github:${repo.nameWithOwner}`.toLowerCase();
    const localIdMatches = local && /^local:sha256:[a-f0-9]{64}$/.test(enrollment.repository_id ?? '');
    const identityMatches = repoIdMatches || localIdMatches;
    const evidence = admissionByEnrollment.get(enrollment.enrollment_id);
    const verified = evidence?.status === 'admitted' && evidence.repository_id === enrollment.repository_id && evidence.workspace_id_matches === true && identityMatches && local;
    entries.push({
      id: `enrollment-baseline:${digest(enrollment.enrollment_id).slice(0, 20)}`,
      category: 'enrollment-baseline', workObjects: sorted([...(mappings.get(repo?.id)?.workIds ?? [])]),
      repository: repoIdMatches ? repoProjection(repo) : null,
      boards: [], pullRequests: [],
      review: { state: 'baseline-record-observed', reason: identityMatches ? 'host-record-matched' : 'baseline-repository-identity-unverified' },
      admission: verified ? { state: 'observed-enrolled', reason: 'verified-existing-host-enrollment' } : { state: 'hold', reason: evidence?.status === 'held' ? evidence.reason_code : evidence ? 'baseline-audit-mismatch' : 'baseline-audit-unavailable' },
      freshness: { observedAt: generatedAt, status: verified && !isStale ? 'fresh' : 'unavailable' },
    });
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error('duplicate intake entry');
  return { schema: SCHEMA, generatedAt, sourceDigest: digest({ rootMap, mappingQueue, audit, boardItems, enrollments, admissionEvidence, holds, manualAssociations, asOf: effectiveAsOf, entries }), entries };
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const auditPath = arg('--audit');
  const outputPath = arg('--out');
  if (!auditPath || !outputPath) throw new Error('usage: node scripts/generate-temperance-portfolio-intake.mjs --audit PRIVATE_AUDIT_JSON --out PRIVATE_SNAPSHOT_JSON [--board-items PRIVATE_BOARD_ITEMS_JSON] [--holds PRIVATE_HOLDS_JSON] [--enrollments PRIVATE_ENROLLMENTS_JSON] [--manual-associations PRIVATE_ASSOCIATIONS_JSON]');
  const destination = resolve(outputPath);
  const repositoryRoot = realpathSync(fileURLToPath(ROOT));
  const canonicalDestination = resolve(realpathSync(dirname(destination)), basename(destination));
  if (canonicalDestination === repositoryRoot || canonicalDestination.startsWith(`${repositoryRoot}${sep}`)) throw new Error('private intake output must be outside the repository');
  try {
    if (lstatSync(destination).isSymbolicLink()) throw new Error('private intake output cannot be a symbolic link');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
  const snapshot = buildPortfolioIntake({
    rootMap: readJson(new URL('docs/project-management/portfolio-roots.v1.json', ROOT)),
    mappingQueue: readJson(new URL('docs/project-management/github-repository-mapping-action-queue.v1.json', ROOT)),
    audit: readJson(auditPath),
    boardItems: arg('--board-items') ? readJson(arg('--board-items')) : [],
    enrollments: arg('--enrollments') ? readJson(arg('--enrollments')) : undefined,
    admissionEvidence: arg('--admission-evidence') ? readJson(arg('--admission-evidence')) : undefined,
    holds: arg('--holds') ? readJson(arg('--holds')) : undefined,
    manualAssociations: arg('--manual-associations') ? readJson(arg('--manual-associations')) : undefined,
    asOf: arg('--as-of') ?? undefined,
  });
  writeFileSync(destination, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  chmodSync(destination, 0o600);
  process.stdout.write(`${snapshot.entries.length} entries; sourceDigest ${snapshot.sourceDigest}\n`);
}
