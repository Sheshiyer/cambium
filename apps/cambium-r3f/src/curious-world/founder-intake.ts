import type { GateBridge } from './gate-folio.ts';

export interface FounderIntakeState { draft: string; busy: boolean; message: string; uncertain: boolean }
export function parseFounderIntake(text: string): Record<string, unknown> {
  if (new TextEncoder().encode(text).length > 65_536) throw new Error('Keep the draft within 64 KB.');
  let value: any;
  try { value = JSON.parse(text); } catch { throw new Error('Enter a valid JSON goal graph draft.'); }
  if (!value || Array.isArray(value) || value.schema !== 'cambium.founder.goal-graph-intent.v1'
    || value.version !== 1 || value.tenantId !== 'cambium'
    || typeof value.clientRequestId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(value.clientRequestId)
    || !Array.isArray(value.goals) || value.goals.length < 1 || value.goals.length > 32) {
    throw new Error('Use the Cambium founder intent schema with a stable request ID and 1–32 goals.');
  }
  return value;
}

/** Local draft only. The host owns authenticated requests; existing Gate owns decisions. */
export function founderIntakeForm(bridge: GateBridge, state: FounderIntakeState): HTMLElement {
  const details = document.createElement('details');
  details.className = 'cw-founder-intake';
  details.dataset.cwDisclosure = 'founder-intake';
  const summary = document.createElement('summary'); summary.textContent = 'Propose a graph update';
  const note = document.createElement('p');
  note.textContent = 'Prepare an additive bookkeeping proposal for Cambium. This does not authorize execution. Read all proposed changes in the Gate before confirming.';
  const form = document.createElement('form');
  const label = document.createElement('label'); label.htmlFor = 'cw-founder-intake-draft'; label.textContent = 'Goal graph draft (JSON)';
  const draft = document.createElement('textarea'); draft.id = label.htmlFor; draft.value = state.draft;
  draft.rows = 10; draft.spellcheck = false; draft.required = true; draft.disabled = state.busy;
  const button = document.createElement('button'); button.type = 'submit'; button.className = 'cw-link';
  button.textContent = state.busy ? 'Preparing proposal…' : 'Prepare proposal'; button.disabled = state.busy || state.uncertain;
  const status = document.createElement('p'); status.className = 'cw-gate-status'; status.setAttribute('role', 'status'); status.textContent = state.message;
  draft.addEventListener('input', () => { state.draft = draft.value; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (state.busy || state.uncertain || typeof bridge.intakeGate !== 'function') return;
    let input: Record<string, unknown>;
    try { input = parseFounderIntake(state.draft); }
    catch (error) { state.message = (error as Error).message; status.textContent = state.message; return; }
    state.busy = true; draft.disabled = true; button.disabled = true; button.textContent = 'Preparing proposal…';
    try {
      const outcome = await bridge.intakeGate(input);
      state.message = outcome.message;
      state.uncertain = outcome.outcome === 'uncertain';
    } catch {
      state.message = 'The outcome is unconfirmed. Check pending proposals before trying again.'; state.uncertain = true;
    } finally {
      state.busy = false; draft.disabled = false; button.disabled = state.uncertain;
      button.textContent = 'Prepare proposal'; status.textContent = state.message;
    }
  });
  form.append(label, draft, button, status); details.append(summary, note, form);
  return details;
}
