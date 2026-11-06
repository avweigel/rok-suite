'use client';

import { useMemo, useState } from 'react';
import { existingColor } from '../../core/colors';
import type { ObjectiveType } from '../../core/types';
import type { World } from '../../core/world';
import { Check, ResIcon, Section, cap } from '../components';
import { OBJECTIVE_LABEL } from '../model';
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
}

const CODES = [1, 2, 3, 4];
const OBJ_TYPES: ObjectiveType[] = ['temple', 'shrine', 'altar', 'pass'];

export function FiltersPanel(p: FiltersPanelProps) {
  const { world, filters } = p;
  const [query, setQuery] = useState('');
  const set = <K extends keyof Layers>(k: K) => (v: boolean) => p.onLayers({ ...p.layers, [k]: v });

  const counts = useMemo(() => {
    const c: Record<number, number> = {};
    for (const pt of world.points) c[pt.res] = (c[pt.res] ?? 0) + 1;
    return c;
  }, [world]);
  const objCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of world.objectives) c[o.type] = (c[o.type] ?? 0) + 1;
    return c;
  }, [world]);
  const owned = useMemo(() => {
    const c = new Map<number, number>();
    for (const b of world.buildings) c.set(b.ai, (c.get(b.ai) ?? 0) + 1);
    return c;
  }, [world]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return world.alliances
      .filter((a) => !q || a.tag.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
      .sort((a, b) => (owned.get(b.index) ?? 0) - (owned.get(a.index) ?? 0) || a.tag.localeCompare(b.tag));
  }, [world, query, owned]);

  const resCodes = CODES.filter((c) => world.resources[c]);
  const toggleRes = (c: number): void => p.onFilters({ ...filters, res: { ...filters.res, [c]: filters.res[c] === false } });
  const onlyRes = (c: number): void => p.onFilters({ ...filters, res: Object.fromEntries(resCodes.map((k) => [k, k === c])) });
  const toggleObj = (t: ObjectiveType): void => p.onFilters({ ...filters, objectives: { ...filters.objectives, [t]: filters.objectives[t] === false } });
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
        {p.extra.map((l) => (
          <Check key={l.id} checked={p.extraOn[l.id] !== false} onChange={(v) => p.onExtraOn({ ...p.extraOn, [l.id]: v })} label={l.label} />
        ))}
      </Section>

      <Section title="Resource points" defaultOpen={false} hint="The points that feed an alliance's storage (not the gathering nodes of the players).">
        <div className="rokp-chips">
          {resCodes.map((c) => (
            <div key={c} className="rokp-chiprow">
              <button type="button" className={`rokp-chip${filters.res[c] === false ? '' : ' on'}`} onClick={() => toggleRes(c)}>
                <ResIcon name={world.resources[c]} code={c} size={22} />
                <span className="rokp-grow">{cap(world.resources[c])}</span>
                <span className="rokp-n">{counts[c] ?? 0}</span>
              </button>
              <button type="button" className="rokp-only" onClick={() => onlyRes(c)} title="Show only this resource">
                only
              </button>
            </div>
          ))}
        </div>
        <Check checked={filters.pointsFree} onChange={(v) => p.onFilters({ ...filters, pointsFree: v })} label="In nobody's land" hint="An alliance can still take them" />
        <Check checked={filters.pointsTaken} onChange={(v) => p.onFilters({ ...filters, pointsTaken: v })} label="Already inside a land" hint="Of an alliance that exists, or of this plan" />
        <button type="button" onClick={() => p.onFilters({ ...filters, res: {}, pointsFree: true, pointsTaken: true })}>
          Show all
        </button>
      </Section>

      <Section title="Holy sites and passes" defaultOpen={false}>
        <div className="rokp-chips">
          {OBJ_TYPES.filter((t) => objCounts[t]).map((t) => (
            <button key={t} type="button" className={`rokp-chip${filters.objectives[t] === false ? '' : ' on'}`} onClick={() => toggleObj(t)}>
              <span className="rokp-grow">{OBJECTIVE_LABEL[t]}</span>
              <span className="rokp-n">{objCounts[t]}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Alliances on the map" defaultOpen={false} count={world.alliances.length - filters.hiddenExisting.size}>
        <input className="rokp-input" placeholder="Search a tag or name" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search alliances" />
        <div className="rokp-row rokp-wrap">
          <button type="button" onClick={() => p.onFilters({ ...filters, hiddenExisting: new Set() })}>All</button>
          <button type="button" onClick={() => p.onFilters({ ...filters, hiddenExisting: new Set(world.alliances.map((a) => a.index)) })}>None</button>
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
          {list.map((a) => (
            <li key={a.index}>
              <Check
                checked={!filters.hiddenExisting.has(a.index)}
                onChange={() => toggleAlliance(a.index)}
                swatch={existingColor(a.id)}
                label={a.tag ? `[${a.tag}] ${a.name}` : a.name || `Alliance ${a.id}`}
                hint={`${owned.get(a.index) ?? 0} buildings`}
              />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
