// Room highlights for the end of a game. Built only from distributions the projector has ALREADY shown
// (group totals that passed the privacy minimum), so it reveals nothing new. Kept in this tab's sessionStorage so a refresh keeps them.
import type { View } from './view';

export interface Moment { idx: number; prompt: string; n: number; options: { id: string; text: string; emoji?: string; pct: number }[]; correct?: string; explanation?: string }
const key = (code: string) => `pp_hl_${code}`;
const read = (code: string): Record<number, Moment> => { try { return JSON.parse(sessionStorage.getItem(key(code)) || '{}'); } catch { return {}; } };

export function recordMoment(v: View) {
  const d = v.reveal?.distribution, a = v.activity;
  if (v.stage !== 'activity' || v.phase !== 'reveal' || !d || d.suppressed || !d.n || !a?.options) return;
  const all = read(v.code); if (all[v.index]) return;
  all[v.index] = { idx: v.index, prompt: a.prompt, n: d.n, correct: v.reveal?.correct, explanation: v.reveal?.explanation,
    options: a.options.map(o => ({ id: o.id, text: o.text, emoji: o.emoji, pct: Math.round((100 * (d.counts[o.id] ?? 0)) / d.n) })) };
  try { sessionStorage.setItem(key(v.code), JSON.stringify(all)); } catch { /* storage unavailable: highlights are optional */ }
}
export const moments = (code: string) => Object.values(read(code)).sort((a, b) => a.idx - b.idx);
export const clearMoments = (code: string) => { try { sessionStorage.removeItem(key(code)); } catch { /* ignore */ } };

const top = (m: Moment) => Math.max(...m.options.map(o => o.pct));
/** Opinion games: the question that split the room most evenly and the one it agreed on most. */
export function opinionHighlights(ms: Moment[]) {
  if (ms.length < 2) return null;
  const byTop = [...ms].sort((a, b) => top(a) - top(b) || a.idx - b.idx);
  const divided = byTop[0], united = byTop[byTop.length - 1];
  return united.idx === divided.idx ? { divided, united: null } : { divided, united };
}
/** Quiz games: the claim the fewest got right, and the one most got right. */
export function quizHighlights(ms: Moment[]) {
  const q = ms.filter(m => m.correct); if (q.length < 2) return null;
  const pc = (m: Moment) => m.options.find(o => o.id === m.correct)?.pct ?? 0;
  const s = [...q].sort((a, b) => pc(a) - pc(b) || a.idx - b.idx);
  return { toughest: s[0], easiest: s[s.length - 1], pc };
}
