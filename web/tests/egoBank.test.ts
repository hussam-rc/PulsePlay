// Release 3.0B draft: structural rules for the 60-question bank. The draft is not published; these checks gate review.
import { describe, it, expect } from 'vitest';
import { BANK_EN, DIMENSIONS } from '../src/experiences/drafts/egoCheckV2.en';
import { egoCheckV2Draft as e } from '../src/experiences/drafts/egoCheckV2';
import { validateExperience } from '../src/engine/schema';
import { lengthOptions, selectActivities, sessionExperience } from '../src/engine/bank';
import { personalResult } from '../src/engine/scoring';
import { rng, hash } from '../src/engine/random';

describe('Who is in Control? v2 draft bank', () => {
  it('validates, with 60 questions, 10 per dimension, offering 10 / 15 / 20', () => {
    const v = validateExperience(e);
    expect(v.errors).toEqual([]); expect(v.warnings).toEqual([]);
    expect(BANK_EN.length).toBe(60);
    for (const d of DIMENSIONS) expect(BANK_EN.filter(q => q.dimension === d).length).toBe(10);
    expect(lengthOptions(e).map(o => [o.n, o.available])).toEqual([[10, true], [15, true], [20, true]]);
  });
  it('every question has exactly one answer at each level 0-3, with stable unique ids', () => {
    expect(new Set(BANK_EN.map(q => q.id)).size).toBe(60);
    for (const q of BANK_EN) {
      expect(q.options.map(o => o.points).sort()).toEqual([0, 1, 2, 3]);
      expect(q.options.map(o => o.id)).toEqual(['a', 'b', 'c', 'd']);
      expect(new Set(q.options.map(o => o.text)).size).toBe(4);
      expect(q.theme).toBe(q.dimension);
    }
  });
  it('no answer letter is systematically the "good" one', () => {
    for (const letter of ['a', 'b', 'c', 'd']) {
      const zeros = BANK_EN.filter(q => q.options.find(o => o.id === letter)!.points === 0).length;
      expect(zeros).toBeGreaterThanOrEqual(10); expect(zeros).toBeLessThanOrEqual(20);
    }
  });
  it('short enough for timed play on phones', () => {
    for (const q of BANK_EN) { expect(q.prompt.length).toBeLessThanOrEqual(90); for (const o of q.options) expect(o.text.length).toBeLessThanOrEqual(70); }
  });
  it('uses ego wording, no clinical or judging labels', () => {
    const all = JSON.stringify(e).toLowerCase();
    for (const banned of ['autopilot', 'narciss', 'disorder', 'toxic', 'diagnos', 'arrogant', 'selfish']) expect(all).not.toContain(banned);
  });
  it('healthy confidence never lands in an ego category, whatever questions are drawn', () => {
    for (const n of [10, 15, 20]) for (let k = 0; k < 50; k++) {
      const acts = selectActivities(e, n, { random: rng(hash(`hc${n}${k}`)) });
      const ans = Object.fromEntries(acts.map(a => [a.id, (a as typeof BANK_EN[number]).options.find(o => o.points === 1)!.id]));
      const r = personalResult({ ...e, rounds: [{ id: 'main', activities: acts }] }, ans);
      expect(r.band!.tone).toBe('good');
    }
  });
  // Current (v1) insight rules give "great" results two strengths and no growth line; the habit still targets the reflex.
  // Proposal for the v2 results presentation: always name the strongest growth area when any answer scored 3 (needs approval).
  it('a strong ego reflex in one area still drives the personal habit and challenge', () => {
    const s = sessionExperience(e, { n: 15, seed: 'one-area' });
    const acts = s.rounds[0].activities as typeof BANK_EN;
    const ans = Object.fromEntries(acts.map(a => [a.id, a.options.find(o => o.points === (a.dimension === 'recognition' ? 3 : 0))!.id]));
    const r = personalResult(s, ans);
    expect(r.band!.tone).toBe('great');
    expect(r.habit).toBe(e.insights!.themes.recognition.habit);
    expect(r.challenge).toBe(e.insights!.themes.recognition.challenge);
  });
});
