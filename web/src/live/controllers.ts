// Controllers give screens one interface for practice (in memory) and live (server) sessions.
import { Session } from '../engine/session';
import type { ResponseValue } from '../engine/scoring';
import { SUPABASE_URL, SUPABASE_KEY } from './config';
import { accessToken } from './auth';
import { sessionView, View, MyState } from './view';

export type Cmd = 'next' | 'pause' | 'resume' | 'end';
export interface Controller {
  view: View | null;
  offset: number;                          // server clock - local clock (ms)
  error: string | null;
  subscribe(fn: () => void): () => void;
  command(cmd: Cmd): Promise<void>;
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

/** Polls the server. Phases advance by the server clock on every poll, so screens never drive timing. */
class Poller extends Base {
  private timer: ReturnType<typeof setTimeout> | null = null; private stopped = false; private fails = 0;
  constructor(private read: () => Promise<{ data: View; offset: number }>) { super(); this.loop(); }
  protected setView(v: View, off: number) {
    if (off) this.offset = off;
    if (v.ended) { if (!this.view?.ended) { this.view = this.view ? { ...this.view, ended: true } : null; this.error = this.view ? null : 'This game has ended.'; this.emit(); } this.stop(); return; }
    if (!this.view || v.seq !== this.view.seq || v.answered !== this.view.answered || v.joined !== this.view.joined || v.ended) { this.view = v; this.emit(); } }
  private async loop() {
    if (this.stopped) return;
    try { const { data, offset } = await this.read(); this.fails = 0; if (this.error) { this.error = null; this.emit(); } this.setView(data, offset); }
    catch (e) { this.fails++; if (this.fails >= 3 && this.error !== (e as Error).message) { this.error = (e as Error).message; this.emit(); } }
    const fast = this.view?.stage === 'activity';
    this.timer = setTimeout(() => this.loop(), this.fails ? Math.min(5000, 800 * this.fails) : fast ? 500 : 1000);
  }
  refresh() { if (this.timer) clearTimeout(this.timer); this.loop(); }
  async command(_: Cmd) {}
  stop() { this.stopped = true; if (this.timer) clearTimeout(this.timer); }
}

export class LiveHost extends Poller {
  constructor(public code: string, private token: string) { super(() => rpc<View>('pp_host_state', { p_code: code, p_token: token })); }
  async command(cmd: Cmd) {
    try {
      const { data, offset } = await rpc<View & { ended?: boolean }>('pp_host_command', { p_code: this.code, p_token: this.token, p_cmd: cmd });
      if (cmd === 'end') { this.view = { ...(this.view as View), ended: true }; this.emit(); this.stop(); return; }
      this.setView(data, offset);
    } catch (e) { const m = (e as Error).message; if (!/answer window still open/.test(m)) { this.error = m; this.emit(); } }
  }
}

export class LivePlayer extends Poller {
  my: MyState = { answers: {} };
  constructor(public code: string, public token: string) { super(() => rpc<View>('pp_state', { p_code: code })); this.loadMine(); }
  async loadMine() { try { const { data } = await rpc<MyState | null>('pp_my_state', { p_token: this.token }); if (data) { this.my = data; this.emit(); } else { this.error = 'Your place in this game has ended.'; this.emit(); } } catch { /* retried on next answer */ } }
  async submit(activityId: string, value: ResponseValue): Promise<string> {
    this.my = { ...this.my, answers: { ...this.my.answers, [activityId]: value } }; this.emit();
    try {
      const { data } = await rpc<string>('pp_submit', { p_token: this.token, p_activity: activityId, p_value: value });
      if (data !== 'ok' && data !== 'duplicate') { const a = { ...this.my.answers }; delete a[activityId]; this.my = { ...this.my, answers: a }; this.emit(); }
      return data;
    } catch (e) { const a = { ...this.my.answers }; delete a[activityId]; this.my = { ...this.my, answers: a }; this.error = (e as Error).message; this.emit(); return 'error'; }
  }
}

/** Practice: the in-memory engine exposed through the same interface. Never touches the network. */
export class PracticeHost extends Base {
  private unsub: () => void;
  constructor(public session: Session) { super(); this.view = sessionView(session, true); this.unsub = session.subscribe(() => { this.view = sessionView(session, true); this.emit(); }); }
  async command(cmd: Cmd) { if (cmd === 'next') this.session.next(); if (cmd === 'pause') this.session.pause(); if (cmd === 'resume') this.session.resume(); if (cmd === 'end') this.session.end(); }
  stop() { this.unsub(); this.session.end(); }
}

// ---------- local recovery ----------
const get = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const set = (k: string, v: unknown) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
export interface SavedHost { code: string; token: string; experienceId: string; at: number }
export interface SavedPlayer { code: string; token: string; nickname: string; avatar: string; at: number }
export const savedHost = (): SavedHost | null => { const h = get('pp_host'); return h && Date.now() - h.at < 24 * 3600e3 ? h : null; };
export const saveHost = (h: SavedHost | null) => set('pp_host', h);
export const savedPlayer = (code?: string): SavedPlayer | null => { const p = get('pp_player'); return p && Date.now() - p.at < 24 * 3600e3 && (!code || p.code === code) ? p : null; };
export const savePlayer = (p: SavedPlayer | null) => set('pp_player', p);
