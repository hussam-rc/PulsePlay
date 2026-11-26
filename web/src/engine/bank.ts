// Question banks: which questions a session plays. Generic (no game-specific rules), deterministic given a random source.
// The live server (pp._bank_select in SQL) implements the same rules and is authoritative for live rooms;
// this copy powers solo play, previews and the host's setup screen. Tests hold both to the same invariants.
import type { Experience, Activity } from './schema';
import { flatActivities } from './util';
import { rng as seeded, hash } from './random';

export type Strategy = 'fixed' | 'random' | 'category' | 'dimension';
export const STANDARD_LENGTHS = [10, 15, 20] as const;

/** Questions a strategy may pick from: active ones; random strategies also skip questions marked random:false. */
export function eligible(e: Pick<Experience, 'rounds'>, strategy: Strategy): Activity[] {
  return flatActivities(e).filter(a => a.active !== false && (strategy === 'fixed' || a.random !== false));
}

export function strategyOf(e: Pick<Experience, 'bank'>): Strategy { return e.bank?.strategy ?? 'fixed'; }

/** Strategies a host may choose: the game's own, plus random order and fixed (authored) order. */
export function strategiesFor(e: Pick<Experience, 'bank'>): Strategy[] {
  const own = strategyOf(e);
  return own === 'fixed' || own === 'random' ? ['fixed', 'random'] : [own, 'random', 'fixed'];
}

export interface LengthOption { n: number; available: boolean; all: boolean; missing: number }

/**
 * Game lengths for the host. Configured lengths (default 10/15/20) are offered only when enough eligible questions exist;
 * content without a bank also offers "all N" (its previous behaviour). Questions are never duplicated to reach a length.
 */
export function lengthOptions(e: Pick<Experience, 'rounds' | 'bank'>, strategy: Strategy = strategyOf(e)): LengthOption[] {
  const pool = eligible(e, strategy).length;
  const base: number[] = e.bank ? [...e.bank.lengths] : [...STANDARD_LENGTHS];
  const opts: LengthOption[] = base.map(n => ({ n, available: n <= pool, all: n === pool, missing: Math.max(0, n - pool) }));
  if ((!e.bank || !opts.some(o => o.available)) && pool > 0 && !base.includes(pool))
    opts.push({ n: pool, available: true, all: true, missing: 0 });
  return opts.sort((a, b) => a.n - b.n);
}

export function defaultLength(e: Pick<Experience, 'rounds' | 'bank'>, strategy: Strategy = strategyOf(e)): number {
  const av = lengthOptions(e, strategy).filter(o => o.available);
  if (!av.length) return 0;
  if (!e.bank) return av[av.length - 1].n; // no bank: every question, as before
  const d = e.bank.defaultLength;
  return d != null && av.some(o => o.n === d) ? d : av[0].n;
}

/** Recently used question ids → recency (higher = used more recently). Unseen questions are preferred. */
export type Recency = Record<string, number>;

/** Build a Recency map from recent selections, most recent first (e.g. the host's last sessions). */
export function recencyFrom(recent: string[][]): Recency {
  const r: Recency = {};
  recent.forEach((ids, k) => ids.forEach(id => { if (!(id in r)) r[id] = recent.length - k; }));
  return r;
}

export interface SelectOptions { strategy?: Strategy; recency?: Recency; random?: () => number }

const groupKey = (a: Activity, s: Strategy) => (s === 'category' ? a.category : s === 'dimension' ? a.dimension : undefined) ?? '_';

/**
 * Pick `n` questions and their play order.
 * - fixed: required first, then authored order; played in authored order.
 * - random: required first, then least recently used, ties random; played in random order.
 * - category / dimension: as even as possible across groups (round-robin, required count toward their group),
 *   least recently used first within a group; played interleaved so consecutive questions vary.
 * Throws when n is not a valid length for this content.
 */
export function selectActivities(e: Pick<Experience, 'rounds' | 'bank'>, n: number, o: SelectOptions = {}): Activity[] {
  const strategy = o.strategy ?? strategyOf(e), rec = o.recency ?? {}, rnd = o.random ?? Math.random;
  if (!lengthOptions(e, strategy).some(x => x.available && x.n === n)) throw new Error(`${n} questions is not available for this game`);
  const pool = eligible(e, strategy);
  const req = pool.filter(a => a.required);
  if (req.length > n) throw new Error('more required questions than the game length');

  if (strategy === 'fixed') {
    const picked = new Set([...req, ...pool.filter(a => !a.required)].slice(0, n).map(a => a.id));
    return pool.filter(a => picked.has(a.id));
  }
  const tie = new Map(pool.map(a => [a.id, rnd()]));
  const fresh = (a: Activity, b: Activity) => (rec[a.id] ?? -1) - (rec[b.id] ?? -1) || tie.get(a.id)! - tie.get(b.id)!;

  if (strategy === 'random') {
    const picked = [...req, ...pool.filter(a => !a.required).sort(fresh)].slice(0, n);
    return picked.map(a => ({ a, k: rnd() })).sort((x, y) => x.k - y.k).map(x => x.a);
  }

  // Balanced: each group ranks its own questions (required first), then picks go round-robin by rank, groups in random order.
  const groups = new Map<string, Activity[]>();
  for (const a of pool) { const g = groupKey(a, strategy); if (!groups.has(g)) groups.set(g, []); groups.get(g)!.push(a); }
  const gOrder = new Map([...groups.keys()].map(g => [g, rnd()]));
  const ranked: { a: Activity; g: string; rank: number; req: boolean }[] = [];
  for (const [g, as] of groups) {
    const r = as.filter(a => a.required), rest = as.filter(a => !a.required).sort(fresh);
    [...r, ...rest].forEach((a, i) => ranked.push({ a, g, rank: i, req: !!a.required }));
  }
  const byPick = (x: typeof ranked[0], y: typeof ranked[0]) => x.rank - y.rank || gOrder.get(x.g)! - gOrder.get(y.g)!;
  const reqRanked = ranked.filter(x => x.req), rest = ranked.filter(x => !x.req).sort(byPick);
  // Required questions sit at the top of their group, so groups holding them are already "ahead" and fill later.
  const picked = [...reqRanked, ...rest].slice(0, n);
  return picked.sort(byPick).map(x => x.a);
}

/** The snapshot a session plays: same content, rounds narrowed to the selection, plus a record of what was chosen. */
export function applySelection<E extends Experience>(e: E, picked: Activity[], strategy: Strategy): E {
  const order = new Map(picked.map((a, i) => [a.id, i]));
  const multi = e.rounds.length > 1;
  const rounds = multi
    ? e.rounds.map(r => ({ ...r, activities: r.activities.filter(a => order.has(a.id)).sort((x, y) => order.get(x.id)! - order.get(y.id)!) })).filter(r => r.activities.length)
    : [{ ...e.rounds[0], activities: picked }];
  return { ...e, rounds, selection: { strategy, count: picked.length, bankSize: eligible(e, strategy).length, ids: picked.map(a => a.id) } };
}

/** Convenience for solo and preview: default length and strategy, optional seed for a reproducible preview. */
export function sessionExperience<E extends Experience>(e: E, opts: { n?: number; strategy?: Strategy; seed?: string; recency?: Recency } = {}): E {
  const strategy = opts.strategy ?? strategyOf(e), n = opts.n ?? defaultLength(e, strategy);
  if (!n) return e;
  const random = opts.seed != null ? seeded(hash(opts.seed)) : undefined;
  return applySelection(e, selectActivities(e, n, { strategy, recency: opts.recency, random }), strategy);
}

export interface DurationInput { questions: number; readSec: number; answerSec: number; reveal: Experience['reveal']; scored: boolean; autoAdvanceSec?: number }

/**
 * Estimated playing time in seconds, from the actual settings: per question read + answer + reveal/transition,
 * plus intro and results. Joining time is not included. Allowances are deliberately round numbers.
 */
export function estimateSeconds(d: DurationInput): number {
  const between = d.reveal === 'none' ? (d.autoAdvanceSec ?? 5) : (d.autoAdvanceSec ?? 10); // host taps "next" when not automatic
  const perQ = d.readSec + d.answerSec + between;
  const intro = 60, results = d.scored ? 150 : 90;
  return d.questions * perQ + intro + results;
}

export const estimateMinutes = (d: DurationInput) => Math.max(1, Math.round(estimateSeconds(d) / 60));
