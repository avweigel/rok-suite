'use client';

// What the plan assumes gone from the map, and the way to bring it back.
import { useMemo } from 'react';
import type { PlanDoc } from '../../core/plan';
import { describeRemovals } from '../../core/removal';
import type { World } from '../../core/world';
import { RemovalList, Section } from '../components';

export function RemovedPanel(p: { baseWorld: World; plan: PlanDoc; readOnly: boolean; onGo(x: number, y: number): void; onRestore(list?: [number, number][]): void }) {
  const removed = p.plan.removed;
  const groups = useMemo(() => describeRemovals(p.baseWorld, removed ?? []), [p.baseWorld, removed]);
  if (!removed?.length) return null;
  return (
    <Section title="Assumed removed" count={removed.length} hint="Buildings of other alliances this plan assumes gone: the map, the rules and the routes treat them as not there.">
      <RemovalList
        groups={groups}
        onGo={p.onGo}
        onRestore={
          p.readOnly
            ? undefined
            : (g) => p.onRestore([...g.cfs, ...g.flags, ...g.centres, ...g.sites.map((s): [number, number] => [s.x, s.y])])
        }
      />
      {!p.readOnly && (
        <button type="button" onClick={() => p.onRestore()} title="Put everything back. Buildings of the plan that stand on their land stop counting">
          Bring all back
        </button>
      )}
    </Section>
  );
}
