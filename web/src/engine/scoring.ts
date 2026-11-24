// Scoring + aggregation. Deterministic, transparent, no AI. Same code runs in tests and (later) server-side.
import type { Experience, Activity, ResultBand } from './schema';
import { flatActivities } from './util';
import { hash } from './random';

/** A response is an option id (choice/poll), a number (scale), a string (reflection, never aggregated) or null (missed). */
export type ResponseValue = string | number | null;
export type Responses = Record<string, ResponseValue>;

export interface Observation { kind: 'strength' | 'growth'; text: string; theme: string }
export interface PersonalResult {
  answered: number;
  total: number;
  valid: boolean;
  score: number | null;      // 0..100 or null when not scored
  band: ResultBand | null;
  correct?: number;          // correct-answer scoring only
  observations: Observation[];
  habit?: string;
  challenge?: string;
}

const scoredActivities = (e: Experience) => flatActivities(e).filter(a => a.type === 'choice');

export function personalResult(e: Experience, responses: Responses, seed = ''): PersonalResult {
  const acts = scoredActivities(e);
  const total = acts.length;
  const answeredActs = acts.filter(a => responses[a.id] != null);
  const answered = answeredActs.length;
  const valid = total > 0 && answered >= Math.ceil(total * e.scoring.minAnsweredRatio);
  let score: number | null = null, correct: number | undefined;
  const per: { a: Activity; p: number; max: number }[] = [];

  if (e.scoring.kind === 'behaviour') {
    let pts = 0, max = 0;
    for (const a of answeredActs) {
      if (a.type !== 'choice') continue;
      const opt = a.options.find(o => o.id === responses[a.id]);
      if (!opt) continue;
      const m = Math.max(...a.options.map(o => o.points ?? 0));
      pts += opt.points ?? 0; max += m; per.push({ a, p: opt.points ?? 0, max: m });
    }
    score = max > 0 ? Math.round((100 * pts) / max) : null;
  } else if (e.scoring.kind === 'correct') {
    correct = acts.filter(a => a.type === 'choice' && a.options.find(o => o.id === responses[a.id])?.correct).length;
    score = total ? Math.round((100 * correct) / total) : null; // missed questions count as not correct
  }
  const band = score == null ? null : bandFor(e.results ?? [], score);
  const r: PersonalResult = { answered, total, valid, score, band, correct, observations: [] };

  if (e.insights && e.scoring.kind === 'behaviour') {
    const themes = e.insights.themes, rot = hash(seed) % Math.max(1, per.length);
    const strengths = per.filter(x => x.p === 0 && x.a.theme)
      .map((x, i) => ({ x, k: (i - rot + per.length) % per.length })).sort((a, b) => a.k - b.k).map(y => y.x.a.theme!);
    const growth = per.filter(x => x.p >= 2 && x.a.theme).sort((a, b) => b.p - a.p).map(x => x.a.theme!);
    const goodBand = band && (band.tone === 'great' || band.tone === 'good');
    const take = (t: string, kind: 'strength' | 'growth') => {
      if (r.observations.length < 2 && !r.observations.some(o => o.theme === t && o.kind === kind))
        r.observations.push({ kind, theme: t, text: kind === 'strength' ? themes[t].strength : themes[t].growth });
    };
    if (goodBand) strengths.slice(0, 2).forEach(t => take(t, 'strength')); else if (strengths[0]) take(strengths[0], 'strength');
    growth.forEach(t => take(t, 'growth'));
    strengths.forEach(t => take(t, 'strength'));
    const focus = growth[0];
    r.habit = focus ? themes[focus].habit : e.insights.defaultHabit;
    r.challenge = focus ? themes[focus].challenge : strengths[0] ? themes[strengths[0]].challenge : e.insights.defaultChallenge;
  }
  return r;
}

export function bandFor(bands: ResultBand[], score: number): ResultBand | null {
  return bands.find(b => score >= b.min && score <= b.max) ?? null;
}

export interface Distribution { n: number; counts: Record<string, number>; suppressed: boolean }

/** Option counts for one activity. Suppressed below the experience's group minimum. */
export function distribution(e: Experience, a: Activity, all: Responses[]): Distribution {
  const counts: Record<string, number> = {};
  let n = 0;
  if (a.type === 'choice' || a.type === 'poll') a.options.forEach(o => (counts[o.id] = 0));
  for (const r of all) {
    const v = r[a.id];
    if (v == null || a.type === 'reflection') continue;
    const k = String(v);
    if (k in counts || a.type === 'scale') { counts[k] = (counts[k] ?? 0) + 1; n++; }
  }
  return { n, counts, suppressed: n < e.privacy.groupMinimum };
}

export interface GroupSummary { joined: number; valid: number; average: number | null; band: ResultBand | null; bands: number[] | null; suppressed: boolean }

/** Group average from valid personal results only; band breakdown needs twice the group minimum. */
export function groupSummary(e: Experience, results: PersonalResult[], joined: number): GroupSummary {
  const valid = results.filter(r => r.valid && r.score != null);
  const min = e.privacy.groupMinimum;
  if (valid.length < min) return { joined, valid: valid.length, average: null, band: null, bands: null, suppressed: true };
  const average = Math.round(valid.reduce((s, r) => s + (r.score ?? 0), 0) / valid.length);
  const bands = valid.length >= 2 * min ? (e.results ?? []).map(b => valid.filter(r => r.score! >= b.min && r.score! <= b.max).length) : null;
  return { joined, valid: valid.length, average, band: bandFor(e.results ?? [], average), bands, suppressed: false };
}
