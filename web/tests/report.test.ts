import { describe, it, expect } from 'vitest';
import { toCsv } from '../src/pages/Report';
import type { Report } from '../src/live/workspace';

const r: Report = { id: 'x', title: 'Team, "poll"', joined: 6, completed: 5, average: null, startedAt: null, endedAt: '2026-11-24T10:00:00Z', version: 1, scoring: 'aggregate', groupMinimum: 3, band: null,
  questions: [
    { id: 'q1', prompt: '=HYPERLINK("x")', type: 'poll', options: [{ id: 'a', text: 'Yes', correct: null }, { id: 'b', text: 'No', correct: null }], result: { n: 4, counts: { a: 3, b: 1 }, suppressed: false } },
    { id: 'q2', prompt: 'Small', type: 'poll', options: [{ id: 'a', text: 'A', correct: null }], result: { n: 2, counts: {}, suppressed: true } },
    { id: 'q3', prompt: 'Private', type: 'choice', options: [], result: null } ] };
describe('session CSV', () => {
  const csv = toCsv(r);
  it('starts with a BOM so Excel reads Arabic and accents correctly', () => expect(csv.charCodeAt(0)).toBe(0xfeff));
  it('quotes commas and quotes', () => expect(csv).toContain('"Team, ""poll"""'));
  it('neutralises spreadsheet formulas', () => { expect(csv).not.toMatch(/(^|,)=HYPERLINK/m); });
  it('writes counts and shares', () => expect(csv).toContain(',Yes,,3,75,4,'));
  it('marks suppressed and private questions without numbers', () => { expect(csv).toContain('Hidden: fewer than 3 answers'); expect(csv).toContain('Not collected for this game type'); });
});
