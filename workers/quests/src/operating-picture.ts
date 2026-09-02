// Track 3 · operating-picture wiring.
//
// The concrete seam a founder surface or a Hermes read step binds to. It calls
// the Phase G reader and renders a single, human-readable status line plus the
// structured view — so a caller can log/print "where does tenant X stand?"
// without knowing anything about transports, digests, or Access.
//
// Reads-only. Never throws. When live reads are off or anything fails, the line
// says so plainly and the view is a gap.

import { readVaultFabricView, type VaultFabricView } from './vault-fabric-reader.ts';
import type { MissionFabricReadConfig } from './mission-fabric-read-client.ts';

export interface OperatingPicture {
  tenantId: string;
  /** One-line human summary, safe to print in a digest or log. */
  line: string;
  view: VaultFabricView;
}

/** Render a view into a single status line. */
export function renderOperatingLine(view: VaultFabricView): string {
  if (!view.ok) {
    return `⚠ ${view.tenantId}: no live operating picture (${view.reason}) — ${view.detail}`;
  }
  const kinds = Object.entries(view.counts.byKind)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}:${n}`)
    .join(' ');
  const gapNote = view.counts.gaps > 0 ? ` · ${view.counts.gaps} open gap(s)` : '';
  return `✓ ${view.tenantId} @ v${view.graphVersion} — ${view.counts.nodes} nodes (${kinds}), ${view.counts.edges} edges${gapNote}`;
}

/**
 * Read a tenant's operating picture. Composes the Phase G reader and renders a
 * printable line alongside the structured view. Reads-only; never throws.
 */
export async function operatingPicture(config: MissionFabricReadConfig): Promise<OperatingPicture> {
  const view = await readVaultFabricView(config);
  return { tenantId: config.tenantId, line: renderOperatingLine(view), view };
}
