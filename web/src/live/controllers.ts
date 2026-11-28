// Controllers give screens one interface for practice (in memory) and live (server) sessions.
import { Session } from '../engine/session';
import type { ResponseValue } from '../engine/scoring';
import { SUPABASE_URL, SUPABASE_KEY } from './config';
import { accessToken } from './auth';
import { sessionView, View, MyState } from './view';

export type OpenCmd = 'open_approve' | 'open_hide' | 'open_close' | 'open_reveal' | 'open_clear';
export type Cmd = 'next' | 'pause' | 'resume' | 'end' | 'kick' | OpenCmd;
export interface Controller {
  view: View | null;
  offset: number;                          // server clock - local clock (ms)
  error: string | null;
  subscribe(fn: () => void): () => void;
  command(cmd: Cmd, args?: Record<string, unknown>): Promise<void>;
  stop(): void;
}

// ---------- RPC ----------
export async function rpc<T = any>(fn: string, args: Record<string, unknown>): Promise<{ data: T; offset: number }> {
  const h: Record<string, string> = { 'content-type': 'application/json', apikey: SUPABASE_KEY };
  const tok = await accessToken();                       // signed-in creators act as themselves; players stay anonymous
  if (tok) h.Authorization = `Bearer ${tok}`; else if (!SUPABASE_KEY.startsWith('sb_')) h.Authorization = `Bearer ${SUPABASE_KEY}`;
  const t0 = Date.now();
  let r: Response;
  try { r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: h, body: JSON.stringify(args) }); }
  catch { throw new Error('No connection to the game server. Check your internet and try again.'); }
  const t1 = Date.now();
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && (j.message || j.error)) || `Server error ${r.status}`);
  const now = j && typeof j === 'object' && typeof j.now === 'number' ? j.now : null;
  return { data: j as T, offset: now ? now - (t0 + t1) / 2 : 0 };
}

/** Calls a Supabase Edge Function as the signed-in user. */
export async function callFunction<T = any>(name: string, body: unknown): Promise<T> {
  const tok = await accessToken();
  if (!tok) throw new Error('Please sign in first.');
  let r: Response;
  try { r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }); }
  catch { throw new Error('No connection to the server. Check your internet and try again.'); }
  const j = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error((j && j.error) || `Server error ${r.status}`) as Error & { details?: string[] }; e.details = j?.errors; throw e; }
  return j as T;
}

abstract class Base implements Controller {
  view: View | null = null; offset = 0; error: string | null = null;
  private subs = new Set<() => void>();
  subscribe(fn: () => void) { this.subs.add(fn); return () => { this.subs.delete(fn); }; }
  protected emit() { this.subs.forEach(f => f()); }
  abstract command(cmd: Cmd): Promise<void>;
  abstract stop(): void;
}

/** Optional push channel (Supabase Realtime broadcast). Carries no data: a "tick" only tells screens to fetch now.
 *  If WebSockets are blocked or flaky, nothing breaks: polling continues on its own. */
export class Nudge {
  healthy = false; private ws: WebSocket | null = null; private hb: ReturnType<typeof setInterval> | null = null; private retry = 0; private closed = false; private ref = 0;
  constructor(private code: string, private onTick: () => void) { this.open(); }
  private open() {
    if (this.closed || typeof WebSocket === 'undefined' || !/^https?:/.test(SUPABASE_URL)) return;
    let ws: WebSocket;
    try { ws = new WebSocket(`${SUPABASE_URL.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_KEY)}&vsn=1.0.0`); } catch { return; }
    this.ws = ws;
    const send = (topic: string, event: string, payload: unknown) => { try { ws.send(JSON.stringify({ topic, event, payload, ref: String(++this.ref) })); } catch { /* reconnect handles it */ } };
    ws.onopen = () => { send(`realtime:pp-room-${this.code}`, 'phx_join', { config: { broadcast: { self: false }, presence: { key: '' }, private: false } });
      this.hb = setInterval(() => send('phoenix', 'heartbeat', {}), 25000); };
    ws.onmessage = e => { try { const m = JSON.parse(e.data as string);
      if (m.event === 'phx_reply' && m.payload?.status === 'ok' && m.topic !== 'phoenix') { this.healthy = true; this.retry = 0; }
      if (m.event === 'broadcast') this.onTick(); } catch { /* ignore */ } };
    ws.onclose = () => { this.healthy = false; if (this.hb) clearInterval(this.hb); if (!this.closed) setTimeout(() => this.open(), Math.min(30000, 1000 * 2 ** this.retry++)); };
    ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
  }
  close() { this.closed = true; this.healthy = false; if (this.hb) clearInterval(this.hb); try { this.ws?.close(); } catch { /* ignore */ } }
}

/** Polls the server. Phases advance by the server clock on every poll, so screens never drive timing.
 *  With a healthy push channel it polls slowly and fetches immediately on each tick and at every phase boundary.
 *  It pauses while a phone screen is off and catches up the moment it comes back or the network returns. */
class Poller extends Base {
  private timer: ReturnType<typeof setTimeout> | null = null; private stopped = false; private fails = 0; private inflight = false; private again = false; private last = 0;
  private nudge: Nudge | null = null;
  protected hostFast = false;   // the presenter polls fast regardless of push, so Start/Pause/answer counts never lag
  private wake = () => { if (!document.hidden) this.refresh(); };
  constructor(private read: () => Promise<{ data: View; offset: number }>, code?: string) {
    super();
    if (code && typeof window !== 'undefined') { this.nudge = new Nudge(code, () => this.refresh()); document.addEventListener('visibilitychange', this.wake); window.addEventListener('online', this.wake); }
    this.loop();
  }
  protected onView(_v: View) { /* hook */ }
  protected setView(v: View, off: number) {
    this.onView(v);
    if (off) this.offset = off;
    if (v.ended) { if (!this.view?.ended) { this.view = this.view ? { ...this.view, ended: true } : null; this.error = this.view ? null : 'This game has ended.'; this.emit(); } this.stop(); return; }
    if (!this.view || v.seq !== this.view.seq || v.answered !== this.view.answered || v.joined !== this.view.joined || v.open?.rev !== this.view.open?.rev || v.ended) { this.view = v; this.emit(); } }
  private nextDelay() {
    if (this.fails) return Math.min(8000, 1000 * 2 ** (this.fails - 1));
    const v = this.view, push = this.nudge?.healthy;
    let d = this.hostFast ? 700 : v?.stage === 'activity' ? (push ? 2500 : 600) : (push ? 4000 : 1200);
    if (v && !v.paused && v.phase) {                       // be there exactly when the server clock moves the phase on
      const at = v.phase === 'read' && v.timing ? v.phaseAt + v.timing.readSec * 1000 : v.phase === 'answer' ? v.deadline : undefined;
      if (at) { const until = at - (Date.now() + this.offset) + 150; if (until > 0) d = Math.min(d, until); }
    }
    return d;
  }
  private async loop() {
    if (this.stopped) return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (typeof document !== 'undefined' && document.hidden && this.nudge) { this.timer = setTimeout(() => this.loop(), 5000); return; }
    if (this.inflight) { this.again = true; return; }
    this.inflight = true; this.last = Date.now();
    try { const { data, offset } = await this.read(); this.fails = 0; if (this.error) { this.error = null; this.emit(); } this.setView(data, offset); }
    catch (e) { this.fails++; const m = /connection/i.test((e as Error).message) ? 'Connection lost. Reconnecting…' : (e as Error).message; if (this.fails >= 2 && this.error !== m) { this.error = m; this.emit(); } }
    finally { this.inflight = false; }
    if (this.stopped) return;
    if (this.again) { this.again = false; this.timer = setTimeout(() => this.loop(), Math.max(0, 300 - (Date.now() - this.last))); return; }
    this.timer = setTimeout(() => this.loop(), this.nextDelay());
  }
  /** Fetch now (coalesced: at most about 3 reads per second however many ticks arrive). */
  refresh() { if (this.stopped) return; if (this.inflight) { this.again = true; return; } const wait = 300 - (Date.now() - this.last); if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => this.loop(), Math.max(0, wait)); }
  async command(_: Cmd, _args?: Record<string, unknown>) {}
  stop() { this.stopped = true; if (this.timer) clearTimeout(this.timer); this.nudge?.close(); if (typeof window !== 'undefined') { document.removeEventListener('visibilitychange', this.wake); window.removeEventListener('online', this.wake); } }
}

export class LiveHost extends Poller {
  constructor(public code: string, private token: string) { super(() => rpc<View>('pp_host_state', { p_code: code, p_token: token }), code); this.hostFast = true; }
  async command(cmd: Cmd, args?: Record<string, unknown>) {
    try {
      const { data, offset } = await rpc<View & { ended?: boolean }>('pp_host_command', { p_code: this.code, p_token: this.token, p_cmd: cmd, ...(args ? { p_args: args } : {}) });
      if (cmd === 'end') { this.view = { ...(this.view as View), ended: true }; this.emit(); this.stop(); return; }
      this.view = null; this.setView(data, offset);
    } catch (e) { const m = (e as Error).message; if (!/answer window still open/.test(m)) { this.error = m; this.emit(); } }
  }
  /** Removes a nickname from the room (e.g. an inappropriate one). */
  kick(seat: string) { return this.command('kick' as Cmd, { seat }); }
}

export class LivePlayer extends Poller {
  my: MyState = { answers: {} };
  sending: Record<string, true> = {};
  kicked = false;
  seat?: string;
  constructor(public code: string, public token: string) { super(() => rpc<View>('pp_state', { p_code: code }), code); this.loadMine(); }
  protected onView(v: View) {
    if (!this.kicked && this.seat && v.kicked?.includes(this.seat)) {
      this.kicked = true; rpc('pp_forget_me', { p_token: this.token }).catch(() => {}); savePlayer(null); this.emit(); this.stop();
    }
  }
  async loadMine() { try { const { data } = await rpc<MyState | null>('pp_my_state', { p_token: this.token }); if (data) { this.my = { ...data, answers: { ...data.answers, ...this.pendingAnswers() } }; this.emit(); } else { this.error = 'Your place in this game has ended.'; this.emit(); } } catch { /* retried on next answer */ } }
  private pendingAnswers() { return Object.fromEntries(Object.keys(this.sending).map(k => [k, this.my.answers[k]])); }
  private drop(activityId: string, note?: string) { const a = { ...this.my.answers }; delete a[activityId]; delete this.sending[activityId]; this.my = { ...this.my, answers: a }; if (note) this.error = note; this.emit(); }
  /** Optimistic answer. Network failures are retried until the server accepts or refuses it (e.g. too late); answers are never silently lost. */
  async submit(activityId: string, value: ResponseValue, attempt = 0): Promise<string> {
    if (attempt === 0) { this.my = { ...this.my, answers: { ...this.my.answers, [activityId]: value } }; this.sending = { ...this.sending, [activityId]: true }; this.emit(); }
    try {
      const { data } = await rpc<string>('pp_submit', { p_token: this.token, p_activity: activityId, p_value: value });
      if (data === 'ok' || data === 'duplicate') { delete this.sending[activityId]; if (this.error) this.error = null; this.emit(); }
      else this.drop(activityId, data === 'late' || data === 'not_open' ? 'Your answer arrived after the time was up.' : undefined);
      return data;
    } catch (e) {
      if (/connection/i.test((e as Error).message) && attempt < 12 && !this.view?.ended) {
        this.error = 'Connection lost. Sending your answer again…'; this.emit();
        await new Promise(r => setTimeout(r, Math.min(4000, 700 * (attempt + 1))));
        return this.submit(activityId, value, attempt + 1);
      }
      this.drop(activityId, (e as Error).message); return 'error';
    }
  }
  /**
   * Open answers: sent as typed text, never optimistic on screen (the server decides). Network failures are retried; a retry
   * that the server already stored comes back as 'duplicate' with an id we have not seen, which counts as success.
   */
  async openSend(activityId: string, text: string, editId?: string, attempt = 0): Promise<string> {
    const known = new Set((this.my.open?.[activityId] ?? []).map(x => x.id));
    try {
      const { data } = await rpc<{ status: string; id?: string; editUntil?: number }>('pp_open_submit', { p_token: this.token, p_activity: activityId, p_text: text, p_id: editId ?? null });
      let st = data.status;
      if (st === 'duplicate' && attempt > 0 && data.id && !known.has(data.id)) st = 'ok';
      if (st === 'ok' && data.id) {
        const list = (this.my.open?.[activityId] ?? []).filter(x => x.id !== data.id);
        const prev = this.my.open?.[activityId]?.find(x => x.id === data.id);
        list.push({ id: data.id, t: text, at: prev?.at ?? Date.now() + this.offset, editUntil: data.editUntil ?? 0 });
        const before = this.my.openUsed?.[activityId] ?? known.size, used = prev ? before : before + 1;   // an edit does not use a new answer
        this.my = { ...this.my, open: { ...this.my.open, [activityId]: list }, openUsed: { ...this.my.openUsed, [activityId]: used } };
        if (this.error) this.error = null; this.emit();
      }
      return st;
    } catch (e) {
      if (/connection/i.test((e as Error).message) && attempt < 8 && !this.view?.ended) {
        this.error = 'Connection lost. Sending your answer again…'; this.emit();
        await new Promise(r => setTimeout(r, Math.min(4000, 700 * (attempt + 1))));
        return this.openSend(activityId, text, editId, attempt + 1);
      }
      return 'error';
    }
  }
}

/** Practice: the in-memory engine exposed through the same interface. Never touches the network. */
export class PracticeHost extends Base {
  private unsub: () => void;
  constructor(public session: Session) { super(); this.view = sessionView(session, true); this.unsub = session.subscribe(() => { this.view = sessionView(session, true); this.emit(); }); }
  async command(cmd: Cmd, args?: Record<string, unknown>) { if (cmd.startsWith('open_')) { this.session.openCommand(cmd as OpenCmd, args as { ids?: string[]; all?: boolean }); return; } if (cmd === 'next') this.session.next(); if (cmd === 'pause') this.session.pause(); if (cmd === 'resume') this.session.resume(); if (cmd === 'end') this.session.end(); }
  stop() { this.unsub(); this.session.end(); }
}

// ---------- local recovery ----------
const get = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const set = (k: string, v: unknown) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
export interface SavedHost { code: string; token: string; experienceId: string; at: number }
export interface SavedPlayer { code: string; token: string; nickname: string; avatar: string; at: number; seat?: string }
export const savedHost = (): SavedHost | null => { const h = get('pp_host'); return h && Date.now() - h.at < 24 * 3600e3 ? h : null; };
export const saveHost = (h: SavedHost | null) => set('pp_host', h);
export const savedPlayer = (code?: string): SavedPlayer | null => { const p = get('pp_player'); return p && Date.now() - p.at < 24 * 3600e3 && (!code || p.code === code) ? p : null; };
export const savePlayer = (p: SavedPlayer | null) => set('pp_player', p);
