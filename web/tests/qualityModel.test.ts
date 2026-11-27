import { describe, it, expect } from 'vitest';
import type { Activity } from '../src/engine/schema';
import { findDuplicates, diffAgainstPublished, summaryText, stableEqual } from '../src/builder/qualityModel';

const q = (id: string, prompt: string, answers = ['Open answer', 'Guarded answer'], extra: Partial<Activity> = {}): Activity =>
  ({ id, type: 'choice', prompt, shuffle: true, options: answers.map((t, k) => ({ id: 'abcd'[k], text: t, points: k })), ...extra }) as Activity;

describe('C4c duplicates', () => {
  it('finds identical questions ignoring case, accents, punctuation and spacing', () => {
    const d = findDuplicates([q('a', 'Your manager rewrites your report.'), q('b', 'your  MANAGER rewrites your report'), q('c', 'Something else entirely here')]);
    expect(d.get('a')).toEqual([{ kind: 'same', with: 'b' }]); expect(d.get('b')).toEqual([{ kind: 'same', with: 'a' }]); expect(d.has('c')).toBe(false);
  });
  it('finds very similar questions (80% of words) but not merely related ones', () => {
    const d = findDuplicates([q('a', 'A colleague presents your idea in a meeting without naming you'), q('b', 'A colleague presents your idea in the meeting without naming you'),
      q('c', 'A colleague presents their own idea in a planning meeting')]);
    expect(d.get('a')?.[0]).toEqual({ kind: 'similar', with: 'b' }); expect(d.has('c')).toBe(false);
  });
  it('flags repeated answers within one question and works for Arabic', () => {
    expect(findDuplicates([q('a', 'Q', ['Same answer', 'same answer!'])]).get('a')).toEqual([{ kind: 'answers' }]);
    const d = findDuplicates([q('a', 'زميلة تبكي بعد اجتماع صعب'), q('b', 'زميلةٌ تبكي بعد اجتماعٍ صعب')]);
    expect(d.get('a')?.[0].kind).toBe('same');
  });
  it('checks 200 questions quickly', () => {
    const acts = Array.from({ length: 200 }, (_, i) => q(`q${i}`, `Situation ${i} about a ${['team', 'client', 'manager'][i % 3]} moment at work number ${i * 7}`));
    const t = performance.now(); findDuplicates(acts); expect(performance.now() - t).toBeLessThan(200);
  });
});

describe('C4c draft vs published', () => {
  const pub = [q('a', 'One'), q('b', 'Two'), q('c', 'Three', undefined, { active: false }), q('d', 'Four')];
  it('labels new, edited, archived and restored questions, and lists deleted ones', () => {
    const draft = [q('a', 'One'), q('b', 'Two, reworded'), q('c', 'Three'), q('d', 'Four', undefined, { active: false }), q('e', 'Five')];
    const x = diffAgainstPublished([...draft.filter(a => a.id !== 'a')], pub, 3)!;
    expect(Object.fromEntries(x.changes)).toEqual({ b: 'edited', c: 'restored', d: 'archived', e: 'new' });
    expect(x.deleted).toEqual([{ id: 'a', prompt: 'One' }]);
    expect(summaryText(x)).toBe('5 unpublished changes since version 3: 1 new, 1 edited, 1 archived, 1 restored, 1 deleted.');
  });
  it('ignores key order and the internal version counter, so re-saved content is not "edited"', () => {
    const rev = (o: unknown): unknown => Array.isArray(o) ? o.map(rev) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).reverse().map(([k, v]) => [k, rev(v)])) : o;
    const reordered = pub.map(a => rev(a) as Activity);
    const x = diffAgainstPublished(reordered.map(a => ({ ...a, rev: 7 }) as Activity), pub, 1)!;
    expect(x.total).toBe(0); expect(summaryText(x)).toBe('No changes since version 1.');
    expect(stableEqual({ a: 1, b: [1, { c: 2, d: undefined }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
  });
  it('never modifies the published list it compares against', () => {
    const snap = JSON.stringify(pub); diffAgainstPublished([q('a', 'Changed')], pub, 2); expect(JSON.stringify(pub)).toBe(snap);
    expect(diffAgainstPublished([], null, 0)).toBeNull();
  });
});
