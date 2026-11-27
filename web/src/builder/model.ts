// No-code builder model: game types, blank drafts, safe edits and plain-language checker messages.
// Everything here produces the same schema v1 the engine, the server and the publish function validate.
import type { Activity, Experience, ResultBand } from '../engine/schema';

export type Draft = Experience;           // drafts use the published shape; status stays 'draft'
export type GameKind = 'quiz' | 'poll' | 'score' | 'talk';

export const KINDS: Record<GameKind, { emoji: string; label: string; blurb: string; activity: Activity['type'][] }> = {
  quiz:  { emoji: '🧠', label: 'Quiz', blurb: 'Questions with one right answer. Players see their score and an explanation; optional nickname leaderboard.', activity: ['choice'] },
  poll:  { emoji: '📊', label: 'Opinion poll', blurb: 'No right answers. The room sees how everyone voted, anonymously (like Would You Rather?).', activity: ['poll', 'scale'] },
  score: { emoji: '🪞', label: 'Self-reflection', blurb: 'Each answer carries 0–3 points. Everyone gets a private result; the group sees only an anonymous average.', activity: ['choice'] },
  talk:  { emoji: '💬', label: 'Conversation starter', blurb: 'Prompts, polls and scales to spark discussion. No scores at all.', activity: ['poll', 'scale', 'reflection'] },
};
export const ACTIVITY_LABEL: Record<Activity['type'], string> = { choice: 'Multiple choice', poll: 'Poll (everyone votes)', scale: 'Scale (1 to N)', reflection: 'Open reflection (nothing is collected)' };

export function kindOf(d: Draft): GameKind {
  if (d.scoring.kind === 'correct') return 'quiz';
  if (d.scoring.kind === 'behaviour') return 'score';
  if (d.scoring.kind === 'aggregate') return 'poll';
  return 'talk';
}

let n = 0;
export const newId = (p = 'q') => `${p}${Date.now().toString(36).slice(-4)}${(n++).toString(36)}`.toLowerCase();
const LETTERS = 'abcdef';

export function newActivity(type: Activity['type'], kind: GameKind): Activity {
  const id = newId();
  if (type === 'choice') return { id, type, prompt: '', shuffle: kind !== 'quiz' ? true : false,
    options: kind === 'quiz' ? [{ id: 'a', text: '', correct: true }, { id: 'b', text: '', correct: false }] : [{ id: 'a', text: '', points: 0 }, { id: 'b', text: '', points: 3 }] };
  if (type === 'poll') return { id, type, prompt: '', options: [{ id: 'a', text: '' }, { id: 'b', text: '' }] };
  if (type === 'scale') return { id, type, prompt: '', min: 1, max: 5, minLabel: 'Not at all', maxLabel: 'Completely' };
  return { id, type, prompt: '' };
}

export function nextOptionId(opts: { id: string }[]) { return LETTERS.split('').find(l => !opts.some(o => o.id === l)) ?? newId('o'); }

/** Evenly split 0..100 into bands, keeping the texts of existing bands where they exist. */
export function splitBands(old: ResultBand[], count: number, kind: GameKind): ResultBand[] {
  const tones: ResultBand['tone'][] = kind === 'quiz' ? ['grow', 'watch', 'good', 'great'] : ['great', 'good', 'watch', 'grow'];
  const sorted = [...old].sort((a, b) => a.min - b.min);
  return Array.from({ length: count }, (_, i) => {
    const min = Math.round((i * 101) / count), max = Math.round(((i + 1) * 101) / count) - 1;
    const prev = sorted[i];
    return { emoji: prev?.emoji ?? ['🌱', '🙂', '😎', '🏆'][i % 4], title: prev?.title ?? `Result ${i + 1}`, message: prev?.message ?? 'Write what this result means.',
      explanation: prev?.explanation ?? 'Explain why someone gets this result.', tone: prev?.tone ?? tones[Math.min(i, 3)], groupTitle: prev?.groupTitle, groupMessage: prev?.groupMessage, min, max: i === count - 1 ? 100 : max };
  });
}

const BASE = (kind: GameKind, title: string): Draft => ({
  schemaVersion: 1, id: 'my-game', title, tagline: KINDS[kind].blurb.split('.')[0] + '.', emoji: KINDS[kind].emoji,
  category: kind === 'quiz' ? 'trivia' : kind === 'score' ? 'reflection' : kind === 'poll' ? 'icebreaker' : 'communication',
  description: 'Describe your game in one or two sentences: what players do and what they get out of it.', durationMin: 10,
  players: { min: kind === 'score' ? 5 : 3, max: 80 }, languages: ['en'], ageRating: 'all', facilitator: 'optional', modes: ['live', 'self', 'practice'],
  defaultTiming: { readSec: 3, answerSec: kind === 'quiz' ? 15 : 10 },
  reveal: kind === 'quiz' ? 'correct' : kind === 'talk' ? 'distribution' : kind === 'poll' ? 'distribution' : 'none',
  privacy: { individualResults: kind === 'quiz' || kind === 'score', groupMinimum: kind === 'score' ? 5 : 3, retainResponses: false },
  scoring: { kind: kind === 'quiz' ? 'correct' : kind === 'score' ? 'behaviour' : kind === 'poll' ? 'aggregate' : 'none', minAnsweredRatio: 0.7 },
  disclaimer: kind === 'score' ? 'A light-hearted reflection, not an assessment. Results are private.' : 'Answers are anonymous. Only group totals are shown.',
  creator: 'PulsePlay creator', status: 'draft',
  closing: { questions: ['What surprised you?', 'What will you take away from this?'], message: 'Thanks for playing!' },
  rounds: [{ id: 'main', activities: [newActivity(KINDS[kind].activity[0], kind), newActivity(KINDS[kind].activity[0], kind), newActivity(KINDS[kind].activity[0], kind)] }],
});
export function blankDraft(kind: GameKind, title = 'My new game'): Draft {
  const d = BASE(kind, title);
  if (kind === 'quiz' || kind === 'score') d.results = splitBands([], kind === 'quiz' ? 3 : 4, kind);
  return d;
}

/** Switching game type keeps every question text and answer text, and adjusts what each type needs. */
export function changeKind(d: Draft, kind: GameKind): Draft {
  const fresh = blankDraft(kind);
  const allowed = KINDS[kind].activity;
  const acts = d.rounds.flatMap(r => r.activities).map((a): Activity => {
    const opts = 'options' in a ? a.options.map(o => ({ id: o.id, text: o.text })) : null;
    if (allowed.includes(a.type) && !(a.type === 'choice')) return a;
    if (kind === 'quiz' && opts) return { id: a.id, type: 'choice', prompt: a.prompt, shuffle: false, options: opts.map((o, i) => ({ ...o, correct: i === 0 })), explanation: 'explanation' in a ? a.explanation : undefined };
    if (kind === 'score' && opts) return { id: a.id, type: 'choice', prompt: a.prompt, shuffle: true, options: opts.map((o, i) => ({ ...o, points: i === 0 ? 0 : Math.min(3, i) })), theme: a.theme };
    if ((kind === 'poll' || kind === 'talk') && opts) return { id: a.id, type: 'poll', prompt: a.prompt, options: opts };
    return { ...newActivity(allowed[0], kind), id: a.id, prompt: a.prompt };
  });
  return { ...d, scoring: fresh.scoring, reveal: fresh.reveal, privacy: { ...d.privacy, individualResults: fresh.privacy.individualResults },
    results: kind === 'quiz' || kind === 'score' ? (d.results?.length ? d.results : fresh.results) : undefined,
    insights: kind === 'score' ? d.insights : undefined, rounds: [{ id: d.rounds[0]?.id ?? 'main', activities: acts }] };
}

// ---------- plain-language checker ----------
export interface Problem { where: string; anchor: string; text: string }
const FIELD: Record<string, string> = { title: 'Game name', tagline: 'Short tagline', description: 'Description', disclaimer: 'Privacy note', creator: 'Made by', emoji: 'Icon',
  durationMin: 'Duration', 'players.min': 'Minimum players', 'players.max': 'Maximum players', languages: 'Languages', 'closing.message': 'Closing message' };

export function humanize(errors: string[], d: Draft): Problem[] {
  const acts = d.rounds.flatMap(r => r.activities);
  const qn = (id: string) => { const i = acts.findIndex(a => a.id === id); return i < 0 ? null : i + 1; };
  return errors.map(e => {
    const [path, ...rest] = e.split(': '); const msg = rest.join(': ') || path;
    const m = path.match(/^rounds\.(\d+)\.activities\.(\d+)\.?(.*)$/);
    if (m) {
      const q = d.rounds.slice(0, +m[1]).reduce((s, r) => s + r.activities.length, 0) + +m[2] + 1; const f = m[3];
      const what = /^options\.(\d+)\.text/.test(f) ? `Answer ${+f.split('.')[1] + 1}` : f.startsWith('options') ? 'Answers' : f === 'prompt' ? 'Question text' : /Label$/.test(f) ? 'Scale label' : f === 'explanation' ? 'Explanation' : 'This question';
      return { where: `Question ${q}`, anchor: `q-${q}`, text: `${what} ${plain(msg)}` };
    }
    const b = path.match(/^results\.(\d+)\.?(.*)$/);
    if (b) return { where: `Result ${+b[1] + 1}`, anchor: 'results', text: `${b[2] ? cap(b[2]) + ' ' : ''}${plain(msg)}` };
    const sem = e.match(/^([a-z0-9-]+): (.*)$/);
    if (sem && qn(sem[1])) return { where: `Question ${qn(sem[1])}`, anchor: `q-${qn(sem[1])}`, text: semantic(sem[2]) };
    if (/^bank\.|eligible questions|required questions|archived question/.test(e)) return { where: 'Question bank', anchor: 'bank', text: semantic(e) };
    if (/band|result/i.test(e)) return { where: 'Results', anchor: 'results', text: semantic(e) };
    if (FIELD[path]) return { where: 'Basics', anchor: 'basics', text: `${FIELD[path]} ${plain(msg)}` };
    if (path.startsWith('rounds')) return { where: 'Questions', anchor: 'questions', text: plain(msg) };
    return { where: 'Game', anchor: 'basics', text: semantic(e) };
  });
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function plain(m: string) {
  let r: RegExpMatchArray | null;
  if (/at least 1 character/.test(m)) return 'is empty.';
  if ((r = m.match(/at most (\d+) character/))) return `is too long (max ${r[1]} characters).`;
  if ((r = m.match(/Array must contain at least (\d+)/))) return `needs at least ${r[1]}.`;
  if ((r = m.match(/Array must contain at most (\d+)/))) return `can have at most ${r[1]}.`;
  if ((r = m.match(/greater than or equal to (\d+)/))) return `must be at least ${r[1]}.`;
  if ((r = m.match(/less than or equal to (\d+)/))) return `must be at most ${r[1]}.`;
  return m.endsWith('.') ? m : m + '.';
}
function semantic(m: string) {
  return m.replace(/needs exactly one correct option \(has (\d+)\)/, (_, k) => `mark exactly one answer as correct (now ${k}).`)
    .replace('behaviour scoring needs points on every option', 'every answer needs a score from 0 to 3.')
    .replace('no 0-point (most reflective) option', 'no answer scores 0, so nobody can get the best result on this one.')
    .replace(/theme "(.*)" has no insight entry/, 'uses a theme from the template that no longer has a tip. Pick another question type or keep the original theme.')
    .replace('result bands must start at 0', 'The first result must start at 0.').replace('result bands must end at 100', 'The last result must end at 100.')
    .replace(/bands "(.*)" and "(.*)" overlap/, 'Results "$1" and "$2" overlap.').replace(/gap between (\d+) and (\d+)/, 'No result covers the scores between $1 and $2.')
    .replace('result bands are required for scored experiences', 'Add at least one result.')
    .replace('players.min is greater than players.max', 'Minimum players is higher than maximum players.')
    .replace(/duplicate activity id .*/, 'Two questions share an id. Duplicate it again or delete one.')
    .replace('bank.lengths must be unique and ascending', 'Each game length can be chosen only once.')
    .replace('bank.defaultLength must be one of bank.lengths', 'The suggested length must be one of the game lengths.')
    .replace(/(\d+) required questions do not fit the shortest game \((\d+)\)/, '$1 questions are always included, which is more than the shortest game ($2).')
    .replace(/only (\d+) eligible questions: (.*)-question games are not available/, 'Only $1 questions are in use, so $2-question games cannot be offered yet.')
    .replace(/(\d+) eligible questions have no (category|dimension); they are balanced as one extra group/, (_, k, w) => `${k} questions have no ${w === 'dimension' ? 'area' : 'category'}; they are mixed as one extra group.`)
    .replace('an archived question cannot be required', 'An archived question cannot be always included.');
}
