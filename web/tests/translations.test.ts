// 3.0B translations: completeness and parity with the English master. Drafts stay unpublished until reviewed.
import { describe, it, expect } from 'vitest';
import { egoCheckV2Draft as en, egoCheckV2For, LANGUAGE_PACKS } from '../src/experiences/drafts/egoCheckV2';
import { TRANSLATION_STATUS } from '../src/experiences/drafts/translate';
import { BANK_EN } from '../src/experiences/drafts/egoCheckV2.en';
import { validateExperience } from '../src/engine/schema';
import { personalResult } from '../src/engine/scoring';
import { sessionExperience } from '../src/engine/bank';
import { ALL_EXPERIENCES } from '../src/experiences';

const ids = BANK_EN.map(q => q.id).sort();
describe.each(LANGUAGE_PACKS.map(p => [p.lang, p] as const))('translation %s', (lang, pack) => {
  const e = egoCheckV2For(pack);
  const acts = e.rounds[0].activities as typeof BANK_EN;
  it('is complete: every question, no extras, no empty or duplicate answers', () => {
    expect(Object.keys(pack.bank).sort()).toEqual(ids);
    for (const [id, [prompt, opts]] of Object.entries(pack.bank)) {
      expect(prompt.trim().length, id).toBeGreaterThan(10);
      expect(opts.every(o => o.trim().length > 2), id).toBe(true);
      expect(new Set(opts).size, id).toBe(4);
    }
  });
  it('keeps the master\'s option ids and points for every question', () => {
    for (const q of acts) {
      const m = BANK_EN.find(x => x.id === q.id)!;
      expect(q.options.map(o => [o.id, o.points])).toEqual(m.options.map(o => [o.id, o.points]));
      expect(q.dimension).toBe(m.dimension);
    }
  });
  it('validates as a full experience with the same bank settings and bands', () => {
    const v = validateExperience(e); expect(v.errors).toEqual([]); expect(v.warnings).toEqual([]);
    expect(e.bank).toEqual(en.bank); expect(e.scoring).toEqual(en.scoring);
    expect(e.results!.map(b => [b.min, b.max, b.tone, b.emoji])).toEqual(en.results!.map(b => [b.min, b.max, b.tone, b.emoji]));
    expect(Object.keys(e.insights!.themes).sort()).toEqual(Object.keys(en.insights!.themes).sort());
  });
  it('fits phones (prompts <= 110, answers <= 90 characters)', () => {
    for (const q of acts) { expect(q.prompt.length, q.id).toBeLessThanOrEqual(110); for (const o of q.options) expect(o.text.length, q.id).toBeLessThanOrEqual(90); }
  });
  it('uses the agreed wording', () => {
    const all = JSON.stringify(e);
    expect(all).not.toMatch(/autopilot|pilote automatique|طيار آلي|narciss|narziss|toxi|الغرور|نرجس/i);
    if (lang === 'ar') { expect(all).toContain('الأنا'); expect(/[؀-ۿ]/.test(acts[0].prompt)).toBe(true); }
  });
  it('produces v2 feedback in its own language', () => {
    const s = sessionExperience(e, { n: 15, seed: lang });
    const q = s.rounds[0].activities as typeof BANK_EN;
    const r = personalResult(s, Object.fromEntries(q.map((a, i) => [a.id, a.options.find(o => o.points === (i === 2 ? 3 : 0))!.id])));
    expect(r.feedback!.challenge.text).toBe(pack.insights.themes[q[2].dimension].challenge);
    expect(Object.values(pack.insights.themes).map(t => t.strength)).toEqual(expect.arrayContaining(r.feedback!.strengths.map(x => x.text)));
  });
});

describe('translation workflow', () => {
  it('tracks every language and keeps unreviewed drafts out of the catalogue', () => {
    expect(Object.keys(TRANSLATION_STATUS).sort()).toEqual(['ar', 'de', 'fr']);
    const published = JSON.stringify(ALL_EXPERIENCES);
    for (const q of ['sa10', 'em10', 'rc6']) expect(published).not.toContain(`"id":"${q}"`); // no v2 bank ids in published content
    for (const [, s] of Object.entries(TRANSLATION_STATUS)) if (s.status === 'reviewed') expect(s.reviewer && s.date).toBeTruthy();
  });
});
