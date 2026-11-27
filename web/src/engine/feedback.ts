// Scoring v2: evidence-based personal feedback. Pure, deterministic, language-neutral (texts come from content + i18n).
// The 0-100 score formula is unchanged from v1 (points / maximum of the questions actually answered), so it is
// already normalised for 10, 15 or 20 questions. What v2 adds is how feedback is chosen:
//   strengths   only with evidence: >= 2 answers in a dimension, all open or confident
//   reflection  a pattern needs >= 2 answers in a dimension, a clear majority self-protective or ego-driven;
//               otherwise a single ego-driven answer becomes "a situation worth reflecting on"; otherwise nothing
//   challenge   always exactly one practical action
// A dimension represented by a single question is never called a strength or a pattern.
import type { Experience, Activity } from './schema';
import { flatActivities } from './util';

export const SCORING_VERSION_LATEST = 2;
export type Level = 0 | 1 | 2 | 3;

export interface DimensionEvidence { theme: string; answered: number; levels: Level[]; mean: number }
/** label/text are resolved from the content so a saved result can be shown again without the experience. */
export type Strength = { kind: 'open' | 'confident'; theme: string; evidence: number; label: string; text: string };
export type Reflection =
  | { kind: 'pattern'; theme: string; evidence: number; of: number; label: string; text: string }
  | { kind: 'moment'; theme: string; activityId: string; prompt: string; label: string };
export interface FeedbackV2 {
  version: 2;
  strengths: Strength[];                  // 0-2, strongest evidence first
  reflection: Reflection | null;          // never forced
  challenge: { theme: string | null; text: string };
  dimensions: DimensionEvidence[];
}

/** Map an answer's points onto 0-3 whatever the question's point scale. */
export function levelOf(a: Activity, optionId: unknown): Level | null {
  if (a.type !== 'choice') return null;
  const o = a.options.find(x => x.id === optionId);
  if (!o) return null;
  const max = Math.max(...a.options.map(x => x.points ?? 0));
  return (max > 0 ? Math.round((3 * (o.points ?? 0)) / max) : 0) as Level;
}

const themeOf = (a: Activity) => a.dimension ?? a.theme;

export function feedbackV2(e: Experience, responses: Record<string, unknown>): FeedbackV2 {
  const themes = e.insights?.themes ?? {};
  const answered = flatActivities(e).flatMap(a => {
    const t = themeOf(a), l = levelOf(a, responses[a.id]);
    return t && l != null && themes[t] ? [{ a, t, l }] : [];
  });
  const byTheme = new Map<string, Level[]>();
  for (const x of answered) byTheme.set(x.t, [...(byTheme.get(x.t) ?? []), x.l]);
  const dimensions: DimensionEvidence[] = [...byTheme].map(([theme, levels]) => ({
    theme, levels, answered: levels.length, mean: levels.reduce((s: number, v) => s + v, 0) / levels.length,
  }));

  // Strengths: at least two answers in the dimension and none of them self-protective or ego-driven.
  const strengths: Strength[] = dimensions
    .filter(d => d.answered >= 2 && d.levels.every(l => l <= 1))
    .sort((x, y) => y.answered - x.answered || x.mean - y.mean || x.theme.localeCompare(y.theme))
    .slice(0, 2)
    .map(d => ({ kind: d.mean <= 0.5 ? 'open' : 'confident', theme: d.theme, evidence: d.answered, label: themes[d.theme].label, text: themes[d.theme].strength }));

  // Reflection: a consistent pattern first, else one notable ego-driven moment, else nothing.
  let reflection: Reflection | null = null;
  const patterns = dimensions
    .map(d => ({ d, high: d.levels.filter(l => l >= 2).length }))
    .filter(x => x.d.answered >= 2 && x.high >= 2 && x.high / x.d.answered > 0.5)
    .sort((x, y) => y.d.mean - x.d.mean || y.high - x.high || x.d.theme.localeCompare(y.d.theme));
  if (patterns.length) { const t = patterns[0].d.theme; reflection = { kind: 'pattern', theme: t, evidence: patterns[0].high, of: patterns[0].d.answered, label: themes[t].label, text: themes[t].growth }; }
  else {
    const moment = answered.find(x => x.l === 3);
    if (moment) reflection = { kind: 'moment', theme: moment.t, activityId: moment.a.id, prompt: moment.a.prompt, label: themes[moment.t].label };
  }

  // Challenge: tied to the reflection if there is one, otherwise a general stretch.
  const ct = reflection?.theme ?? null;
  const challenge = ct ? { theme: ct, text: themes[ct].challenge } : { theme: null, text: e.insights?.defaultChallenge ?? '' };
  return { version: 2, strengths: strengths.filter(s => s.theme !== reflection?.theme), reflection, challenge, dimensions };
}

export const scoringVersion = (e: Pick<Experience, 'scoring'>) => e.scoring.version ?? 1;
