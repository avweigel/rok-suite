'use client';

// CF initial drop: the popup that asks which resource points count, and the list of the best spots.
import { useMemo } from 'react';
import type { DropSpot } from '../../core/drop';
import type { PlanState } from '../../core/state';
import type { World } from '../../core/world';
import { ResIcon, Section, cap, plural } from '../components';
import type { Tool } from '../model';

const CODES = [1, 2, 3, 4];

export function DropDialog(p: { world: World; state: PlanState; selected: readonly number[]; onChange(next: number[]): void; onFind(): void; onClose(): void }) {
  const { world, state } = p;
  const codes = CODES.filter((c) => world.resources[c]);
  // the points still up for grabs: those inside somebody's land do not count for a new CF
  const free = useMemo(() => {
    const out: Record<number, number> = {};
    for (const pt of world.points) if (!world.owner.has(pt.cell) && !state.claimed.has(pt.cell)) out[pt.res] = (out[pt.res] ?? 0) + 1;
    return out;
  }, [world, state]);
  const toggle = (c: number): void => p.onChange(p.selected.includes(c) ? p.selected.filter((x) => x !== c) : [...p.selected, c]);
  return (
    <div className="rokp-modal" role="dialog" aria-modal="true" aria-label="CF initial drop">
      <div className="rokp-modal-box">
        <button type="button" className="rokp-x" onClick={p.onClose} aria-label="Close">
          ×
        </button>
        <b>CF initial drop</b>
        <p className="rokp-hint">Which resource points should the CF take in? The planner shows the spots where one CF gets the most of them.</p>
        <div className="rokp-chips">
          {codes.map((c) => (
            <button key={c} type="button" className={`rokp-chip${p.selected.includes(c) ? ' on' : ''}`} aria-pressed={p.selected.includes(c)} onClick={() => toggle(c)}>
              <ResIcon name={world.resources[c]} code={c} size={22} />
              <span className="rokp-grow">{cap(world.resources[c])}</span>
              <span className="rokp-n" title="Points in nobody's land">{free[c] ?? 0} free</span>
            </button>
          ))}
        </div>
        <div className="rokp-row">
          <button type="button" className="rokp-grow" onClick={p.onClose}>Cancel</button>
          <button type="button" className="rokp-primary rokp-grow" disabled={p.selected.length === 0} autoFocus onClick={p.onFind}>
            Find the best spots
          </button>
        </div>
      </div>
    </div>
  );
}

export function DropPanel(p: { world: World; tool: Tool; readOnly: boolean; allianceName: string; spots: DropSpot[] | null; onOpen(): void; onClear(): void; onGo(s: DropSpot): void; onPlace(s: DropSpot): void }) {
  const { world, spots } = p;
  return (
    <Section title="CF initial drop" defaultOpen={false} forceOpen={p.tool === 'drop'} hint="Where one fortress, dropped on empty land, takes in the most resource points of the kinds you choose.">
      <div className="rokp-row">
        <button type="button" className={spots ? '' : 'rokp-primary'} disabled={p.readOnly} onClick={p.onOpen}>
          Choose the nodes…
        </button>
        {spots && <button type="button" onClick={p.onClear}>Clear</button>}
      </div>
      {spots && spots.length === 0 && <p className="rokp-msg bad">No free spot takes in any of those points.</p>}
      {spots && spots.length > 0 && (
        <>
          <p className="rokp-hint">For {p.allianceName}. Click a numbered spot on the map, or a button here.</p>
          <ol className="rokp-drops">
            {spots.map((s, i) => (
              <li key={`${s.x},${s.y}`}>
                <span className="rokp-droprank">{i + 1}</span>
                <div className="rokp-grow">
                  <div className="rokp-dropnodes">
                    <b>{plural(s.total, 'point')}</b>
                    {CODES.filter((c) => s.nodes[c]).map((c) => (
                      <span key={c} className="rokp-nodechip">
                        <ResIcon name={world.resources[c]} code={c} size={16} />
                        {s.nodes[c]}
                      </span>
                    ))}
                  </div>
                  <small>
                    {s.x}, {s.y}
                    {s.others > 0 ? ` · +${s.others} of other kinds` : ''}
                    {s.foreignCells > 0 ? ` · covers ${s.foreignCells} taken cells` : ''}
                  </small>
                </div>
                <button type="button" onClick={() => p.onGo(s)} title="Show it on the map">Go</button>
                <button type="button" className="rokp-primary" disabled={p.readOnly} onClick={() => p.onPlace(s)} title="Place the CF here">Place</button>
              </li>
            ))}
          </ol>
        </>
      )}
    </Section>
  );
}
