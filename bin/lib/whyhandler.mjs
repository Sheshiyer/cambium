// Cambium — the why-handler (I4): turn a drift signal into the learning loop (HOMEOSTASIS §7).
//
// verifyOutput DETECTS drift; this CLASSIFIES it (the one-bit error-vs-intent question),
// RESOLVES it (error → reroll toward the same x*; intent → absorb Δ into x*/the contract),
// builds the WHY-PROMPT the agent fills via AskUserQuestion, and emits a ledger record (the
// cortex-write — stubbed locally; I3 swaps in the real Worker). All pure: no I/O, no spawn.

/**
 * The one-bit disambiguation. A drift defaults to ERROR (fail-closed → reroll toward the same x*);
 * it is INTENT only when this stage is explicitly flagged intentional (a user redirect, or — later —
 * a cortex-recognised repeated attractor). Default-deny on ambiguity, like the spend gate.
 * @param {{stage:string, reason?:string}} deviation
 * @param {{intent?: string|null}} opts  intent = the stage id the operator marked intentional
 */
export function classifyDeviation(deviation, opts = {}) {
  if (opts.intent && opts.intent === deviation.stage) {
    return { kind: 'intent', reason: `flagged intentional (--intent ${deviation.stage})` };
  }
  return { kind: 'error', reason: 'unflagged → treated as error (reroll toward x*)' };
}

/**
 * Resolve a classified deviation into an action.
 *   error  → reroll toward the SAME x* (automatic, fail-closed)
 *   intent → absorb Δ into x* and the contract/ISC, carrying the rationale (the learning)
 */
export function resolveDeviation(deviation, classification, rationale = null) {
  if (classification.kind === 'intent') {
    return { action: 'absorb', rationale, note: 'incorporate Δ into x* / the contract — it must never read as drift again' };
  }
  return { action: 'reroll', rationale: null, note: 'reject + reroll toward the same x* (no setpoint change)' };
}

/** The structured question the orchestration layer (the agent) passes to AskUserQuestion. Pure. */
export function buildWhyPrompt(deviation) {
  return {
    question: `Drift at stage "${deviation.stage}": ${deviation.reason || 'output violated its contract'}. Why — is this an error or an intentional change?`,
    options: [
      { label: 'Error — reroll', description: 'A bad step; reroll toward the same brand-DNA x* (automatic).' },
      { label: 'Intent — new direction', description: 'You moved the target; absorb it into x*/the contract so it never reads as drift again. (You then say what changed.)' },
    ],
  };
}

/** One canonical ledger line (the cortex-write STUB). Pure — the CLI adds the newline + persists. */
export function recordDeviation(r) {
  return JSON.stringify({
    ts: r.ts || null,
    stage: r.stage,
    kind: r.kind || null,
    action: r.action || null,
    rationale: r.rationale || null,
    reason: r.reason || null,
  });
}

/**
 * The full handler for one drifted stage. Pure given the deviation + opts (+ optional rationale).
 * Returns { classification, resolution, line } — the line is appended to the ledger by the CLI.
 */
export function handleDeviation(deviation, opts = {}, rationale = null) {
  const classification = classifyDeviation(deviation, opts);
  const resolution = resolveDeviation(deviation, classification, rationale);
  const line = recordDeviation({
    ts: opts.ts || null,
    stage: deviation.stage,
    kind: classification.kind,
    action: resolution.action,
    rationale: resolution.rationale,
    reason: deviation.reason,
  });
  return { classification, resolution, line };
}
