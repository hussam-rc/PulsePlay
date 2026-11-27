// Quality and version tracking for question banks (PulsePlay Creator Studio C4c). Pure functions:
// duplicate detection, and the difference between the draft and the latest published version. Nothing is changed in
// published content; the comparison only reads it.
import type { Activity } from '../engine/schema';
import { normalize } from './listModel';

// ---------- duplicates ----------
export type DupKind = 'same' | 'similar' | 'answers';
export interface DupIssue { kind: DupKind; with?: string }
/** Letter pairs of the normalised text: a Dice score of 0.9+ means nearly the same wording (robust to small edits and word order slips). */
function bigrams(k: string) { const m = new Map<string, number>(); for (let i = 0; i < k.length - 1; i++) { const b = k.slice(i, i + 2); m.set(b, (m.get(b) ?? 0) + 1); } return m; }
function dice(x: Map<string, number>, nx: number, y: Map<string, number>, ny: number) { let i = 0; for (const [k, v] of x) i += Math.min(v, y.get(k) ?? 0); return (2 * i) / (nx + ny || 1); }

/**
 * - same: identical question text (ignoring case, accents, punctuation and spacing)
 * - similar: nearly the same wording (Dice similarity of letter pairs 0.9 or more), for questions of 20+ letters
 * - answers: two answers within one question are the same
 * Archived questions count too, so restoring one cannot silently create a duplicate.
 */
// letter pairs are cached per question text, so re-checking 200 questions after a keystroke only re-reads the edited one
const prepCache = new Map<string, { k: string; g: Map<string, number>; n: number }>();
function prep(prompt: string, key: (s: string) => string) {
  let p = prepCache.get(prompt);
  if (!p) { const k = key(prompt); p = { k, g: bigrams(k), n: Math.max(0, k.length - 1) }; if (prepCache.size > 5000) prepCache.clear(); prepCache.set(prompt, p); }
  return p;
}
export function findDuplicates(acts: Activity[]): Map<string, DupIssue[]> {
  const out = new Map<string, DupIssue[]>(), add = (id: string, x: DupIssue) => { const l = out.get(id) ?? []; if (!l.some(y => y.kind === x.kind && y.with === x.with)) l.push(x); out.set(id, l); };
  const key = (s: string) => normalize(s).replace(/[^\p{L}\p{N}]/gu, '');
  const prepared = acts.map(a => ({ a, ...prep(a.prompt, key) })).filter(x => x.k);
  const byKey = new Map<string, string>();
  for (const x of prepared) { const first = byKey.get(x.k); if (first) { add(x.a.id, { kind: 'same', with: first }); add(first, { kind: 'same', with: x.a.id }); } else byKey.set(x.k, x.a.id); }
  for (let i = 0; i < prepared.length; i++) for (let j = i + 1; j < prepared.length; j++) {
    const p = prepared[i], q = prepared[j];
    if (p.k === q.k || p.n < 20 || q.n < 20) continue;
    if (Math.min(p.n, q.n) / Math.max(p.n, q.n) < 0.8) continue;   // cheap length check before comparing
    if (dice(p.g, p.n, q.g, q.n) >= 0.9) { add(p.a.id, { kind: 'similar', with: q.a.id }); add(q.a.id, { kind: 'similar', with: p.a.id }); }
  }
  for (const a of acts) if ('options' in a) { const t = a.options.map(o => key(o.text)).filter(Boolean); if (new Set(t).size < t.length) add(a.id, { kind: 'answers' }); }
  return out;
}

// ---------- draft vs latest published ----------
export type Change = 'new' | 'edited' | 'archived' | 'restored';
export interface VersionDiff { version: number; changes: Map<string, Change>; deleted: { id: string; prompt: string }[]; counts: Record<Change | 'deleted', number>; total: number }

/** Stable comparison of two questions, ignoring the internal version counter and key order. */
const keyCache = new WeakMap<Activity, string>();   // unchanged questions keep their object, so their key is computed once
function contentKey(x: Activity): string {
  let k = keyCache.get(x);
  if (k == null) { const { rev: _r, active: _a, ...rest } = x as Activity & { rev?: number }; k = stable(rest); keyCache.set(x, k); }
  return k;
}
function same(a: Activity, b: Activity): boolean { return contentKey(a) === contentKey(b); }
/** Deep equality that ignores key order and undefined values (published content comes back from the database re-ordered). */
export const stableEqual = (a: unknown, b: unknown) => stable(a) === stable(b);
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).filter(k => (v as Record<string, unknown>)[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

export function diffAgainstPublished(draft: Activity[], published: Activity[] | null, version: number): VersionDiff | null {
  if (!published) return null;
  const pub = new Map(published.map(a => [a.id, a])), changes = new Map<string, Change>();
  for (const a of draft) {
    const p = pub.get(a.id);
    if (!p) { changes.set(a.id, 'new'); continue; }
    const wasActive = p.active !== false, isActive = a.active !== false;
    if (!same(a, p)) changes.set(a.id, 'edited');
    else if (wasActive && !isActive) changes.set(a.id, 'archived');
    else if (!wasActive && isActive) changes.set(a.id, 'restored');
  }
  const ids = new Set(draft.map(a => a.id));
  const deleted = published.filter(a => !ids.has(a.id)).map(a => ({ id: a.id, prompt: a.prompt }));
  const counts = { new: 0, edited: 0, archived: 0, restored: 0, deleted: deleted.length };
  for (const c of changes.values()) counts[c]++;
  return { version, changes, deleted, counts, total: changes.size + deleted.length };
}

export const CHANGE_LABEL: Record<Change, string> = { new: 'New', edited: 'Edited', archived: 'Archived', restored: 'Restored' };
export function summaryText(d: VersionDiff): string {
  if (!d.total) return `No changes since version ${d.version}.`;
  const parts = ([['new', 'new'], ['edited', 'edited'], ['archived', 'archived'], ['restored', 'restored'], ['deleted', 'deleted']] as const)
    .filter(([k]) => d.counts[k]).map(([k, w]) => `${d.counts[k]} ${w}`);
  return `${d.total} unpublished change${d.total === 1 ? '' : 's'} since version ${d.version}: ${parts.join(', ')}.`;
}
