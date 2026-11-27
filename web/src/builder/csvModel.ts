// CSV import and export for question banks (PulsePlay Creator Studio C4b). Pure functions: parsing, the template,
// row-by-row checks in plain language, duplicate warnings and the import plan. Nothing here saves anything; the builder
// applies a plan only after the creator confirms, and published versions are never changed.
import { Activity as ActivitySchema, type Activity } from '../engine/schema';
import { normalize } from './listModel';
import type { Draft, GameKind } from './model';
import { kindOf } from './model';

export const MAX_ROWS = 200;
export const MAX_FILE_BYTES = 1024 * 1024;
const MAX_ANSWERS = 6;

// ---------- parsing ----------
export interface ParsedCsv { header: string[]; rows: string[][]; delimiter: ',' | ';' | '\t'; error?: string }

/** RFC 4180 CSV with the variations spreadsheets produce: UTF-8 BOM, comma / semicolon / tab, CRLF, quoted line breaks, "" escapes. */
export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const count = (c: string) => firstLine.split(c).length - 1;
  const delimiter = ([';', '\t', ','] as const).reduce((best, c) => (count(c) > count(best) ? c : best), ',' as ',' | ';' | '\t');
  const out: string[][] = []; let row: string[] = [], field = '', q = false, i = 0, quotedAt = -1;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"' && field === '') { q = true; quotedAt = out.length + 1; i++; continue; }
    if (c === delimiter) { row.push(field); field = ''; i++; continue; }
    if (c === '\r' || c === '\n') { row.push(field); out.push(row); row = []; field = ''; i += c === '\r' && text[i + 1] === '\n' ? 2 : 1; continue; }
    field += c; i++;
  }
  if (q) return { header: [], rows: [], delimiter, error: `A quoted value that starts on line ${quotedAt} never ends. Check for a missing closing quote (").` };
  if (field !== '' || row.length) { row.push(field); out.push(row); }
  const nonEmpty = out.filter(r => r.some(v => v.trim() !== ''));
  if (!nonEmpty.length) return { header: [], rows: [], delimiter, error: 'The file is empty.' };
  const [header, ...rows] = nonEmpty;
  return { header: header.map(h => h.trim().toLowerCase().replace(/\s+/g, '_')), rows, delimiter };
}

// ---------- template and export ----------
export function columnsFor(kind: GameKind): string[] {
  const ans = Array.from({ length: MAX_ANSWERS }, (_, k) => `answer_${k + 1}`);
  if (kind === 'quiz') return ['id', 'question', 'category', 'status', ...ans, 'correct', 'explanation'];
  if (kind === 'score') return ['id', 'question', 'category', 'area', 'status', ...ans.flatMap((a, k) => [a, `points_${k + 1}`])];
  return ['id', 'type', 'question', 'category', 'status', ...ans, 'scale_max', 'label_low', 'label_high'];
}
const esc = (v: string, d: string) => (v.includes(d) || /["\n\r]/.test(v) || v !== v.trim() ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(d: Draft, delimiter: ',' | ';' = ',', example = false): string {
  const kind = kindOf(d), cols = columnsFor(kind);
  const acts = example ? exampleRows(kind) : d.rounds.flatMap(r => r.activities);
  const line = (a: Activity) => cols.map(c => cell(a, c)).map(v => esc(v, delimiter)).join(delimiter);
  return '﻿' + [cols.join(delimiter), ...acts.map(line)].join('\r\n') + '\r\n';
}
function cell(a: Activity, c: string): string {
  const opts = 'options' in a ? a.options : [];
  let m: RegExpMatchArray | null;
  if (c === 'id') return a.id;
  if (c === 'type') return a.type;
  if (c === 'question') return a.prompt;
  if (c === 'category') return a.category ?? '';
  if (c === 'area') return a.dimension ?? '';
  if (c === 'status') return a.active === false ? 'archived' : 'in use';
  if ((m = c.match(/^answer_(\d)$/))) return opts[+m[1] - 1]?.text ?? '';
  if ((m = c.match(/^points_(\d)$/))) { const o = opts[+m[1] - 1]; return o && 'points' in o && o.points != null ? String(o.points) : ''; }
  if (c === 'correct') { const k = opts.findIndex(o => 'correct' in o && o.correct); return k >= 0 ? String(k + 1) : ''; }
  if (c === 'explanation') return a.type === 'choice' ? a.explanation ?? '' : '';
  if (c === 'scale_max') return a.type === 'scale' ? String(a.max) : '';
  if (c === 'label_low') return a.type === 'scale' ? a.minLabel : '';
  if (c === 'label_high') return a.type === 'scale' ? a.maxLabel : '';
  return '';
}
function exampleRows(kind: GameKind): Activity[] {
  if (kind === 'quiz') return [{ id: 'q1', type: 'choice', prompt: 'Which planet is known as the Red Planet?', shuffle: false, category: 'space', explanation: 'Iron oxide gives Mars its colour.',
    options: [{ id: 'a', text: 'Mars', correct: true }, { id: 'b', text: 'Venus', correct: false }, { id: 'c', text: 'Jupiter', correct: false }] }];
  if (kind === 'score') return [{ id: 'q1', type: 'choice', prompt: 'A colleague questions your plan in a meeting.', shuffle: true, category: 'feedback',
    options: [{ id: 'a', text: 'Ask what they would change', points: 0 }, { id: 'b', text: 'Explain your reasons calmly', points: 0 }, { id: 'c', text: 'Change the subject', points: 2 }, { id: 'd', text: 'Insist you are right', points: 3 }] }];
  return [{ id: 'q1', type: 'poll', prompt: 'Coffee or tea?', category: 'warm-up', options: [{ id: 'a', text: 'Coffee' }, { id: 'b', text: 'Tea' }] },
    { id: 'q2', type: 'scale', prompt: 'How energised do you feel today?', min: 1, max: 5, minLabel: 'Not at all', maxLabel: 'Completely' }];
}

// ---------- row checks and the import plan ----------
export type RowStatus = 'new' | 'update' | 'error';
export interface RowResult { line: number; status: RowStatus; activity?: Activity; errors: string[]; warnings: string[]; prompt: string; answers: number }
export interface ImportPlan { rows: RowResult[]; fileError?: string; unknownColumns: string[]; missingColumns: string[]; counts: { new: number; update: number; error: number; warnings: number } }
export type ImportMode = 'add' | 'update';

const tagOf = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
const LETTERS = 'abcdef';

export function planImport(d: Draft, parsed: ParsedCsv, mode: ImportMode, makeId: () => string): ImportPlan {
  const empty = { rows: [], unknownColumns: [], missingColumns: [], counts: { new: 0, update: 0, error: 0, warnings: 0 } };
  if (parsed.error) return { ...empty, fileError: parsed.error };
  const kind = kindOf(d), known = new Set([...columnsFor(kind), 'type', 'area', 'scale_max', 'label_low', 'label_high', 'explanation', 'correct',
    ...Array.from({ length: MAX_ANSWERS }, (_, k) => `points_${k + 1}`)]);
  const col = new Map(parsed.header.map((h, i) => [h, i]));
  const missing = ['question', 'answer_1'].filter(c => !col.has(c) && !(c === 'answer_1' && kind === 'talk'));
  if (!col.has('question')) return { ...empty, missingColumns: missing, fileError: 'The first line must name the columns, including "question". Download the template to see the expected columns.' };
  if (parsed.rows.length > MAX_ROWS) return { ...empty, fileError: `The file has ${parsed.rows.length} questions; at most ${MAX_ROWS} can be imported at once. Split it into smaller files.` };
  const existing = d.rounds.flatMap(r => r.activities), byId = new Map(existing.map(a => [a.id, a]));
  const seenPrompts = new Map(existing.map(a => [normalize(a.prompt), a.id]));
  const usedIds = new Set(existing.map(a => a.id));
  const rows = parsed.rows.map((r, k): RowResult => {
    const line = k + 2, get = (c: string) => (col.has(c) ? (r[col.get(c)!] ?? '').trim() : '');
    const errors: string[] = [], warnings: string[] = [];
    if (r.length > parsed.header.length && r.slice(parsed.header.length).some(v => v.trim())) warnings.push('This line has more values than there are columns; the extra values are ignored.');
    const prompt = get('question');
    const typeIn = (get('type') || (kind === 'quiz' || kind === 'score' ? 'choice' : 'poll')).toLowerCase();
    const allowed: Record<GameKind, string[]> = { quiz: ['choice'], score: ['choice'], poll: ['poll', 'scale'], talk: ['poll', 'scale', 'reflection'] };
    const type = typeIn as Activity['type'];
    if (!allowed[kind].includes(type)) errors.push(`Type "${typeIn}" is not available in this game. Use ${allowed[kind].join(' or ')}.`);
    if (!prompt) errors.push('The question is empty.');
    else if (prompt.length > 220) errors.push(`The question is too long (${prompt.length} characters, max 220).`);
    const texts = Array.from({ length: MAX_ANSWERS }, (_, j) => get(`answer_${j + 1}`));
    const lastFilled = texts.map(t => !!t).lastIndexOf(true);
    if (texts.slice(0, lastFilled + 1).some(t => !t)) errors.push('Answers must be filled from answer_1 onwards without gaps.');
    const answers = texts.filter(Boolean);
    answers.forEach((t, j) => { if (t.length > 140) errors.push(`answer_${j + 1} is too long (${t.length} characters, max 140).`); });
    if ((type === 'choice' || type === 'poll') && answers.length < 2) errors.push('Give at least 2 answers (answer_1 and answer_2).');
    if (new Set(answers.map(normalize)).size < answers.length) warnings.push('Two answers in this question are the same.');
    let activity: Activity | undefined;
    const id0 = get('id'), status = get('status').toLowerCase();
    if (status && !['in use', 'archived', 'active', ''].includes(status)) errors.push(`Status "${get('status')}" is unknown. Use "in use" or "archived".`);
    if (!errors.length) {
      const base: Record<string, unknown> = { id: '', prompt };
      const cat = tagOf(get('category')), area = tagOf(get('area'));
      if (cat) base.category = cat; if (area) base.dimension = area;
      if (status === 'archived') base.active = false;
      if (type === 'choice') {
        let opts: Record<string, unknown>[];
        if (kind === 'quiz') {
          const c = get('correct'), n = Number(c);
          if (!c) errors.push('Say which answer is correct in "correct" (1 for answer_1, 2 for answer_2, …).');
          else if (!Number.isInteger(n) || n < 1 || n > answers.length) errors.push(`"correct" must be a number from 1 to ${answers.length}.`);
          opts = answers.map((t, j) => ({ id: LETTERS[j], text: t, correct: j + 1 === n }));
          const ex = get('explanation'); if (ex) { if (ex.length > 400) errors.push('The explanation is too long (max 400 characters).'); base.explanation = ex; }
          base.shuffle = false;
        } else {
          opts = answers.map((t, j) => {
            const p = get(`points_${j + 1}`), n = Number(p);
            if (p === '') errors.push(`points_${j + 1} is empty. Give every answer a score (0 = most open).`);
            else if (!Number.isInteger(n) || n < 0 || n > 10) errors.push(`points_${j + 1} must be a whole number from 0 to 10 (found "${p}").`);
            return { id: LETTERS[j], text: t, points: n };
          });
          if (!errors.length && !opts.some(o => o.points === 0)) warnings.push('No answer scores 0, so nobody can get the best result on this question.');
          base.shuffle = true;
        }
        Object.assign(base, { type, options: opts });
      } else if (type === 'poll') Object.assign(base, { type, options: answers.map((t, j) => ({ id: LETTERS[j], text: t })) });
      else if (type === 'scale') {
        const mx = Number(get('scale_max') || 5);
        if (!Number.isInteger(mx) || mx < 3 || mx > 10) errors.push('scale_max must be a whole number from 3 to 10.');
        const lo = get('label_low') || 'Not at all', hi = get('label_high') || 'Completely';
        Object.assign(base, { type, min: 1, max: mx, minLabel: lo.slice(0, 40), maxLabel: hi.slice(0, 40) });
      } else Object.assign(base, { type });
      if (!errors.length) {
        // update keeps the existing id; otherwise a fresh id (an id in the file that is already used is never overwritten in "add" mode)
        const target = mode === 'update' && id0 ? byId.get(id0) : undefined;
        if (mode === 'update' && id0 && !target) warnings.push(`No question with id "${id0}" exists, so it will be added as a new question.`);
        if (mode === 'add' && id0 && byId.has(id0)) warnings.push(`Id "${id0}" is already used, so this row gets a new id.`);
        let id = target?.id ?? (id0 && !usedIds.has(id0) && /^[a-z0-9][a-z0-9_-]{0,39}$/i.test(id0) ? id0 : makeId());
        while (!target && usedIds.has(id)) id = makeId();
        usedIds.add(id); base.id = id;
        if (target) { for (const k of ['theme', 'timing', 'difficulty', 'tags', 'estSec', 'required', 'random'] as const) if (target[k] !== undefined && base[k] === undefined) base[k] = target[k]; base.rev = (target.rev ?? 1) + 1; }
        const v = ActivitySchema.safeParse(base);
        if (!v.success) errors.push(...v.error.issues.map(i => `${i.path.join('.') || 'row'}: ${i.message}`));
        else {
          activity = v.data;
          const np = normalize(prompt), same = seenPrompts.get(np);
          if (same && same !== id) warnings.push(`Possible duplicate: the same question already exists${same.startsWith('row:') ? ` on line ${same.slice(4)}` : ' in this game'}.`);
          if (!same) seenPrompts.set(np, `row:${line}`);
        }
      }
    }
    const st: RowStatus = errors.length ? 'error' : mode === 'update' && id0 && byId.has(id0) ? 'update' : 'new';
    return { line, status: st, activity: errors.length ? undefined : activity, errors, warnings, prompt, answers: answers.length };
  });
  const unknown = parsed.header.filter(h => h && !known.has(h));
  const counts = { new: rows.filter(r => r.status === 'new').length, update: rows.filter(r => r.status === 'update').length, error: rows.filter(r => r.status === 'error').length, warnings: rows.filter(r => r.warnings.length).length };
  return { rows, unknownColumns: unknown, missingColumns: missing, counts };
}

/** Apply a confirmed plan to the draft: updates replace in place, new questions are appended, error rows are skipped. */
export function applyImport(d: Draft, plan: ImportPlan): Draft {
  const ok = plan.rows.filter(r => r.activity);
  const upd = new Map(ok.filter(r => r.status === 'update').map(r => [r.activity!.id, r.activity!]));
  // untouched blank questions (a new game starts with a few) are dropped, as when adding AI-drafted questions
  const blank = (a: Activity) => !a.prompt.trim() && !('options' in a && a.options.some(o => o.text.trim()));
  const acts = d.rounds.flatMap(r => r.activities).filter(a => !blank(a) || upd.has(a.id)).map(a => upd.get(a.id) ?? a);
  const added = ok.filter(r => r.status === 'new').map(r => r.activity!);
  return { ...d, rounds: [{ ...d.rounds[0], id: d.rounds[0]?.id ?? 'main', activities: [...acts, ...added] }] };
}
