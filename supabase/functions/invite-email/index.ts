// invite-email: emails an invited person a sign-in link. Only an owner/admin of the organisation, only for a pending invite,
// at most 30 per organisation per day (checked in the database). Uses Supabase Auth's mailer (your SMTP settings).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ALLOWED = ['https://hussam-rc.github.io', 'http://localhost:5173', 'http://localhost:4173', 'http://localhost:8789'];
const cors = (o: string | null) => ({ 'Access-Control-Allow-Origin': o && ALLOWED.includes(o) ? o : ALLOWED[0], 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' });

Deno.serve(async (req) => {
  const h = cors(req.headers.get('origin'));
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...h, 'content-type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Please sign in first.' }, 401);
  let b: { orgId?: string; email?: string };
  try { b = await req.json(); } catch { return json({ error: 'invalid request' }, 400); }
  const org = String(b.orgId ?? ''), email = String(b.email ?? '').trim().toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(org) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'invalid request' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const appUrl = Deno.env.get('APP_URL') ?? 'https://hussam-rc.github.io/PulsePlay/app/';
  const asUser = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u, error: ue } = await asUser.auth.getUser();
  if (ue || !u?.user) return json({ error: 'Please sign in first.' }, 401);
  const { data: me } = await asUser.rpc('pp_me');
  const orgName = (me?.orgs ?? []).find((o: { id: string }) => o.id === org)?.name;
  if (!orgName) return json({ error: 'not a member of this organisation' }, 403);

  const svc = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { error: qe } = await svc.rpc('pp_invite_email_take', { p_org: org, p_actor: u.user.id, p_email: email });
  if (qe) return json({ error: qe.message }, qe.message.includes('limit') ? 429 : 403);

  // New people get Supabase's "Invite user" email; people who already have an account get a sign-in link.
  const inv = await svc.auth.admin.inviteUserByEmail(email, { redirectTo: appUrl, data: { invited_to: orgName } });
  if (!inv.error) return json({ sent: 'invite' });
  if (!/already|registered|exists/i.test(inv.error.message)) { console.error('invite', inv.error.message); return json({ error: 'The email could not be sent. Check the email settings in Supabase.' }, 502); }
  const otp = await createClient(url, anon, { auth: { persistSession: false } }).auth.signInWithOtp({ email, options: { emailRedirectTo: appUrl, shouldCreateUser: false } });
  if (otp.error) { console.error('otp', otp.error.message); return json({ error: 'The email could not be sent right now. Try again in a minute.' }, 502); }
  return json({ sent: 'signin' });
});
