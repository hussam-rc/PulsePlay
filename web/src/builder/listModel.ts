// Question list tools for large banks (Creator Studio C4a): search, filters and stable edits by question id.
// Pure functions; the builder keeps the draft in the published schema and changes nothing about how games run.
import type { Activity } from '../engine/schema';
import type { Draft } from './model';

/** Case-, accent- and Arabic-diacritic-insensitive form used for search (é→e, أ/إ/آ→ا, ى→ي, ة→ه, no tashkeel or tatweel). */
export function normalize(s: string): string {
  return s.normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')            // Latin accents
    .replace(/[ً-ٰٟـ]/g, '') // Arabic tashkeel, superscript alef, tatweel
    .replace(/[آأإ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Everything a creator might search for in one question: prompt, answers, explanation, scale labels. */
export function searchText(a: Activity): string {
  const parts = [a.prompt];
  if ('options' in a) for (const o of a.options) parts.push(o.text);
  if (a.type === 'choice' && a.explanation) parts.push(a.explanation);
  if (a.type === 'scale') parts.push(a.minLabel, a.maxLabel);
  return normalize(parts.join(' ‖ '));
}

export type StatusFilter = 'all' | 'active' | 'archived' | 'problems';
export interface ListFilter { query: string; group: string; groupKey: 'category' | 'dimension'; status: StatusFilter; type: Activity['type'] | 'all' }
export const NO_FILTER: ListFilter = { query: '', group: '', groupKey: 'category', status: 'all', type: 'all' };
export const NO_GROUP = '__none__';

/** Every search word must appear somewhere in the question (order free). */
export function matches(a: Activity, words: string[], index?: Map<string, string>): boolean {
  if (!words.length) return true;
  const t = index?.get(a.id) ?? searchText(a);
  return words.every(w => t.includes(w));
}

export function filterActivities(acts: Activity[], f: ListFilter, problemIds: Set<string> = new Set(), index?: Map<string, string>): Activity[] {
  const words = normalize(f.query).split(' ').filter(Boolean);
  return acts.filter(a =>
    (f.status === 'all' || (f.status === 'active' && a.active !== false) || (f.status === 'archived' && a.active === false) || (f.status === 'problems' && problemIds.has(a.id))) &&
    (f.type === 'all' || a.type === f.type) &&
    (!f.group || (f.group === NO_GROUP ? !a[f.groupKey] : a[f.groupKey] === f.group)) &&
    matches(a, words, index));
}
export const isFiltered = (f: ListFilter) => !!(f.query.trim() || f.group || f.status !== 'all' || f.type !== 'all');

/** Split text around search hits so the row can highlight them (positions found on the normalised form). */
export function highlight(text: string, query: string): { text: string; hit: boolean }[] {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length || !text) return [{ text, hit: false }];
  // map each original character to its normalised form, so hits can be located in the original string
  const chars = [...text], norm = chars.map(c => normalize(c) || (c === ' ' ? ' ' : ''));
  const flat = norm.join(''), owner: number[] = [];
  norm.forEach((n, i) => { for (let k = 0; k < n.length; k++) owner.push(i); });
  const mark = new Array(chars.length).fill(false);
  for (const w of words) { let p = flat.indexOf(w); while (p >= 0) { for (let k = p; k < p + w.length; k++) mark[owner[k]] = true; p = flat.indexOf(w, p + w.length); } }
  const out: { text: string; hit: boolean }[] = [];
  chars.forEach((c, i) => { const last = out[out.length - 1]; if (last && last.hit === mark[i]) last.text += c; else out.push({ text: c, hit: mark[i] }); });
  return out;
}

/** Problem anchors from the checker ("q-12") to question ids. */
export function problemIdsFrom(anchors: string[], acts: Activity[]): Set<string> {
  const s = new Set<string>();
  for (const a of anchors) { const m = a.match(/^q-(\d+)$/); if (m && acts[+m[1] - 1]) s.add(acts[+m[1] - 1].id); }
  return s;
}

// ---------- stable edits by id (only the changed question is copied) ----------
const activities = (d: Draft) => d.rounds.flatMap(r => r.activities);
function withActs(d: Draft, acts: Activity[]): Draft { return { ...d, rounds: [{ ...d.rounds[0], id: d.rounds[0]?.id ?? 'main', activities: acts }] }; }

export function patchActivity(d: Draft, id: string, f: (a: Activity) => void): Draft {
  return withActs(d, activities(d).map(a => { if (a.id !== id) return a; const c = structuredClone(a); f(c); return c; }));
}
export function replaceActivity(d: Draft, id: string, b: Activity): Draft { return withActs(d, activities(d).map(a => (a.id === id ? b : a))); }
export function moveActivity(d: Draft, id: string, dir: -1 | 1): Draft {
  const xs = [...activities(d)], i = xs.findIndex(a => a.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= xs.length) return d;
  [xs[i], xs[j]] = [xs[j], xs[i]]; return withActs(d, xs);
}
export function duplicateActivity(d: Draft, id: string, newId: string): Draft {
  const xs = [...activities(d)], i = xs.findIndex(a => a.id === id);
  if (i < 0) return d; xs.splice(i + 1, 0, { ...structuredClone(xs[i]), id: newId }); return withActs(d, xs);
}
export function deleteActivity(d: Draft, id: string): Draft { return withActs(d, activities(d).filter(a => a.id !== id)); }
export function appendActivities(d: Draft, add: Activity[], keep: (a: Activity) => boolean = () => true): Draft { return withActs(d, [...activities(d).filter(keep), ...add]); }

/** Short one-line summary of the answers for a collapsed row. */
export function topScore(a: Activity): number | null { return a.type === 'choice' && a.options.some(o => o.points != null) ? Math.max(...a.options.map(o => o.points ?? 0)) : null; }
