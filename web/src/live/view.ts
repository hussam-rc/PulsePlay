// One state format for every game and every mode. The server (pp._state) produces it for live sessions;
// sessionView() produces the identical shape from the in-memory practice engine. Screens render only this.
import type { Experience, Activity } from '../engine/schema';
import { timingOf } from '../engine/util';
import { Session } from '../engine/session';
import type { ResponseValue } from '../engine/scoring';

export interface PublicOption { id: string; text: string; emoji?: string }
export interface OpenSettings { display: 'cloud' | 'wall' | 'list'; maxChars: number; maxWords?: number; maxResponses: number; editSec: number; moderation: 'approve' | 'live'; showAnswers: 'live' | 'closed'; placeholder?: string }
export interface PublicActivity { id: string; type: Activity['type']; prompt: string; theme?: string; shuffle: boolean; options?: PublicOption[]; min?: number; max?: number; minLabel?: string; maxLabel?: string; open?: OpenSettings }
/** Host-only answer as moderated and displayed (anonymous: no nickname or player link). */
export interface OpenViewItem { id: string; t: string; k: string; s: 'pending' | 'shown' | 'hidden'; f: boolean; at: number }
export interface OpenView { n: number; people: number; pending: number; closed: boolean; visible: boolean; clearedAt?: number; rev: number; items?: OpenViewItem[] }
export interface MyOpenAnswer { id: string; t: string; at: number; editUntil: number }
export interface Distribution { n: number; counts: Record<string, number>; suppressed: boolean }
export interface GroupView { joined: number; valid: number; average: number | null; bands: number[] | null; suppressed: boolean }
export interface View {
  now: number; code: string; stage: 'lobby' | 'intro' | 'activity' | 'results' | 'group' | 'closing'; index: number;
  phase?: 'read' | 'answer' | 'reveal'; phaseAt: number; deadline?: number; paused: boolean; pausedRemaining?: number;
  seq: number; total: number; joined: number; answered?: number; timing?: { readSec: number; answerSec: number };
  settings: { leaderboard: boolean; autoAdvanceSec?: number; readSec?: number; answerSec?: number };
  selection?: { strategy: string; count: number; bankSize: number };
  experience: Pick<Experience, 'id' | 'title' | 'tagline' | 'emoji' | 'disclaimer' | 'privacy' | 'reveal' | 'defaultTiming' | 'transitions' | 'closing' | 'results' | 'insights'> & { scoringKind: Experience['scoring']['kind'] };
  activity?: PublicActivity;
  reveal?: { distribution: Distribution; correct?: string; explanation?: string };
  group?: GroupView;
  leaderboard?: { name: string; correct: number }[];
  open?: OpenView;
  snapshot?: Experience;
  names?: { n: string; a: string; i?: string }[];
  kicked?: string[];
  ended?: boolean;
}
export interface MyState { answers: Record<string, ResponseValue>; boardName?: string | null; open?: Record<string, MyOpenAnswer[]>; openUsed?: Record<string, number> }

export function publicActivity(a: Activity): PublicActivity {
  return {
    id: a.id, type: a.type, prompt: a.prompt, theme: a.theme, shuffle: a.type === 'choice' ? a.shuffle : false,
    options: a.type === 'choice' || a.type === 'poll' ? a.options.map(o => ({ id: o.id, text: o.text, ...('emoji' in o && o.emoji ? { emoji: o.emoji } : {}) })) : undefined,
    ...(a.type === 'scale' ? { min: a.min, max: a.max, minLabel: a.minLabel, maxLabel: a.maxLabel } : {}),
    ...(a.type === 'open' ? { open: { display: a.display, maxChars: a.maxChars, maxWords: a.maxWords, maxResponses: a.maxResponses, editSec: a.editSec,
      moderation: a.moderation, showAnswers: a.showAnswers, placeholder: a.placeholder } } : {}),
  };
}

function meta(e: Experience): View['experience'] {
  return { id: e.id, title: e.title, tagline: e.tagline, emoji: e.emoji, disclaimer: e.disclaimer, privacy: e.privacy, reveal: e.reveal, scoringKind: e.scoring.kind,
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
    if (a.type === 'open') {
      const list = s.open[a.id] ?? [], fl = s.openFlags[a.id] ?? {};
      v.open = { n: list.filter(x => x.status !== 'hidden').length, people: new Set(list.map(x => x.player)).size, pending: list.filter(x => x.status === 'pending').length,
        closed: st.phase === 'reveal', visible: a.showAnswers !== 'closed' || st.phase === 'reveal' || !!fl.revealed, clearedAt: fl.clearedAt,
        rev: list.length + list.reduce((m, x) => m + x.text.length + x.status.length, 0) + (fl.clearedAt ?? 0) % 997,
        items: forHost ? list.map(x => ({ id: x.id, t: x.text, k: x.key, s: x.status, f: x.flagged, at: x.at })) : undefined };
    }
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
