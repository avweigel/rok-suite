'use client';

// CF initial drop: the popup that asks which resource points count, and the list of the best spots.
import { useMemo, useState } from 'react';
import type { DropSpot } from '../../core/drop';
import type { PlanState } from '../../core/state';
import { resourceCodes } from '../../core/world';
import type { World } from '../../core/world';
import { Check, RemovalList, ResIcon, Section, cap, plural } from '../components';
import type { Tool } from '../model';

const PAGE = 50;

export function DropDialog(p: { world: World; state: PlanState; selected: readonly number[]; onChange(next: number[]): void; includeOwned: boolean; onIncludeOwned(v: boolean): void; onFind(): void; onClose(): void }) {
  const { world, state } = p;
  const codes = resourceCodes(world);
  const counts = useMemo(() => {
    const free: Record<number, number> = {};
    const all: Record<number, number> = {};
    for (const pt of world.points) {
      all[pt.res] = (all[pt.res] ?? 0) + 1;
      if (!world.owner.has(pt.cell) && !state.claimed.has(pt.cell)) free[pt.res] = (free[pt.res] ?? 0) + 1;
    }
    return { free, all };
  }, [world, state]);
  const toggle = (c: number): void => p.onChange(p.selected.includes(c) ? p.selected.filter((x) => x !== c) : [...p.selected, c]);
  return (
    <div className="rokp-modal" role="dialog" aria-modal="true" aria-label="CF initial drop">
      <div className="rokp-modal-box">
        <button type="button" className="rokp-x" onClick={p.onClose} aria-label="Close">
          ×
        </button>
        <b>CF initial drop</b>
        <p className="rokp-hint">Which resource points should the CF take in? The planner lists every spot where one CF gets 2 or more of them, the richest first.</p>
        <div className="rokp-chips">
          {codes.map((c) => (
            <button key={c} type="button" className={`rokp-chip${p.selected.includes(c) ? ' on' : ''}`} aria-pressed={p.selected.includes(c)} onClick={() => toggle(c)}>
              <ResIcon name={world.resources[c]} code={c} size={22} />
              <span className="rokp-grow">{cap(world.resources[c])}</span>
              <span className="rokp-n">{p.includeOwned ? `${counts.all[c] ?? 0} points` : `${counts.free[c] ?? 0} free`}</span>
            </button>
          ))}
        </div>
        <Check checked={p.includeOwned} onChange={p.onIncludeOwned} label="Count the points already in an alliance's land" hint={p.includeOwned ? 'The alliances are ignored: Go on a spot says what would have to be removed.' : 'Only empty land and free points: the spots can be taken right now.'} />
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

export function DropPanel(p: { world: World; tool: Tool; readOnly: boolean; allianceName: string; spots: DropSpot[] | null; focus: number; onOpen(): void; onClear(): void; onGo(s: DropSpot, index: number): void; onGoTo(x: number, y: number): void; onPlace(s: DropSpot, index: number): void }) {
  const { world, spots } = p;
  // the list grows a page at a time; a new search starts it again
  const [page, setPage] = useState<{ of: DropSpot[] | null; n: number }>({ of: null, n: PAGE });
  const shown = Math.max(page.of === spots ? page.n : PAGE, p.focus + 1);
  const byTotal = useMemo(() => {
    const c = new Map<number, number>();
    for (const s of spots ?? []) c.set(s.total, (c.get(s.total) ?? 0) + 1);
    return [...c].sort((a, b) => b[0] - a[0]);
  }, [spots]);
  return (
    <Section title="CF initial drop" defaultOpen={false} forceOpen={p.tool === 'drop'} hint="Where one fortress, dropped on empty land, takes in the most resource points of the kinds you choose.">
      <div className="rokp-row">
        <button type="button" className={spots ? '' : 'rokp-primary'} disabled={p.readOnly} onClick={p.onOpen}>
          Choose the nodes…
        </button>
        {spots && <button type="button" onClick={p.onClear}>Clear</button>}
      </div>
      {spots && spots.length === 0 && <p className="rokp-msg bad">No spot takes in 2 or more of those points.</p>}
      {spots && spots.length > 0 && (
        <>
          <p className="rokp-hint">
            For {p.allianceName}: {plural(spots.length, 'spot')}, {byTotal.map(([t, n]) => `${n} with ${t}`).join(', ')} points. Click a yellow spot on the map, or a button here.
          </p>
          <ol className="rokp-drops">
            {spots.slice(0, shown).map((s, i) => (
              <li key={`${s.x},${s.y}`}>
                <span className="rokp-droprank">{i + 1}</span>
                <div className="rokp-grow">
                  <div className="rokp-dropnodes">
                    <b>{plural(s.total, 'point')}</b>
                    {resourceCodes(world).filter((c) => s.nodes[c]).map((c) => (
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
                    {s.owned > 0 ? ` · ${s.owned} of them in somebody's land` : ''}
                    {!s.checked && s.owners.length > 0 ? ` · land of ${listed(s.owners)}` : ''}
                    {s.checked && s.removals.length > 0 ? ` · remove from ${listed(s.removals.map((g) => g.label))}` : ''}
                    {s.impossible ? ' · cannot be cleared' : ''}
                  </small>
                  {p.focus === i && s.removals.length > 0 && <RemovalList groups={s.removals} onGo={p.onGoTo} />}
                </div>
                <button type="button" onClick={() => p.onGo(s, i)} title="Show it on the map, with what would have to go">Go</button>
                <button type="button" className="rokp-primary" disabled={p.readOnly || s.impossible} onClick={() => p.onPlace(s, i)} title="Place the CF here">Place</button>
              </li>
            ))}
          </ol>
          {shown < spots.length && (
            <button type="button" className="rokp-more" onClick={() => setPage({ of: spots, n: shown + PAGE })}>
              Show {Math.min(PAGE, spots.length - shown)} more ({spots.length - shown} left)
            </button>
          )}
        </>
      )}
    </Section>
  );
}

/** A few names, then how many more. */
function listed(names: string[]): string {
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
}
