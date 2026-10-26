import { FITCHECK_GOLDEN_PATH } from './fitcheck-golden-path.ts';
import { IVERIF_GOLDEN_PATH } from './iverif-golden-path.ts';
import type { OperationalPacketProjection, OperationalRepositoryComponent } from './operational-packet-projection.ts';

export const OPERATIONAL_PACKET_PROJECTIONS: readonly OperationalPacketProjection[] = Object.freeze([
  FITCHECK_GOLDEN_PATH,
  IVERIF_GOLDEN_PATH,
]);

const projectionsByWorkId = new Map(
  OPERATIONAL_PACKET_PROJECTIONS.map((projection) => [projection.identity.workId, projection] as const),
);

if (projectionsByWorkId.size !== OPERATIONAL_PACKET_PROJECTIONS.length) {
  throw new Error('operational packet registry contains duplicate WorkObject IDs');
}

export function operationalPacketProjectionFor(workId: string): OperationalPacketProjection | null {
  return projectionsByWorkId.get(workId) ?? null;
}

// Reviewed local knowledge projection (2026-10-25), not runtime admission.
// Source: existing Labs client briefs/project-links; Co.Property README and
// ParkArea context. Tirak's four source-supported roles await final sign-off.
// projectAssociation is document navigation, never a new registered project ID.
type MembershipRow = readonly [string, string, readonly OperationalRepositoryComponent['roles'][number][], NonNullable<OperationalRepositoryComponent['lifecycle']>, string];
const reviewedRows: Readonly<Record<string, readonly MembershipRow[]>> = {
  "branch:tirak": [
    ["Sheshiyer/tirak-website-v1", "R_kgDOQDvyvQ", ["frontend"], "current", "core"],
    ["Sheshiyer/tirak-mobile-app-v2", "R_kgDOSkuDKw", ["experience"], "current", "core"],
    ["pineappleinnovationlabs/tirak-admin-command-center", "R_kgDOO4p3uw", ["frontend"], "current", "core"],
    ["Sheshiyer/tirak-backend-alpha01", "R_kgDOO5Ekzg", ["backend"], "unreviewed", "core"],
    ["Sheshiyer/tirakplus", "R_kgDOSXh9KQ", ["experience"], "unreviewed", "plus"],
    ["Sheshiyer/tirakplus0admin", "R_kgDOSXh9OQ", ["frontend"], "unreviewed", "plus"],
    ["Sheshiyer/wikiv2-tirakapp", "R_kgDOQ-nokA", ["docs"], "unreviewed", "shared"],
    ["pineappleinnovationlabs/tirak-website-v1", "R_kgDOQDuQIw", ["frontend"], "historical", "core"],
    ["pineappleinnovationlabs/rork-tirak--companion-marketplace-in-thailand", "R_kgDOO4v-mw", ["experience"], "historical", "core"],
    ["pineappleinnovationlabs/tirak-dream-journeys", "R_kgDOPHdksg", ["frontend"], "historical", "core"],
  ],
  "branch:parkarea": [
    ["Sheshiyer/parkarea-aleph", "R_kgDOSDqEkg", ["frontend", "backend"], "current", "parkarea"],
    ["Sheshiyer/parkarea-aleph-mobile", "R_kgDOU83z1A", ["experience"], "current", "parkarea"],
    ["Sheshiyer/parkarea-wiki-v0", "R_kgDOTFJkwA", ["docs"], "current", "parkarea"],
  ],
  "branch:insight-realtors-legal-advisors": [
    ["Sheshiyer/Insightreality", "R_kgDOSxg4Kw", ["frontend"], "current", "insight-realtors-legal-advisors"],
  ],
  "branch:relovo": [
    ["Sheshiyer/relovo", "R_kgDOVTHb5Q", ["experience"], "current", "relovo"],
  ],
  "branch:co-property": [
    ["Sheshiyer/coproperty-office-os", "R_kgDOVMQgOA", ["experience"], "current", "office-os"],
    ["copropertyinfo-a11y/coproperty-showcase-2026", "R_kgDOVMFYng", ["frontend"], "current", "website-2026"],
    ["copropertyinfo-a11y/coproperty-academy", "R_kgDOVNPz7w", ["experience"], "current", "academy"],
    ["Sheshiyer/copropertyspace", "R_kgDOOlrLlg", ["experience"], "historical", "client-history"],
    ["Sheshiyer/dashboard-0.1-coproperty", "R_kgDORD3wFQ", ["frontend"], "historical", "client-history"],
    ["Sheshiyer/v0-co-property", "R_kgDOOhxT2w", ["frontend"], "historical", "client-history"],
    ["Sheshiyer/v0-coproperty-checklist", "R_kgDOOrAk_Q", ["experience"], "historical", "client-history"],
    ["Sheshiyer/v0-coproperty-edu", "R_kgDOOuZQ2A", ["experience"], "historical", "client-history"],
    ["Sheshiyer/wiki-coproperty", "R_kgDOOf6QRA", ["docs"], "historical", "client-history"],
    ["Sheshiyer/wiki-coproperty-v1", "R_kgDOQy2PiQ", ["docs"], "historical", "client-history"],
  ],
  "branch:klear-karma": [
    ["Sheshiyer/kkv2-klear-karma-RN", "R_kgDOSUMQlw", ["experience", "backend"], "current", "klear-karma"],
    ["Sheshiyer/kkv2-admin-panel", "R_kgDOSzKl3w", ["frontend"], "current", "klear-karma"],
    ["Sheshiyer/kkv2-astro-wiki", "R_kgDOSpHtyw", ["docs"], "current", "klear-karma"],
    ["Sheshiyer/klear-karma-website-v2", "R_kgDOSygkXA", ["frontend"], "current", "klear-karma"],
    ["Sheshiyer/Klearkarma-wiki", "R_kgDOPNXkIQ", ["docs"], "historical", "klear-karma"],
    ["Sheshiyer/klear-karma", "R_kgDOSTjD5w", ["experience"], "historical", "klear-karma"],
    ["Sheshiyer/klear-karma-backend", "R_kgDOPT_ipA", ["backend"], "historical", "klear-karma"],
    ["Sheshiyer/klear-karma-pitchv1", "R_kgDOPN3-TA", ["frontend"], "historical", "klear-karma"],
    ["Sheshiyer/rork-klear-karma-mobile-app-frontend", "R_kgDOPcQ4Lg", ["experience"], "historical", "klear-karma"],
    ["Sheshiyer/karma-healing-mobile", "R_kgDOPNbCuQ", ["experience"], "historical", "klear-karma"],
  ],
};
const reviewedMembership: Readonly<Record<string, readonly OperationalRepositoryComponent[]>> = Object.fromEntries(
  Object.entries(reviewedRows).map(([workId, rows]) => [workId, Object.freeze(rows.map(([nameWithOwner, immutableRepositoryId, roles, lifecycle, projectAssociation]) => Object.freeze({
    componentId: nameWithOwner.replace('/', '--').toLowerCase(), nameWithOwner, immutableRepositoryId,
    roles: Object.freeze([...roles]), lifecycle, projectAssociation, ownerWorkObjectId: workId,
    planningAuthority: false, accessState: 'verified' as const,
  })))]),
);

export function reviewedRepositoryComponentsFor(workId: string): readonly OperationalRepositoryComponent[] {
  return reviewedMembership[workId] ?? [];
}

// Full membership is independent of the one selected planning repository.
export function repositoryComponentsForIntake(workId: string, primary: string | null): OperationalRepositoryComponent[] {
  return reviewedRepositoryComponentsFor(workId).map((component) => ({
    ...component, roles: [...component.roles],
    planningAuthority: `repo:${component.nameWithOwner}`.toLowerCase() === primary?.toLowerCase(),
  }));
}

// Called only for new component-bearing proposals. Legacy singular proposals
// remain byte-for-byte unchanged for their historic digest/idempotency checks.
export function validateIntakeRepositoryComponents(
  value: unknown, workId: string, primary: string | null, requireComplete = true,
): OperationalRepositoryComponent[] {
  if (!Array.isArray(value) || (requireComplete && value.length === 0) || value.length > 64) throw new TypeError('repositoryComponents must contain 1..64 components');
  const expected = repositoryComponentsForIntake(workId, primary);
  if (!expected.length) throw new TypeError('repositoryComponents require reviewed WorkObject membership');
  if (requireComplete && value.length !== expected.length) throw new TypeError('repositoryComponents must preserve full reviewed membership');
  const seen = new Set<string>();
  const normalized = value.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('invalid repository component');
    const candidate = raw as OperationalRepositoryComponent;
    const match = expected.find((component) => component.componentId === candidate.componentId);
    if (!match || seen.has(match.componentId)) throw new TypeError('unknown or duplicate repository component');
    seen.add(match.componentId);
    if (Object.keys(raw).some((key) => !Object.hasOwn(match, key)) ||
      Object.keys(match).some((key) => JSON.stringify((raw as Record<string, unknown>)[key]) !== JSON.stringify((match as unknown as Record<string, unknown>)[key]))) {
      throw new TypeError('repository component identity, owner, role or lifecycle differs from reviewed membership');
    }
    return candidate;
  });
  const authorities = normalized.filter((component) => component.planningAuthority);
  if (requireComplete && ((primary === null ? authorities.length !== 0 : authorities.length !== 1) || authorities.some((component) => component.lifecycle !== 'current'))) throw new TypeError('choose exactly one approved current planning repository');
  return normalized;
}

// Existing generated repository-evidence aliases, not new repository identities.
const reviewedLegacyAliases: Readonly<Record<string, string>> = {
  'repo:parkarea.parkarea-aleph': 'Sheshiyer/parkarea-aleph',
  'repo:parkarea.wiki': 'Sheshiyer/parkarea-wiki-v0',
  'repo:insightreality': 'Sheshiyer/Insightreality',
  'repo:klear-karma.kkv2-admin-panel': 'Sheshiyer/kkv2-admin-panel',
  'repo:klear-karma.kkv2-klear-karma-rn': 'Sheshiyer/kkv2-klear-karma-RN',
  'repo:klear-karma.klear-karma-website-v2': 'Sheshiyer/klear-karma-website-v2',
};

// Qualified GitHub names are case-insensitive; immutable IDs are not. Require
// all three identity claims to resolve to the same reviewed component, without
// rewriting the original singular payload or its historic digest input.
export function reviewedPlanningRepository(
  workId: string, reference: string | null,
  authority: { kind: string; repositoryId?: string; fullName?: string } | null,
  requireApproved = true,
): OperationalRepositoryComponent | undefined {
  const components = reviewedRepositoryComponentsFor(workId);
  if (!components.length || authority?.kind !== 'repository') return undefined;
  const byId = components.find((component) => component.immutableRepositoryId === authority.repositoryId);
  const byName = components.find((component) => component.nameWithOwner.toLowerCase() === authority.fullName?.toLowerCase());
  const normalizedRef = reference?.toLowerCase() ?? '';
  const refName = reviewedLegacyAliases[normalizedRef]?.toLowerCase() ?? (normalizedRef.startsWith('repo:') ? normalizedRef.slice(5) : '');
  if (!byId || byId !== byName || refName !== byId.nameWithOwner.toLowerCase()) {
    throw new TypeError('planning repository ID, qualified name and source reference must identify the same reviewed component');
  }
  if (requireApproved && byId.lifecycle !== 'current') throw new TypeError('choose exactly one approved current planning repository');
  return byId;
}
