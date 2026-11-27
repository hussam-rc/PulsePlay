import { describe, it, expect } from 'vitest';
import { blankDraft } from '../src/builder/model';
import { parseCsv, toCsv, planImport, applyImport, columnsFor, MAX_ROWS } from '../src/builder/csvModel';
import { validateExperience } from '../src/engine/schema';

let n = 0; const mk = () => `n${n++}`;
const score = () => { const d = blankDraft('score'); d.rounds[0].activities = [
  { id: 'q1', type: 'choice', prompt: 'A colleague questions your plan.', shuffle: true, category: 'feedback', options: [{ id: 'a', text: 'Ask why', points: 0 }, { id: 'b', text: 'Insist', points: 3 }] },
  { id: 'q2', type: 'choice', prompt: 'You missed a deadline.', shuffle: true, active: false, options: [{ id: 'a', text: 'Tell them early', points: 0 }, { id: 'b', text: 'Blame others', points: 3 }] }]; return d; };

describe('C4b CSV parsing', () => {
  it('handles a BOM, semicolons, CRLF, quoted delimiters, quotes and line breaks', () => {
    const p = parseCsv('﻿question;answer_1;answer_2\r\n"Line one\r\nline two";"a; b";"He said ""hi"""\r\n');
    expect(p.delimiter).toBe(';'); expect(p.header).toEqual(['question', 'answer_1', 'answer_2']);
    expect(p.rows).toEqual([['Line one\r\nline two', 'a; b', 'He said "hi"']]);
  });
  it('detects comma and tab files and skips blank lines', () => {
    expect(parseCsv('question,answer_1\nQ,A\n\n').rows).toEqual([['Q', 'A']]);
    expect(parseCsv('question\tanswer_1\nQ\tA').delimiter).toBe('\t');
  });
  it('reports an unterminated quote with its line', () => {
    expect(parseCsv('question,answer_1\nok,fine\n"broken,x\n').error).toMatch(/line 3/);
    expect(parseCsv('').error).toBe('The file is empty.');
  });
  it('reads Arabic text unchanged', () => {
    expect(parseCsv('question;answer_1\nزميلة تبكي بعد اجتماع صعب.;أسألها بهدوء').rows[0][0]).toBe('زميلة تبكي بعد اجتماع صعب.');
  });
});

describe('C4b export and template', () => {
  it('round-trips a bank: export, parse, plan as update, apply = identical questions (except the version counter)', () => {
    const d = score(), csv = toCsv(d, ';');
    expect(csv.startsWith('﻿')).toBe(true);
    const plan = planImport(d, parseCsv(csv), 'update', mk);
    expect(plan.counts).toMatchObject({ update: 2, new: 0, error: 0 });
    const back = applyImport(d, plan).rounds[0].activities.map(({ rev, ...a }) => a);
    expect(back).toEqual(d.rounds[0].activities);
  });
  it('the template for each game type imports cleanly into a blank game of that type', () => {
    for (const kind of ['quiz', 'score', 'poll', 'talk'] as const) {
      const d = blankDraft(kind), plan = planImport(d, parseCsv(toCsv(d, ',', true)), 'add', mk);
      expect(plan.counts.error, kind).toBe(0); expect(plan.counts.new, kind).toBeGreaterThan(0);
      expect(validateExperience({ ...applyImport(d, plan), status: 'published' }).ok, kind).toBe(true);
    }
    expect(columnsFor('score')).toContain('points_6');
  });
});

describe('C4b row checks', () => {
  const plan = (csv: string, mode: 'add' | 'update' = 'add', d = score()) => planImport(d, parseCsv(csv), mode, mk);
  it('explains each problem in plain language and skips only the broken rows', () => {
    const p = plan(['question,answer_1,points_1,answer_2,points_2,status',
      ',A,0,B,3,',                      // empty question
      'Q2,A,0,,,',                      // one answer
      'Q3,A,zero,B,3,',                 // bad points
      'Q4,A,0,B,11,',                   // out of range
      'Q5,A,0,B,3,deleted',             // unknown status
      'Fine question,A,0,B,3,archived'].join('\n'));
    const e = p.rows.map(r => r.errors.join(' | '));
    expect(e[0]).toMatch(/question is empty/); expect(e[1]).toMatch(/at least 2 answers/); expect(e[2]).toMatch(/points_1 must be a whole number/);
    expect(e[3]).toMatch(/points_2 must be a whole number from 0 to 10/); expect(e[4]).toMatch(/Status "deleted" is unknown/);
    expect(p.rows[5].status).toBe('new'); expect(p.rows[5].activity?.active).toBe(false);
    expect(p.counts).toMatchObject({ error: 5, new: 1 });
  });
  it('quiz rows need exactly one correct answer by number', () => {
    const d = blankDraft('quiz');
    const p = planImport(d, parseCsv('question,answer_1,answer_2,correct\nQ,A,B,\nQ2,A,B,3\nQ3,A,B,2'), 'add', mk);
    expect(p.rows[0].errors[0]).toMatch(/which answer is correct/); expect(p.rows[1].errors[0]).toMatch(/from 1 to 2/);
    expect(p.rows[2].activity).toMatchObject({ options: [{ correct: false }, { correct: true }] });
  });
  it('warns about duplicates in the game and inside the file', () => {
    const p = plan('question,answer_1,points_1,answer_2,points_2\nA colleague questions your plan.,x,0,y,3\nNew one,x,0,y,3\nnew ONE,x,0,y,3');
    expect(p.rows[0].warnings.join()).toMatch(/already exists in this game/);
    expect(p.rows[2].warnings.join()).toMatch(/on line 3/);
    expect(p.counts.new).toBe(3);
  });
  it('add mode never overwrites: an existing id gets a new id; update mode replaces in place and bumps the version counter', () => {
    const csv = 'id,question,answer_1,points_1,answer_2,points_2\nq1,Changed text,A,0,B,2';
    const add = plan(csv, 'add'); expect(add.rows[0].status).toBe('new'); expect(add.rows[0].activity!.id).not.toBe('q1');
    const d = score(), upd = planImport(d, parseCsv(csv), 'update', mk), out = applyImport(d, upd).rounds[0].activities;
    expect(out).toHaveLength(2); expect(out[0]).toMatchObject({ id: 'q1', prompt: 'Changed text', rev: 2 });
    expect(d.rounds[0].activities[0].prompt).toBe('A colleague questions your plan.');   // the draft passed in is untouched
  });
  it('limits and file-level errors', () => {
    expect(plan('answer_1\nA').fileError).toMatch(/"question"/);
    const big = ['question,answer_1,points_1,answer_2,points_2', ...Array.from({ length: MAX_ROWS + 1 }, (_, i) => `Q${i},a,0,b,3`)].join('\n');
    expect(plan(big).fileError).toMatch(/at most 200/);
    expect(plan('question,answer_1\n"open').fileError).toMatch(/never ends/);
  });
  it('200 rows are checked quickly', () => {
    const csv = ['question,category,answer_1,points_1,answer_2,points_2', ...Array.from({ length: 200 }, (_, i) => `Question ${i},team,a,0,b,3`)].join('\n');
    const t = performance.now(); const p = plan(csv); expect(p.counts.new).toBe(200); expect(performance.now() - t).toBeLessThan(300);
  });
});
