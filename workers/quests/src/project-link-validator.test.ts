import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PORTFOLIO_CATALOG_DIGEST } from './portfolio-catalog.ts';
import { PORTFOLIO_ROOT_MAP_DIGEST } from './portfolio-root-map.generated.ts';
import {
  PROJECT_LINK_SCHEMA,
  ProjectLinkValidationError,
  validateProjectLink,
} from './project-link-validator.ts';

const VALID_LINK = {
  schema: PROJECT_LINK_SCHEMA,
  kind: 'client-branch',
  lifecycle: 'active',
  client: {
    id: 'klear-karma',
    name: 'Klear Karma',
    cloudflareAccountId: '2daf2852ced6e2a1b86b658a1a23e3a9',
    cloudflareProfile: 'klear-karma',
  },
  cambium: {
    workIds: ['branch:klear-karma'],
    portfolioCatalogDigest: PORTFOLIO_CATALOG_DIGEST,
    rootMapDigest: PORTFOLIO_ROOT_MAP_DIGEST,
    planningAuthority: ['60-client-ecosystem/klear-karma/project-links.md'],
  },
  execution: {
    supersetHands: [
      { display: 'klear · admin', branchPrefix: 'klear/', localPath: 'klear-karma/kkv2-admin-panel' },
    ],
    worktrees: [],
  },
  mapping: {
    workspace: 'fixtures/projects/thoughtseed/klear-karma',
    repos: [
      { name: 'Admin panel', github: 'https://github.com/Sheshiyer/kkv2-admin-panel' },
    ],
    liveSites: [],
    externalRefs: [],
  },
  proof: {
    sourceOfTruth: 'vault',
    syncStatus: 'mapped',
    verifiedAt: '2026-09-01',
    verifiedBy: 'ceo',
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
  },
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe('thoughtseed.project-link.v1 validator', () => {
  it('accepts a complete catalog-bound project link', () => {
    const result = validateProjectLink(VALID_LINK);
    assert.equal(result.schema, PROJECT_LINK_SCHEMA);
    assert.deepEqual(result.cambium.workIds, ['branch:klear-karma']);
  });

  it('requires exact schema and rejects unknown kinds including tool', () => {
    assert.throws(() => validateProjectLink({ ...VALID_LINK, schema: 'wrong' }), ProjectLinkValidationError);
    assert.throws(() => validateProjectLink({ ...VALID_LINK, kind: 'tool' }), ProjectLinkValidationError);
  });

  it('requires client only for client branches', () => {
    const missingClient = clone(VALID_LINK) as Record<string, unknown>;
    delete missingClient.client;
    assert.throws(() => validateProjectLink(missingClient), /requires client/);

    const fitcheck = clone(VALID_LINK);
    fitcheck.kind = 'sapling';
    fitcheck.cambium.workIds = ['sapling:fitcheck'];
    assert.throws(() => validateProjectLink(fitcheck), /only valid for client-branch/);
    delete (fitcheck as Partial<typeof fitcheck>).client;
    assert.equal(validateProjectLink(fitcheck).kind, 'sapling');
  });

  it('binds client IDs and authority digests to the catalog', () => {
    const badClient = clone(VALID_LINK);
    badClient.client.id = 'wrong-client';
    assert.throws(() => validateProjectLink(badClient), /catalog account/);

    const staleCatalog = clone(VALID_LINK);
    staleCatalog.cambium.portfolioCatalogDigest = `sha256:${'0'.repeat(64)}`;
    assert.throws(() => validateProjectLink(staleCatalog), /shipped portfolio catalog/);
  });

  it('rejects impossible calendar dates', () => {
    for (const field of ['createdAt', 'updatedAt', 'verifiedAt'] as const) {
      const bad = clone(VALID_LINK);
      bad.proof[field] = '2026-02-30';
      assert.throws(() => validateProjectLink(bad), /valid calendar date/, field);
    }
  });

  it('rejects Unix, Windows drive, and UNC absolute paths', () => {
    for (const absolute of ['/Volumes/private/repo', 'C:\\private\\repo', '\\\\server\\share']) {
      const workspace = clone(VALID_LINK);
      workspace.mapping.workspace = absolute;
      assert.throws(() => validateProjectLink(workspace), /absolute path/, absolute);

      const repo = clone(VALID_LINK);
      repo.mapping.repos[0].localPath = absolute;
      assert.throws(() => validateProjectLink(repo), /absolute path/, absolute);

      const hand = clone(VALID_LINK);
      hand.execution.supersetHands[0].localPath = absolute;
      assert.throws(() => validateProjectLink(hand), /absolute path/, absolute);
    }
  });

  it('enforces array minimums, maximums, and string uniqueness', () => {
    const noWorkIds = clone(VALID_LINK);
    noWorkIds.cambium.workIds = [];
    assert.throws(() => validateProjectLink(noWorkIds), ProjectLinkValidationError);

    const duplicateAuthority = clone(VALID_LINK);
    duplicateAuthority.cambium.planningAuthority = ['same', 'same'];
    assert.throws(() => validateProjectLink(duplicateAuthority), /unique/);

    const duplicateRepos = clone(VALID_LINK);
    duplicateRepos.mapping.repos = [clone(duplicateRepos.mapping.repos[0]), clone(duplicateRepos.mapping.repos[0])];
    assert.throws(() => validateProjectLink(duplicateRepos), /mapping.repos must be unique/);

    const tooManyHands = clone(VALID_LINK);
    tooManyHands.execution.supersetHands = Array.from({ length: 65 }, (_, index) => ({
      display: `hand ${index}`,
      branchPrefix: `h${index}/`,
      localPath: `repo-${index}`,
    }));
    assert.throws(() => validateProjectLink(tooManyHands), /execution.supersetHands is invalid/);
  });

  it('requires valid GitHub and HTTPS URLs', () => {
    const badGitHub = clone(VALID_LINK);
    badGitHub.mapping.repos[0].github = 'https://gitlab.com/foo/bar';
    assert.throws(() => validateProjectLink(badGitHub), ProjectLinkValidationError);

    const badSite = clone(VALID_LINK);
    badSite.mapping.liveSites = [{ url: 'https://' }];
    assert.throws(() => validateProjectLink(badSite), ProjectLinkValidationError);
  });

  it('requires paired proof verification metadata', () => {
    const missingVerifier = clone(VALID_LINK);
    delete (missingVerifier.proof as Partial<typeof missingVerifier.proof>).verifiedBy;
    assert.throws(() => validateProjectLink(missingVerifier), /both be present/);
  });
});
