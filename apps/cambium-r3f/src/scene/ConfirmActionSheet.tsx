import { useEffect } from 'react';

export interface ConfirmActionControl {
  id: string;
  interaction: string;
  source: string;
  target?: string;
}

export interface ConfirmActionSheetProps {
  control: ConfirmActionControl;
  onConfirm: (id: string) => void;
  onCancel: () => void;
}

export function ConfirmActionSheet({ control, onConfirm, onCancel }: ConfirmActionSheetProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <aside className="diegetic-readout" aria-label={`Confirm signed action ${control.id}`} data-surface="signed-action">
      <div>
        <span className="hud-kicker">SIGNED ACTION</span>
        <h1>{control.id}</h1>
        <div className="scene-instruments" role="list">
          <div className="instrument-line" role="listitem" data-tone="mist">
            <span>SOURCE</span>
            <strong>{control.source}</strong>
          </div>
          {control.target ? (
            <div className="instrument-line" role="listitem" data-tone="depth">
              <span>TARGET</span>
              <strong>{control.target}</strong>
            </div>
          ) : null}
          <div className="instrument-line" role="listitem" data-tone="signal">
            <span>INTERACTION</span>
            <strong>{control.interaction}</strong>
          </div>
        </div>
        <section className="camera-dial" aria-label="Confirm or cancel">
          <button type="button" onClick={() => onConfirm(control.id)} aria-label={`Confirm ${control.id}`}>
            confirm
          </button>
          <button type="button" onClick={onCancel} aria-label={`Cancel ${control.id}`}>
            cancel
          </button>
        </section>
      </div>
    </aside>
  );
}
