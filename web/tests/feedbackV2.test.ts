import { describe, it, expect } from 'vitest';
import { egoCheckV2Draft as draft } from '../src/experiences/drafts/egoCheckV2';
import { AUTHORED } from '../src/experiences/drafts/egoCheckV2.en';
import { feedbackV2, levelOf, pointScale } from '../src/engine/feedback';
import { personalResult } from '../src/engine/scoring';
import { sessionExperience } from '../src/engine/bank';
import { ALL_EXPERIENCES } from '../src/experiences';
import type { Experience, Activity } from '../src/engine/schema';

type Q = Activity & { type: 'choice'; dimension: string };
const game = (seed: string, n = 15) => sessionExperience(draft, { n, seed });
const acts = (e: Experience) => e.rounds.flatMap(r => r.activities) as Q[];
const at = (q: Q, pos: number) => q.options[AUTHORED[q.id].indexOf(pos)];
/** Answer every question at an authored position: 0 open, 1 assertive, 2 self-protective, 3 ego. */
const answer = (e: Experience, pos: (q: Q, i: number) => number) => Object.fromEntries(acts(e).map((q, i) => [q.id, at(q, pos(q, i)).id]));

describe('scoring v2: feedback rules', () => {
  it('existing games stay on v1: no v2 feedback', () => {
    for (const e of ALL_EXPERIENCES) { const r = personalResult(e, {}); expect(r.scoringVersion).toBe(1); expect(r.feedback).toBeUndefined(); }
  });
  it('the 0-100 score is the same formula in v1 and v2', () => {
    const e = game('same'); const ans = answer(e, (_, i) => i % 4);
    const v1 = personalResult({ ...e, scoring: { ...e.scoring, version: 1 } }, ans), v2 = personalResult(e, ans);
    expect(v2.score).toBe(v1.score); expect(v2.band).toEqual(v1.band);
  });
  it('strongly reflective: up to two strengths, nothing to reflect on, one challenge', () => {
    const e = game('open'); const f = personalResult(e, answer(e, () => 0)).feedback!;
    expect(f.strengths.length).toBe(2); expect(f.reflection).toBeNull(); expect(f.challenge.text.length).toBeGreaterThan(10);
  });
  it('assertive answers (stating views, boundaries, staying neutral) earn strengths, never a reflection', () => {
    const e = game('assert'); const r = personalResult(e, answer(e, () => 1));
    expect(r.band!.tone).toBe('great'); expect(r.feedback!.strengths.length).toBeGreaterThan(0); expect(r.feedback!.reflection).toBeNull();
  });
  it('one notable ego-driven answer is a situation to reflect on, not a weak dimension', () => {
    const e = game('one'); const target = acts(e).find(q => at(q, 3).points === 3)!;
    const f = personalResult(e, answer(e, q => (q.id === target.id ? 3 : 0))).feedback!;
    expect(f.reflection).toMatchObject({ kind: 'moment', theme: target.dimension, activityId: target.id });
    expect(f.strengths.some(s => s.theme === target.dimension)).toBe(false);
  });
  it('a consistent pattern (>= 2 answers, a clear majority at 2-3 points) is a possible growth area', () => {
    const e = game('pattern', 20); const dim = acts(e)[0].dimension;
    const worst = (q: Q) => [3, 2].find(pos => (at(q, pos)?.points ?? 0) >= 2)!;      // a 2-3 point reaction in every question of that area
    const f = personalResult(e, answer(e, q => (q.dimension === dim ? worst(q) : 0))).feedback!;
    expect(f.reflection).toMatchObject({ kind: 'pattern', theme: dim }); expect(f.challenge.theme).toBe(dim);
  });
  it('a dimension with only one question is never a strength or a pattern', () => {
    const e = game('thin', 10);
    const count = acts(e).reduce((m, q) => ({ ...m, [q.dimension]: (m[q.dimension] ?? 0) + 1 }), {} as Record<string, number>);
    const single = Object.keys(count).filter(d => count[d] === 1);
    expect(single.length).toBeGreaterThan(0);
    expect(personalResult(e, answer(e, () => 0)).feedback!.strengths.some(s => single.includes(s.theme))).toBe(false);
    expect(personalResult(e, answer(e, q => (single.includes(q.dimension) ? 2 : 0))).feedback!.reflection).toBeNull();
  });
  it('mixed answers in a dimension (one ego-driven, one open) are not called a pattern', () => {
    const e = game('mixed', 20); const dim = acts(e).find(q => at(q, 3).points === 3)!.dimension; let k = 0;
    const f = personalResult(e, answer(e, q => (q.dimension === dim && k++ === 0 && at(q, 3).points === 3 ? 3 : 0))).feedback!;
    expect(f.reflection?.kind === 'pattern').toBe(false);
  });
  it('never names the same dimension as both a strength and the reflection; at most two strengths', () => {
    for (let s = 0; s < 200; s++) {
      const e = game(`x${s}`, [10, 15, 20][s % 3]); const f = personalResult(e, answer(e, (_, i) => (s * 7 + i * 3) % 4)).feedback;
      if (!f) continue;
      expect(f.strengths.some(x => x.theme === f.reflection?.theme)).toBe(false); expect(f.strengths.length).toBeLessThanOrEqual(2);
    }
  });
  it('a result without enough answers gets no v2 feedback', () => {
    const e = game('few'); const ans = Object.fromEntries(Object.entries(answer(e, () => 0)).slice(0, 5));
    expect(personalResult(e, ans).feedback).toBeUndefined();
  });
  it('feedbackV2 is pure: same answers, same feedback', () => {
    const e = game('pure'); const ans = answer(e, (_, i) => i % 4); expect(feedbackV2(e, ans)).toEqual(feedbackV2(e, ans));
  });
});

// Tied scores and variable maxima (27 Nov decision): 100 = the most ego points the selected questions allow.
const choice = (id: string, pts: number[], dimension = 'feedback'): Activity =>
  ({ id, type: 'choice', prompt: `Situation ${id}`, shuffle: true, dimension, theme: dimension, options: pts.map((p, k) => ({ id: 'abcd'[k], text: `Answer ${k}`, points: p })) }) as Activity;
const mini = (qs: Activity[], scoring: Partial<Experience['scoring']> = {}): Experience =>
  ({ ...draft, bank: undefined, scoring: { ...draft.scoring, ...scoring }, rounds: [{ id: 'main', activities: qs }] });

describe('scoring with tied scores and variable maximum points', () => {
  it('ties: two equally reasonable answers score the same', () => {
    const e = mini([choice('t1', [0, 0, 2, 3]), choice('t2', [0, 0, 2, 3])]);
    expect(personalResult(e, { t1: 'a', t2: 'a' }).score).toBe(personalResult(e, { t1: 'b', t2: 'b' }).score);
  });
  it('100 = the maximum ego points of the selected questions, whatever each question\'s maximum is', () => {
    const e = mini([choice('m3', [0, 0, 2, 3]), choice('m2', [0, 1, 1, 2]), choice('m3b', [0, 0, 1, 3])]);
    expect(personalResult(e, { m3: 'd', m2: 'd', m3b: 'd' }).score).toBe(100);
    expect(personalResult(e, { m3: 'c', m2: 'd', m3b: 'c' }).score).toBe(Math.round((100 * (2 + 2 + 1)) / 8));
    expect(personalResult(e, { m3: 'a', m2: 'a', m3b: 'b' }).score).toBe(0);
  });
  it('unanswered questions are excluded from the maximum, so 10, 15 and 20 questions use the same scale', () => {
    const e = mini([choice('u1', [0, 0, 2, 3]), choice('u2', [0, 1, 1, 2]), choice('u3', [0, 0, 1, 3])], { minAnsweredRatio: 0.5 });
    expect(personalResult(e, { u1: 'd', u3: 'd' }).score).toBe(100);
  });
  it('a question without an ego-driven option: its worst answer reads as self-protective, not ego-driven', () => {
    const q = choice('n2', [0, 1, 1, 2]);
    expect(levelOf(q, 'd', 3)).toBe(2);
    expect(levelOf(q, 'd', 2)).toBe(3);   // what a per-question scale would have said
    const e = mini([q, choice('o1', [0, 0, 2, 3]), choice('o2', [0, 0, 2, 3])], { maxPoints: 3 });
    expect(personalResult(e, { n2: 'd', o1: 'a', o2: 'a' }).feedback!.reflection).toBeNull();
  });
  it('real bank: question maximum and feedback level are separate scales', () => {
    // a 2-max question's worst answer earns 100% of that question's points, yet reads as self-protective (level 2), never ego-driven (3)
    const all = draft.rounds.flatMap(r => r.activities) as Q[];
    const twoMax = all.filter(q => Math.max(...q.options.map(o => o.points ?? 0)) === 2);
    expect(twoMax.length).toBe(12);
    for (const q of twoMax) {
      const worst = q.options.find(o => o.points === 2)!;
      expect(levelOf(q, worst.id, pointScale(draft))).toBe(2);
      const e = mini([q, q, q].map((x, i) => ({ ...x, id: `${x.id}-${i}` })), { maxPoints: 3 });
      const r = personalResult(e, Object.fromEntries(e.rounds[0].activities.map(a => [a.id, worst.id])));
      expect(r.score).toBe(100);
      expect(r.feedback!.reflection?.kind ?? null).not.toBe('moment'); // never a "single ego-driven situation"
    }
  });
  it('the point scale defaults to the highest points in the content', () => {
    expect(pointScale(mini([choice('s1', [0, 1, 2]), choice('s2', [0, 5, 10])], { maxPoints: undefined }))).toBe(10);
    expect(pointScale(draft)).toBe(3);
  });
  it('historical compatibility: v1 games score exactly as before (points / per-question maximum of answered questions)', () => {
    for (const e of ALL_EXPERIENCES.filter(x => x.scoring.kind === 'behaviour')) {
      const qs = e.rounds.flatMap(r => r.activities).filter(a => a.type === 'choice') as Q[];
      const ans = Object.fromEntries(qs.map((q, i) => [q.id, q.options[i % q.options.length].id]));
      let p = 0, m = 0; for (const q of qs) { p += q.options.find(o => o.id === ans[q.id])!.points ?? 0; m += Math.max(...q.options.map(o => o.points ?? 0)); }
      const r = personalResult(e, ans);
      expect(r.score).toBe(Math.round((100 * p) / m)); expect(r.scoringVersion).toBe(1); expect(r.feedback).toBeUndefined();
    }
  });
});
