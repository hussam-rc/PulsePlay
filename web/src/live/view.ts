// One state format for every game and every mode. The server (pp._state) produces it for live sessions;
// sessionView() produces the identical shape from the in-memory practice engine. Screens render only this.
import type { Experience, Activity } from '../engine/schema';
import { timingOf } from '../engine/util';
import { Session } from '../engine/session';
import type { ResponseValue } from '../engine/scoring';

export interface PublicOption { id: string; text: string; emoji?: string }
export interface PublicActivity { id: string; type: Activity['type']; prompt: string; theme?: string; shuffle: boolean; options?: PublicOption[]; min?: number; max?: number; minLabel?: string; maxLabel?: string }
export interface Distribution { n: number; counts: Record<string, number>; suppressed: boolean }
export interface GroupView { joined: number; valid: number; average: number | null; bands: number[] | null; suppressed: boolean }
export interface View {
  now: number; code: string; stage: 'lobby' | 'intro' | 'activity' | 'results' | 'group' | 'closing'; index: number;
  phase?: 'read' | 'answer' | 'reveal'; phaseAt: number; deadline?: number; paused: boolean; pausedRemaining?: number;
  seq: number; total: number; joined: number; answered?: number; timing?: { readSec: number; answerSec: number };
  settings: { leaderboard: boolean; autoAdvanceSec?: number; readSec?: number; answerSec?: number };
  selection?: { strategy: string; count: number; bankSize: number };
  experience: Pick<Experience, 'id' | 'title' | 'tagline' | 'emoji' | 'disclaimer' | 'privacy' | 'reveal' | 'defaultTiming' | 'transitions' | 'closing' | 'results' | 'insights'> & { scoringKind: Experience['scoring']['kind']; scoring?: Pick<Experience['scoring'], 'version'> };
  activity?: PublicActivity;
  reveal?: { distribution: Distribution; correct?: string; explanation?: string };
  group?: GroupView;
  leaderboard?: { name: string; correct: number }[];
  snapshot?: Experience;
  names?: { n: string; a: string; i?: string }[];
  kicked?: string[];
  ended?: boolean;
}
export interface MyState { answers: Record<string, ResponseValue>; boardName?: string | null }

export function publicActivity(a: Activity): PublicActivity {
  return {
    id: a.id, type: a.type, prompt: a.prompt, theme: a.theme, shuffle: a.type === 'choice' ? a.shuffle : false,
    options: a.type === 'choice' || a.type === 'poll' ? a.options.map(o => ({ id: o.id, text: o.text, ...('emoji' in o && o.emoji ? { emoji: o.emoji } : {}) })) : undefined,
    ...(a.type === 'scale' ? { min: a.min, max: a.max, minLabel: a.minLabel, maxLabel: a.maxLabel } : {}),
  };
}

function meta(e: Experience): View['experience'] {
  return { id: e.id, title: e.title, tagline: e.tagline, emoji: e.emoji, disclaimer: e.disclaimer, privacy: e.privacy, reveal: e.reveal, scoringKind: e.scoring.kind, scoring: e.scoring.version ? { version: e.scoring.version } : undefined,
    defaultTiming: e.defaultTiming, transitions: e.transitions, closing: e.closing, results: e.results, insights: e.insights };
}

/** Practice mode → View, mirroring the server's visibility rules exactly. */
export function sessionView(s: Session, forHost: boolean): View {
  const e = s.experience, st = s.state, a = s.activity;
  const v: View = {
    now: Date.now(), code: s.code, stage: st.stage === 'ended' ? 'closing' : st.stage, index: st.index, phase: st.phase ?? undefined,
    phaseAt: st.phaseStartedAt, deadline: st.deadline ?? undefined, paused: st.paused, pausedRemaining: st.pausedRemaining ?? undefined,
    seq: st.seq, total: s.activities.length, joined: s.players.length, settings: { leaderboard: false }, experience: meta(e),
  };
  if (a) {
    v.activity = publicActivity(a); v.answered = s.answeredCount(); v.timing = timingOf(e, a);
    if (st.phase === 'reveal' && e.reveal !== 'none') {
      v.reveal = { distribution: s.distributionFor(a) };
      if (e.reveal === 'correct' && a.type === 'choice') { v.reveal.correct = a.options.find(o => o.correct)?.id; v.reveal.explanation = a.explanation; }
    }
  }
  if ((st.stage === 'group' || st.stage === 'closing') && (e.scoring.kind === 'behaviour' || e.scoring.kind === 'correct')) {
    const g = s.group(); v.group = { joined: g.joined, valid: g.valid, average: g.average, bands: g.bands, suppressed: g.suppressed };
  }
  if (st.stage === 'results' || st.stage === 'group' || st.stage === 'closing') v.snapshot = e;
  if (forHost) v.names = s.players.map(p => ({ n: p.nickname, a: p.avatar }));
  return v;
}
