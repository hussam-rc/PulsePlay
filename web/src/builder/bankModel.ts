// Question-bank management for the no-code builder (Creator slice C3).
// Pure functions over a Draft: they only set the optional bank fields the engine, the server and the publish function
// already understand (bank, category, dimension, active). Content without a bank keeps its previous behaviour.
import type { Activity, Experience } from '../engine/schema';
import { eligible, lengthOptions, defaultLength, selectActivities, estimateMinutes, type Strategy } from '../engine/bank';
import type { Draft } from './model';

export type BalanceBy = 'random' | 'category' | 'dimension';
export const LENGTH_CHOICES = [5, 10, 15, 20, 25, 30] as const;
export const BALANCE_LABEL: Record<BalanceBy, { title: string; blurb: string }> = {
  random: { title: 'Mix them randomly', blurb: 'Any questions, in a new order each game.' },
  category: { title: 'Balance across categories', blurb: 'Each game takes an even share from every category.' },
  dimension: { title: 'Balance across areas', blurb: 'Each game covers every area evenly (for example, the areas of a self-reflection).' },
};

const flat = (d: Pick<Experience, 'rounds'>) => d.rounds.flatMap(r => r.activities);
/** Groups are stored as short tags (a-z, 0-9, hyphen); the builder shows readable names. */
export const toTag = (name: string) => name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
export const tagLabel = (tag: string) => tag.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const key = (b: BalanceBy) => (b === 'dimension' ? 'dimension' : 'category') as 'category' | 'dimension';

export function isBank(d: Pick<Experience, 'bank'>) { return !!d.bank; }
export function balanceOf(d: Pick<Experience, 'bank'>): BalanceBy {
  const s = d.bank?.strategy; return s === 'category' || s === 'dimension' ? s : 'random';
}

/** Turn the bank on with sensible defaults (lengths the content can already fill), or off (every question, authored order). */
export function setBankEnabled(d: Draft, on: boolean): Draft {
  if (!on) { const { bank: _b, ...rest } = d; return rest as Draft; }
  const active = flat(d).filter(a => a.active !== false).length;
  const fit = LENGTH_CHOICES.filter(n => n <= active);
  const lengths = fit.length ? fit.filter(n => n >= 10).slice(0, 3) : [];
  const ls = lengths.length ? lengths : [Math.max(3, Math.min(active, 10))];
  const strategy: Strategy = flat(d).some(a => a.dimension) ? 'dimension' : flat(d).some(a => a.category) ? 'category' : 'random';
  return { ...d, bank: { strategy, lengths: ls, defaultLength: ls[0] } };
}

export function setBalance(d: Draft, b: BalanceBy): Draft { return d.bank ? { ...d, bank: { ...d.bank, strategy: b } } : d; }

/** Toggle a game length; keeps lengths ascending and the default valid. At least one length always remains. */
export function toggleLength(d: Draft, n: number): Draft {
  if (!d.bank) return d;
  const has = d.bank.lengths.includes(n);
  const lengths = (has ? d.bank.lengths.filter(x => x !== n) : [...d.bank.lengths, n]).sort((a, b) => a - b);
  if (!lengths.length) return d;
  const def = d.bank.defaultLength != null && lengths.includes(d.bank.defaultLength) ? d.bank.defaultLength : lengths[0];
  return { ...d, bank: { ...d.bank, lengths: lengths.slice(0, 5), defaultLength: def } };
}
export function setDefaultLength(d: Draft, n: number): Draft {
  return d.bank && d.bank.lengths.includes(n) ? { ...d, bank: { ...d.bank, defaultLength: n } } : d;
}

/** Edit one question by id; returns a new draft. */
function editQ(d: Draft, id: string, f: (a: Activity) => Activity): Draft {
  return { ...d, rounds: d.rounds.map(r => ({ ...r, activities: r.activities.map(a => (a.id === id ? f(a) : a)) })) };
}
/** Archive keeps the question (and its history) but no game will select it. Restoring makes it selectable again. */
export function setArchived(d: Draft, id: string, archived: boolean): Draft {
  return editQ(d, id, a => { const c = { ...a }; if (archived) { c.active = false; delete c.required; } else delete c.active; return c; });
}
/** Assign a group (category or area) by readable name; empty name clears it. */
export function setGroup(d: Draft, id: string, by: BalanceBy, name: string): Draft {
  const k = key(by), tag = toTag(name);
  return editQ(d, id, a => { const c = { ...a }; if (tag) c[k] = tag; else delete c[k]; return c; });
}
/** Rename a group everywhere it is used. Renaming onto an existing group merges the two. */
export function renameGroup(d: Draft, by: BalanceBy, from: string, toName: string): Draft {
  const k = key(by), to = toTag(toName);
  if (!to) return d;
  return { ...d, rounds: d.rounds.map(r => ({ ...r, activities: r.activities.map(a => (a[k] === from ? { ...a, [k]: to } : a)) })) };
}

export interface GroupCount { tag: string; label: string; active: number; archived: number }
export function groups(d: Pick<Experience, 'rounds' | 'insights'>, by: BalanceBy): GroupCount[] {
  const k = key(by), m = new Map<string, GroupCount>();
  for (const a of flat(d)) {
    const t = a[k]; if (!t) continue;
    if (!m.has(t)) m.set(t, { tag: t, label: (by === 'dimension' && d.insights?.themes[t]?.label) || tagLabel(t), active: 0, archived: 0 });
    m.get(t)![a.active === false ? 'archived' : 'active']++;
  }
  return [...m.values()].sort((x, y) => x.label.localeCompare(y.label));
}

export interface Overview {
  total: number; active: number; archived: number; withoutGroup: number;
  lengths: { n: number; available: boolean; minutes: number }[];
  scored: boolean; maxPoints: number[];        // behaviour games: highest score per active question (variable maxima are allowed)
}
export function overview(d: Draft): Overview {
  const acts = flat(d), active = acts.filter(a => a.active !== false);
  const by = balanceOf(d), strategy: Strategy = d.bank?.strategy ?? 'fixed';
  const scored = d.scoring.kind === 'behaviour';
  return {
    total: acts.length, active: active.length, archived: acts.length - active.length,
    withoutGroup: by === 'random' ? 0 : eligible(d, strategy).filter(a => !a[key(by)]).length,
    lengths: lengthOptions(d, strategy).filter(o => !d.bank || d.bank.lengths.includes(o.n)).map(o => ({ n: o.n, available: o.available, minutes: minutes(d, o.n) })),
    scored, maxPoints: scored ? active.map(a => (a.type === 'choice' ? Math.max(...a.options.map(o => o.points ?? 0)) : 0)) : [],
  };
}
const minutes = (d: Draft, n: number) => estimateMinutes({ questions: n, readSec: d.defaultTiming.readSec, answerSec: d.defaultTiming.answerSec,
  reveal: d.reveal, scored: d.scoring.kind === 'behaviour' || d.scoring.kind === 'correct' });

export interface Sample { questions: { id: string; prompt: string; group?: string }[]; groups: Record<string, number>; minutes: number }
/** k example games of length n, as a host would get them (no recency): shows creators what a selection looks like. */
export function previewSelections(d: Draft, n: number, k = 3, seed = 1): Sample[] {
  const strategy: Strategy = d.bank?.strategy ?? 'fixed', by = balanceOf(d);
  if (!lengthOptions(d, strategy).some(o => o.available && o.n === n)) return [];
  const g = groups(d, by), label = (t?: string) => g.find(x => x.tag === t)?.label;
  return Array.from({ length: k }, (_, i) => {
    let s = (seed * 7919 + i * 104729) >>> 0;
    const random = () => ((s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296);
    const picked = selectActivities(d, n, { strategy, random });
    const groupsCount: Record<string, number> = {};
    const qs = picked.map(a => { const t = by === 'random' ? undefined : label(a[key(by)]) ?? 'No group'; if (t) groupsCount[t] = (groupsCount[t] ?? 0) + 1; return { id: a.id, prompt: a.prompt, group: t }; });
    return { questions: qs, groups: groupsCount, minutes: minutes(d, n) };
  });
}

export { defaultLength };
