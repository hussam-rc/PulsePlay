import { describe, it, expect } from 'vitest';
import { validateExperience, flatActivities } from '../src/engine/schema';
import { Session, Clock } from '../src/engine/session';
import { TEMPLATES } from '../src/builder/templates';
import { humanize, kindOf } from '../src/builder/model';

class FakeClock implements Clock {
  t = 1_000_000; private q: { at: number; fn: () => void; id: number }[] = []; private n = 0;
  now() { return this.t; }
  setTimeout(fn: () => void, ms: number) { const id = ++this.n; this.q.push({ at: this.t + ms, fn, id }); return id; }
  clearTimeout(h: unknown) { this.q = this.q.filter(x => x.id !== h); }
  advance(ms: number) { const end = this.t + ms; for (;;) { this.q.sort((a, b) => a.at - b.at); const nx = this.q[0]; if (!nx || nx.at > end) break; this.q.shift(); this.t = nx.at; nx.fn(); } this.t = end; }
}
const seeded = (s = 42) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

describe('Creator Studio starter templates', () => {
  it('offers the five planned templates (Team Challenge waits for team mechanics)', () => {
    expect(TEMPLATES.map(t => t.name)).toEqual(['Trivia Quiz', 'Icebreaker', 'Would You Rather?', 'Opinion Poll', 'Personal Reflection']);
  });
  for (const tpl of TEMPLATES) {
    it(`${tpl.name}: valid, publishable, no checker problems, matching game type`, () => {
      const d = tpl.build();
      expect(d.status).toBe('draft');
      const r = validateExperience({ ...d, status: 'published' });
      expect(r.errors).toEqual([]);
      expect(humanize(r.errors, d)).toEqual([]);
      expect(kindOf(d)).toBe(tpl.kind);
      expect(flatActivities(d).every(a => a.prompt.trim().length > 0)).toBe(true);
    });
    it(`${tpl.name}: plays end to end with simulated players`, () => {
      const clock = new FakeClock(), d = validateExperience({ ...tpl.build(), status: 'published' }).experience!;
      const s = new Session(d, clock, seeded()); s.addSimulated(8);
      s.next(); s.next();
      const n = flatActivities(d).length;
      for (let i = 0; i < n; i++) { clock.advance(30_000); clock.advance(30_000); if (i < n - 1) s.next(); }
      while (s.next()) { /* through results, group and closing */ }
      expect(['closing', 'ended']).toContain(s.state.stage);
      if (d.scoring.kind === 'behaviour' || d.scoring.kind === 'correct') expect(s.group().average).not.toBeNull();
    });
  }
  it('every build returns a fresh copy (editing one draft never changes the template)', () => {
    const a = TEMPLATES[0].build(), b = TEMPLATES[0].build();
    a.title = 'changed'; expect(b.title).not.toBe('changed');
  });
});
