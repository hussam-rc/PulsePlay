import { describe, it, expect } from 'vitest';
import { blankDraft } from '../src/builder/model';
import type { Activity } from '../src/engine/schema';
import { normalize, searchText, filterActivities, highlight, problemIdsFrom, patchActivity, moveActivity, duplicateActivity, deleteActivity, replaceActivity, appendActivities, NO_FILTER, NO_GROUP } from '../src/builder/listModel';

const q = (id: string, prompt: string, answers: string[], extra: Partial<Activity> = {}): Activity =>
  ({ id, type: 'choice', prompt, shuffle: true, options: answers.map((t, k) => ({ id: 'abcd'[k], text: t, points: k })), ...extra }) as Activity;
const bank = (n: number) => Array.from({ length: n }, (_, i) => q(`q${i}`, `Situation ${i} at work`, [`Open ${i}`, `Ego ${i}`], { category: ['team', 'self'][i % 2], ...(i % 7 === 0 ? { active: false } : {}) }));
const draftOf = (acts: Activity[]) => { const d = blankDraft('score'); d.rounds[0].activities = acts; return d; };

describe('C4a list model: search', () => {
  it('normalises case, accents and Arabic spelling variants', () => {
    expect(normalize('Équipe  Réunion')).toBe('equipe reunion');
    expect(normalize('أَعْتَذِرُ')).toBe(normalize('اعتذر'));
    expect(normalize('مـديـرة')).toBe(normalize('مديره'));
    expect(normalize('إلى')).toBe(normalize('الي'));
  });
  it('finds words in prompts, answers and explanations, in any order', () => {
    const acts = [q('a', 'Your manager rewrites the report', ['Compare versions', 'Ask to be involved']), q('b', 'A client is angry', ['Acknowledge frustration', 'Explain calmly'], { explanation: 'Listening first helps' } as Partial<Activity>)];
    const s = (query: string) => filterActivities(acts, { ...NO_FILTER, query }).map(a => a.id);
    expect(s('report manager')).toEqual(['a']);
    expect(s('INVOLVED')).toEqual(['a']);
    expect(s('listening')).toEqual(['b']);
    expect(s('frustration calmly')).toEqual(['b']);
    expect(s('nothing like this')).toEqual([]);
    expect(searchText(acts[0])).toContain('compare versions');
  });
  it('combines search with category, status, type and problem filters', () => {
    const acts = bank(30);
    expect(filterActivities(acts, { ...NO_FILTER, status: 'archived' }).map(a => a.id)).toEqual(['q0', 'q7', 'q14', 'q21', 'q28']);
    expect(filterActivities(acts, { ...NO_FILTER, status: 'active', group: 'team' }).every(a => a.category === 'team' && a.active !== false)).toBe(true);
    expect(filterActivities(acts, { ...NO_FILTER, query: 'situation 1', group: 'self' }).map(a => a.id)).toContain('q1');
    expect(filterActivities(acts, { ...NO_FILTER, status: 'problems' }, new Set(['q3', 'q5'])).map(a => a.id)).toEqual(['q3', 'q5']);
    expect(filterActivities(acts, { ...NO_FILTER, type: 'poll' })).toEqual([]);
    const noCat = [...acts, q('x', 'Loose question', ['a', 'b'])];
    expect(filterActivities(noCat, { ...NO_FILTER, group: NO_GROUP }).map(a => a.id)).toEqual(['x']);
  });
  it('searching 200 questions stays well under a frame', () => {
    const acts = bank(200); const t = performance.now();
    for (let k = 0; k < 20; k++) filterActivities(acts, { ...NO_FILTER, query: `situation ${k} work`, status: 'active', group: 'team' });
    expect((performance.now() - t) / 20).toBeLessThan(8);
  });
  it('highlights hits in the original text, also with accents and Arabic', () => {
    expect(highlight('Réunion difficile', 'reunion').filter(p => p.hit).map(p => p.text)).toEqual(['Réunion']);
    expect(highlight('أعتذر له شخصيًا', 'اعتذر').some(p => p.hit)).toBe(true);
    expect(highlight('No match here', 'zzz')).toEqual([{ text: 'No match here', hit: false }]);
  });
  it('maps checker anchors to question ids', () => {
    expect([...problemIdsFrom(['q-2', 'results', 'q-99'], bank(3))]).toEqual(['q1']);
  });
});

describe('C4a list model: edits by id', () => {
  it('copies only the changed question; every other question keeps its identity', () => {
    const d = draftOf(bank(200)), before = d.rounds[0].activities;
    const after = patchActivity(d, 'q50', a => { a.prompt = 'Changed'; }).rounds[0].activities;
    expect(after[50].prompt).toBe('Changed'); expect(before[50].prompt).toBe('Situation 50 at work');
    expect(after.filter((a, i) => a === before[i]).length).toBe(199);
  });
  it('move, duplicate, replace, delete and append work by id and never touch the original draft', () => {
    const d = draftOf(bank(5)), ids = (x: typeof d) => x.rounds[0].activities.map(a => a.id);
    expect(ids(moveActivity(d, 'q2', -1))).toEqual(['q0', 'q2', 'q1', 'q3', 'q4']);
    expect(ids(moveActivity(d, 'q0', -1))).toEqual(ids(d));
    expect(ids(duplicateActivity(d, 'q1', 'new'))).toEqual(['q0', 'q1', 'new', 'q2', 'q3', 'q4']);
    expect(ids(deleteActivity(d, 'q3'))).toEqual(['q0', 'q1', 'q2', 'q4']);
    expect(replaceActivity(d, 'q4', q('q4', 'Replaced', ['a', 'b'])).rounds[0].activities[4].prompt).toBe('Replaced');
    expect(ids(appendActivities(d, [q('z', 'Z', ['a', 'b'])], a => a.id !== 'q0'))).toEqual(['q1', 'q2', 'q3', 'q4', 'z']);
    expect(ids(d)).toEqual(['q0', 'q1', 'q2', 'q3', 'q4']);
  });
});
