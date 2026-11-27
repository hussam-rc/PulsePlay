import { describe, it, expect } from 'vitest';
import { egoCheckV2Draft as draft } from '../src/experiences/drafts/egoCheckV2';
import { feedbackV2, levelOf } from '../src/engine/feedback';
import { personalResult } from '../src/engine/scoring';
import { sessionExperience } from '../src/engine/bank';
import { ALL_EXPERIENCES } from '../src/experiences';
import type { Experience, Activity } from '../src/engine/schema';

type Q = Activity & { type: 'choice'; dimension: string };
const game = (seed: string, n = 15) => sessionExperience(draft, { n, seed });
const acts = (e: Experience) => e.rounds.flatMap(r => r.activities) as Q[];
const answer = (e: Experience, lvl: (q: Q, i: number) => number) => Object.fromEntries(acts(e).map((q, i) => { const l = lvl(q, i); return [q.id, q.options.find(o => o.points === l)!.id]; }));

describe('scoring v2: feedback rules', () => {
  it('existing games stay on v1: no v2 feedback, same fields as before', () => {
    for (const e of ALL_EXPERIENCES) {
      const r = personalResult(e, {});
      expect(r.scoringVersion).toBe(1); expect(r.feedback).toBeUndefined();
    }
  });
  it('the 0-100 score formula is unchanged in v2', () => {
    const e = game('same'); const ans = answer(e, (_, i) => i % 4);
    const v1 = personalResult({ ...e, scoring: { ...e.scoring, version: 1 } }, ans), v2 = personalResult(e, ans);
    expect(v2.score).toBe(v1.score); expect(v2.band).toEqual(v1.band);
  });
  it('strongly reflective: up to two strengths, nothing to reflect on, one challenge', () => {
    const f = personalResult(game('open'), answer(game('open'), () => 0)).feedback!;
    expect(f.strengths.length).toBe(2); expect(f.strengths.every(s => s.kind === 'open')).toBe(true);
    expect(f.reflection).toBeNull(); expect(f.challenge.text.length).toBeGreaterThan(10);
  });
  it('healthy confidence is recognised as a strength, never as something to reflect on', () => {
    const e = game('conf'); const r = personalResult(e, answer(e, () => 1));
    expect(r.band!.tone).toBe('good');
    expect(r.feedback!.strengths.length).toBeGreaterThan(0); expect(r.feedback!.strengths.every(s => s.kind === 'confident')).toBe(true);
    expect(r.feedback!.reflection).toBeNull();
  });
  it('one notable answer is a situation to reflect on, not a weak dimension', () => {
    const e = game('one'); const target = acts(e)[3];
    const f = personalResult(e, answer(e, q => (q.id === target.id ? 3 : 0))).feedback!;
    expect(f.reflection).toMatchObject({ kind: 'moment', theme: target.dimension, activityId: target.id, prompt: target.prompt });
    expect(f.strengths.some(s => s.theme === target.dimension)).toBe(false);
  });
  it('a consistent pattern (>= 2 answers, a clear majority at 2-3 points) is a possible growth area', () => {
    const e = game('pattern', 20); const dim = acts(e)[0].dimension;
    const f = personalResult(e, answer(e, q => (q.dimension === dim ? 2 : 0))).feedback!;
    expect(f.reflection).toMatchObject({ kind: 'pattern', theme: dim });
    expect(f.challenge.theme).toBe(dim);
  });
  it('a dimension with only one question is never a strength or a pattern', () => {
    const e = game('thin', 10);
    const single = Object.entries(acts(e).reduce((m, q) => ({ ...m, [q.dimension]: (m[q.dimension] ?? 0) + 1 }), {} as Record<string, number>)).filter(([, n]) => n === 1).map(([d]) => d);
    expect(single.length).toBeGreaterThan(0); // 10 questions over 6 dimensions: some appear once
    const f1 = personalResult(e, answer(e, () => 0)).feedback!;
    expect(f1.strengths.some(s => single.includes(s.theme))).toBe(false);
    const f2 = personalResult(e, answer(e, q => (single.includes(q.dimension) ? 2 : 0))).feedback!;
    expect(f2.reflection).toBeNull(); // single 2-point answers are not evidence of a pattern, and not "ego-driven"
  });
  it('mixed answers in a dimension (one 3, one 0) are not called a pattern', () => {
    const e = game('mixed', 20); const dim = acts(e)[0].dimension; let k = 0;
    const f = personalResult(e, answer(e, q => (q.dimension === dim ? (k++ === 0 ? 3 : 0) : 0))).feedback!;
    expect(f.reflection?.kind).toBe('moment');
  });
  it('never names the same dimension as both a strength and the reflection', () => {
    for (let s = 0; s < 200; s++) {
      const e = game(`x${s}`, [10, 15, 20][s % 3]); const f = personalResult(e, answer(e, (_, i) => (s * 7 + i * 3) % 4)).feedback;
      if (!f) continue;
      expect(f.strengths.some(x => x.theme === f.reflection?.theme)).toBe(false);
      expect(f.strengths.length).toBeLessThanOrEqual(2);
    }
  });
  it('maps any point scale onto four levels', () => {
    const a = { id: 'x', type: 'choice', prompt: 'p', shuffle: true, options: [{ id: 'a', text: 'A', points: 0 }, { id: 'b', text: 'B', points: 5 }, { id: 'c', text: 'C', points: 10 }] } as Activity;
    expect([levelOf(a, 'a'), levelOf(a, 'b'), levelOf(a, 'c'), levelOf(a, 'z')]).toEqual([0, 2, 3, null]);
  });
  it('a result without enough answers gets no v2 feedback', () => {
    const e = game('few'); const ans = Object.fromEntries(Object.entries(answer(e, () => 0)).slice(0, 5));
    expect(personalResult(e, ans).feedback).toBeUndefined();
  });
  it('feedbackV2 is pure: same answers, same feedback', () => {
    const e = game('pure'); const ans = answer(e, (_, i) => i % 4);
    expect(feedbackV2(e, ans)).toEqual(feedbackV2(e, ans));
  });
});
