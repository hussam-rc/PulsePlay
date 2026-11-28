// Generic session state machine. Practice mode runs it in memory with simulated players;
// the live backend (Phase 1b) mirrors the same states server-side.
import type { Experience, Activity } from './schema';
import { flatActivities, timingOf } from './util';
import { Responses, ResponseValue, personalResult, PersonalResult, groupSummary, distribution } from './scoring';
import { randomId } from './random';
import { answerKey, checkAnswer, initialStatus, type OpenItem, type OpenError } from './openAnswer';

export type Stage = 'lobby' | 'intro' | 'activity' | 'results' | 'group' | 'closing' | 'ended';
export type Phase = 'read' | 'answer' | 'reveal';
export type AnswerStatus = 'ok' | 'duplicate' | 'late' | 'not_open' | 'unknown_player' | 'invalid';

export interface Player { id: string; nickname: string; avatar: string; simulated: boolean; bias: number; responses: Responses }
export interface SessionState {
  stage: Stage; index: number; phase: Phase | null;
  phaseStartedAt: number; deadline: number | null; seq: number; paused: boolean; pausedRemaining: number | null;
}
export interface Clock { now(): number; setTimeout(fn: () => void, ms: number): unknown; clearTimeout(h: unknown): void }
export const realClock: Clock = { now: () => Date.now(), setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: h => clearTimeout(h as number) };

const AVATARS = ['🦊', '🐼', '🐙', '🦉', '🐢', '🦁', '🐧', '🦄', '🐝', '🐳', '🦜', '🐨', '🦔', '🐯', '🐸', '🦩', '🐬', '🦦', '🐞', '🦋'];
const SIM_NAMES = ['Lina', 'Omar', 'Sara', 'Youssef', 'Mona', 'Karim', 'Nour', 'Hana', 'Tarek', 'Rania', 'Ziad', 'Layla', 'Fadi', 'Dina', 'Samir', 'Mariam', 'Adam', 'Salma', 'Jonas', 'Elena'];
export const MAX_SIMULATED = 20;
/** Generic words simulated players type in practice mode (nothing is ever sent anywhere). */
const SIM_WORDS = ['Curious', 'Kind', 'Creative', 'Helpful', 'Bold', 'Calm', 'Open', 'Fun', 'Curious', 'Kind', 'Reliable', 'Fast', 'Friendly', 'Creative', 'Brave'];
export type OpenStatusCode = 'ok' | 'duplicate' | 'not_open' | 'late' | 'unknown_player' | 'invalid' | 'edit_closed' | OpenError;
export interface OpenEntry extends OpenItem { player: string }

export class Session {
  readonly experience: Experience;
  readonly activities: Activity[];
  readonly code: string;
  state: SessionState;
  players: Player[] = [];
  private timer: unknown = null;
  private simTimers: unknown[] = [];
  private listeners = new Set<() => void>();
  autoSim = true;
  /** Open answers per activity (practice only, in memory). The player id stays inside the engine, never in a view. */
  open: Record<string, OpenEntry[]> = {};
  openFlags: Record<string, { revealed?: boolean; clearedAt?: number }> = {};

  constructor(e: Experience, private clock: Clock = realClock, private rand: () => number = Math.random) {
    this.experience = e;
    this.activities = flatActivities(e);
    this.code = String(100000 + Math.floor(this.rand() * 900000));
    this.state = { stage: 'lobby', index: 0, phase: null, phaseStartedAt: clock.now(), deadline: null, seq: 1, paused: false, pausedRemaining: null };
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { this.listeners.forEach(f => f()); }
  get activity(): Activity | null { return this.state.stage === 'activity' ? this.activities[this.state.index] : null; }

  private set(p: Partial<SessionState>) {
    this.clock.clearTimeout(this.timer); this.timer = null;
    this.state = { ...this.state, ...p, seq: this.state.seq + 1, phaseStartedAt: this.clock.now() };
    this.schedule(); this.simulate(); this.emit();
  }

  private schedule() {
    const s = this.state, a = this.activity;
    if (!a || s.paused) return;
    const t = timingOf(this.experience, a);
    if (s.phase === 'read') this.timer = this.clock.setTimeout(() => this.set({ phase: 'answer', deadline: this.clock.now() + t.answerSec * 1000 }), Math.max(0, s.phaseStartedAt + t.readSec * 1000 - this.clock.now()));
    if (s.phase === 'answer' && s.deadline) this.timer = this.clock.setTimeout(() => this.lock(), Math.max(0, s.deadline - this.clock.now()));
  }

  join(nickname: string, opts: { simulated?: boolean; avatar?: string } = {}): Player {
    const nick = nickname.trim().slice(0, 20);
    if (!nick) throw new Error('nickname required');
    if (this.state.stage === 'ended') throw new Error('session ended');
    const p: Player = {
      id: randomId(), nickname: nick, simulated: !!opts.simulated,
      avatar: opts.avatar ?? AVATARS[this.players.length % AVATARS.length],
      bias: Math.min(0.95, Math.max(0, 0.1 + ((this.rand() + this.rand() + this.rand()) / 3) * 0.55 - 0.1)),
      responses: {},
    };
    this.players = [...this.players, p]; this.emit(); return p;
  }

  addSimulated(n: number) {
    const sims = this.players.filter(p => p.simulated).length;
    for (let i = 0; i < n && sims + i < MAX_SIMULATED; i++) this.join(SIM_NAMES[(sims + i) % SIM_NAMES.length], { simulated: true });
  }

  /** Host advances. Timed phases advance on their own; the host can skip the read phase or reveal early only when everyone answered. */
  next(): boolean {
    const s = this.state;
    if (s.paused || s.stage === 'ended') return false;
    if (s.stage === 'lobby') { this.set({ stage: 'intro', phase: null }); return true; }
    if (s.stage === 'intro') { this.set({ stage: 'activity', index: 0, phase: 'read', deadline: null }); return true; }
    if (s.stage === 'activity') {
      if (s.phase === 'read') { this.set({ phase: 'answer', deadline: this.clock.now() + timingOf(this.experience, this.activity!).answerSec * 1000 }); return true; }
      if (s.phase === 'answer') {
        if (this.activity?.type === 'open') { this.lock(); return true; }   // open answers: Next closes submissions at any time
        if (this.answeredCount() >= this.players.length && this.players.length) { this.lock(); return true; } return false;
      }
      if (s.index < this.activities.length - 1) { this.set({ index: s.index + 1, phase: 'read', deadline: null }); return true; }
      this.set({ stage: 'results', phase: null, deadline: null }); return true;
    }
    if (s.stage === 'results') { this.set({ stage: this.experience.scoring.kind === 'behaviour' || this.experience.scoring.kind === 'correct' ? 'group' : 'closing' }); return true; }
    if (s.stage === 'group') { this.set({ stage: 'closing' }); return true; }
    return false;
  }

  private lock() { if (this.state.phase === 'answer') this.set({ phase: 'reveal' }); }

  pause() {
    const s = this.state; if (s.paused || s.stage !== 'activity' || (s.phase !== 'answer' && s.phase !== 'read')) return;
    this.clock.clearTimeout(this.timer);
    const end = s.phase === 'answer' ? s.deadline! : s.phaseStartedAt + timingOf(this.experience, this.activity!).readSec * 1000;
    this.state = { ...s, paused: true, pausedRemaining: Math.max(0, end - this.clock.now()), seq: s.seq + 1 }; this.emit();
  }
  resume() {
    const s = this.state; if (!s.paused) return;
    this.state = s.phase === 'read'
      ? { ...s, paused: false, phaseStartedAt: this.clock.now() + (s.pausedRemaining ?? 0) - timingOf(this.experience, this.activity!).readSec * 1000, pausedRemaining: null, seq: s.seq + 1 }
      : { ...s, paused: false, deadline: this.clock.now() + (s.pausedRemaining ?? 0), pausedRemaining: null, seq: s.seq + 1 };
    this.schedule(); this.emit();
  }
  end() { this.clock.clearTimeout(this.timer); this.simTimers.forEach(t => this.clock.clearTimeout(t)); this.state = { ...this.state, stage: 'ended', seq: this.state.seq + 1 }; this.emit(); }

  answer(playerId: string, activityId: string, value: ResponseValue): AnswerStatus {
    const p = this.players.find(x => x.id === playerId); if (!p) return 'unknown_player';
    const s = this.state, a = this.activity;
    if (!a || a.id !== activityId || s.phase !== 'answer' || s.paused) return 'not_open';
    if (s.deadline && this.clock.now() > s.deadline) return 'late';
    if (p.responses[activityId] != null) return 'duplicate';
    if (!isValidValue(a, value)) return 'invalid';
    p.responses = { ...p.responses, [activityId]: value };
    this.players = [...this.players];
    this.emit();
    if (this.answeredCount() >= this.players.length) this.timer = (this.clock.clearTimeout(this.timer), this.clock.setTimeout(() => this.lock(), 600));
    return 'ok';
  }

  answeredCount(): number {
    const a = this.activity; if (!a) return 0;
    if (a.type === 'open') return new Set((this.open[a.id] ?? []).map(x => x.player)).size;
    return this.players.filter(p => p.responses[a.id] != null).length;
  }

  /** Same rules as pp.open_submit: limits, duplicates, edit window, links, basic filter, moderation. */
  openSubmit(playerId: string, activityId: string, raw: string, editId?: string): { status: OpenStatusCode; id?: string; editUntil?: number } {
    const p = this.players.find(x => x.id === playerId); if (!p) return { status: 'unknown_player' };
    const s = this.state, a = this.activity;
    if (!a || a.id !== activityId || a.type !== 'open' || s.phase !== 'answer' || s.paused) return { status: 'not_open' };
    if (s.deadline && this.clock.now() > s.deadline + 400) return { status: 'late' };
    const c = checkAnswer(a, raw); if (!c.ok) return { status: c.error };
    const key = answerKey(c.text); if (!key) return { status: 'empty' };
    const list = (this.open[a.id] ??= []), mine = list.filter(x => x.player === playerId && x.status !== 'hidden'), now = this.clock.now();
    const until = (x: OpenEntry) => x.at + a.editSec * 1000;
    if (editId) {
      const x = mine.find(y => y.id === editId); if (!x) return { status: 'invalid' };
      if (!a.editSec || now > until(x)) return { status: 'edit_closed' };
      if (mine.some(y => y.key === key && y.id !== editId)) return { status: 'duplicate' };
      Object.assign(x, { text: c.text, key, flagged: c.flagged, status: initialStatus(a, c.flagged) });
      this.open = { ...this.open, [a.id]: [...list] }; this.emit(); return { status: 'ok', id: x.id, editUntil: until(x) };
    }
    const same = list.find(y => y.player === playerId && y.key === key);
    if (same) return { status: 'duplicate', id: same.id, editUntil: until(same) };
    if (list.filter(y => y.player === playerId).length >= a.maxResponses) return { status: 'limit' };
    const e: OpenEntry = { id: randomId(), player: playerId, text: c.text, key, flagged: c.flagged, status: initialStatus(a, c.flagged), at: now };
    this.open = { ...this.open, [a.id]: [...list, e] }; this.emit();
    return { status: 'ok', id: e.id, editUntil: until(e) };
  }

  /** A participant's own visible answers, as the phone shows them (mirrors pp.my_state). */
  myOpen(playerId: string, activityId: string) {
    const a = this.experience && this.activity;
    const sec = a && a.type === 'open' && a.id === activityId ? a.editSec : 0;
    return (this.open[activityId] ?? []).filter(x => x.player === playerId && x.status !== 'hidden').map(x => ({ id: x.id, t: x.text, at: x.at, editUntil: x.at + sec * 1000 }));
  }
  /** Host moderation, mirroring pp._open_command. */
  openCommand(cmd: 'open_approve' | 'open_hide' | 'open_close' | 'open_reveal' | 'open_clear', args: { ids?: string[]; all?: boolean } = {}) {
    const a = this.activity; if (!a || a.type !== 'open') return;
    const list = this.open[a.id] ?? [], ids = new Set(args.ids ?? []);
    if (cmd === 'open_approve') list.forEach(x => { if (args.all ? x.status === 'pending' && !x.flagged : ids.has(x.id)) x.status = 'shown'; });
    if (cmd === 'open_hide') list.forEach(x => { if (ids.has(x.id)) x.status = 'hidden'; });
    if (cmd === 'open_close') { if (this.state.phase === 'answer' && !this.state.paused) this.lock(); return; }
    if (cmd === 'open_reveal') this.openFlags = { ...this.openFlags, [a.id]: { ...this.openFlags[a.id], revealed: true } };
    if (cmd === 'open_clear') this.openFlags = { ...this.openFlags, [a.id]: { ...this.openFlags[a.id], clearedAt: this.clock.now() } };
    this.open = { ...this.open, [a.id]: [...list] };
    this.state = { ...this.state, seq: this.state.seq + 1 }; this.emit();
  }
  resultFor(playerId: string): PersonalResult | null { const p = this.players.find(x => x.id === playerId); return p ? personalResult(this.experience, p.responses, p.id) : null; }
  group() { return groupSummary(this.experience, this.players.map(p => personalResult(this.experience, p.responses, p.id)), this.players.length); }
  distributionFor(a: Activity) { return distribution(this.experience, a, this.players.map(p => p.responses)); }

  /** Simulated players answer during the answer window with a personal bias. Never persisted anywhere. */
  private simulate() {
    const s = this.state, a = this.activity;
    if (!this.autoSim || !a || s.phase !== 'answer' || !s.deadline) return;
    const win = Math.min(s.deadline - this.clock.now(), 25000);
    if (a.type === 'open') {                     // simulated players type one or two generic words
      for (const p of this.players.filter(x => x.simulated)) {
        if (this.rand() < 0.15) continue;
        const n = Math.min(a.maxResponses, this.rand() < 0.3 ? 2 : 1);
        for (let k = 0; k < n; k++) {
          const word = SIM_WORDS[Math.floor(this.rand() * SIM_WORDS.length)];
          this.simTimers.push(this.clock.setTimeout(() => this.openSubmit(p.id, a.id, word), 400 + this.rand() * Math.max(300, win - 600)));
        }
      }
      return;
    }
    for (const p of this.players.filter(x => x.simulated)) {
      if (this.rand() < 0.05) continue; // some people miss a question
      const at = 300 + this.rand() * Math.max(200, win - 500);
      this.simTimers.push(this.clock.setTimeout(() => this.answer(p.id, a.id, simulatedValue(a, p.bias, this.rand)), at));
    }
  }
}

export function isValidValue(a: Activity, v: ResponseValue): boolean {
  if (v == null) return false;
  if (a.type === 'choice' || a.type === 'poll') return typeof v === 'string' && a.options.some(o => o.id === v);
  if (a.type === 'scale') return typeof v === 'number' && Number.isInteger(v) && v >= a.min && v <= a.max;
  return typeof v === 'string' && v.length <= 500;
}

function simulatedValue(a: Activity, bias: number, rand: () => number): ResponseValue {
  if (a.type === 'choice') {
    const hasPoints = a.options.some(o => o.points !== undefined);
    const w = a.options.map(o => hasPoints ? (o.points === 0 ? (1 - bias) * 2.2 : (o.points ?? 0) * bias * 1.2 + 0.05) : o.correct ? 1 + (1 - bias) * 2 : 1);
    let r = rand() * w.reduce((x, y) => x + y, 0);
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return a.options[i].id; }
    return a.options[a.options.length - 1].id;
  }
  if (a.type === 'poll') return a.options[Math.floor(rand() * a.options.length)].id;
  if (a.type === 'scale') return a.min + Math.floor(rand() * (a.max - a.min + 1));
  return 'simulated reflection';
}
