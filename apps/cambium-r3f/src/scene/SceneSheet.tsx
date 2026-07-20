import type { SheetRowModel } from './scene-data.ts';
import type { MiniAppSectionId } from '../../../../shared/mini-app-surface-contract.ts';

export interface SceneSheetProps {
  title: string;
  kicker: string;
  rows: readonly SheetRowModel[];
  sectionId?: MiniAppSectionId;
}

export function SceneSheet({ title, kicker, rows, sectionId }: SceneSheetProps) {
  return (
    <aside
      className="diegetic-readout"
      aria-label={`${title} diegetic sheet`}
      data-section={sectionId}
      data-surface="sheet"
    >
      <div>
        <span className="hud-kicker">{kicker}</span>
        <h1>{title}</h1>
        <div className="scene-instruments" role="list">
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
