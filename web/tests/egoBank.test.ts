// Release 3.0B: rules for the 60-question bank after the final scoring review (ties allowed). Gates content approval.
import { describe, it, expect } from 'vitest';
import { BANK_EN, DIMENSIONS, AUTHORED, POINTS } from '../src/experiences/drafts/egoCheckV2.en';
import { egoCheckV2Draft as e } from '../src/experiences/drafts/egoCheckV2';
import { validateExperience } from '../src/engine/schema';
import { lengthOptions, selectActivities, sessionExperience } from '../src/engine/bank';
import { personalResult } from '../src/engine/scoring';
import { rng, hash } from '../src/engine/random';

type Q = typeof BANK_EN[number];
/** The answer at an authored position: 0 open, 1 assertive, 2 self-protective, 3 ego. */
const at = (q: Q, pos: number) => q.options[AUTHORED[q.id].indexOf(pos)];

describe('Who is in Control? v2 bank: structure', () => {
  it('validates, with 60 questions, 10 per dimension, offering 10 / 15 / 20', () => {
    const v = validateExperience(e);
    expect(v.errors).toEqual([]); expect(v.warnings).toEqual([]);
    expect(BANK_EN.length).toBe(60);
    for (const d of DIMENSIONS) expect(BANK_EN.filter(q => q.dimension === d).length).toBe(10);
    expect(lengthOptions(e).map(o => [o.n, o.available])).toEqual([[10, true], [15, true], [20, true]]);
  });
  it('stable unique ids, four distinct answers, points on the 0-3 scale', () => {
    expect(new Set(BANK_EN.map(q => q.id)).size).toBe(60);
    for (const q of BANK_EN) {
      expect(q.options.map(o => o.id)).toEqual(['a', 'b', 'c', 'd']);
      expect(new Set(q.options.map(o => o.text)).size).toBe(4);
      for (const o of q.options) expect([0, 1, 2, 3]).toContain(o.points);
      expect(q.theme).toBe(q.dimension);
    }
  });
  it('scores follow behaviour, not an even spread: ties are allowed and used', () => {
    const patterns = new Set(BANK_EN.map(q => [...q.options.map(o => o.points)].sort().join('')));
    expect(patterns.size).toBeGreaterThan(3);
    expect(BANK_EN.filter(q => new Set(q.options.map(o => o.points)).size < 4).length).toBeGreaterThan(40);
  });
  it('every question has at least one 0-point reaction and some reaction worth reflecting on (>= 2)', () => {
    for (const q of BANK_EN) {
      expect(q.options.some(o => o.points === 0), q.id).toBe(true);
      expect(Math.max(...q.options.map(o => o.points)), q.id).toBeGreaterThanOrEqual(2);
    }
  });
  it('the open and the assertive reaction are never scored as ego: open = 0, assertive <= 1', () => {
    for (const q of BANK_EN) { expect(at(q, 0).points, q.id).toBe(0); expect(at(q, 1).points, q.id).toBeLessThanOrEqual(1); }
  });
  it('authored order and points agree with the reviewed POINTS table', () => {
    for (const q of BANK_EN) for (let pos = 0; pos < 4; pos++) expect(at(q, pos).points).toBe(POINTS[q.id][pos]);
  });
  it('short enough for timed play on phones', () => {
    for (const q of BANK_EN) { expect(q.prompt.length).toBeLessThanOrEqual(90); for (const o of q.options) expect(o.text.length).toBeLessThanOrEqual(70); }
  });
  it('uses ego wording, no clinical or judging labels', () => {
    const all = JSON.stringify(e).toLowerCase();
    for (const banned of ['autopilot', 'narciss', 'disorder', 'toxic', 'diagnos', 'arrogant', 'selfish']) expect(all).not.toContain(banned);
  });
});

describe('Who is in Control? v2 bank: no giveaways', () => {
  const zero = BANK_EN.flatMap(q => q.options.filter(o => o.points === 0)), high = BANK_EN.flatMap(q => q.options.filter(o => o.points >= 2));
  const first = (t: string) => t.split(/[\s,;:]/)[0].toLowerCase();
  const top = (xs: { text: string }[]) => { const m: Record<string, number> = {}; xs.forEach(x => (m[first(x.text)] = (m[first(x.text)] ?? 0) + 1)); return Math.max(...Object.values(m)) / xs.length; };
  it('no opening word gives away the score (at most 20% of 0-point or of 2-3 point answers)', () => {
    expect(top(zero)).toBeLessThanOrEqual(0.2); expect(top(high)).toBeLessThanOrEqual(0.2);
  });
  it('answer length gives nothing away (0-point vs 2-3 point averages within 6 characters)', () => {
    const avg = (xs: { text: string }[]) => xs.reduce((s, x) => s + x.text.length, 0) / xs.length;
    expect(Math.abs(avg(zero) - avg(high))).toBeLessThanOrEqual(6);
  });
  it('no letter is systematically a 0-point answer', () => {
    for (const l of ['a', 'b', 'c', 'd']) { const n = BANK_EN.filter(q => q.options.find(o => o.id === l)!.points === 0).length; expect(n).toBeGreaterThanOrEqual(20); expect(n).toBeLessThanOrEqual(40); }
  });
  it('feelings are never scored: no feeling words in 2-3 point answers', () => {
    const FEEL = /\b(feel|feels|felt|upset|hurt|annoyed|disappointed|irritated|sting)\b/i;
    for (const o of high) expect(o.text).not.toMatch(FEEL);
  });
  it('only observable reactions carry points: no thoughts, decisions-in-the-head or moods in 1-3 point answers', () => {
    const INNER = /\b(decide|decides|assume|think|believe|forget|lose interest|wonder|hope|realise|resent|enjoy|wish|doubt|suspect|tell yourself|hear it as|feel|feels)\b/i;
    const scored = BANK_EN.flatMap(q => q.options.filter(o => o.points > 0).map(o => `${q.id}: ${o.text}`));
    expect(scored.filter(t => INNER.test(t))).toEqual([]);
  });
  it('em2: giving privacy (0) is distinguished from ignoring someone in distress (2)', () => {
    const q = BANK_EN.find(x => x.id === 'em2')!;
    expect(q.options.find(o => /privacy/.test(o.text))!.points).toBe(0);
    expect(q.options.find(o => /as if nothing happened/.test(o.text))!.points).toBe(2);
  });
  it('every answer in the bank is distinct', () => {
    const t = BANK_EN.flatMap(q => q.options.map(o => o.text.toLowerCase())); expect(new Set(t).size).toBe(t.length);
  });
});

describe('Who is in Control? v2 bank: results', () => {
  it('always-assertive players land in "driver\'s seat" on any selection', () => {
    for (const n of [10, 15, 20]) for (let k = 0; k < 50; k++) {
      const acts = selectActivities(e, n, { random: rng(hash(`as${n}${k}`)) }) as Q[];
      const r = personalResult({ ...e, rounds: [{ id: 'main', activities: acts }] }, Object.fromEntries(acts.map(a => [a.id, at(a, 1).id])));
      expect(r.band!.tone).toBe('great');
    }
  });
  it('a strong ego reflex in one area is named in the reflection, and the challenge targets it', () => {
    const s = sessionExperience(e, { n: 15, seed: 'one-area' });
    const acts = s.rounds[0].activities as Q[];
    const r = personalResult(s, Object.fromEntries(acts.map(a => [a.id, at(a, a.dimension === 'recognition' ? 3 : 0).id])));
    expect(r.feedback!.reflection?.theme).toBe('recognition');
    expect(r.challenge).toBe(e.insights!.themes.recognition.challenge);
  });
});
