'use client';

import { useState } from 'react';
import { LIMITS, addAlliance, clearAlliance, removeAlliance, updateAlliance } from '../../core/plan';
import type { PlanDoc } from '../../core/plan';
import type { PlanState } from '../../core/state';
import type { World } from '../../core/world';
import { Section, plural } from '../components';

export interface AlliancesPanelProps {
  world: World;
  plan: PlanDoc;
  state: PlanState;
  activeId: string;
  readOnly: boolean;
  hidden: ReadonlySet<string>;
  onActive(id: string): void;
  onToggleHidden(id: string): void;
  onChange(next: PlanDoc): void;
  onAdded(id: string): void;
  onError(text: string): void;
}

function NameField(props: { value: string; disabled: boolean; onCommit(v: string): void }) {
  const [v, setV] = useState(props.value);
  const [seen, setSeen] = useState(props.value);
  if (props.value !== seen) {                                       // the name changed from outside (undo, another plan): show it
    setSeen(props.value);
    setV(props.value);
  }
  return (
    <input
      className="rokp-input rokp-grow"
      value={v}
      disabled={props.disabled}
      maxLength={60}
      aria-label="Alliance name"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => (v.trim() && v !== props.value ? props.onCommit(v) : setV(props.value))}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function AlliancesPanel(p: AlliancesPanelProps) {
  const { plan, state, world } = p;
  const usable = world.alliances.filter((a) => world.fortAlliances.has(a.index)).sort((a, b) => (a.tag || a.name).localeCompare(b.tag || b.name));
  const taken = new Set(plan.alliances.map((a) => a.baseId).filter((x): x is number => x != null));
  return (
    <Section title="Alliances of this plan" count={plan.alliances.length} hint="Pick the alliance you are placing for (the round button), then click the map. Right click a building to delete it.">
      <ul className="rokp-alliances">
        {plan.alliances.map((a) => {
          const s = state.byAlliance.get(a.id);
          const cls = ['rokp-ally', p.activeId === a.id ? 'on' : '', p.hidden.has(a.id) ? 'dim' : ''].join(' ');
          return (
            <li key={a.id} className={cls} style={{ borderLeftColor: a.color }}>
              <div className="rokp-row">
                <input type="radio" name="rokp-active" checked={p.activeId === a.id} onChange={() => p.onActive(a.id)} title="Place buildings for this alliance" aria-label={`Place for ${a.name}`} />
                <input type="color" value={a.color} disabled={p.readOnly} className="rokp-color" aria-label="Colour" onChange={(e) => p.onChange(updateAlliance(plan, a.id, { color: e.target.value }))} />
                <NameField value={a.name} disabled={p.readOnly} onCommit={(name) => p.onChange(updateAlliance(plan, a.id, { name }))} />
                <button type="button" className="rokp-ico" title={p.hidden.has(a.id) ? 'Show on the map' : 'Hide from the map'} onClick={() => p.onToggleHidden(a.id)}>
                  {p.hidden.has(a.id) ? '◌' : '◉'}
                </button>
                {!p.readOnly && plan.alliances.length > 1 && (
                  <button
                    type="button"
                    className="rokp-ico"
                    title="Remove this alliance and what it placed"
                    onClick={() => {
                      if (!s?.cf && !s?.flags) p.onChange(removeAlliance(plan, a.id));
                      else if (window.confirm(`Remove ${a.name} and its ${plural((s?.cf ?? 0) + (s?.flags ?? 0), 'building')}? (You can undo it.)`)) p.onChange(removeAlliance(plan, a.id));
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="rokp-sub">
                {s ? `${plural(s.cf, 'CF', 'CFs')} · ${plural(s.flags, 'flag')}${s.inactive ? ` (${s.inactive} not connected)` : ''} · ${s.fresh.size * 9} new tiles` : ''}
                {s && s.captured.length > 0 && ` · reaches ${s.captured.map((o) => o.name).join(', ')}`}
              </div>
              {!p.readOnly && (
                <div className="rokp-row rokp-wrap">
                  <select
                    className="rokp-select rokp-grow"
                    value={a.baseId ?? ''}
                    aria-label="Continue an existing alliance"
                    onChange={(e) => p.onChange(updateAlliance(plan, a.id, { baseId: e.target.value ? Number(e.target.value) : null }))}
                    title="Start from the land and fortresses of an alliance that exists now"
                  >
                    <option value="">A new alliance (starts with a CF)</option>
                    {usable.map((u) => (
                      <option key={u.id} value={u.id} disabled={taken.has(u.id) && a.baseId !== u.id}>
                        Continue {u.tag ? `[${u.tag}] ` : ''}{u.name}
                      </option>
                    ))}
                  </select>
                  {(s?.cf || s?.flags) ? (
                    <button type="button" onClick={() => p.onChange(clearAlliance(plan, a.id))} title="Delete everything this alliance placed">
                      Clear
                    </button>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!p.readOnly && (
        <button
          type="button"
          className="rokp-primary"
          onClick={() => {
            try {
              const r = addAlliance(plan);
              p.onChange(r.plan);
              p.onAdded(r.alliance.id);
            } catch (e) {
              p.onError((e as Error).message);
            }
          }}
          disabled={plan.alliances.length >= LIMITS.alliances}
        >
          + Add alliance
        </button>
      )}
    </Section>
  );
}
