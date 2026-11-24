// "Find your perfect experience": deterministic, explainable matching on catalogue metadata.
// The Recommender interface lets a server-side AI ranker replace or re-rank this later without UI changes.
import type { Experience } from '../engine/schema';
import { meta, Audience, Purpose } from './catalog';

export const GOALS = ['laugh', 'connect', 'teamwork', 'learn', 'ideas', 'opinions', 'celebrate'] as const;
export type Goal = typeof GOALS[number];
export const SIZES = ['1', '2-5', '6-15', '16-50', '50+'] as const;
export const TIMES = ['lt5', '5-10', '10-20', '20-45', 'long'] as const;
export type Time = typeof TIMES[number];
export interface Answers { audience: Audience; goal: Goal; size: typeof SIZES[number]; time: Time }

/** Which purposes serve each goal, strongest first. */
const GOAL_PURPOSES: Record<Goal, Purpose[]> = {
  laugh: ['fun', 'icebreak'], connect: ['icebreak', 'conversation', 'trust'], teamwork: ['trust', 'challenge', 'conversation'],
  learn: ['learn', 'challenge'], ideas: ['ideas', 'conversation'], opinions: ['conversation', 'icebreak'], celebrate: ['fun', 'cultures'],
};
const TIME_MAX: Record<Time, number> = { lt5: 5, '5-10': 10, '10-20': 20, '20-45': 45, long: 999 };

export type Reason =
  | { k: 'goal'; goal: Goal } | { k: 'goalPartly'; goal: Goal } | { k: 'audience'; audience: Audience }
  | { k: 'size'; size: string } | { k: 'solo' } | { k: 'time'; min: number } | { k: 'tooLong'; min: number } | { k: 'audienceMaybe'; audience: Audience };
export interface Recommendation { id: string; score: number; reasons: Reason[]; warnings: Reason[] }
export interface Recommender { recommend(a: Answers, pool: Experience[]): Recommendation[] }

/** Strict: the game must work even at the smallest size in the range (Discover's filter is more permissive). */
function worksFor(e: Experience, size: Answers['size']) {
  if (size === '1') return e.modes.includes('self');
  const lo = size === '50+' ? 51 : Number(size.split('-')[0]);
  return e.modes.includes('live') && e.players.min <= lo && e.players.max >= lo;
}

/** Group size is a hard rule (a game that cannot run for that group is never suggested). Everything else adds to the score. */
export const metadataRecommender: Recommender = {
  recommend(a, pool) {
    const out: Recommendation[] = [];
    for (const e of pool) {
      const m = meta(e.id); if (!m || !worksFor(e, a.size)) continue;
      const reasons: Reason[] = [], warnings: Reason[] = []; let score = 0;
      const gp = GOAL_PURPOSES[a.goal], hit = gp.findIndex(p => m.purposes.includes(p));
      if (hit === 0) { score += 4; reasons.push({ k: 'goal', goal: a.goal }); } else if (hit > 0) { score += 2; reasons.push({ k: 'goalPartly', goal: a.goal }); }
      score += Math.max(0, gp.filter(p => m.purposes.includes(p)).length - 1);   // serves the goal in more than one way
      if (m.audiences.includes(a.audience)) { score += 2; reasons.push({ k: 'audience', audience: a.audience }); } else warnings.push({ k: 'audienceMaybe', audience: a.audience });
      reasons.push(a.size === '1' ? { k: 'solo' } : { k: 'size', size: a.size });
      if (e.durationMin <= TIME_MAX[a.time]) { score += 2; reasons.push({ k: 'time', min: e.durationMin }); } else { score -= 2; warnings.push({ k: 'tooLong', min: e.durationMin }); }
      out.push({ id: e.id, score, reasons, warnings });
    }
    return out.sort((x, y) => y.score - x.score || x.id.localeCompare(y.id)).slice(0, 3);
  },
};
