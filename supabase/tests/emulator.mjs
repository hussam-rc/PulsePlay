// Copy of the local emulator used by web/e2e/workspace.py. Run: node emulator.mjs <site-root> <db>  (needs `pg`).
// Local stand-in for the Supabase services the app uses: PostgREST RPC (roles from the JWT), Auth email OTP, Edge Functions proxy.
// Test only. JWTs here are unsigned; real Supabase verifies signatures. Codes are readable at /__test/code?email=… for automation.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import pg from 'pg';
const DB = process.argv[3] || 'e2e', root = process.argv[2], PORT = 8789, FN = 'http://localhost:8000';
const pool = new pg.Pool({ host: '/tmp/pgt', port: 5499, user: 'postgres', database: DB, max: 30 });
const JSONB = new Set(['p_settings', 'p_args', 'p_value', 'p_draft', 'p_content']);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const codes = new Map(), refresh = new Map();
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub, email, ttl = 3600) => `${b64({ alg: 'none' })}.${b64({ sub, email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + ttl })}.x`;
const decode = t => { try { const c = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()); return c.exp * 1000 > Date.now() ? c : null; } catch { return null; } };
async function session(email) {
  const r = await pool.query(`insert into auth.users(id, email) values (gen_random_uuid(), $1) on conflict (email) do update set email = excluded.email returning id`, [email]);
  const rt = crypto.randomUUID(); refresh.set(rt, { id: r.rows[0].id, email });
  return { access_token: jwt(r.rows[0].id, email, +(process.env.TTL || 3600)), refresh_token: rt, expires_in: 3600, token_type: 'bearer' };
}
http.createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const send = (s, o) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  const url = new URL(req.url, 'http://x');
  let body = ''; for await (const c of req) body += c;
  const tok = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (url.pathname === '/__test/code') return send(200, { code: codes.get(url.searchParams.get('email')) ?? null });
  if (url.pathname.startsWith('/auth/v1/')) {
    if (req.headers.apikey !== 'testkey') return send(401, { msg: 'no api key' });
    const a = JSON.parse(body || '{}'), p = url.pathname.slice(9);
    if (p === 'otp') { const c = String(100000 + crypto.randomInt(900000)); codes.set(a.email, c); return send(200, {}); }
    if (p === 'verify') { if (!a.token || codes.get(a.email) !== a.token) return send(403, { msg: 'Token has expired or is invalid' }); codes.delete(a.email); return send(200, await session(a.email)); }
    if (p === 'token') { const s = refresh.get(a.refresh_token); if (!s) return send(400, { error_description: 'Invalid Refresh Token' }); refresh.delete(a.refresh_token); return send(200, await session(s.email)); }
    if (p === 'logout') return send(204, {});
    if (p === 'user') { const c = decode(tok); return c ? send(200, { id: c.sub, email: c.email, aud: 'authenticated' }) : send(401, { msg: 'invalid JWT' }); }
    return send(404, {});
  }
  if (url.pathname.startsWith('/functions/v1/')) {
    const r = await fetch(FN + url.pathname.replace('/functions/v1', ''), { method: req.method, headers: { authorization: req.headers.authorization || '', 'content-type': 'application/json', origin: req.headers.origin || '' }, body: req.method === 'POST' ? body : undefined });
    res.writeHead(r.status, { 'content-type': 'application/json' }); return res.end(await r.text());
  }
  const m = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
  if (!m) {
    let p = decodeURIComponent(url.pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); return res.end(fs.readFileSync(f));
  }
  if (req.headers.apikey !== 'testkey' && tok !== 'service') return send(401, { message: 'no api key' });
  const args = JSON.parse(body || '{}'), ks = Object.keys(args);
  const c = await pool.connect();
  try {
    await c.query('begin');
    const claims = tok && tok !== 'testkey' && tok !== 'service' ? decode(tok) : null;
    if (tok && tok !== 'testkey' && tok !== 'service' && !claims) { await c.query('rollback'); return send(401, { message: 'JWT expired' }); }
    if (tok === 'service') await c.query('set local role postgres');
    else if (claims) { await c.query('set local role authenticated'); await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]); }
    else await c.query('set local role anon');
    const r = await c.query(`select public.${m[1]}(${ks.map((k, i) => `${k} => $${i + 1}${JSONB.has(k) ? '::jsonb' : ''}`).join(',')}) as v`, ks.map(k => args[k] == null ? null : JSONB.has(k) ? JSON.stringify(args[k]) : String(args[k])));
    await c.query('commit'); send(200, r.rows[0].v);
  } catch (e) { await c.query('rollback').catch(() => {}); send(e.code === '42501' ? 403 : 400, { message: e.message, code: e.code }); } finally { c.release(); }
}).listen(PORT, () => console.log('full emulator up on', PORT));
