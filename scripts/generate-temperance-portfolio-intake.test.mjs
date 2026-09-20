import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { buildPortfolioIntake } from './generate-temperance-portfolio-intake.mjs';

const captured = '2026-09-20T23:29:10.000Z';
const asOf = '2026-09-21T00:00:00.000Z';
const repo = (id, name, extra = {}) => ({ id, nameWithOwner: `Sheshiyer/${name}`, url: `https://github.com/Sheshiyer/${name}`, isFork: false, isArchived: false, ...extra });
const defaults = () => ({
  rootMap: { schema: 'thoughtseed.portfolio-root-map.v1', portfolios: [{ portfolioId: 'thoughtseed', folders: [{ folder: 'alpha', proposedKind: 'client-branch', workIds: ['branch:alpha'], status: 'mapping-proposal' }], archivedProjects: ['old-alpha'], infrastructure: ['vault'] }] },
  mappingQueue: { batches: [{ batchId: 'reviewed', rows: [{ repository: 'Sheshiyer/alpha', repositoryId: 'R_alpha', targetWorkId: 'branch:alpha' }] }] },
  audit: { schema: 'temperance.portfolio-audit.v1', generated_at: captured, github_repositories: { Sheshiyer: [repo('R_alpha', 'alpha'), repo('R_remote', 'remote')], 'thoughtseed-labs': [] }, github_projects: [], open_prs: [], repositories: [], worktrees: [] },
  boardItems: [], asOf,
});

function reviewedAssociationInput() {
  const input = defaults();
  const sourceHead = 'a'.repeat(40);
  const prHead = 'b'.repeat(40);
  const statement = 'Owner confirms this source';
  const localPath = '/synthetic/local/alpha';
  input.audit.github_repositories.Sheshiyer[0] = repo('R_alpha', 'alpha', { databaseId: 42, isPrivate: true });
  input.audit.repositories = [{ common_dir: `${localPath}/.git`, known_paths: [localPath], origin: null, local_branches: [{ name: 'main', head: sourceHead }] }];
  input.audit.worktrees = [{ path: localPath, common_dir: `${localPath}/.git`, status: 'dirty', changes: [{ path: 'changed.txt' }] }];
  input.audit.open_prs = [{ repository: { nameWithOwner: 'Sheshiyer/alpha' }, number: 9, url: 'https://github.com/Sheshiyer/alpha/pull/9', head_sha: prHead }];
  input.manualAssociations = { schema: 'temperance.portfolio-manual-associations.v1', associations: [{
    git_common_dir: `${localPath}/.git`, portfolioId: 'thoughtseed', folder: 'alpha',
    repositoryId: 'R_alpha', repositoryDatabaseId: 42, nameWithOwner: 'Sheshiyer/alpha',
    workObjects: ['branch:alpha'],
    ownerDecision: { status: 'confirmed-first-party', statementDigest: createHash('sha256').update(JSON.stringify(statement)).digest('hex') },
    sourceReceipt: { schema: 'temperance.local-source-intake-receipt.v1', destination_repository: { id: 42, nameWithOwner: 'Sheshiyer/alpha', private: true }, source_local_path: localPath, source_remote_at_capture: null, source_git_head: sourceHead, original_tree_preserved: true, user_ownership_decision: statement, pull_request: 'https://github.com/Sheshiyer/alpha/pull/9', pr_head: prHead },
  }] };
  return input;
}

test('duplicate clones retain one repository identity and distinct worktree holds without private paths', () => {
  const input = defaults();
  input.audit.repositories = [
    { common_dir: '/synthetic/local/private-a/.git', origin: 'https://github.com/Sheshiyer/alpha.git' },
    { common_dir: '/synthetic/local/private-b/.git', origin: 'git@github.com:Sheshiyer/alpha.git' },
  ];
  input.audit.worktrees = [
    { path: '/synthetic/local/private-a', common_dir: '/synthetic/local/private-a/.git', status: 'dirty', changes: [{ path: 'secret.txt', content: { sha256: 'secret-content-digest' } }] },
    { path: '/synthetic/local/private-b', common_dir: '/synthetic/local/private-b/.git', status: 'missing', changes: [] },
  ];
  const result = buildPortfolioIntake(input);
  assert.equal(result.entries.filter((entry) => entry.id === 'github:R_alpha').length, 1);
  const worktrees = result.entries.filter((entry) => entry.id.startsWith('worktree:'));
  assert.equal(worktrees.length, 2);
  assert.equal(new Set(worktrees.map((entry) => entry.id)).size, 2);
  assert.deepEqual(worktrees.map((entry) => entry.review.state).sort(), ['changes-held', 'missing-worktree']);
  assert.equal(JSON.stringify(result).includes('/synthetic/local'), false);
  assert.equal(JSON.stringify(result).includes('secret.txt'), false);
  assert.equal(JSON.stringify(result).includes('secret-content-digest'), false);
});

test('remote-only repository stays explicit and unadmitted', () => {
  const result = buildPortfolioIntake(defaults());
  const remote = result.entries.find((entry) => entry.id === 'github:R_remote');
  assert.equal(remote.review.state, 'mapping-held');
  assert.equal(remote.category, 'unresolved');
  assert.equal(remote.admission.state, 'hold');
  assert.equal(remote.freshness.status, 'fresh');
});

test('boards link only through exact repository evidence and preserve multiple links', () => {
  const input = defaults();
  input.audit.github_projects = [
    { number: 1, title: 'Board 1', url: 'https://github.com/users/Sheshiyer/projects/1' },
    { number: 2, title: 'Board 2', url: 'https://github.com/users/Sheshiyer/projects/2' },
  ];
  input.boardItems = input.audit.github_projects.map((project, index) => ({ board: { id: `PVT_${index + 1}`, title: project.title, url: project.url }, repositories: ['Sheshiyer/alpha'] }));
  input.audit.repositories = [{ common_dir: '/synthetic/local/alpha/.git', known_paths: ['/synthetic/local/alpha'], origin: 'https://github.com/Sheshiyer/alpha.git' }];
  input.audit.worktrees = [{ path: '/synthetic/local/alpha', common_dir: '/synthetic/local/alpha/.git', status: 'clean', changes: [] }];
  input.audit.open_prs = [{ repository: { nameWithOwner: 'Sheshiyer/alpha' }, number: 9, url: 'https://github.com/Sheshiyer/alpha/pull/9' }];
  const result = buildPortfolioIntake(input);
  assert.deepEqual(result.entries.find((entry) => entry.id === 'github:R_alpha').boards.map((board) => board.id), ['PVT_1', 'PVT_2']);
  const worktree = result.entries.find((entry) => entry.id.startsWith('worktree:'));
  assert.deepEqual(worktree.boards.map((board) => board.id), ['PVT_1', 'PVT_2']);
  assert.deepEqual(worktree.pullRequests, [{ number: 9, url: 'https://github.com/Sheshiyer/alpha/pull/9' }]);
  assert.equal(result.entries.filter((entry) => entry.id.startsWith('board:')).length, 2);
  assert.deepEqual(result.entries.find((entry) => entry.id === 'github:R_remote').boards, []);
});

test('unmatched origin and scan error have identity holds', () => {
  const input = defaults();
  input.audit.repositories = [{ common_dir: '/synthetic/external/unmatched/.git', origin: 'https://github.com/elsewhere/unmatched.git' }];
  input.audit.worktrees = [{ path: '/synthetic/external/unmatched', common_dir: '/synthetic/external/unmatched/.git', status: 'scan-error', changes: [] }];
  const result = buildPortfolioIntake(input);
  const unmatched = result.entries.find((entry) => entry.id.startsWith('local-unmatched:'));
  assert.equal(unmatched.review.reason, 'origin-not-in-authenticated-inventory');
  assert.equal(unmatched.admission.state, 'hold');
  assert.equal(unmatched.freshness.status, 'unavailable');
  assert.equal(result.entries.find((entry) => entry.id.startsWith('worktree:')).review.state, 'scan-error');
  assert.equal(JSON.stringify(result).includes('/synthetic/external'), false);
});

test('stale evidence is marked stale and open PR links contain no titles', () => {
  const input = defaults();
  input.asOf = '2026-10-01T00:00:00.000Z';
  input.audit.open_prs = [{ repository: { nameWithOwner: 'Sheshiyer/alpha' }, number: 42, url: 'https://github.com/Sheshiyer/alpha/pull/42', title: 'private title' }];
  const result = buildPortfolioIntake(input);
  const alpha = result.entries.find((entry) => entry.id === 'github:R_alpha');
  assert.equal(alpha.freshness.status, 'stale');
  assert.deepEqual(alpha.pullRequests, [{ number: 42, url: 'https://github.com/Sheshiyer/alpha/pull/42' }]);
  assert.equal(JSON.stringify(result).includes('private title'), false);
});

test('observed host enrollment remains a hold and cannot expose binding paths', () => {
  const input = defaults();
  input.audit.repositories = [{ common_dir: '/synthetic/local/alpha/.git', known_paths: ['/synthetic/local/alpha'], origin: 'https://github.com/Sheshiyer/alpha.git' }];
  input.enrollments = { schema: 'temperance.project-enrollments.v1', enrollments: [{ enrollment_id: 'enr-private', git_common_dir: '/synthetic/local/alpha/.git', repository_id: 'github:Sheshiyer/alpha', superset: { workspace_id: 'private-workspace', branch: 'main' }, hands_enabled: true }] };
  const result = buildPortfolioIntake(input);
  const baseline = result.entries.find((entry) => entry.id.startsWith('enrollment-baseline:'));
  assert.equal(baseline.repository.id, 'R_alpha');
  assert.equal(baseline.admission.state, 'hold');
  assert.equal(baseline.admission.reason, 'baseline-audit-unavailable');
  assert.equal(JSON.stringify(result).includes('/synthetic/local'), false);
  assert.equal(JSON.stringify(result).includes('private-workspace'), false);
  assert.equal(JSON.stringify(result).includes('hands_enabled'), false);
});

test('authoritative resolver evidence changes admission state and intake digest', () => {
  const input = defaults();
  input.audit.repositories = [{ common_dir: '/synthetic/local/alpha/.git', known_paths: ['/synthetic/local/alpha'], origin: 'https://github.com/Sheshiyer/alpha.git' }];
  input.enrollments = { schema: 'temperance.project-enrollments.v1', enrollments: [{ enrollment_id: 'enr-alpha', git_common_dir: '/synthetic/local/alpha/.git', repository_id: 'github:Sheshiyer/alpha' }] };
  input.admissionEvidence = { schema: 'temperance.enrollment-audit.v1', rows: [{ observed_enrollment_id: 'enr-alpha', repository_id: 'github:Sheshiyer/alpha', status: 'held', reason_code: 'manifest_identity_mismatch', workspace_id_matches: true }] };
  const held = buildPortfolioIntake(input);
  assert.equal(held.entries.find((entry) => entry.id.startsWith('enrollment-baseline:')).admission.reason, 'manifest_identity_mismatch');
  input.admissionEvidence.rows[0] = { ...input.admissionEvidence.rows[0], status: 'admitted', reason_code: 'verified_worktree' };
  const admitted = buildPortfolioIntake(input);
  assert.equal(admitted.entries.find((entry) => entry.id.startsWith('enrollment-baseline:')).admission.state, 'observed-enrolled');
  assert.notEqual(held.sourceDigest, admitted.sourceDigest);
});

test('reviewed source hold survives local matching without publishing its source path', () => {
  const input = defaults();
  input.audit.repositories = [{ common_dir: '/synthetic/local/alpha/.git', known_paths: ['/synthetic/local/alpha'], origin: null }];
  input.holds = { schema: 'temperance.portfolio-holds.v1', holds: [{ portfolioId: 'thoughtseed', folder: 'alpha', category: 'sapling', workObjects: ['branch:alpha'], reason: 'source-ownership-overlap-review' }] };
  const snapshot = buildPortfolioIntake(input);
  const unmatched = snapshot.entries.find((entry) => entry.id.startsWith('local-unmatched:'));
  assert.equal(unmatched.admission.reason, 'source-ownership-overlap-review');
  assert.equal(unmatched.category, 'sapling');
  assert.equal(snapshot.schema, 'temperance.portfolio-intake.v1');
  assert.match(snapshot.sourceDigest, /^[0-9a-f]{64}$/);
  assert.equal(new Set(snapshot.entries.map((entry) => entry.id)).size, snapshot.entries.length);
  assert.equal(snapshot.entries.every((entry) => entry.admission.state === 'hold'), true);
  assert.doesNotMatch(JSON.stringify(snapshot), /\/Users\/|\/Volumes\/|gho_|github_pat_|BEGIN [A-Z ]*PRIVATE KEY/);
});

test('reviewed no-origin association links exact private repository and source PR while holding admission', () => {
  const input = reviewedAssociationInput();
  const result = buildPortfolioIntake(input);
  const github = result.entries.find((entry) => entry.id === 'github:R_alpha');
  const root = result.entries.find((entry) => entry.id === 'root:thoughtseed:alpha');
  const worktree = result.entries.find((entry) => entry.id.startsWith('worktree:'));
  assert.equal(github.category, 'client-branch');
  assert.equal(github.review.state, 'changes-held');
  assert.equal(github.admission.reason, 'source-pr-review-required');
  assert.deepEqual(github.pullRequests, [{ number: 9, url: 'https://github.com/Sheshiyer/alpha/pull/9' }]);
  assert.equal(root.repository.id, 'R_alpha');
  assert.equal(worktree.repository.id, 'R_alpha');
  assert.equal(worktree.admission.state, 'hold');
  assert.equal(result.entries.some((entry) => entry.id.startsWith('local-unmatched:')), false);
  assert.equal(JSON.stringify(result).includes('/synthetic/local/alpha'), false);
  input.manualAssociations.associations[0].sourceReceipt.included_files = [{ sha256: 'c'.repeat(64) }];
  assert.notEqual(buildPortfolioIntake(input).sourceDigest, result.sourceDigest);
});

test('manual association rejects duplicate, origin, immutable ID, source PR, and owner evidence mismatches', () => {
  const cases = [
    (input) => input.manualAssociations.associations.push(structuredClone(input.manualAssociations.associations[0])),
    (input) => { input.audit.repositories[0].origin = 'https://github.com/Sheshiyer/alpha.git'; },
    (input) => { input.manualAssociations.associations[0].repositoryId = 'R_other'; },
    (input) => { input.manualAssociations.associations[0].repositoryDatabaseId = 43; },
    (input) => { input.audit.open_prs[0].head_sha = 'c'.repeat(40); },
    (input) => { input.manualAssociations.associations[0].ownerDecision.statementDigest = '0'.repeat(64); },
    (input) => { input.manualAssociations.associations[0].sourceReceipt.pull_request = 'https://github.com/Sheshiyer/remote/pull/9'; },
  ];
  for (const mutate of cases) {
    const input = reviewedAssociationInput();
    mutate(input);
    assert.throws(() => buildPortfolioIntake(input), /invalid, ambiguous, or mismatched manual association/);
  }
});

test('CLI refuses to write the full private inventory inside its public repository', () => {
  const command = spawnSync(process.execPath, [new URL('./generate-temperance-portfolio-intake.mjs', import.meta.url).pathname, '--audit', '/missing-private-audit.json', '--out', new URL('../docs/project-management/intake.json', import.meta.url).pathname], { encoding: 'utf8' });
  assert.notEqual(command.status, 0);
  assert.match(command.stderr, /output must be outside the repository/);
});
