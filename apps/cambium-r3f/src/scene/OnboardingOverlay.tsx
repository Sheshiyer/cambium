import { useEffect, useState } from 'react';

export type OnboardingRole = 'founder' | 'team' | 'consultant';

export interface OnboardingStep {
  kicker: string;
  title: string;
  body: string;
}

export interface OnboardingOverlayProps {
  role: OnboardingRole;
  steps: readonly OnboardingStep[];
  onDone: () => void;
}

export function OnboardingOverlay({ role, steps, onDone }: OnboardingOverlayProps) {
  const total = steps.length;
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(Math.max(index, 0), Math.max(total - 1, 0));
  const step = safeIndex < total ? steps[safeIndex] : null;
  const isLast = safeIndex >= total - 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDone();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  const advance = () => {
    if (safeIndex >= total - 1) {
      onDone();
      return;
    }
    setIndex(safeIndex + 1);
  };

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-label={`${role} onboarding tour`}>
      <div className="onboarding-card">
        <div className="onboarding-dots" aria-label="Tour progress">
          {steps.map((_, dot) => (
            <span
              key={dot}
              className={
                'onboarding-dot' +
                (dot === safeIndex ? ' onboarding-dot--active' : '') +
                (dot < safeIndex ? ' onboarding-dot--done' : '')
              }
            />
          ))}
        </div>

        {step ? (
          <div className="onboarding-step">
            <span className="hud-kicker">{step.kicker}</span>
            <h1>{step.title}</h1>
            <p>{step.body}</p>
          </div>
        ) : null}

        <div className="onboarding-actions">
          <button type="button" className="onboarding-skip" onClick={onDone}>
            ESC · DONE
          </button>
          <button type="button" className="onboarding-advance" onClick={advance}>
            {isLast ? 'DONE' : 'NEXT'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const ROLE_TOUR_STEPS: readonly OnboardingStep[] = [
  {
    kicker: 'ISLAND · GENESIS',
    title: 'THE ORGANS ARE THE MAP',
    body: 'Cambium lays the company out as five islands — Genesis feeds Taste, Taste feeds Build, Build feeds Ops, and Cortex remembers every pass. Each island is one organ of the build. You are looking at the whole organism at once, not a slide deck.',
  },
  {
    kicker: 'NODE · TELEMETRY',
    title: 'READ THE INSTRUMENTS',
    body: 'The left rail is live telemetry, the right readout is the focused node. Tone tags — signal, mist, depth — tell you what is live, what is forming, and what is structural memory. Read the numbers as pulses, not verdicts.',
  },
  {
    kicker: 'ROLE · CONSULTANT',
    title: 'WHAT YOU CAN SEE VS ASK FOR',
    body: 'Your seat is read-only. You can tour the map, read every island, and follow the packet rail, but you cannot mutate state. If something needs to change, flag it and route the ask back to the operator. Observe, then advise.',
  },
];
