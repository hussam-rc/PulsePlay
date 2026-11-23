// Creator sign-in with Supabase Auth (email link or 6-digit code). No passwords, no extra dependency.
// Only the access/refresh tokens of the signed-in creator are stored in this browser. Players never sign in.
import { SUPABASE_URL, SUPABASE_KEY } from './config';

export interface AuthSession { access_token: string; refresh_token: string; expires_at: number; email: string; userId: string }
const KEY = 'pp_auth';
let session: AuthSession | null = load();
const subs = new Set<() => void>();
let refreshing: Promise<AuthSession | null> | null = null;

function load(): AuthSession | null { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.access_token ? s : null; } catch { return null; } }
function save(s: AuthSession | null) {
  session = s;
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* storage blocked: session lasts this tab */ }
  subs.forEach(f => f());
}
export const currentSession = () => session;
export const onAuthChange = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };

function claims(token: string): Record<string, any> {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return {}; }
}
function fromTokens(access: string, refresh: string, expiresIn?: number): AuthSession {
  const c = claims(access);
  return { access_token: access, refresh_token: refresh, expires_at: c.exp ? c.exp * 1000 : Date.now() + (expiresIn ?? 3600) * 1000, email: c.email ?? '', userId: c.sub ?? '' };
}

async function gotrue(path: string, body: unknown, token?: string) {
  const h: Record<string, string> = { 'content-type': 'application/json', apikey: SUPABASE_KEY };
  if (token) h.Authorization = `Bearer ${token}`;
  let r: Response;
  try { r = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, { method: 'POST', headers: h, body: JSON.stringify(body) }); }
  catch { throw new Error('No connection to the sign-in server. Check your internet and try again.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(friendly(j.msg || j.error_description || j.message || j.error || `Sign-in error ${r.status}`));
  return j;
}
function friendly(m: string) {
  if (/rate limit|too many|seconds/i.test(m)) return 'Too many sign-in emails were requested. Please wait a minute and try again.';
  if (/expired|invalid/i.test(m)) return 'That code or link has expired or is not valid. Request a new one.';
  return m;
}

/** Where sign-in links return to: the app itself, without any #route (the router restores the page afterwards). */
export const appUrl = () => `${location.origin}${location.pathname}`;

export async function requestSignIn(email: string) {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Please enter a valid email address.');
  await gotrue(`otp?redirect_to=${encodeURIComponent(appUrl())}`, { email: e, create_user: true });
  try { sessionStorage.setItem('pp_after_signin', location.hash || '#/workspace'); } catch { /* ignore */ }
}

export async function verifyCode(email: string, code: string) {
  const j = await gotrue('verify', { type: 'email', email: email.trim().toLowerCase(), token: code.replace(/\D/g, '') });
  save(fromTokens(j.access_token, j.refresh_token, j.expires_in));
}

/** Call once before the router starts: turns a returning sign-in link (#access_token=… or ?error=…) into a session. */
export function consumeRedirect(): string | null {
  const h = location.hash.replace(/^#/, '');
  if (!/(^|&)(access_token|error)=/.test(h)) return null;
  const p = new URLSearchParams(h);
  let back = '#/workspace';
  try { back = sessionStorage.getItem('pp_after_signin') || back; sessionStorage.removeItem('pp_after_signin'); } catch { /* ignore */ }
  if (p.get('access_token') && p.get('refresh_token')) save(fromTokens(p.get('access_token')!, p.get('refresh_token')!, Number(p.get('expires_in')) || undefined));
  history.replaceState(null, '', appUrl() + back);
  return p.get('error_description') ? friendly(p.get('error_description')!) : null;
}

/** A valid access token, refreshed if it expires within a minute; null when signed out or the session is gone. */
export async function accessToken(): Promise<string | null> {
  if (!session) return null;
  if (session.expires_at - Date.now() > 60_000) return session.access_token;
  if (!refreshing) refreshing = (async () => {
    try { const j = await gotrue('token?grant_type=refresh_token', { refresh_token: session!.refresh_token }); const s = fromTokens(j.access_token, j.refresh_token, j.expires_in); save(s); return s; }
    catch (e) { if (!/connection/i.test((e as Error).message)) save(null); return null; }
    finally { refreshing = null; }
  })();
  return (await refreshing)?.access_token ?? null;
}

export async function signOut() {
  const t = session?.access_token;
  save(null);
  if (t) try { await gotrue('logout', {}, t); } catch { /* token already invalid */ }
}

// Picks up sign-in/out in other tabs.
if (typeof window !== 'undefined') window.addEventListener('storage', e => { if (e.key === KEY) { session = load(); subs.forEach(f => f()); } });
