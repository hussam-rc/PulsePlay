// Discovery metadata, kept apart from game content so finding a game never changes how it plays or scores.
// Editorial and factual only: no popularity numbers. Moves into pp.experiences when community publishing arrives.
import type { Experience } from '../engine/schema';

export const PURPOSES = [
  ['icebreak', '🧊'], ['trust', '🤝'], ['fun', '😂'], ['learn', '🧠'],
  ['ideas', '💡'], ['cultures', '🌍'], ['conversation', '💬'], ['challenge', '🎯'],
] as const;
export type Purpose = typeof PURPOSES[number][0];
export type Format = 'reflection' | 'opinion' | 'quiz';

export const AUDIENCES = ['colleagues', 'community', 'students', 'friends', 'conference', 'other'] as const;
export type Audience = typeof AUDIENCES[number];

export const CATALOG: Record<string, { purposes: Purpose[]; format: Format; competitive: boolean; tone: string; audiences: Audience[] }> = {
  'ego-check': { purposes: ['trust', 'conversation'], format: 'reflection', competitive: false, tone: 'from-violet-600 to-sky-500', audiences: ['colleagues', 'conference', 'students'] },
  'would-you-rather': { purposes: ['icebreak', 'fun', 'conversation'], format: 'opinion', competitive: false, tone: 'from-sky-500 to-teal-500', audiences: ['colleagues', 'community', 'students', 'friends', 'conference', 'other'] },
  'myth-or-fact': { purposes: ['learn', 'fun', 'challenge'], format: 'quiz', competitive: true, tone: 'from-teal-500 to-violet-600', audiences: ['colleagues', 'community', 'students', 'friends', 'conference', 'other'] },
};
export const meta = (id: string) => CATALOG[id.replace(/-(de|fr|ar)$/, '')];

export const DURATIONS = ['any', 'short', 'mid', 'long'] as const;
export type Duration = typeof DURATIONS[number];
export const fitsDuration = (e: Experience, d: Duration) =>
  d === 'any' || (d === 'short' ? e.durationMin <= 10 : d === 'mid' ? e.durationMin > 10 && e.durationMin <= 20 : e.durationMin > 20);

export const GROUPS = ['any', '1', '2-5', '6-15', '16-50', '50+'] as const;
export type Group = typeof GROUPS[number];
/** A game fits a group size when its player range overlaps it; "1" means it can be played solo. */
export const fitsGroup = (e: Experience, g: Group) => {
  if (g === 'any') return true;
  if (g === '1') return e.modes.includes('self');
  const [lo, hi] = g === '50+' ? [51, 10000] : g.split('-').map(Number);
  return e.modes.includes('live') && e.players.min <= hi && e.players.max >= lo;
};
