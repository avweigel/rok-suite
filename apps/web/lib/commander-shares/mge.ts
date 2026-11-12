// "Sort out MGE" (Davide, 2026-11-12): for an MGE of one category, who should take which rank so that the sculptures complete
// a rally or garrison pair. Mostly the missing heads to 5555, then the gear for that unit (the rally / garrison rating).
// Only shared commanders are known: a pair with a commander the player never shared cannot be counted (the player is asked to share it).

import type { ShareRow } from './data';
import { compareRating, type Rating } from './rating';

export type MgeCategory = 'infantry' | 'cavalry' | 'archer';
export const MGE_CATEGORIES: readonly MgeCategory[] = ['infantry', 'cavalry', 'archer'];
export const MGE_CATEGORY_NAME: Record<MgeCategory, string> = { infantry: 'Infantry', cavalry: 'Cavalry', archer: 'Archer' };

/** Sculptures by MGE rank: 1st 180, 2nd 90, 3rd 60, 4th 50, 5th 40, 6th 30, 7th–10th 20 each. */
export const MGE_REWARDS: readonly number[] = [180, 90, 60, 50, 40, 30, 20, 20, 20, 20];

type Hero = { id: number; name: string };
const H = {
  gorgo: { id: 184, name: 'Gorgo' },
  tokugawa: { id: 503, name: 'Tokugawa Ieyasu' },
  hector: { id: 576, name: 'Hector' },
  selim: { id: 622, name: 'Selim I' },
  scipio: { id: 197, name: 'Scipio Aemilianus' },
  ivar: { id: 596, name: 'Ivar' },
  attila: { id: 103, name: 'Attila' },
  david: { id: 578, name: 'David IV' },
  subutai: { id: 539, name: 'Subutai' },
  achilles: { id: 575, name: 'Achilles' },
  marshal: { id: 620, name: 'William Marshal' },
  hayam: { id: 612, name: 'Hayam Wuruk' },
  heraclius: { id: 177, name: 'Heraclius' },
  shapur: { id: 506, name: 'Shapur I' },
  ashur: { id: 186, name: 'Ashurbanipal' },
} satisfies Record<string, Hero>;

export type PairKind = 'garrison' | 'rally';
export type PairDef = { kind: PairKind; heroes: [Hero, Hero] };

/** The pairs that count as a complete garrison / rally, per MGE category (his list, 2026-11-12). Ids from the game data. */
export const MGE_PAIRS: Record<MgeCategory, PairDef[]> = {
  infantry: [
    { kind: 'garrison', heroes: [H.gorgo, H.tokugawa] },
    { kind: 'garrison', heroes: [H.gorgo, H.hector] },
    { kind: 'garrison', heroes: [H.selim, H.gorgo] },
    { kind: 'garrison', heroes: [H.selim, H.tokugawa] },
    { kind: 'rally', heroes: [H.scipio, H.ivar] },
  ],
  cavalry: [
    { kind: 'garrison', heroes: [H.attila, H.david] },
    { kind: 'garrison', heroes: [H.david, H.hector] },
    { kind: 'rally', heroes: [H.attila, H.subutai] },
    { kind: 'rally', heroes: [H.attila, H.achilles] },
    { kind: 'rally', heroes: [H.subutai, H.achilles] },
    { kind: 'rally', heroes: [H.marshal, H.subutai] },
  ],
  archer: [
    { kind: 'garrison', heroes: [H.hayam, H.heraclius] },
    { kind: 'garrison', heroes: [H.hayam, H.hector] },
    { kind: 'rally', heroes: [H.shapur, H.ashur] },
  ],
};

/** One commander of a pair for one player: missing heads to 5555, or null when the player has not shared it. */
export type HeroState = { id: number; name: string; missing: number | null; kind: string };
export type PairState = { kind: PairKind; heroes: [HeroState, HeroState]; missing: number | null };

export type MgePlayer = {
  pid: number;
  player: string;
  garrison: PairState | null;
  rally: PairState | null;
  /** The incomplete pair closest to complete (both commanders shared), and its missing heads. */
  target: PairState | null;
  need: number | null;
  /** The player's best card for this unit (the rally / garrison rating), if any. */
  gear: Rating | null;
  rank?: number;
  reward?: number;
};

export type MgeResult = {
  category: MgeCategory;
  /** Ranks 1..10 in order; null = nobody needs that rank. */
  ranks: (MgePlayer | null)[];
  /** Still missing heads, no rank left for them. */
  waiting: MgePlayer[];
  /** Already have a complete garrison or rally of this category, and nothing else known to complete. */
  complete: MgePlayer[];
  /** Have some of these commanders but not a whole pair shared: they need to share the rest. */
  unknown: MgePlayer[];
};

const pairName = (p: { heroes: [{ name: string }, { name: string }] }) => `${p.heroes[0].name} + ${p.heroes[1].name}`;
export { pairName };

/** The players' cards → the MGE ranks for one category. */
export function sortOutMge(rows: ShareRow[], ratings: Map<string, { rating: Rating }>, category: MgeCategory): MgeResult {
  const pairs = MGE_PAIRS[category];
  const ids = new Set(pairs.flatMap((p) => p.heroes.map((h) => h.id)));

  const byPid = new Map<number, ShareRow[]>();
  for (const r of rows) {
    const list = byPid.get(r.pid);
    if (list) list.push(r);
    else byPid.set(r.pid, [r]);
  }

  const players: MgePlayer[] = [];
  for (const [pid, cards] of byPid) {
    if (!cards.some((c) => ids.has(c.hero_id))) continue;                      // nothing of this category's pairs
    const latest = [...cards].sort((a, b) => Date.parse(b.shared_at) - Date.parse(a.shared_at))[0];
    const heroCard = new Map(cards.map((c) => [c.hero_id, c]));

    const states: PairState[] = pairs.map((p) => {
      const heroes = p.heroes.map((h): HeroState => {
        const card = heroCard.get(h.id);
        const s = card?.record.hero.sculptures_to_5555;
        return { id: h.id, name: h.name, missing: card ? (s?.count ?? 0) : null, kind: s?.kind ?? 'GH' };
      }) as [HeroState, HeroState];
      const known = heroes.every((h) => h.missing !== null);
      return { kind: p.kind, heroes, missing: known ? heroes[0].missing! + heroes[1].missing! : null };
    });
    // Best of each kind: the known pair with the fewest heads missing; else the one with the most commanders shared.
    const best = (kind: PairKind): PairState | null => {
      const of = states.filter((s) => s.kind === kind);
      const known = of.filter((s) => s.missing !== null).sort((a, b) => a.missing! - b.missing!);
      if (known.length) return known[0];
      const shared = (s: PairState) => s.heroes.filter((h) => h.missing !== null).length;
      return of.filter((s) => shared(s) > 0).sort((a, b) => shared(b) - shared(a))[0] ?? null;
    };
    const garrison = best('garrison');
    const rally = best('rally');
    const open = [garrison, rally].filter((s): s is PairState => !!s && s.missing !== null && s.missing > 0).sort((a, b) => a.missing! - b.missing!);
    const target = open[0] ?? null;

    let gear: Rating | null = null;
    for (const c of cards) {
      const g = ratings.get(c.key)?.rating;
      if (g && g.unit === category && (!gear || compareRating(g, gear) < 0)) gear = g;
    }
    players.push({ pid, player: latest.record.player ?? latest.player ?? '', garrison, rally, target, need: target?.missing ?? null, gear });
  }

  // Closest to complete first; the better gear for this unit between equals.
  const byNeed = (a: MgePlayer, b: MgePlayer) =>
    (a.need ?? Infinity) - (b.need ?? Infinity) || (a.gear && b.gear ? compareRating(a.gear, b.gear) : a.gear ? -1 : b.gear ? 1 : 0) || a.pid - b.pid;
  const candidates = players.filter((p) => p.need !== null && p.need > 0).sort(byNeed);

  // 1. As many completions as possible: each player, closest first, takes the smallest reward that completes the pair.
  const free = MGE_REWARDS.map((reward, i) => ({ reward, i })).sort((a, b) => a.reward - b.reward);
  const given = new Map<number, number>();                                      // pid → index of the rank taken
  const take = (pid: number, slot: { reward: number; i: number }) => {
    given.set(pid, slot.i);
    free.splice(free.indexOf(slot), 1);
  };
  for (const p of candidates) {
    const slot = free.find((f) => f.reward >= p.need!);
    if (slot) take(p.pid, slot);
  }
  // 2. The rewards left: the biggest to whoever is then closest to complete.
  for (const p of candidates) {
    if (!free.length) break;
    if (!given.has(p.pid)) take(p.pid, free[free.length - 1]);
  }

  // Each player on the rank of the reward taken (a rank nobody needs stays free); equal rewards (7th–10th) in order of who is closest.
  const at: (MgePlayer | null)[] = MGE_REWARDS.map(() => null);
  for (const p of candidates) if (given.has(p.pid)) at[given.get(p.pid)!] = p;
  for (const reward of new Set(MGE_REWARDS)) {
    const idx = MGE_REWARDS.map((r, i) => (r === reward ? i : -1)).filter((i) => i >= 0);
    const ps = idx.map((i) => at[i]).filter((p): p is MgePlayer => !!p).sort(byNeed);
    idx.forEach((i, k) => (at[i] = ps[k] ?? null));
  }
  const ranks = at.map((p, i) => (p ? { ...p, rank: i + 1, reward: MGE_REWARDS[i] } : null));

  const complete = players
    .filter((p) => p.need === null && [p.garrison, p.rally].some((s) => s?.missing === 0))
    .sort((a, b) => a.player.localeCompare(b.player));
  const unknown = players.filter((p) => p.need === null && !complete.includes(p)).sort((a, b) => a.player.localeCompare(b.player));
  return { category, ranks, waiting: candidates.filter((p) => !given.has(p.pid)), complete, unknown };
}

/** The commanders a player still has to share for this category's pairs (to be counted). */
export function toShare(p: MgePlayer): string[] {
  const out = new Set<string>();
  for (const s of [p.garrison, p.rally]) if (s && s.missing === null) for (const h of s.heroes) if (h.missing === null) out.add(h.name);
  return [...out];
}

const DIVIDER = '►═════════❂❂❂═════════◄';

/** The RoK mail: the MGE ranks with what each rank completes, then the golden heads still missing. */
export function mgeMail(res: MgeResult): string {
  const cat = MGE_CATEGORY_NAME[res.category].toUpperCase();
  const lines: string[] = [DIVIDER, '', `<b><color=#ff3333>${cat} MGE — RANKING</color></b>`, ''];
  lines.push('Ranks go where the sculptures complete a rally or garrison pair.', '');
  res.ranks.forEach((p, i) => {
    const reward = MGE_REWARDS[i];
    if (!p) {
      lines.push(`<b>${i + 1}.</b> free — ${reward} sculptures`);
      return;
    }
    const t = p.target!;
    const after = Math.max(0, t.missing! - reward);
    lines.push(
      `<b>${i + 1}. ${p.player}</b> — ${reward} sculptures → ${pairName(t)} (${t.kind}): ${t.missing} GH missing${after ? `, ${after} after MGE` : ', <color=#00cc66>complete</color>'}`,
    );
  });
  const still = [...res.ranks.filter((p): p is MgePlayer => !!p), ...res.waiting];
  if (still.length) {
    lines.push('', `<b>GH missing: now → after MGE</b>`);
    for (const p of still) {
      const t = p.target!;
      const left = Math.max(0, t.missing! - (p.reward ?? 0));
      const per = t.heroes.map((h) => `${h.name} ${h.missing}`).join(', ');
      lines.push(`${p.player}: ${pairName(t)} ${t.missing} → ${left ? left : '<color=#00cc66>complete</color>'} (${per})`);
    }
  }
  const share = res.unknown.filter((p) => toShare(p).length);
  if (share.length) {
    lines.push('', `<b>Please share in chat</b>`);
    for (const p of share) lines.push(`${p.player}: ${toShare(p).join(', ')}`);
  }
  lines.push('', DIVIDER);
  return lines.join('\n');
}
