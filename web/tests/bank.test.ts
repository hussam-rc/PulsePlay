import { describe, it, expect } from 'vitest';
import { validateExperience, type Experience, type Activity } from '../src/engine/schema';
import { lengthOptions, defaultLength, selectActivities, applySelection, sessionExperience, recencyFrom, estimateMinutes, eligible, strategiesFor } from '../src/engine/bank';
import { personalResult } from '../src/engine/scoring';
import { rng, hash, order } from '../src/engine/random';
import { ALL_EXPERIENCES as BUILT_INS } from '../src/experiences';

// A behaviour-scored bank: `per` questions in each of `dims` dimensions, options with stable ids and points 0..3.
function bank(dims: number, per: number, extra: Partial<Experience> = {}, tweak?: (a: Activity, i: number) => Activity): Experience {
  const base = structuredClone(BUILT_INS.find(e => e.id === 'ego-check')!) as Experience;
  const acts: Activity[] = [];
  for (let d = 0; d < dims; d++) for (let k = 0; k < per; k++) {
    const i = acts.length;
    const a: Activity = { id: `q${i + 1}`, type: 'choice', prompt: `Question ${i + 1}`, dimension: `d${d + 1}`, category: `c${(i % 3) + 1}`, shuffle: true,
      options: [{ id: 'a', text: 'A', points: 0 }, { id: 'b', text: 'B', points: 1 }, { id: 'c', text: 'C', points: 2 }, { id: 'd', text: 'D', points: 3 }] } as Activity;
    acts.push(tweak ? tweak(a, i) : a);
  }
  return { ...base, insights: undefined, rounds: [{ id: 'main', activities: acts }], bank: { strategy: 'dimension', lengths: [10, 15, 20], defaultLength: 10 }, ...extra };
}
const seq = (s: string) => rng(hash(s));
const ids = (as: Activity[]) => as.map(a => a.id);
const countBy = (as: Activity[], k: 'dimension' | 'category') => as.reduce((m, a) => ({ ...m, [a[k]!]: (m[a[k]!] ?? 0) + 1 }), {} as Record<string, number>);

describe('question bank: lengths', () => {
  it('existing games keep every question by default (no bank configured)', () => {
    for (const e of BUILT_INS) {
      const n = eligible(e, 'fixed').length;
      expect(defaultLength(e)).toBe(n);
      expect(ids(selectActivities(e, n))).toEqual(ids(e.rounds.flatMap(r => r.activities)));
    }
  });
  it('a 60-question bank offers 10, 15 and 20, default 10', () => {
    const e = bank(6, 10);
    expect(lengthOptions(e).map(o => [o.n, o.available])).toEqual([[10, true], [15, true], [20, true]]);
    expect(defaultLength(e)).toBe(10);
  });
  it('12 eligible questions: 15 and 20 are shown as unavailable with what is missing, never padded', () => {
    const e = bank(3, 4);
    const o = lengthOptions(e);
    expect(o.filter(x => x.available).map(x => x.n)).toEqual([10]);
    expect(o.find(x => x.n === 15)).toMatchObject({ available: false, missing: 3 });
    expect(() => selectActivities(e, 15)).toThrow(/not available/);
  });
  it('a 12-question game without a bank offers 10 or all 12', () => {
    const e = bank(3, 4, { bank: undefined });
    expect(lengthOptions(e).filter(x => x.available).map(x => x.n)).toEqual([10, 12]);
    expect(defaultLength(e)).toBe(12);
  });
  it('archived and fixed-only questions are not eligible for random selection', () => {
    const e = bank(2, 6, {}, (a, i) => (i === 0 ? { ...a, active: false } : i === 1 ? { ...a, random: false } : a));
    expect(eligible(e, 'dimension').length).toBe(10);
    expect(eligible(e, 'fixed').length).toBe(11);
    expect(ids(selectActivities(e, 10, { random: seq('x') }))).not.toContain('q1');
    expect(ids(selectActivities(e, 10, { random: seq('x') }))).not.toContain('q2');
  });
});

describe('question bank: selection', () => {
  for (const n of [10, 15, 20]) it(`selects ${n} distinct questions from 60, balanced across all six dimensions`, () => {
    const e = bank(6, 10);
    for (let s = 0; s < 30; s++) {
      const p = selectActivities(e, n, { random: seq(`${n}-${s}`) });
      expect(p.length).toBe(n);
      expect(new Set(ids(p)).size).toBe(n);
      const c = Object.values(countBy(p, 'dimension'));
      expect(c.length).toBe(6);
      expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1);
    }
  });
  it('balances by category when configured', () => {
    const e = bank(6, 10, { bank: { strategy: 'category', lengths: [10, 15, 20] } });
    const c = Object.values(countBy(selectActivities(e, 15, { random: seq('cat') }), 'category'));
    expect(c).toEqual([5, 5, 5]);
  });
  it('balances as evenly as practical when one dimension is small', () => {
    const e = bank(3, 10, {}, (a, i) => (i >= 22 ? { ...a, active: false } : a)); // d1=10, d2=10, d3=2
    const c = countBy(selectActivities(e, 15, { random: seq('small') }), 'dimension');
    expect(c.d3).toBe(2); expect(Math.abs(c.d1 - c.d2)).toBeLessThanOrEqual(1); expect(c.d1 + c.d2 + c.d3).toBe(15);
  });
  it('interleaves dimensions so consecutive questions vary', () => {
    for (const n of [10, 15, 20]) for (let k = 0; k < 10; k++) {
      const p = selectActivities(bank(6, 10), n, { random: seq(`inter${n}${k}`) });
      for (let i = 1; i < p.length; i++) expect(p[i].dimension).not.toBe(p[i - 1].dimension);
    }
  });
  it('always includes required questions and still balances the rest', () => {
    const e = bank(6, 10, {}, (a, i) => (i < 3 ? { ...a, required: true } : a)); // three required in d1
    for (let s = 0; s < 10; s++) {
      const p = selectActivities(e, 10, { random: seq(`req${s}`) });
      expect(ids(p)).toEqual(expect.arrayContaining(['q1', 'q2', 'q3']));
      expect(Object.keys(countBy(p, 'dimension')).length).toBe(6);
    }
  });
  it('fixed selection is the authored order, required first', () => {
    const e = bank(6, 10, { bank: { strategy: 'fixed', lengths: [10, 15] } }, (a, i) => (i === 40 ? { ...a, required: true } : a));
    expect(ids(selectActivities(e, 10))).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q41']);
  });
  it('random selection differs between sessions', () => {
    const e = bank(6, 10, { bank: { strategy: 'random', lengths: [10, 15, 20] } });
    const a = ids(selectActivities(e, 10, { random: seq('one') })), b = ids(selectActivities(e, 10, { random: seq('two') }));
    expect(a).not.toEqual(b);
  });
});

describe('question bank: recent-question avoidance', () => {
  it('prefers questions the host has not used in recent sessions', () => {
    const e = bank(6, 10);
    const first = selectActivities(e, 20, { random: seq('r1') });
    const second = selectActivities(e, 20, { random: seq('r2'), recency: recencyFrom([ids(first)]) });
    const third = selectActivities(e, 20, { random: seq('r3'), recency: recencyFrom([ids(second), ids(first)]) });
    expect(ids(second).filter(i => ids(first).includes(i))).toEqual([]);
    // Third game: 40 of 60 used. Balance wins over avoidance, so a dimension with too few unseen questions
    // reuses the OLDEST ones (game 1) and never the most recent (game 2).
    expect(ids(third).filter(i => ids(second).includes(i))).toEqual([]);
    for (const a of third.filter(x => ids(first).includes(x.id))) {
      const unseen = bank(6, 10).rounds[0].activities.filter(x => x.dimension === a.dimension && !ids(first).includes(x.id) && !ids(second).includes(x.id));
      expect(unseen.every(u => ids(third).includes(u.id))).toBe(true);
    }
  });
  it('when the bank is exhausted, reuses the least recently used questions first', () => {
    const e = bank(2, 10, { bank: { strategy: 'random', lengths: [10] } }); // 20 questions
    const s1 = ids(selectActivities(e, 10, { random: seq('e1') }));
    const s2 = ids(selectActivities(e, 10, { random: seq('e2'), recency: recencyFrom([s1]) }));
    const s3 = ids(selectActivities(e, 10, { random: seq('e3'), recency: recencyFrom([s2, s1]) }));
    expect(new Set([...s1, ...s2]).size).toBe(20);
    expect([...s3].sort()).toEqual([...s1].sort()); // s1 is the least recently used
  });
  it('avoidance never breaks balance or produces duplicates', () => {
    const e = bank(6, 10);
    const used = ids(selectActivities(e, 20, { random: seq('u') }));
    const p = selectActivities(e, 20, { random: seq('v'), recency: recencyFrom([used]) });
    expect(new Set(ids(p)).size).toBe(20);
    const c = Object.values(countBy(p, 'dimension'));
    expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1);
  });
});

describe('question bank: snapshots and scoring', () => {
  it('the session snapshot holds only the selected questions, in play order, with a record of the selection', () => {
    const e = bank(6, 10);
    const p = selectActivities(e, 15, { random: seq('snap') });
    const s = applySelection(e, p, 'dimension');
    expect(ids(s.rounds[0].activities)).toEqual(ids(p));
    expect(s.selection).toEqual({ strategy: 'dimension', count: 15, bankSize: 60, ids: ids(p) });
    expect(validateExperience(s).ok).toBe(true);
    expect(e.rounds[0].activities.length).toBe(60); // the source content is untouched
  });
  it('scores by option id: the same answers score the same in any display order', () => {
    const e = sessionExperience(bank(6, 10), { n: 10, seed: 'score' });
    const answers = Object.fromEntries(e.rounds[0].activities.map((a, i) => [a.id, ['a', 'b', 'c', 'd'][i % 4]]));
    const r = personalResult(e, answers);
    // reorder questions and shuffle each question's options: identical score
    const shuffled: Experience = { ...e, rounds: [{ ...e.rounds[0], activities: [...e.rounds[0].activities].reverse().map(a => a.type === 'choice'
      ? { ...a, options: order('p', a.id, a.options.length).map(k => a.options[k]) } : a) }] };
    expect(personalResult(shuffled, answers).score).toBe(r.score);
    expect(r.score).toBe(Math.round((100 * (0 + 1 + 2 + 3 + 0 + 1 + 2 + 3 + 0 + 1)) / 30));
  });
  it('scores are percentages of the questions actually played, for 10, 15 and 20', () => {
    for (const n of [10, 15, 20]) {
      const e = sessionExperience(bank(6, 10), { n, seed: `pct${n}` });
      const all3 = Object.fromEntries(e.rounds[0].activities.map(a => [a.id, 'd']));
      expect(personalResult(e, all3).score).toBe(100);
      const half = Object.fromEntries(e.rounds[0].activities.slice(0, n - 3).map(a => [a.id, 'a']));
      const r = personalResult(e, half);
      expect(r.score).toBe(0); expect(r.total).toBe(n); expect(r.valid).toBe((n - 3) >= Math.ceil(n * 0.7));
    }
  });
  it('solo play of an existing game is unchanged', () => {
    for (const e of BUILT_INS) expect(ids(sessionExperience(e).rounds.flatMap(r => r.activities))).toEqual(ids(e.rounds.flatMap(r => r.activities)));
  });
});

describe('question bank: validation, strategies, duration', () => {
  it('rejects broken bank settings and warns about too few questions', () => {
    expect(validateExperience(bank(6, 10, { bank: { strategy: 'dimension', lengths: [15, 10] } })).errors.join()).toMatch(/ascending/);
    expect(validateExperience(bank(6, 10, { bank: { strategy: 'dimension', lengths: [10], defaultLength: 15 } })).errors.join()).toMatch(/defaultLength/);
    expect(validateExperience(bank(6, 10, {}, (a, i) => (i < 11 ? { ...a, required: true } : a))).errors.join()).toMatch(/required/);
    expect(validateExperience(bank(2, 6)).warnings.join()).toMatch(/only 12 eligible questions: 15\/20/);
    expect(validateExperience(bank(6, 10)).ok).toBe(true);
  });
  it('offers the game strategy plus random and fixed order', () => {
    expect(strategiesFor({ bank: { strategy: 'dimension', lengths: [10] } })).toEqual(['dimension', 'random', 'fixed']);
    expect(strategiesFor({})).toEqual(['fixed', 'random']);
  });
  it('estimates duration from the real settings', () => {
    // Calibration: the 25 Nov live game (10 questions, 4 s read, 15 s answer, host-advanced) ran ~12 min including ~3 min of joining.
    expect(estimateMinutes({ questions: 10, readSec: 4, answerSec: 15, reveal: 'none', scored: true })).toBe(8);
    expect(estimateMinutes({ questions: 20, readSec: 4, answerSec: 15, reveal: 'none', scored: true })).toBe(12);
    expect(estimateMinutes({ questions: 15, readSec: 5, answerSec: 12, reveal: 'correct', scored: true })).toBe(10);
  });
});
