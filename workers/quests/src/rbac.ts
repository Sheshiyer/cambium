// cambium-quests · mini-app surface RBAC (zero-dependency, server-side envelope filter).
//
// Roles are a CEILING on the interaction-kind ladder, not a set of ad-hoc
// flags. Enforcement is by ABSENCE: disallowed sections, subsections, and
// controls are omitted from the serialized envelope entirely — the client
// never receives a "disabled" affordance it could re-enable.
//
// Rules:
//   1. A principal sees only items whose primary interaction is at or below
//      its role ceiling.
//   2. On surviving items, secondary interactions and controls above the
//      ceiling are stripped (item stays, capability leaves).
//   3. Consultants additionally carry a per-subsection allow-list; only
//      allow-listed subsection ids survive. The ceiling still wins over the
//      allow-list: an allow-listed subsection whose primary exceeds the
//      consultant ceiling is dropped, not granted.
//   4. Founder and team bypass the allow-list entirely (subject to ceiling).
//   5. Expired principals (expiresAt < now) receive an empty envelope.
//
// Inputs are never mutated; items needing control stripping are shallow-copied
// with fresh `interactions` (and `controls`) objects.

import type {
  MiniAppInteractionControl,
  MiniAppInteractionKind,
  MiniAppInteractionProfile,
  MiniAppMapSubsection,
  MiniAppMapSubsectionId,
  MiniAppSurfaceSection,
} from './mini-app-surface-contract.ts';

export type RbacRole = 'founder' | 'team' | 'consultant';

/**
 * Capability ladder, ordered low -> high. An interaction kind is permitted
 * for a role iff its ladder index is at or below the role ceiling's index.
 */
export const INTERACTION_LADDER = [
  'read-only',
  'external-proof',
  'sheet',
  'chat-command',
  'signed-action',
] as const satisfies readonly MiniAppInteractionKind[];

/** Role -> highest permitted interaction kind on the ladder. */
export const ROLE_CEILINGS: Record<RbacRole, MiniAppInteractionKind> = {
  founder: 'signed-action',
  team: 'chat-command',
  consultant: 'read-only',
} as const;

export interface Principal {
  id: string;
  tenant: string;
  role: RbacRole;
  /**
   * Allow-listed MiniAppMapSubsectionId values. Only consulted for
   * consultants: empty array = no subsections. Founder/team bypass this list
   * (subject to their ceiling).
   */
  allow: readonly string[];
  createdBy: string;
  /** ISO-8601 timestamp; principal is expired when expiresAt < now. */
  expiresAt?: string;
}

const ladderIndex = (kind: MiniAppInteractionKind): number =>
  (INTERACTION_LADDER as readonly MiniAppInteractionKind[]).indexOf(kind);

/** True iff `kind` is at or below the ceiling granted to `role`. */
export function permits(kind: MiniAppInteractionKind, role: RbacRole): boolean {
  return ladderIndex(kind) <= ladderIndex(ROLE_CEILINGS[role]);
}

/** True iff the principal is a consultant whose allow-list contains the subsection. */
export function isConsultantVisible(
  principal: Principal,
  subsectionId: MiniAppMapSubsectionId,
): boolean {
  return principal.role === 'consultant' && principal.allow.includes(subsectionId);
}

const isExpired = (principal: Principal, now: Date): boolean =>
  principal.expiresAt !== undefined && new Date(principal.expiresAt).getTime() < now.getTime();

type SurfaceItem = MiniAppSurfaceSection | MiniAppMapSubsection;

/**
 * Core envelope filter. Drops items whose primary exceeds the ceiling and
 * strips above-ceiling secondary interactions/controls from survivors,
 * copying only the items that actually change.
 */
function filterItems<T extends SurfaceItem>(
  items: readonly T[],
  principal: Principal,
  now: Date,
  allowListApplies: boolean,
): T[] {
  if (isExpired(principal, now)) return [];

  const out: T[] = [];
  for (const item of items) {
    const { interactions } = item;
    if (!permits(interactions.primary, principal.role)) continue;
    if (allowListApplies && principal.role === 'consultant' && !principal.allow.includes(item.id)) {
      continue;
    }

    const secondary = interactions.secondary?.filter((kind) => permits(kind, principal.role));
    const controls = interactions.controls?.filter((control: MiniAppInteractionControl) =>
      permits(control.interaction, principal.role),
    );

    const secondaryStripped =
      secondary !== undefined && secondary.length !== (interactions.secondary?.length ?? 0);
    const controlsStripped =
      controls !== undefined && controls.length !== (interactions.controls?.length ?? 0);

    if (!secondaryStripped && !controlsStripped) {
      out.push(item);
      continue;
    }

    const filteredProfile: MiniAppInteractionProfile = { primary: interactions.primary };
    if (secondary !== undefined && secondary.length > 0) filteredProfile.secondary = secondary;
    if (controls !== undefined && controls.length > 0) filteredProfile.controls = controls;
    out.push({ ...item, interactions: filteredProfile });
  }
  return out;
}

/**
 * Filter the mini-app section envelope for a principal. The consultant
 * allow-list does not apply to sections (it names subsection ids), so
 * consultants see sections subject to their ceiling only.
 */
export function filterSections(
  sections: readonly MiniAppSurfaceSection[],
  principal: Principal,
  now: Date = new Date(),
): MiniAppSurfaceSection[] {
  return filterItems(sections, principal, now, false);
}

/**
 * Filter the map-subsection envelope for a principal. Consultants are
 * additionally restricted to allow-listed subsection ids, and the ceiling
 * still wins over the allow-list.
 */
export function filterSubsections(
  subsections: readonly MiniAppMapSubsection[],
  principal: Principal,
  now: Date = new Date(),
): MiniAppMapSubsection[] {
  return filterItems(subsections, principal, now, true);
}
