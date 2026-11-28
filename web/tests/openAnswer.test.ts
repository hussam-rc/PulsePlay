import { describe, it, expect } from 'vitest';
import migration from '../../supabase/migrations/20261128_0200_pp_open_answers.sql?raw';
import clientRules from '../src/engine/openAnswer.ts?raw';
import { Experience, OpenActivity as OpenSchema, validateExperience, timingOf } from '../src/engine/schema';
import { answerKey, checkAnswer, cleanAnswer, cloud, cloudSize, isFlagged, looksLikeLink, OPEN_DEFAULTS, type OpenActivity } from '../src/engine/openAnswer';
import { personalResult } from '../src/engine/scoring';
import { Session, Clock } from '../src/engine/session';
import { sessionView } from '../src/live/view';
import { layoutCloud, visibleItems } from '../src/live/open';
import { mythOrFact } from '../src/experiences/mythOrFact';
import { newActivity } from '../src/builder/model';
import { LOCALES } from '../src/i18n';

class FakeClock implements Clock {
  t = 1_000_000; private q: { at: number; fn: () => void; id: number }[] = []; private n = 0;
  now() { return this.t; }
  setTimeout(fn: () => void, ms: number) { const id = ++this.n; this.q.push({ at: this.t + ms, fn, id }); return id; }
  clearTimeout(h: unknown) { this.q = this.q.filter(x => x.id !== h); }
  advance(ms: number) { const end = this.t + ms; for (;;) { this.q.sort((a, b) => a.at - b.at); const nx = this.q[0]; if (!nx || nx.at > end) break; this.q.shift(); this.t = nx.at; nx.fn(); } this.t = end; }
}
const act = (o: Partial<OpenActivity> = {}) => OpenSchema.parse({ id: 'w1', type: 'open', prompt: 'One word for today?', maxWords: 2, maxResponses: 3, ...o }) as OpenActivity;

describe('open answer rules (shared by phone, practice engine and server)', () => {
  it('cleans text: trims, collapses spaces, strips control, zero-width and bidi characters', () => {
    expect(cleanAnswer('  hello ​  world‮ ')).toBe('hello world');
    expect(cleanAnswer('a\u0000b')).not.toContain('\u0000');
  });
  it('groups identical answers case-insensitively and ignores edge punctuation, but never merges translations', () => {
    expect(answerKey('Teamwork!')).toBe(answerKey('teamwork'));
    expect(answerKey('  TEAMWORK. ')).toBe(answerKey('teamwork'));
    expect(answerKey('Teamwork')).not.toBe(answerKey('Teamarbeit'));
    expect(answerKey('سَلام')).toBe(answerKey('سلام'));        // tashkeel is spelling, not meaning
    expect(answerKey('سلام')).not.toBe(answerKey('peace'));
  });
  it('enforces length, word count, empty and link rules', () => {
    const a = act({ maxChars: 10 });
    expect(checkAnswer(a, '   ')).toEqual({ ok: false, error: 'empty' });
    expect(checkAnswer(a, 'x'.repeat(11))).toEqual({ ok: false, error: 'too_long' });
    expect(checkAnswer(act(), 'one two three')).toEqual({ ok: false, error: 'too_many_words' });
    for (const l of ['www.x.com', 'http://a.b', 'spam.ru', '@handle']) expect(looksLikeLink(l), l).toBe(true);
    expect(checkAnswer(act(), 'see spam.ru')).toEqual({ ok: false, error: 'link' });
    expect(looksLikeLink('e.g.')).toBe(false);
  });
  it('keeps HTML as plain text (rendering escapes it)', () => {
    const c = checkAnswer(act({ maxChars: 60, maxWords: undefined }), '<img src=x onerror=alert(1)>');
    expect(c.ok).toBe(true);
  });
  it('flags common offensive words in EN/DE/FR/AR, including leetspeak, without false positives', () => {
    for (const w of ['sh1t', 'F U C K'.replace(/ /g, ''), 'Arschloch', 'putain', 'شرموط']) expect(isFlagged(w), w).toBe(true);
    for (const w of ['Shitake', 'Scunthorpe', 'class', 'كلب', 'Dick Fosbury', 'nazi history']) expect(isFlagged(w), w).toBe(false);
  });
  it('uses the same blocklist as the database', () => {
    const sqlList = migration.match(/_open_flag[\s\S]*?unnest\(array\[([\s\S]*?)\]\)/)![1].match(/'([^']+)'/g)!.map((x: string) => x.slice(1, -1));
    const tsList = clientRules.match(/const BLOCK: string\[\] = \[([\s\S]*?)\];/)![1].replace(/\/\/.*$/gm, '').match(/'([^']+)'/g)!.map((x: string) => x.slice(1, -1));
    expect(tsList.sort()).toEqual(sqlList.sort());
  });
  it('builds a word cloud from shown answers only, most common spelling first appearance order', () => {
    const items = [
      { text: 'Calm', key: 'calm', status: 'shown' as const, at: 1 }, { text: 'calm', key: 'calm', status: 'shown' as const, at: 2 },
      { text: 'calm', key: 'calm', status: 'shown' as const, at: 3 }, { text: 'Busy', key: 'busy', status: 'pending' as const, at: 4 },
      { text: 'Tired', key: 'tired', status: 'hidden' as const, at: 5 }, { text: 'Happy', key: 'happy', status: 'shown' as const, at: 6 },
    ];
    expect(cloud(items)).toMatchObject([{ key: 'calm', text: 'calm', count: 3 }, { key: 'happy', text: 'Happy', count: 1 }]);
    expect(cloud(items)).toHaveLength(2);
    expect(cloudSize(1, 10)).toBeLessThan(cloudSize(10, 10));
    expect(cloudSize(10, 10)).toBe(5.5);
  });
});

describe('open questions in experiences', () => {
  const withOpen = (o: Partial<OpenActivity> = {}): Experience => ({ ...mythOrFact, id: 'oa-test', rounds: [{ ...mythOrFact.rounds[0], activities: [act(o), ...mythOrFact.rounds[0].activities.slice(0, 2)] }] });
  it('validates, uses its own submission window and has builder defaults per display', () => {
    const e = withOpen(); expect(validateExperience(e).errors).toEqual([]);
    expect(timingOf(e, e.rounds[0].activities[0]).answerSec).toBe(60);
    expect(timingOf(withOpen({ submitSec: 0 }), act({ submitSec: 0 })).answerSec).toBe(86400);
    const n = { ...newActivity('open', 'poll'), prompt: 'Q' }; expect(n.type).toBe('open'); expect(OpenSchema.safeParse(n).success).toBe(true);
    expect(OPEN_DEFAULTS.wall.maxChars).toBeGreaterThan(OPEN_DEFAULTS.cloud.maxChars);
  });
  it('is never scored: personal results ignore open answers', () => {
    const e = withOpen(), choice = e.rounds[0].activities[1] as Extract<Experience['rounds'][0]['activities'][0], { type: 'choice' }>;
    const right = choice.options.find(o => o.correct)!.id;
    const r = personalResult(e, { w1: 'anything', [choice.id]: right }, 'p');
    const r2 = personalResult(withOpen(), { [choice.id]: right }, 'p');
    expect(r).toEqual(r2);
  });

  const run = (o: Partial<OpenActivity> = {}) => {
    const clock = new FakeClock(), s = new Session(withOpen(o), clock, () => 0.5);
    s.autoSim = false;
    const p = s.join('A'), q = s.join('B'); s.join('C');
    s.next(); s.next(); clock.advance(10_000);       // lobby → intro → first question → answer phase
    expect(s.state.phase).toBe('answer');
    return { s, clock, p, q };
  };
  it('practice engine: limits, duplicates, moderation, edit window and Next closing', () => {
    const { s, clock, p, q } = run({ editSec: 10 });
    expect(s.openSubmit(p.id, 'w1', 'Calm').status).toBe('ok');
    expect(s.openSubmit(p.id, 'w1', 'calm!').status).toBe('duplicate');
    expect(s.openSubmit(q.id, 'w1', 'CALM').status).toBe('ok');      // other people may say the same thing
    expect(s.openSubmit(p.id, 'w1', 'Focus').status).toBe('ok');
    const third = s.openSubmit(p.id, 'w1', 'Busy');
    expect(third.status).toBe('ok');
    expect(s.openSubmit(p.id, 'w1', 'More').status).toBe('limit');
    expect(s.answeredCount()).toBe(2);                                // people, not answers
    let v = sessionView(s, true);
    expect(v.open!.pending).toBe(4); expect(visibleItems(v.open)).toEqual([]);  // host approval by default
    s.openCommand('open_approve', { all: true });
    v = sessionView(s, true);
    expect(cloud(visibleItems(v.open).map(x => ({ text: x.t, key: x.k, status: 'shown' as const, at: x.at })))[0]).toMatchObject({ key: 'calm', count: 2 });
    expect(s.openSubmit(p.id, 'w1', 'Busier', third.id).status).toBe('ok');   // edit inside the window
    clock.advance(11_000);
    expect(s.openSubmit(p.id, 'w1', 'Later', third.id).status).toBe('edit_closed');
    s.next(); expect(s.state.phase).toBe('reveal');
    expect(s.openSubmit(q.id, 'w1', 'Late').status).toBe('not_open');
  });
  it('flagged answers wait for the host even in live mode; approve-all skips them', () => {
    const { s, p, q } = run({ moderation: 'live' });
    s.openSubmit(p.id, 'w1', 'great'); s.openSubmit(q.id, 'w1', 'sh1t');
    let v = sessionView(s, true);
    expect(visibleItems(v.open).map(x => x.t)).toEqual(['great']);
    s.openCommand('open_approve', { all: true }); v = sessionView(s, true);
    expect(v.open!.items!.find(x => x.t === 'sh1t')!.s).toBe('pending');
    s.openCommand('open_hide', { ids: [v.open!.items![0].id] }); v = sessionView(s, true);
    expect(visibleItems(v.open)).toEqual([]);
  });
  it('the public view never contains answer texts or who wrote them', () => {
    const { s, p } = run({ moderation: 'live' });
    s.openSubmit(p.id, 'w1', 'secretword');
    const pub = JSON.stringify(sessionView(s, false));
    expect(pub).not.toContain('secretword'); expect(pub).not.toContain(p.id);
    const host = JSON.stringify(sessionView(s, true).open);
    expect(host).toContain('secretword'); expect(host).not.toContain(p.id);
  });
  it('clear and reveal: clear hides earlier answers, closed-mode waits for reveal', () => {
    const { s, clock, p, q } = run({ moderation: 'live', showAnswers: 'closed' });
    s.openSubmit(p.id, 'w1', 'one');
    expect(sessionView(s, true).open!.visible).toBe(false);
    s.openCommand('open_reveal'); expect(sessionView(s, true).open!.visible).toBe(true);
    clock.advance(5); s.openCommand('open_clear'); clock.advance(5);
    s.openSubmit(q.id, 'w1', 'two');
    expect(visibleItems(sessionView(s, true).open).map(x => x.t)).toEqual(['two']);
  });
  it('simulated players type answers in practice', () => {
    const clock = new FakeClock(), s = new Session(withOpen({ moderation: 'live' }), clock, () => 0.5);
    s.addSimulated(5); s.next(); s.next(); clock.advance(70_000);
    expect((s.open.w1 ?? []).length).toBeGreaterThan(0);
  });
});

describe('word cloud layout', () => {
  const words = Array.from({ length: 120 }, (_, i) => ({ key: `w${i}`, text: `word${i}`, count: 1 + (i % 7), first: i }));
  const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
  it('places 120 words inside the box without overlaps', () => {
    const l = layoutCloud(words, 1200, 600, new Map()).placed;
    expect(l.length).toBe(120);
    for (const p of l) { expect(p.x - p.w / 2).toBeGreaterThanOrEqual(0); expect(p.x + p.w / 2).toBeLessThanOrEqual(1200); }
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) expect(overlap(l[i], l[j]), `${l[i].key}/${l[j].key}`).toBe(false);
  });
  it('keeps existing words in place when new words arrive (no jumping layout)', () => {
    const a = layoutCloud(words.slice(0, 20), 1200, 600, new Map()), first = a.placed;
    let prev = new Map(first.map(p => [p.key, p])), sc = a.scale, second = first;
    for (const n of [30, 60, 120]) { const r = layoutCloud(words.slice(0, n), 1200, 600, prev, sc); second = r.placed; sc = r.scale; prev = new Map(second.map(p => [p.key, p])); expect(second.length).toBe(n); }
    const moved = first.filter(p => { const q = second.find(x => x.key === p.key)!; return q.x !== p.x || q.y !== p.y; });
    expect(moved.length).toBe(0);
  });
  it('works on a phone-sized box', () => { expect(layoutCloud(words.slice(0, 40), 340, 360, new Map()).placed.length).toBe(40); });
});

describe('open answer translations', () => {
  it('every oa.* key exists in DE, FR and AR', () => {
    const en = Object.keys(LOCALES.en.strings).filter(k => k.startsWith('oa.'));
    expect(en.length).toBeGreaterThan(40);
    for (const l of ['de', 'fr', 'ar'] as const) for (const k of en) expect((LOCALES[l].strings as Record<string, string>)[k], `${l}:${k}`).toBeTruthy();
  });
});
