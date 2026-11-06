'use client';

import type { PlanDoc } from '../../core/plan';
import { MAX_EXTRA_FLAGS, PRESETS } from '../../core/route';
import type { RouteMode, RouteOptions, RouteResult } from '../../core/route';
import type { World } from '../../core/world';
import { Check, ResIcon, Section, Seg, cap, plural } from '../components';
import type { Picks, Tool } from '../model';

export interface RoutePanelProps {
  world: World;
  plan: PlanDoc;
  activeId: string;
  readOnly: boolean;
  tool: Tool;
  onTool(t: Tool): void;
  picks: Picks;
  onPicks(p: Picks): void;
  options: RouteOptions;
  onOptions(o: RouteOptions): void;
  result: RouteResult | null;
  busy: boolean;
  onFind(): void;
  onApply(): void;
  onDiscard(): void;
}

const MODE_TEXT: Record<RouteMode, string> = {
  fewest: 'The chain with the fewest flags, going around anything in the way. Resource points play no part.',
  nodes: 'Still the fewest flags from A to B, on the way that takes in the most resource points. The extra flags then branch off it to reach more.',
};

const num = (s: string): number | null => {
  const v = Number(s);
  return s.trim() !== '' && Number.isFinite(v) ? v : null;
};

function Coord(props: { label: string; value: [number, number] | null; onChange(v: [number, number] | null): void; color: string }) {
  const v = props.value;
  return (
    <div className="rokp-row">
      <span className="rokp-pin" style={{ background: props.color }}>{props.label}</span>
      <input className="rokp-input rokp-num" inputMode="decimal" placeholder="X" aria-label={`${props.label} x`} value={v ? v[0] : ''} onChange={(e) => { const x = num(e.target.value); props.onChange(x === null ? null : [x, v ? v[1] : 0]); }} />
      <input className="rokp-input rokp-num" inputMode="decimal" placeholder="Y" aria-label={`${props.label} y`} value={v ? v[1] : ''} onChange={(e) => { const y = num(e.target.value); props.onChange(y === null ? null : [v ? v[0] : 0, y]); }} />
    </div>
  );
}

export function RoutePanel(p: RoutePanelProps) {
  const { world, options, result } = p;
  const codes = [1, 2, 3, 4].filter((c) => world.resources[c]);
  const active = p.plan.alliances.find((a) => a.id === p.activeId);
  const ready = !!p.picks.a && !!p.picks.b && !p.busy;
  const objective = p.picks.objectiveId ? world.objectives.find((o) => o.id === p.picks.objectiveId) : undefined;
  const set = (patch: Partial<RouteOptions>): void => p.onOptions({ ...options, ...patch });
  const preset = (m: RouteMode): void => p.onOptions({ ...PRESETS[m] });

  return (
    <Section title="Route from A to B" defaultOpen={p.tool === 'route'} forceOpen={p.tool === 'route'} hint="Finds the flags that carry an alliance's land from A to B. It changes nothing until you press Add to plan.">
      <div className="rokp-row">
        <button type="button" className={p.tool === 'route' ? 'rokp-primary' : ''} onClick={() => p.onTool(p.tool === 'route' ? 'view' : 'route')}>
          {p.tool === 'route' ? 'Picking on the map…' : 'Pick A and B on the map'}
        </button>
        {(p.picks.a || p.picks.b) && (
          <button type="button" onClick={() => { p.onPicks({ a: null, b: null }); p.onDiscard(); }}>
            Clear
          </button>
        )}
      </div>
      {p.tool === 'route' && <p className="rokp-hint">{!p.picks.a ? 'Click the map for A, the start.' : !p.picks.b ? 'Now click B, the target. Click a holy site or a pass to aim at it.' : 'Click again to start over.'}</p>}
      <Coord label="A" color="#2f9e44" value={p.picks.a} onChange={(v) => p.onPicks({ ...p.picks, a: v })} />
      <Coord label="B" color="#d6336c" value={p.picks.b} onChange={(v) => p.onPicks({ a: p.picks.a, b: v })} />
      {objective && <p className="rokp-hint">B is {objective.name}: the route ends as soon as the land touches it.</p>}
      <div className="rokp-label">Route for</div>
      <p className="rokp-sub">{active ? <><span className="rokp-sw" style={{ background: active.color }} /> {active.name}</> : 'Pick an alliance in the list above.'}</p>
      <div className="rokp-label">What matters</div>
      <Seg<RouteMode>
        value={options.mode}
        onChange={preset}
        options={[
          { value: 'fewest', label: 'Fewest flags' },
          { value: 'nodes', label: 'More nodes' },
        ]}
      />
      <p className="rokp-hint">{MODE_TEXT[options.mode]}</p>
      {options.mode === 'nodes' && (
        <>
          <label className="rokp-slider">
            <span title="How many flags you accept on top of the fewest that reach B">Extra flags</span>
            <input type="range" min={0} max={MAX_EXTRA_FLAGS} value={options.extraFlags} onChange={(e) => set({ extraFlags: Number(e.target.value) })} />
            <span>up to {options.extraFlags}</span>
          </label>
          <div className="rokp-label">Take in</div>
          <div className="rokp-chips">
            {codes.map((c) => (
              <button key={c} type="button" className={`rokp-chip${(options.weights[c] ?? 0) > 0 ? ' on' : ''}`} onClick={() => set({ weights: { ...options.weights, [c]: (options.weights[c] ?? 0) > 0 ? 0 : 1 } })}>
                <ResIcon name={world.resources[c]} code={c} size={22} />
                <span className="rokp-grow">{cap(world.resources[c])}</span>
              </button>
            ))}
            <Check checked={options.objectiveWeight > 0} onChange={(v) => set({ objectiveWeight: v ? 3 : 0 })} label="Holy sites and passes" />
          </div>
        </>
      )}
      <div className="rokp-row">
        <button type="button" className="rokp-primary" disabled={!ready || !active} onClick={p.onFind}>
          {p.busy ? 'Searching…' : 'Find the route'}
        </button>
      </div>
      {result && (
        <div className={`rokp-msg ${result.ok ? 'ok' : 'bad'}`}>
          <p>{result.message}</p>
          {result.ok && result.stats && result.items.length > 0 && (
            <>
              <ul className="rokp-stats">
                <li>{plural(result.stats.flags, 'flag')}{result.newCf ? ' + 1 CF' : ''} · {result.stats.length} tiles long</li>
                {result.stats.extraFlags > 0 && (
                  <li>
                    <span className="rokp-addeddot" /> {result.stats.extraFlags} added, for {plural(result.stats.extraNodes, 'more point')}
                  </li>
                )}
                <li>{result.stats.newTiles.toLocaleString()} new tiles</li>
                <li>
                  {codes.map((c) => (
                    <span key={c} className="rokp-nodechip">
                      <ResIcon name={world.resources[c]} code={c} size={18} />
                      {result.stats!.nodes[c] ?? 0}
                    </span>
                  ))}
                </li>
                {result.stats.captured.length > 0 && <li>Reaches {result.stats.captured.join(', ')}</li>}
              </ul>
              <div className="rokp-row">
                <button type="button" className="rokp-primary" disabled={p.readOnly} onClick={p.onApply}>
                  Add to plan
                </button>
                <button type="button" onClick={p.onDiscard}>
                  Discard
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Section>
  );
}
