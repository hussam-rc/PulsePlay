import { describe, it, expect } from 'vitest';
import { metadataRecommender as R } from '../src/experiences/recommend';
import { EXPERIENCES } from '../src/experiences';

const rec = (a: Parameters<typeof R.recommend>[0]) => R.recommend(a, EXPERIENCES);

describe('experience concierge (deterministic)', () => {
  it('icebreaker for 15 colleagues in 10 minutes puts Would You Rather first', () => {
    const r = rec({ audience: 'colleagues', goal: 'laugh', size: '6-15', time: '5-10' });
    expect(r[0].id).toBe('would-you-rather');
    expect(r[0].reasons.map(x => x.k)).toEqual(expect.arrayContaining(['goal', 'audience', 'time']));
  });
  it('learning goal puts Myth or Fact first', () => {
    expect(rec({ audience: 'students', goal: 'learn', size: '16-50', time: '10-20' })[0].id).toBe('myth-or-fact');
  });
  it('teamwork with colleagues and enough time puts the reflection game first', () => {
    expect(rec({ audience: 'colleagues', goal: 'teamwork', size: '6-15', time: '10-20' })[0].id).toBe('ego-check');
  });
  it('never suggests a game that cannot run for the group size', () => {
    expect(rec({ audience: 'friends', goal: 'teamwork', size: '2-5', time: 'long' }).map(r => r.id)).not.toContain('ego-check'); // needs 5+
  });
  it('solo only suggests self-paced games', () => {
    const r = rec({ audience: 'other', goal: 'learn', size: '1', time: 'long' });
    expect(r.length).toBeGreaterThan(0); expect(r.every(x => x.reasons.some(y => y.k === 'solo'))).toBe(true);
  });
  it('flags games longer than the time available instead of hiding them', () => {
    const r = rec({ audience: 'colleagues', goal: 'laugh', size: '6-15', time: 'lt5' });
    expect(r.every(x => x.warnings.some(w => w.k === 'tooLong'))).toBe(true);
  });
  it('returns at most three, in a stable order', () => {
    const a = { audience: 'community', goal: 'connect', size: '16-50', time: '20-45' } as const;
    expect(rec(a).length).toBeLessThanOrEqual(3); expect(rec(a)).toEqual(rec(a));
  });
});
