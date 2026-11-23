import { describe, it, expect } from 'vitest';
import { blankDraft, changeKind, humanize, KINDS, splitBands, GameKind } from '../src/builder/model';
import { validateExperience, validateBands } from '../src/engine/schema';
import { EXPERIENCES } from '../src/experiences';

const fill = (d: ReturnType<typeof blankDraft>) => {
  d.rounds[0].activities.forEach((a, i) => { a.prompt = `Question ${i + 1}?`; if ('options' in a) a.options.forEach((o, j) => { o.text = `Answer ${j + 1}`; }); });
  return d;
};
const kinds = Object.keys(KINDS) as GameKind[];

describe('no-code builder model', () => {
  it.each(kinds)('a filled-in blank %s game passes the engine checker', k => {
    const r = validateExperience({ ...fill(blankDraft(k)), status: 'published' });
    expect(r.errors).toEqual([]);
  });
  it('explains empty questions in plain language, pointing at the question', () => {
    const d = blankDraft('quiz'); const r = validateExperience({ ...d, status: 'published' });
    const p = humanize(r.errors, d);
    expect(p.some(x => x.where === 'Question 1' && x.text === 'Question text is empty.' && x.anchor === 'q-1')).toBe(true);
    expect(p.every(x => !/rounds\.|activities\.|String must/.test(x.text))).toBe(true);
  });
  it('explains a missing correct answer and result gaps', () => {
    const d = fill(blankDraft('quiz')); d.rounds[0].activities[1].type === 'choice' && d.rounds[0].activities[1].options.forEach(o => { o.correct = false; });
    d.results = d.results!.slice(0, 2);
    const p = humanize(validateExperience({ ...d, status: 'published' }).errors, d).map(x => `${x.where}: ${x.text}`);
    expect(p).toContain('Question 2: mark exactly one answer as correct (now 0).');
    expect(p).toContain('Results: The last result must end at 100.');
  });
  it.each([2, 3, 4, 5])('splitting into %i results covers 0-100 exactly', c => {
    expect(validateBands(splitBands([], c, 'score'))).toEqual([]);
  });
  it('switching game type keeps question and answer texts', () => {
    const quiz = fill(blankDraft('quiz'));
    for (const k of kinds) {
      const d = changeKind(quiz, k);
      expect(d.rounds[0].activities.map(a => a.prompt)).toEqual(quiz.rounds[0].activities.map(a => a.prompt));
      expect(validateExperience({ ...d, status: 'published' }).errors).toEqual([]);
    }
  });
  it('every built-in game opens in the builder without problems', () => {
    for (const e of EXPERIENCES) expect(humanize(validateExperience(e).errors, e)).toEqual([]);
  });
});
