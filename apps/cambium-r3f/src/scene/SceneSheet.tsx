import type { SheetRowModel } from './scene-data.ts';
import type { MiniAppSectionId } from '../../../../shared/mini-app-surface-contract.ts';

export interface SceneSheetProps {
  title: string;
  kicker: string;
  rows: readonly SheetRowModel[];
  sectionId?: MiniAppSectionId;
  onClose?: () => void;
}

export function SceneSheet({ title, kicker, rows, sectionId, onClose }: SceneSheetProps) {
  return (
    <aside
      className="diegetic-readout scene-sheet"
      aria-label={`${title} diegetic sheet`}
      data-section={sectionId}
      data-surface="sheet"
    >
      <div>
        <div className="scene-sheet__head">
          <span className="hud-kicker">{kicker}</span>
          {onClose ? (
            <button type="button" className="scene-sheet__close" aria-label="Close sheet" onClick={onClose}>
              ×
            </button>
          ) : null}
        </div>
        <h1>{title}</h1>
        <div className="scene-instruments scene-sheet__instruments" role="list">
          {rows.map((row) => (
            <div key={row.id} className="instrument-line" role="listitem" data-tone={row.tone}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
