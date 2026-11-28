// PulsePlay experience schema v1. Pure TypeScript + zod: no React, no Supabase.
import { z } from 'zod';

export const SCHEMA_VERSION = 1 as const;
export const SELECTION_STRATEGIES = ['fixed', 'random', 'category', 'dimension'] as const;

const id = z.string().regex(/^[a-z0-9-]{1,40}$/, 'ids use a-z, 0-9 and hyphens');
const text = (max: number) => z.string().trim().min(1).max(max);

export const Timing = z.object({
  readSec: z.number().int().min(0).max(30),
  answerSec: z.number().int().min(3).max(120),
});

const ChoiceOption = z.object({
  id,
  text: text(140),
  points: z.number().int().min(0).max(10).optional(),
  correct: z.boolean().optional(),
});

const tag = z.string().regex(/^[a-z0-9-]{1,30}$/, 'tags use a-z, 0-9 and hyphens');
/** Question-bank metadata. All optional: content without it behaves exactly as before. */
const bankMeta = {
  category: tag.optional(),                   // balanced-by-category key (e.g. trivia topic)
  dimension: tag.optional(),                  // balanced-by-dimension key (e.g. a behavioural dimension)
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  tags: z.array(tag).max(10).optional(),
  estSec: z.number().int().min(3).max(120).optional(), // estimated response time
  rev: z.number().int().min(1).max(999).optional(),    // question version within the bank
  active: z.boolean().optional(),             // false = archived, never selected
  random: z.boolean().optional(),             // false = only used by the fixed selection
  required: z.boolean().optional(),           // true = included in every selection
};
const base = { id, prompt: text(220), theme: z.string().max(40).optional(), timing: Timing.optional(), ...bankMeta };

export const ChoiceActivity = z.object({
  ...base,
  type: z.literal('choice'),
  options: z.array(ChoiceOption).min(2).max(6),
  shuffle: z.boolean().default(true),
  explanation: z.string().max(400).optional(),
});
export const PollActivity = z.object({
  ...base,
  type: z.literal('poll'),
  options: z.array(z.object({ id, text: text(140), emoji: z.string().max(8).optional() })).min(2).max(6),
});
export const ScaleActivity = z.object({
  ...base,
  type: z.literal('scale'),
  min: z.number().int().min(0).max(1),
  max: z.number().int().min(3).max(10),
  minLabel: text(40),
  maxLabel: text(40),
});
export const ReflectionActivity = z.object({ ...base, type: z.literal('reflection') });
/** Open answer: participants type their own words. Never scored; moderated before display by default. */
export const OpenActivity = z.object({
  ...base,
  type: z.literal('open'),
  display: z.enum(['cloud', 'wall', 'list']).default('cloud'),   // word cloud | answer cards | readable list
  maxChars: z.number().int().min(1).max(140).default(25),
  maxWords: z.number().int().min(1).max(30).optional(),         // e.g. 1 for "one word"
  maxResponses: z.number().int().min(1).max(5).default(1),      // answers per participant
  submitSec: z.number().int().min(0).max(600).default(60),      // submission window; 0 = open until the host closes it
  editSec: z.number().int().min(0).max(120).default(15),        // how long a participant may change an answer
  moderation: z.enum(['approve', 'live']).default('approve'),   // host approves each answer | shown at once unless flagged
  showAnswers: z.enum(['live', 'closed']).default('live'),      // on screen while answering | only once submissions close
  placeholder: z.string().max(60).optional(),
});

export const Activity = z.discriminatedUnion('type', [ChoiceActivity, PollActivity, ScaleActivity, ReflectionActivity, OpenActivity]);
export const KNOWN_ACTIVITY_TYPES = ['choice', 'poll', 'scale', 'reflection', 'open'] as const;

export const ResultBand = z.object({
  min: z.number().int().min(0).max(100),
  max: z.number().int().min(0).max(100),
  emoji: z.string().max(8),
  title: text(80),
  message: text(200),
  explanation: text(400),
  groupTitle: text(80).optional(),
  groupMessage: text(200).optional(),
  tone: z.enum(['great', 'good', 'watch', 'grow']),
});

const Theme = z.object({ label: text(40), strength: text(160), growth: text(160), habit: text(200), challenge: text(200) });

export const Experience = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id,
  title: text(60),
  tagline: text(120),
  emoji: z.string().max(12),
  category: z.enum(['icebreaker', 'team-building', 'reflection', 'workplace-culture', 'communication', 'leadership',
    'collaboration', 'trivia', 'education', 'community', 'intercultural', 'creative', 'problem-solving', 'fun']),
  description: text(600),
  durationMin: z.number().int().min(1).max(180),
  players: z.object({ min: z.number().int().min(1), max: z.number().int().max(500) }),
  languages: z.array(z.enum(['en', 'ar', 'de', 'fr'])).min(1),
  ageRating: z.enum(['all', '12+', '16+', 'adults']),
  contentNotes: z.string().max(300).optional(),
  facilitator: z.enum(['required', 'optional']),
  modes: z.array(z.enum(['live', 'self', 'practice'])).min(1),
  defaultTiming: Timing,
  reveal: z.enum(['none', 'distribution', 'correct']),
  privacy: z.object({ individualResults: z.boolean(), groupMinimum: z.number().int().min(3).max(50), retainResponses: z.boolean() }),
  scoring: z.object({ kind: z.enum(['behaviour', 'correct', 'aggregate', 'none']), minAnsweredRatio: z.number().min(0).max(1).default(0.7) }),
  results: z.array(ResultBand).optional(),
  insights: z.object({ themes: z.record(Theme), defaultHabit: text(200), defaultChallenge: text(200) }).optional(),
  transitions: z.array(text(120)).optional(),
  closing: z.object({ questions: z.array(text(140)).max(5), message: text(200) }).optional(),
  disclaimer: text(240),
  creator: text(80),
  status: z.enum(['draft', 'review', 'published', 'archived']),
  rounds: z.array(z.object({ id, title: z.string().max(80).optional(), activities: z.array(Activity).min(1) })).min(1),
  /** Question bank: how a session picks its questions. Absent = every question, in authored order (previous behaviour). */
  bank: z.object({
    strategy: z.enum(SELECTION_STRATEGIES),
    lengths: z.array(z.number().int().min(3).max(50)).min(1).max(5),
    defaultLength: z.number().int().min(3).max(50).optional(),
  }).optional(),
  /** Written by the server into a session snapshot: which questions this session uses. Never authored. */
  selection: z.object({
    strategy: z.enum(SELECTION_STRATEGIES), count: z.number().int(), bankSize: z.number().int(), ids: z.array(z.string()),
  }).optional(),
});

export type Experience = z.infer<typeof Experience>;
export type Activity = z.infer<typeof Activity>;
export type ResultBand = z.infer<typeof ResultBand>;
export type Timing = z.infer<typeof Timing>;

export interface ValidationResult { ok: boolean; errors: string[]; warnings: string[]; experience?: Experience }

/** Structural (zod) + semantic validation. Used at publish time and in tests. */
export function validateExperience(input: unknown): ValidationResult {
  const errors: string[] = [], warnings: string[] = [];
  const parsed = Experience.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`), warnings };
  }
  const e = parsed.data;
  const acts = flatActivities(e);
  const ids = new Set<string>();
  for (const a of acts) { if (ids.has(a.id)) errors.push(`duplicate activity id "${a.id}"`); ids.add(a.id); }
  if (e.players.min > e.players.max) errors.push('players.min is greater than players.max');

  if (e.scoring.kind === 'behaviour') {
    for (const a of acts) {
      if (a.type !== 'choice') continue;
      if (a.options.some(o => o.points === undefined)) errors.push(`${a.id}: behaviour scoring needs points on every option`);
      const pts = a.options.map(o => o.points ?? 0);
      if (Math.min(...pts) !== 0) warnings.push(`${a.id}: no 0-point (most reflective) option`);
    }
  }
  if (e.scoring.kind === 'correct') {
    for (const a of acts) {
      if (a.type !== 'choice') continue;
      const n = a.options.filter(o => o.correct).length;
      if (n !== 1) errors.push(`${a.id}: needs exactly one correct option (has ${n})`);
    }
  }
  for (const a of acts) {
    if (a.type !== 'open') continue;
    if (a.moderation === 'live') warnings.push(`${a.id}: open answers appear on screen without your approval (links and basic offensive words are still held back)`);
    if (a.maxWords && a.maxWords * 2 > a.maxChars) warnings.push(`${a.id}: ${a.maxWords} words rarely fit in ${a.maxChars} characters`);
  }
  if (e.scoring.kind === 'behaviour' || e.scoring.kind === 'correct') {
    const bandErr = validateBands(e.results ?? []);
    errors.push(...bandErr);
  }
  if (e.bank) {
    const b = e.bank, ls = b.lengths;
    if (new Set(ls).size !== ls.length || ls.some((n, i) => i > 0 && n <= ls[i - 1])) errors.push('bank.lengths must be unique and ascending');
    if (b.defaultLength != null && !ls.includes(b.defaultLength)) errors.push('bank.defaultLength must be one of bank.lengths');
    const pool = acts.filter(a => a.active !== false && (b.strategy === 'fixed' || a.random !== false));
    const req = pool.filter(a => a.required).length;
    if (req > ls[0]) errors.push(`${req} required questions do not fit the shortest game (${ls[0]})`);
    const short = ls.filter(n => n > pool.length);
    if (short.length) warnings.push(`only ${pool.length} eligible questions: ${short.join('/')}-question games are not available`);
    if (b.strategy === 'category' || b.strategy === 'dimension') {
      const key = b.strategy, missing = pool.filter(a => !a[key]).length;
      if (missing) warnings.push(`${missing} eligible questions have no ${b.strategy}; they are balanced as one extra group`);
    }
  }
  if (acts.some(a => a.required && a.active === false)) errors.push('an archived question cannot be required');
  if (e.reveal === 'correct' && e.scoring.kind !== 'correct') warnings.push('reveal "correct" is only meaningful with correct-answer scoring');
  if (e.insights) {
    for (const a of acts) if (a.theme && !e.insights.themes[a.theme]) errors.push(`${a.id}: theme "${a.theme}" has no insight entry`);
  }
  return { ok: errors.length === 0, errors, warnings, experience: errors.length ? undefined : e };
}

/** Bands must cover every integer 0..100 exactly once. */
export function validateBands(bands: ResultBand[]): string[] {
  const errs: string[] = [];
  if (!bands.length) return ['result bands are required for scored experiences'];
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  if (sorted[0].min !== 0) errs.push('result bands must start at 0');
  if (sorted[sorted.length - 1].max !== 100) errs.push('result bands must end at 100');
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    if (b.min > b.max) errs.push(`band "${b.title}" has min > max`);
    const next = sorted[i + 1];
    if (next && next.min <= b.max) errs.push(`bands "${b.title}" and "${next.title}" overlap`);
    if (next && next.min > b.max + 1) errs.push(`gap between ${b.max} and ${next.min}`);
  }
  return errs;
}

export function flatActivities(e: Pick<Experience, 'rounds'>): Activity[] {
  return e.rounds.flatMap(r => r.activities);
}

export function timingOf(e: Experience, a: Activity): Timing {
  const t = a.timing ?? e.defaultTiming;
  // open answers have their own submission window; 0 = open until the host closes it
  return a.type === 'open' ? { readSec: t.readSec, answerSec: a.submitSec || 86400 } : t;
}
