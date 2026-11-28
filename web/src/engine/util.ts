// Copies of flatActivities/timingOf from schema.ts without the zod runtime, so player screens stay light.
// schema.ts must stay byte-identical to the publish Edge Function's copy, so it keeps its own versions (tests check both agree).
import type { Experience, Activity, Timing } from './schema';

export function flatActivities(e: Pick<Experience, 'rounds'>): Activity[] {
  return e.rounds.flatMap(r => r.activities);
}

export function timingOf(e: Experience, a: Activity): Timing {
  const t = a.timing ?? e.defaultTiming;
  // open answers have their own submission window; 0 = open until the host closes it
  return a.type === 'open' ? { readSec: t.readSec, answerSec: a.submitSec || 86400 } : t;
}
