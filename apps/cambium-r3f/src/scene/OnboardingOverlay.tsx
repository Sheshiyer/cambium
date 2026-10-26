import { useEffect, useRef, useState } from 'react';
import { browserTourStorage, hasCompletedTour, recordTourCompletion, tourIndex } from './onboarding-controller';
import type { TourStorage } from './onboarding-controller';
import './onboarding.css';

export type OnboardingRole = 'founder' | 'team' | 'consultant';
export interface OnboardingStep { kicker: string; title: string; body: string; }
export interface OnboardingOverlayProps {
  /** Display context from a future verified caller; never grants authority. */
  role?: OnboardingRole;
  steps?: readonly OnboardingStep[];
  onDone: () => void;
  onDismiss?: () => void;
}

/** Mount overlay only while open. Replay mounts a fresh step-zero tour. */
export function useOnboardingTour(storage?: TourStorage) {
  const [localStorage] = useState(() => storage ?? browserTourStorage());
  const [open, setOpen] = useState(() => !hasCompletedTour(localStorage));
  const [replayKey, setReplayKey] = useState(0);
  return {
    open, replayKey,
    dismiss: () => setOpen(false),
    complete: () => { recordTourCompletion(localStorage); setOpen(false); },
    replay: () => { setReplayKey((key) => key + 1); setOpen(true); },
  };
}

export function OnboardingOverlay({ role, steps = ROLE_TOUR_STEPS, onDone, onDismiss = onDone }: OnboardingOverlayProps) {
  const [index, setIndex] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onDone, onDismiss });
  callbacks.current = { onDone, onDismiss };
  const safeIndex = tourIndex(index, steps.length);
  const step = steps[safeIndex];
  const last = safeIndex >= steps.length - 1;
  const advance = () => last ? callbacks.current.onDone() : setIndex(safeIndex + 1);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusCard = () => card.current?.focus();
    focusCard();
    const keepFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !card.current?.contains(event.target)) focusCard();
    };
    const onKey = (event: KeyboardEvent) => {
      // Capture before window's bubbling scene shortcuts, including key release.
      event.stopImmediatePropagation();
      if (event.type !== 'keydown') return;
      if (event.key === 'Escape') { event.preventDefault(); callbacks.current.onDismiss(); }
      if (event.key === 'Tab') {
        const buttons = Array.from(card.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        if (!buttons.length) { event.preventDefault(); focusCard(); return; }
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (event.shiftKey && current <= 0) { event.preventDefault(); buttons.at(-1)?.focus(); }
        else if (!event.shiftKey && (current < 0 || current === buttons.length - 1)) { event.preventDefault(); buttons[0].focus(); }
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key === 'ArrowRight') { event.preventDefault(); setIndex((value) => tourIndex(value + 1, steps.length)); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); setIndex((value) => tourIndex(value - 1, steps.length)); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    document.addEventListener('focusin', keepFocus);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      document.removeEventListener('focusin', keepFocus);
      if (previous?.isConnected) previous.focus();
    };
  }, [steps]);

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-describedby="onboarding-body">
      <div className="onboarding-card" ref={card} tabIndex={-1}>
        <span className="onboarding-preview">LOCAL PREVIEW · READ-ONLY TOUR</span>
        {role && <span className="onboarding-context">Viewing context: {role} · no authority granted</span>}
        <p className="onboarding-progress" aria-live="polite">{steps.length ? `Step ${safeIndex + 1} of ${steps.length}` : 'Tour unavailable'}</p>
        <div className="onboarding-step">
          <span className="onboarding-kicker">{step?.kicker ?? 'LOCAL'}</span>
          <h1 id="onboarding-title">{step?.title ?? 'Explore at your own pace'}</h1>
          <p id="onboarding-body">{step?.body ?? 'No tour steps are available. You can close this preview safely.'}</p>
        </div>
        <p className="onboarding-boundary">Completion records a local reading preference. It grants no operational authority; missing evidence stays held.</p>
        <div className="onboarding-actions">
          <button type="button" onClick={onDismiss}>Dismiss · Esc</button>
          <button type="button" disabled={safeIndex === 0} onClick={() => setIndex(safeIndex - 1)}>Back</button>
          <button type="button" className="onboarding-advance" onClick={advance}>{last ? 'Finish tour' : 'Next'}</button>
        </div>
        <p className="onboarding-help">Tab to controls · ← / → to read steps · Replay from the tour control</p>
      </div>
    </div>
  );
}

export const ROLE_TOUR_STEPS: readonly OnboardingStep[] = [
  { kicker: 'MAP · IDENTITY', title: 'Find your place in Cambium', body: 'The map connects Genesis, Taste, Build, Ops and Cortex. Use the screen rail to explore, and read identity and provenance before treating a project alias as a canonical WorkObject.' },
  { kicker: 'MAP · NAVIGATION', title: 'Explore at your own pace', body: 'After closing this tour, use the screen controls or left and right arrows to move between screens. Camera controls and keys 1, 2 and 3 select overview, node and flat views. This tour pauses those keyboard shortcuts while open.' },
  { kicker: 'EVIDENCE · PLANS', title: 'A target is not an achievement', body: 'Read provenance, targets and explicit holds together. Mission and KPI targets describe planned outcomes. Packet owners are not live assignments, organ hints are not pinned loadouts, and local preview signals do not prove production execution.' },
  { kicker: 'GATE · HELD', title: 'Missing proof stays held', body: 'ADMITTED, PINNED, EXECUTED and LEARNED each need evidence from their owning authority. A prepared proposal is not approval. Gate and separate proofs govern live actions; reading this tour cannot unlock them.' },
  { kicker: 'LOOP · REFLECTION', title: 'Return evidence to purpose', body: 'Inspect task, loadout, run, receipt and foldback lineage when evidence exists. Evidence can inform a bounded next intent, but cannot silently commit it. Finish or dismiss now, and replay when useful; no action or delivery is performed here.' },
];
