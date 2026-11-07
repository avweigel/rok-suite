'use client';

import { useState } from 'react';
import type { PlanDoc } from '../../core/plan';
import { MAX_EXTRA_FLAGS, PRESETS } from '../../core/route';
import type { RouteMode, RouteOptions, RouteResult } from '../../core/route';
import { resourceCodes } from '../../core/world';
import type { World } from '../../core/world';
import { Check, RemovalList, ResIcon, Section, Seg, cap, plural } from '../components';
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
  onGo(x: number, y: number): void;
  /** "p:<plan alliance id>" or "e:<game id of an alliance on the map>". */
  onRouteFor(value: string): void;
  /** The point the next click on the map sets, when one was asked for; null: A then B. */
  pickFor: 'a' | 'b' | null;
  onPickFor(t: 'a' | 'b' | null): void;
}

const MODE_TEXT: Record<RouteMode, string> = {
  fewest: 'The chain with the fewest flags, going around anything in the way. Resource points play no part.',
  nodes: 'Still the fewest flags from A to B, on the way that takes in the most resource points. The extra flags then widen it a little (at most 2 flags out from the route) to take in more.',
};

const num = (s: string): number | null => {
  const v = Number(s);
  return s.trim() !== '' && Number.isFinite(v) ? v : null;
};

/** X and Y of a point. What is typed stays in the fields; the point goes to the planner once both are numbers (and is taken back when one is cleared). */
function Coord(props: { label: string; value: [number, number] | null; onChange(v: [number, number] | null): void; color: string; picking: boolean; onPick(): void }) {
  const v = props.value;
  const [xs, setXs] = useState(v ? String(v[0]) : '');
  const [ys, setYs] = useState(v ? String(v[1]) : '');
  const [seen, setSeen] = useState(v);
  if (v !== seen) {                                                // set from outside (a click on the map, Clear): show it
    setSeen(v);
    setXs(v ? String(v[0]) : '');
    setYs(v ? String(v[1]) : '');
  }
  const change = (nx: string, ny: string): void => {
    setXs(nx);
    setYs(ny);
    const x = num(nx);
    const y = num(ny);
    const next: [number, number] | null = x !== null && y !== null ? [x, y] : null;
    if (next ? !v || v[0] !== next[0] || v[1] !== next[1] : v !== null) {
      setSeen(next);                                               // ours: the fields already show it
      props.onChange(next);
    }
  };
  return (
    <div className="rokp-row">
      <span className="rokp-pin" style={{ background: props.color }}>{props.label}</span>
      <input className="rokp-input rokp-num" inputMode="decimal" placeholder="X" aria-label={`${props.label} x`} value={xs} onChange={(e) => change(e.target.value, ys)} />
      <input className="rokp-input rokp-num" inputMode="decimal" placeholder="Y" aria-label={`${props.label} y`} value={ys} onChange={(e) => change(xs, e.target.value)} />
      <button type="button" className={`rokp-ico${props.picking ? ' on' : ''}`} aria-pressed={props.picking} title={`Pick ${props.label} on the map`} onClick={props.onPick}>
        ⌖
      </button>
    </div>
  );
}

export function RoutePanel(p: RoutePanelProps) {
  const { world, options, result } = p;
  const codes = resourceCodes(world);
  const active = p.plan.alliances.find((a) => a.id === p.activeId);
  const ready = !!p.picks.a && !!p.picks.b && !p.busy;
  const objective = p.picks.objectiveId ? world.objectives.find((o) => o.id === p.picks.objectiveId) : undefined;
  // The alliances on the map with a fortress, that no alliance of the plan continues yet: picking one adds it to the plan.
  const continued = new Set(p.plan.alliances.map((a) => a.baseId).filter((x): x is number => x != null));
  const onMap = world.alliances.filter((a) => world.fortAlliances.has(a.index) && !continued.has(a.id)).sort((a, b) => (a.tag || a.name).localeCompare(b.tag || b.name));
  const set = (patch: Partial<RouteOptions>): void => p.onOptions({ ...options, ...patch });
  const preset = (m: RouteMode): void => p.onOptions({ ...PRESETS[m], ignoreOthers: options.ignoreOthers });

  return (
    <Section title="Route from A to B" defaultOpen={p.tool === 'route'} forceOpen={p.tool === 'route'} hint="Finds the flags that carry an alliance's land from A to B. It changes nothing until you press Add to plan.">
      <div className="rokp-row">
        <button
          type="button"
          className={p.tool === 'route' && !p.pickFor ? 'rokp-primary' : ''}
          onClick={() => {
            p.onPickFor(null);
            p.onTool(p.tool === 'route' && !p.pickFor ? 'view' : 'route');
          }}
        >
          {p.tool === 'route' && !p.pickFor ? 'Picking on the map…' : 'Pick A and B on the map'}
        </button>
        {(p.picks.a || p.picks.b) && (
          <button type="button" onClick={() => { p.onPicks({ a: null, b: null }); p.onDiscard(); }}>
            Clear
          </button>
        )}
      </div>
      {p.tool === 'route' && (
        <p className="rokp-hint">
          {p.pickFor === 'a'
            ? 'Click the map for A, the start.'
            : p.pickFor === 'b'
              ? 'Click the map for B. Click a holy site or a pass to aim at it.'
              : !p.picks.a
                ? 'Click the map for A, the start.'
                : !p.picks.b
                  ? 'Now click B, the target. Click a holy site or a pass to aim at it.'
                  : 'Click again to start over.'}
        </p>
      )}
      <Coord label="A" color="#2f9e44" value={p.picks.a} onChange={(v) => p.onPicks({ ...p.picks, a: v })} picking={p.tool === 'route' && p.pickFor === 'a'} onPick={() => { p.onPickFor('a'); p.onTool('route'); }} />
      <Coord label="B" color="#d6336c" value={p.picks.b} onChange={(v) => p.onPicks({ a: p.picks.a, b: v })} picking={p.tool === 'route' && p.pickFor === 'b'} onPick={() => { p.onPickFor('b'); p.onTool('route'); }} />
      {objective && <p className="rokp-hint">B is {objective.name}: the route ends as soon as the land touches it.</p>}
      <div className="rokp-label">Route for</div>
      <div className="rokp-row">
        {active && <span className="rokp-sw" style={{ background: active.color }} />}
        <select className="rokp-select rokp-grow" value={active ? `p:${active.id}` : ''} onChange={(e) => p.onRouteFor(e.target.value)} aria-label="Route for" disabled={p.readOnly}>
          {!active && <option value="">Pick an alliance</option>}
          <optgroup label="This plan">
            {p.plan.alliances.map((a) => (
              <option key={a.id} value={`p:${a.id}`}>
                {a.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="On the map (from its land)">
            {onMap.map((u) => (
              <option key={u.id} value={`e:${u.id}`}>
                {u.tag ? `[${u.tag}] ` : ''}
                {u.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
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
      <div className="rokp-label">Other alliances</div>
      <Seg<'around' | 'ignore'>
        value={options.ignoreOthers ? 'ignore' : 'around'}
        onChange={(v) => set({ ignoreOthers: v === 'ignore' })}
        options={[
          { value: 'around', label: 'Go around them' },
          { value: 'ignore', label: 'Ignore them' },
        ]}
      />
      <p className="rokp-hint">{options.ignoreOthers ? 'Goes as if they were not there, and lists what would have to be removed for the route to stand.' : 'Takes the map as it is: it goes around their land when it has to.'}</p>
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
              {result.removals.length > 0 && (
                <>
                  <div className="rokp-label">To make it possible, remove</div>
                  <RemovalList groups={result.removals} onGo={p.onGo} />
                  <p className="rokp-hint">Marked with a cross on the map. Add to plan assumes they are gone.</p>
                </>
              )}
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
