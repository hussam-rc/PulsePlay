// Publish Edge Function: validates a creator's draft with the SAME TypeScript engine the app uses, then stores an
// immutable version. The service-role key exists only here (Supabase injects it); browsers never receive it.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { validateExperience } from './schema.ts';

const ALLOWED = ['https://hussam-rc.github.io', 'http://localhost:5173', 'http://localhost:4173'];
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin',
});

Deno.serve(async (req) => {
  const h = cors(req.headers.get('origin'));
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...h, 'content-type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'sign in first' }, 401);
  let body: { experienceId?: string; visibility?: string };
  try { body = await req.json(); } catch { return json({ error: 'invalid request' }, 400); }
  const id = String(body.experienceId ?? ''), visibility = String(body.visibility ?? 'private');
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: 'invalid experience id' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  // 1. As the user: who are they, may they publish, and what is the draft? (RLS applies)
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u, error: ue } = await asUser.auth.getUser();
  if (ue || !u?.user) return json({ error: 'sign in first' }, 401);
  const { data: can } = await asUser.rpc('pp_can_publish', { p_id: id });
  if (!can) return json({ error: 'you do not have permission to publish this experience' }, 403);
  const { data: exp } = await asUser.rpc('pp_get_experience', { p_id: id });
  if (!exp?.draft) return json({ error: 'nothing to publish' }, 400);

  // 2. Server-side validation with the shared engine.
  const draft = { ...exp.draft, status: 'published' };
  const v = validateExperience(draft);
  if (!v.ok) return json({ error: 'validation failed', errors: v.errors, warnings: v.warnings }, 422);

  // 3. As the service: store the immutable version (the DB re-checks membership and visibility rules).
  const svc = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await svc.rpc('pp_publish_validated', { p_id: id, p_user: u.user.id, p_content: v.experience, p_visibility: visibility });
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true, version: data.version, warnings: v.warnings });
});
