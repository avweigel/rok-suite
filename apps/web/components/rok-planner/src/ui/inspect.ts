// What is at a spot of the map: the card shown when the user clicks in "look" mode. Pure: no DOM.
import type { PlanDoc } from '../core/plan';
import type { PlanState } from '../core/state';
import { allianceLabel } from '../core/world';
import type { World } from '../core/world';

export interface Card {
  x: number;
  y: number;
  title: string;
  lines: string[];
}

const BUILDING_NAME = ['Flag', 'Fortress (CF)', 'Fortress (CF)', 'Resource centre'];

/** The nearest thing within `reach` tiles of (x, y): a building or objective of the map, a resource point, a building of the plan. null when there is nothing. */
export function describeAt(world: World, plan: PlanDoc, state: PlanState, x: number, y: number, reach: number): Card | null {
  const hits: { d: number; card: Card }[] = [];
  const offer = (d: number, card: Card): void => {
    if (d <= reach) hits.push({ d, card });
  };
  for (const it of plan.items) {
    const a = plan.alliances.find((q) => q.id === it.a);
    const on = state.byAlliance.get(it.a)?.active.get(it.id) !== false;
    offer(Math.hypot(it.x - x, it.y - y) - 0.2, {
      x: it.x, y: it.y, title: `${it.k === 'cf' ? 'Planned CF' : 'Planned flag'} · ${a?.name ?? ''}`,
      lines: [`at ${it.x}, ${it.y}`, on ? 'counts toward the land' : 'does not count: it does not border land that reaches a CF'],
    });
  }
  for (const o of world.objectives) {
    const by = state.capturedBy.get(o.id);
    const planName = by ? plan.alliances.find((q) => q.id === by)?.name : undefined;
    offer(Math.hypot(o.x - x, o.y - y), {
      x: o.x, y: o.y, title: o.name,
      lines: [`at ${o.x}, ${o.y}`, o.ai >= 0 ? `owned by ${allianceLabel(world, o.ai)}` : planName ? `captured by ${planName} in the plan` : 'nobody owns it', 'its land is 5 x 5 cells around it'],
    });
  }
  for (const p of world.points) {
    const res = world.resources[p.res] ?? `code ${p.res}`;
    const inPlan = state.claimed.get(p.cell);
    const planName = inPlan ? plan.alliances.find((q) => q.id === inPlan)?.name : undefined;
    const ex = world.owner.get(p.cell);
    offer(Math.hypot(p.x - x, p.y - y), {
      x: p.x, y: p.y, title: `${res[0].toUpperCase()}${res.slice(1)} point`,
      lines: [`at ${p.x}, ${p.y}`, planName ? `inside the plan's land (${planName})` : ex !== undefined ? `inside the land of ${allianceLabel(world, ex)}` : 'in nobody\'s land: an alliance can still take it'],
    });
  }
  for (const b of world.buildings) {
    offer(Math.hypot(b.x - x, b.y - y), {
      x: b.x, y: b.y, title: `${BUILDING_NAME[b.kind]} · ${allianceLabel(world, b.ai)}`,
      lines: [`at ${b.x}, ${b.y}`, world.alliances[b.ai].name ? world.alliances[b.ai].name : ''].filter(Boolean),
    });
  }
  hits.sort((a, b) => a.d - b.d);
  return hits.length ? hits[0].card : null;
}
