'use client';

import { useMemo, useState } from 'react';
import { existingColor } from '../../core/colors';
import type { ObjectiveType } from '../../core/types';
import type { World } from '../../core/world';
import { Check, ResIcon, Section, cap } from '../components';
import type { ExtraLayer, Filters, Layers } from '../model';

export interface FiltersPanelProps {
  world: World;
  layers: Layers;
  onLayers(next: Layers): void;
  maskOpacity: number;
  onMaskOpacity(v: number): void;
  backgroundOpacity: number;
  onBackgroundOpacity(v: number): void;
  hasBackground: boolean;
  filters: Filters;
  onFilters(next: Filters): void;
  extra: ExtraLayer[];
  extraOn: Record<string, boolean>;
  onExtraOn(next: Record<string, boolean>): void;
  wallJumps: { on: boolean; inner: boolean; cf: boolean; count: number | null; cfCount: number | null; onToggle(v: boolean): void; onInner(v: boolean): void; onCf(v: boolean): void };
}

const CODES = [1, 2, 3, 4];
const OBJ_TYPES: ObjectiveType[] = ['temple', 'shrine', 'altar', 'pass'];
const OBJ_NAME: Record<ObjectiveType, [string, string]> = {
  temple: ['Lost Temple', 'Lost Temples'],
  shrine: ['shrine', 'shrines'],
  altar: ['altar', 'altars'],
  pass: ['pass', 'passes'],
};

export function FiltersPanel(p: FiltersPanelProps) {
  const { world, filters } = p;
  const [query, setQuery] = useState('');
  const set = <K extends keyof Layers>(k: K) => (v: boolean) => p.onLayers({ ...p.layers, [k]: v });

  const owned = useMemo(() => {
    const c = new Map<number, number>();
    for (const b of world.buildings) c.set(b.ai, (c.get(b.ai) ?? 0) + 1);
    return c;
  }, [world]);
  // What each alliance holds: the resource points inside its land, by kind, and its holy sites and passes.
  const holdings = useMemo(() => {
    const nodes = new Map<number, Record<number, number>>();
    const sites = new Map<number, Partial<Record<ObjectiveType, number>>>();
    for (const pt of world.points) {
      const ai = world.owner.get(pt.cell);
      if (ai === undefined) continue;
      const r = nodes.get(ai) ?? {};
      r[pt.res] = (r[pt.res] ?? 0) + 1;
      nodes.set(ai, r);
    }
    for (const o of world.objectives) {
      if (o.ai < 0) continue;
      const r = sites.get(o.ai) ?? {};
      r[o.type] = (r[o.type] ?? 0) + 1;
      sites.set(o.ai, r);
    }
    return { nodes, sites };
  }, [world]);
  // the ones on the map: with buildings or holy sites (none on an empty kingdom)
  const holders = useMemo(() => world.alliances.filter((a) => owned.has(a.index) || holdings.sites.has(a.index)), [world, owned, holdings]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return holders
      .filter((a) => !q || a.tag.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
      .sort((a, b) => (owned.get(b.index) ?? 0) - (owned.get(a.index) ?? 0) || a.tag.localeCompare(b.tag));
  }, [holders, query, owned]);

  const resCodes = CODES.filter((c) => world.resources[c]);
  const toggleAlliance = (i: number): void => {
    const next = new Set(filters.hiddenExisting);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    p.onFilters({ ...filters, hiddenExisting: next });
  };

  return (
    <>
      <Section title="Layers" defaultOpen>
        {p.hasBackground && (
          <>
            <Check checked={p.layers.background} onChange={set('background')} label="Map picture" />
            {p.layers.background && (
              <label className="rokp-slider">
                <span>Picture</span>
                <input type="range" min={0} max={100} value={Math.round(p.backgroundOpacity * 100)} onChange={(e) => p.onBackgroundOpacity(Number(e.target.value) / 100)} />
                <span>{Math.round(p.backgroundOpacity * 100)}%</span>
              </label>
            )}
          </>
        )}
        <Check checked={p.layers.mask} onChange={set('mask')} label="Red zones" hint="Where a building cannot go: mountains, lakes, walls. Drawn for the building you are placing." />
        {p.layers.mask && (
          <label className="rokp-slider">
            <span>Opacity</span>
            <input type="range" min={0} max={100} value={Math.round(p.maskOpacity * 100)} onChange={(e) => p.onMaskOpacity(Number(e.target.value) / 100)} />
            <span>{Math.round(p.maskOpacity * 100)}%</span>
          </label>
        )}
        <Check checked={p.layers.land} onChange={set('land')} label="Land of the alliances" />
        <Check checked={p.layers.buildings} onChange={set('buildings')} label="Their flags and CFs" />
        <Check checked={p.layers.objectives} onChange={set('objectives')} label="Holy sites and passes" />
        <Check checked={p.layers.points} onChange={set('points')} label="Resource points" />
        <Check checked={p.layers.cities} onChange={set('cities')} label="Cities" hint="Positions only. They refuse buildings." />
        {p.extra
          .filter((l) => !l.alwaysOn)
          .map((l) => (
            <Check key={l.id} checked={p.extraOn[l.id] !== false} onChange={(v) => p.onExtraOn({ ...p.extraOn, [l.id]: v })} label={l.label} />
          ))}
        <Check
          checked={p.wallJumps.on}
          onChange={p.wallJumps.onToggle}
          label={`Wall jumps${p.wallJumps.count !== null ? ` (${p.wallJumps.count})` : ''}`}
          hint="Where two flags on opposite sides of a wall have land that touches, so the wall can be crossed without a pass."
        />
        {p.wallJumps.on && (
          <>
            <Check
              checked={p.wallJumps.cf}
              onChange={p.wallJumps.onCf}
              label={`With a CF + flag${p.wallJumps.cfCount !== null ? ` (${p.wallJumps.cfCount})` : ''}`}
              hint="Where two flags are too far apart, but a CF on one side reaches: its square is bigger."
            />
            <Check checked={p.wallJumps.inner} onChange={p.wallJumps.onInner} label="Also ridges inside a zone" />
          </>
        )}
      </Section>

      <Section title="Alliances on the map" defaultOpen={false} count={holders.filter((a) => !filters.hiddenExisting.has(a.index)).length}>
        {holders.length === 0 && <p className="rokp-hint">Nobody: this plan is on an empty kingdom.</p>}
        <input className="rokp-input" placeholder="Search a tag or name" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search alliances" />
        <div className="rokp-row rokp-wrap">
          <button type="button" onClick={() => p.onFilters({ ...filters, hiddenExisting: new Set() })}>All</button>
          <button type="button" onClick={() => p.onFilters({ ...filters, hiddenExisting: new Set(holders.map((a) => a.index)) })}>None</button>
          <button
            type="button"
            title="Hide the alliances in the list below"
            onClick={() => {
              const next = new Set(filters.hiddenExisting);
              list.forEach((a) => next.add(a.index));
              p.onFilters({ ...filters, hiddenExisting: next });
            }}
          >
            Hide these
          </button>
        </div>
        <ul className="rokp-list rokp-scroll">
          {list.map((a) => {
            const nodes = holdings.nodes.get(a.index) ?? {};
            const sites = holdings.sites.get(a.index) ?? {};
            return (
              <li key={a.index}>
                <Check
                  checked={!filters.hiddenExisting.has(a.index)}
                  onChange={() => toggleAlliance(a.index)}
                  swatch={existingColor(a.id)}
                  label={a.tag ? `[${a.tag}] ${a.name}` : a.name || `Alliance ${a.id}`}
                  hint={
                    <span className="rokp-own">
                      <span>{owned.get(a.index) ?? 0} buildings</span>
                      {resCodes
                        .filter((c) => nodes[c])
                        .map((c) => (
                          <span key={c} title={`${cap(world.resources[c])} points in its land`}>
                            <ResIcon name={world.resources[c]} code={c} size={13} />
                            {nodes[c]}
                          </span>
                        ))}
                      {OBJ_TYPES.filter((t) => sites[t]).map((t) => (
                        <span key={t}>
                          {sites[t]} {OBJ_NAME[t][sites[t] === 1 ? 0 : 1]}
                        </span>
                      ))}
                    </span>
                  }
                />
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}
