import { describe, it, expect } from 'vitest';
import { blankDraft } from '../src/builder/model';
import { setBankEnabled, setBalance, toggleLength, setDefaultLength, setArchived, setGroup, renameGroup, groups, overview, previewSelections, toTag } from '../src/builder/bankModel';
import { humanize } from '../src/builder/model';
import { validateExperience } from '../src/engine/schema';
import { lengthOptions, selectActivities } from '../src/engine/bank';
import type { Activity } from '../src/engine/schema';

/** A self-reflection draft with n questions, cats[i % cats.length] as category, points 0/0/2/3 (or 0/1/2 when i % 4 == 3). */
function draft(n: number, cats = ['team', 'self', 'work']) {
  const d = blankDraft('score');
  d.rounds[0].activities = Array.from({ length: n }, (_, i): Activity => ({ id: `q${i + 1}`, type: 'choice', prompt: `Situation ${i + 1}`, shuffle: true, category: cats[i % cats.length],
    options: (i % 4 === 3 ? [0, 1, 2] : [0, 0, 2, 3]).map((p, k) => ({ id: 'abcd'[k], text: `Answer ${k + 1} of ${i + 1}`, points: p })) }));
  return d;
}
const valid = (d: ReturnType<typeof draft>) => validateExperience({ ...d, status: 'published' });

describe('creator question bank: model', () => {
  it('turning the bank on picks lengths the content can fill and a valid default; off restores "every question"', () => {
    const d = setBankEnabled(draft(24), true);
    expect(d.bank).toEqual({ strategy: 'category', lengths: [10, 15, 20], defaultLength: 10 });
    expect(valid(d).ok).toBe(true);
    expect(setBankEnabled(d, false).bank).toBeUndefined();
    expect(setBankEnabled(draft(6), true).bank!.lengths).toEqual([6]);
  });
  it('lengths stay ascending and unique, at least one remains, and the default follows', () => {
    let d = setBankEnabled(draft(30), true);
    d = toggleLength(d, 25); d = toggleLength(d, 5);
    expect(d.bank!.lengths).toEqual([5, 10, 15, 20, 25]);
    d = setDefaultLength(d, 15); d = toggleLength(d, 15);
    expect(d.bank!.defaultLength).toBe(5);
    expect(setDefaultLength(d, 99).bank!.defaultLength).toBe(5);
    let one = setBankEnabled(draft(10), true); one = toggleLength(one, one.bank!.lengths[0]);
    expect(one.bank!.lengths.length).toBe(1);
    expect(valid(d).ok).toBe(true);
  });
  it('archive keeps the question but no game selects it; restore makes it selectable again', () => {
    let d = setBankEnabled(draft(12), true); d = setBalance(d, 'random');
    d = setArchived(d, 'q1', true); d = setArchived(d, 'q2', true);
    expect(d.rounds[0].activities).toHaveLength(12);
    expect(overview(d)).toMatchObject({ total: 12, active: 10, archived: 2 });
    for (let s = 0; s < 20; s++) expect(selectActivities(d, 10, { random: Math.random }).map(a => a.id)).not.toContain('q1');
    d = setArchived(d, 'q1', false);
    expect(d.rounds[0].activities[0].active).toBeUndefined();
    expect(overview(d).active).toBe(11);
  });
  it('archiving below a length makes that length unavailable instead of padding', () => {
    let d = setBankEnabled(draft(10), true); d = setArchived(d, 'q3', true);
    expect(lengthOptions(d).find(o => o.n === 10)?.available).toBe(false);
    expect(humanize(valid(d).warnings, d).some(p => p.where === 'Question bank' && /Only 9 questions are in use/.test(p.text))).toBe(true);
  });
  it('categories: readable names stored as tags, counted per group, renamed everywhere, merged when renamed onto another', () => {
    let d = setBankEnabled(draft(9), true);
    d = setGroup(d, 'q1', 'category', 'Team Spirit!');
    expect(d.rounds[0].activities[0].category).toBe('team-spirit');
    expect(groups(d, 'category').map(g => [g.label, g.active])).toEqual([['Self', 3], ['Team', 2], ['Team Spirit', 1], ['Work', 3]]);
    d = renameGroup(d, 'category', 'team', 'Team spirit');
    expect(groups(d, 'category').find(g => g.tag === 'team-spirit')?.active).toBe(3);
    d = setGroup(d, 'q2', 'category', '');
    expect(d.rounds[0].activities[1].category).toBeUndefined();
    expect(toTag('Zusammenarbeit & Ärger')).toBe('zusammenarbeit-arger');
    expect(valid(d).ok).toBe(true);
  });
  it('balanced selection: three example games of each length, each covering every category evenly', () => {
    const d = setBankEnabled(draft(30), true);
    for (const n of [10, 15, 20]) {
      const s = previewSelections(d, n, 3);
      expect(s).toHaveLength(3);
      for (const g of s) {
        expect(g.questions).toHaveLength(n); expect(new Set(g.questions.map(q => q.id)).size).toBe(n);
        const c = Object.values(g.groups); expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1);
        expect(g.minutes).toBeGreaterThan(0);
      }
    }
    expect(previewSelections(d, 10, 3, 1)).toEqual(previewSelections(d, 10, 3, 1));
    expect(previewSelections(d, 25, 3)).toEqual([]);
  });
  it('variable maximum points are reported, not forced to 3', () => {
    const o = overview(setBankEnabled(draft(8), true));
    expect(o.maxPoints.filter(p => p === 3)).toHaveLength(6); expect(o.maxPoints.filter(p => p === 2)).toHaveLength(2);
  });
  it('content without a bank is unchanged by the builder: no bank fields are added', () => {
    const d = draft(5); const o = overview(d);
    expect(d.bank).toBeUndefined(); expect(o.lengths.map(l => l.n)).toContain(5);
    expect(JSON.stringify(d)).not.toMatch(/"active"|"bank"/);
  });
});
