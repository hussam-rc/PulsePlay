import { describe, it, expect } from 'vitest';
import { validateExperience, validateBands, flatActivities, Experience } from '../src/engine/schema';
import { personalResult, groupSummary, distribution } from '../src/engine/scoring';
import { Session, Clock } from '../src/engine/session';
import { order } from '../src/engine/random';
import { EXPERIENCES } from '../src/experiences';
import { egoCheck } from '../src/experiences/egoCheck';
import { mythOrFact } from '../src/experiences/mythOrFact';
import { wouldYouRather } from '../src/experiences/wouldYouRather';

// Deterministic fake clock so timing tests don't sleep.
class FakeClock implements Clock {
  t = 1_000_000; private q: { at: number; fn: () => void; id: number }[] = []; private n = 0;
  now() { return this.t; }
  setTimeout(fn: () => void, ms: number) { const id = ++this.n; this.q.push({ at: this.t + ms, fn, id }); return id; }
  clearTimeout(h: unknown) { this.q = this.q.filter(x => x.id !== h); }
  advance(ms: number) { const end = this.t + ms; for (;;) { this.q.sort((a, b) => a.at - b.at); const nx = this.q[0]; if (!nx || nx.at > end) break; this.q.shift(); this.t = nx.at; nx.fn(); } this.t = end; }
}
const seeded = (s = 42) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

describe('schema validation', () => {
  it('all seeded experiences validate with no errors', () => {
    for (const e of EXPERIENCES) { const r = validateExperience(e); expect(r.errors, e.id).toEqual([]); expect(r.ok).toBe(true); }
  });
  it('rejects overlapping and gapped result bands', () => {
    const b = egoCheck.results!;
    expect(validateBands([{ ...b[0], max: 30 }, b[1], b[2], b[3]])).toContain(`bands "${b[0].title}" and "${b[1].title}" overlap`);
    expect(validateBands([{ ...b[0], max: 20 }, b[1], b[2], b[3]]).some(x => x.startsWith('gap'))).toBe(true);
    expect(validateBands([b[1], b[2], b[3]])).toContain('result bands must start at 0');
  });
  it('requires exactly one correct option for trivia', () => {
    const bad = structuredClone(mythOrFact) as Experience;
    (bad.rounds[0].activities[0] as any).options.forEach((o: any) => (o.correct = true));
    expect(validateExperience(bad).errors.some(x => x.includes('exactly one correct'))).toBe(true);
  });
  it('requires points on every option for behaviour scoring', () => {
    const bad = structuredClone(egoCheck) as any; delete bad.rounds[0].activities[2].options[1].points;
    expect(validateExperience(bad).errors.some((x: string) => x.includes('needs points'))).toBe(true);
  });
  it('rejects unknown activity types and bad ids', () => {
    const bad = structuredClone(wouldYouRather) as any; bad.rounds[0].activities[0].type = 'hologram'; bad.id = 'Bad ID!';
    expect(validateExperience(bad).ok).toBe(false);
  });
  it('rejects duplicate activity ids', () => {
    const bad = structuredClone(wouldYouRather) as any; bad.rounds[0].activities[1].id = 'w1';
    expect(validateExperience(bad).errors).toContain('duplicate activity id "w1"');
  });
});

describe('Ego Check scoring (must match the live backend rubric)', () => {
  const acts = flatActivities(egoCheck);
  const pick = (pts: number[]) => Object.fromEntries(acts.map((a, i) => [a.id, a.type === 'choice' ? a.options.find(o => o.points === pts[i])!.id : null]));
  it('all reflective = 0, all ego = 100', () => {
    expect(personalResult(egoCheck, pick(acts.map(() => 0))).score).toBe(0);
    expect(personalResult(egoCheck, pick(acts.map(() => 3))).score).toBe(100);
  });
  it('band boundaries 25/26, 50/51, 75/76', () => {
    const resp = (n: number) => { let left = n; return Object.fromEntries(acts.map(a => { if (a.type !== 'choice') return [a.id, null];
      for (const v of [3, 2, 1, 0]) { const o = a.options.find(x => x.points === v); if (o && v <= left) { left -= v; return [a.id, o.id]; } } return [a.id, null]; })); };
    const r = (n: number) => personalResult(egoCheck, resp(n));
    expect([r(7).score, r(7).band!.emoji]).toEqual([23, '🥳']);
    expect([r(8).score, r(8).band!.emoji]).toEqual([27, '😎']);
    expect([r(16).score, r(16).band!.emoji]).toEqual([53, '🚦']);
    expect([r(23).score, r(23).band!.emoji]).toEqual([77, '🏎️']);
  });
  it('matches the live server for the pattern used in the backend test (options (i+q)%4) → team average 37', () => {
    const scores = [1, 2, 3, 4, 5, 6].map(i => personalResult(egoCheck, Object.fromEntries(acts.map((a, q) => [a.id, 'abcd'[(i + q) % 4]]))));
    expect(scores.map(s => s.score)).toEqual([43, 17, 53, 50, 43, 17]);
    expect(groupSummary(egoCheck, scores, 6).average).toBe(37);
  });
  it('unanswered questions are excluded, not counted as ego; <7 answered is invalid', () => {
    const six = Object.fromEntries(acts.map((a, i) => [a.id, i < 6 && a.type === 'choice' ? a.options.find(o => o.points === 3)!.id : null]));
    const r = personalResult(egoCheck, six);
    expect(r.answered).toBe(6); expect(r.valid).toBe(false); expect(r.score).toBe(100);
  });
  it('always gives two grounded observations, a habit and a challenge', () => {
    const mixed = acts.map((_, i) => (i % 3 ? 3 : 0)); // 6×3 + 4×0 = 60 → "grabbing the wheel" → 1 strength + 1 growth
    for (const pts of [acts.map(() => 0), acts.map(() => 3), mixed]) {
      const r = personalResult(egoCheck, pick(pts), 'seed');
      expect(r.observations).toHaveLength(2); expect(r.habit).toBeTruthy(); expect(r.challenge).toBeTruthy();
    }
    const m = personalResult(egoCheck, pick(mixed), 'seed');
    expect(m.observations.map(o => o.kind).sort()).toEqual(['growth', 'strength']);
  });
});

describe('group privacy thresholds', () => {
  const acts = flatActivities(egoCheck);
  const valid = () => personalResult(egoCheck, Object.fromEntries(acts.map(a => [a.id, 'a'])));
  it('suppresses the average below the minimum and the breakdown below twice the minimum', () => {
    expect(groupSummary(egoCheck, [valid(), valid(), valid(), valid()], 4).suppressed).toBe(true);
    const five = groupSummary(egoCheck, Array.from({ length: 5 }, valid), 5);
    expect(five.suppressed).toBe(false); expect(five.bands).toBeNull();
    expect(groupSummary(egoCheck, Array.from({ length: 10 }, valid), 10).bands).not.toBeNull();
  });
  it('poll distributions are suppressed below the group minimum', () => {
    const a = flatActivities(wouldYouRather)[0];
    expect(distribution(wouldYouRather, a, [{ w1: 'a' }, { w1: 'b' }]).suppressed).toBe(true);
    const d = distribution(wouldYouRather, a, [{ w1: 'a' }, { w1: 'b' }, { w1: 'a' }]);
    expect(d.suppressed).toBe(false); expect(d.counts).toEqual({ a: 2, b: 1 });
  });
});

describe('trivia scoring', () => {
  it('counts correct answers; missed questions are not correct', () => {
    const acts = flatActivities(mythOrFact);
    const allRight = Object.fromEntries(acts.map(a => [a.id, a.type === 'choice' ? a.options.find(o => o.correct)!.id : null]));
    expect(personalResult(mythOrFact, allRight).correct).toBe(10);
    const sevenRight = { ...allRight, m1: null, m2: null, m3: null };
    const r = personalResult(mythOrFact, sevenRight);
    expect([r.correct, r.score, r.band!.title]).toEqual([7, 70, 'Fact finder!']);
  });
});

// Engine tests use fixed 5 s timing, independent of each game's default.
const ego5 = { ...egoCheck, defaultTiming: { readSec: 5, answerSec: 5 } };
describe('session engine (practice mode)', () => {
  it('runs a full game: timing, duplicate and late rejection, pause/resume, results', () => {
    const clock = new FakeClock(); const s = new Session(ego5, clock, seeded()); s.autoSim = false;
    const me = s.join('Me'); s.addSimulated(5);
    expect(s.players.length).toBe(6);
    s.next(); s.next(); // intro, first question
    expect([s.state.stage, s.state.phase]).toEqual(['activity', 'read']);
    expect(s.answer(me.id, 'q1', 'a')).toBe('not_open');
    clock.advance(5000);
    expect(s.state.phase).toBe('answer');
    expect(s.answer(me.id, 'q1', 'zzz')).toBe('invalid');
    expect(s.answer(me.id, 'q1', 'c')).toBe('ok');
    expect(s.answer(me.id, 'q1', 'a')).toBe('duplicate');
    s.pause(); clock.advance(60_000); expect(s.state.phase).toBe('answer'); s.resume();
    clock.advance(5000);
    expect(s.state.phase).toBe('reveal');
    expect(s.answer(s.players[1].id, 'q1', 'a')).toBe('not_open');
    for (let i = 1; i < 10; i++) { s.next(); clock.advance(5000); s.answer(me.id, `q${i + 1}`, 'c'); clock.advance(5000); }
    s.next(); expect(s.state.stage).toBe('results');
    const r = s.resultFor(me.id)!; expect(r.answered).toBe(10); expect(r.valid).toBe(true);
    s.next(); expect(s.state.stage).toBe('group');
    expect(s.group().suppressed).toBe(true); // simulated players never answered (autoSim off)
  });
  it('late answers are rejected after the deadline', () => {
    const clock = new FakeClock(); const s = new Session(mythOrFact, clock, seeded()); s.autoSim = false;
    const me = s.join('Me'); s.next(); s.next(); clock.advance(4000);
    const deadline = s.state.deadline!; clock.t = deadline + 1;
    expect(s.answer(me.id, 'm1', 'myth')).toBe('late');
  });
  it('simulated players produce a group result without touching anything outside memory', () => {
    const clock = new FakeClock(); const s = new Session(ego5, clock, seeded(7)); s.addSimulated(8);
    s.next(); s.next();
    for (let i = 0; i < 10; i++) { clock.advance(5000); clock.advance(6000); if (i < 9) s.next(); }
    s.next(); s.next();
    const g = s.group(); expect(g.valid).toBeGreaterThanOrEqual(5); expect(g.average).not.toBeNull();
  });
  it('caps simulated players at 20 and blocks joins after the end', () => {
    const s = new Session(wouldYouRather, new FakeClock(), seeded()); s.addSimulated(50);
    expect(s.players.length).toBe(20); s.end(); expect(() => s.join('Late')).toThrow();
  });
});

describe('answer shuffling', () => {
  it('is stable per player and question, and a real permutation', () => {
    expect(order('p1', 'q1', 4)).toEqual(order('p1', 'q1', 4));
    expect([...order('p1', 'q1', 4)].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe('game language versions', () => {
  it('every language version is valid and scores exactly like the original', async () => {
    const { VARIANTS } = await import('../src/experiences');
    const { validateExperience } = await import('../src/engine/schema');
    const pts = (e: typeof egoCheck) => e.rounds.flatMap(r => r.activities).map(a => a.type === 'choice' ? a.options.map(o => `${a.id}${o.id}${o.points}`).join() : '');
    for (const v of VARIANTS) {
      expect(validateExperience(v).errors, v.id).toEqual([]);
      expect(pts(v)).toEqual(pts(egoCheck));
      expect(v.results!.map(b => [b.min, b.max, b.tone, b.emoji])).toEqual(egoCheck.results!.map(b => [b.min, b.max, b.tone, b.emoji]));
      expect(JSON.stringify(v)).not.toContain("Who's driving today"); // no untranslated English left
    }
    for (const e of [egoCheck, ...VARIANTS]) expect(JSON.stringify(e).toLowerCase()).not.toMatch(/autopilot|pilote auto|طيار/);
    // A band's short message must not repeat a sentence of its explanation (shown together on the result screen).
    const sentences = (t = '') => t.split(/(?<=[.!?。])\s+/).map(x => x.trim()).filter(x => x.length > 12);
    for (const e of [egoCheck, ...VARIANTS]) for (const b of e.results!) {
      const ex = sentences(b.explanation);
      for (const m of sentences(b.message)) expect(ex.some(x => x.slice(0, 20) === m.slice(0, 20) || x.slice(-25) === m.slice(-25)), `${e.id} ${b.title}: ${m}`).toBe(false);
    }
  });
});

describe('light engine helpers', () => {
  it('match the schema versions', async () => {
    const u = await import('../src/engine/util'), s = await import('../src/engine/schema');
    const { ALL_EXPERIENCES } = await import('../src/experiences');
    for (const e of ALL_EXPERIENCES) {
      expect(u.flatActivities(e)).toEqual(s.flatActivities(e));
      for (const a of s.flatActivities(e)) expect(u.timingOf(e, a)).toEqual(s.timingOf(e, a));
    }
  });
});
