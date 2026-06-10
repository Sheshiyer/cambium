// Cambium operator · quests — the quest log panel (M4 / W1).
// Renders the quest ledger in the house panel style (see ../onboarding/octalysis.ts):
// two-space indent, ════ header, padEnd columns, █· meters, an out-sink for tests.

import type { QuestLedger } from './quests.ts';

const MARK: Record<string, string> = { complete: '✓', active: '▸', locked: '·' };

function meter(n: number, max: number, width = 14): string {
  const filled = max > 0 ? Math.round((n / max) * width) : 0;
  return '█'.repeat(filled) + '·'.repeat(Math.max(0, width - filled));
}

/** Render the quest log. Every line of status text comes from derived evidence. */
export function renderQuestLog(ledger: QuestLedger, tenant: string, out: (s: string) => void): void {
  out('');
  out('  ════════ Quest Log · the infinite game ════════');
  out('');
  out(`  tenant: ${tenant}`);
  out('');
  for (const row of ledger.rows) {
    const arc = row.quest.arc.padEnd(5);
    const title = row.quest.title.padEnd(20);
    out(`  ${arc}${title}${MARK[row.status]}  ${row.evidence}`);
  }
  out('');
  out(`  progress  ${meter(ledger.completed, ledger.total)} ${ledger.completed}/${ledger.total} quests`);
  if (ledger.current) {
    out(`  you are here → ${ledger.current.arc} · ${ledger.current.title}: ${ledger.current.narration}`);
    out(`  reveals: ${ledger.current.reveals}`);
  } else {
    out('  all quests complete — the game continues; the line grows with the operator.');
  }
  out('  every status derives from real world-state — no fake progress.');
}
