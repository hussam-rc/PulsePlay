import { useCallback, useEffect, useState, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestSignIn, verifyCode, signOut } from '../live/auth';
import { api, useAuth, Me, LibraryItem, Role, ROLE_INFO, SessionSummary } from '../live/workspace';
import { EXPERIENCES } from '../experiences';
import { Chip } from '../ui/bits';
import { blankDraft, GameKind, KINDS } from '../builder/model';

const SPACE_KEY = 'pp_space';

export function Workspace() {
  const auth = useAuth();
  return auth ? <SignedIn key={auth.userId} /> : <SignIn />;
}

// ---------- sign in ----------
export function SignIn({ title = 'Sign in to your workspace' }: { title?: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(() => { try { const m = sessionStorage.getItem('pp_signin_error'); sessionStorage.removeItem('pp_signin_error'); return m ?? ''; } catch { return ''; } });
  const go = (f: () => Promise<void>) => async () => { setBusy(true); setErr(''); try { await f(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  return (
    <div className="max-w-md mx-auto px-4 py-12 grid gap-5">
      <h1 className="text-3xl font-extrabold">🗂️ {title}</h1>
      <div className="card p-6 grid gap-4">
        {!sent ? <>
          <p className="text-ink-soft">For creators, hosts and organisations. We email you a sign-in link and code: no password needed.</p>
          <label className="grid gap-1 font-bold" htmlFor="email">Work or personal email
            <input id="email" type="email" autoComplete="email" className="field" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && go(() => requestSignIn(email).then(() => setSent(true)))()} data-testid="email" /></label>
          <button className="btn-primary" disabled={busy || !email} onClick={go(() => requestSignIn(email).then(() => setSent(true)))} data-testid="send">{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
        </> : <>
          <p>We sent a message to <b>{email}</b>. Open the link on this device, or type the 6-digit code from the email.</p>
          <label className="grid gap-1 font-bold" htmlFor="code">Code
            <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} className="field tracking-[0.3em] text-center text-2xl" value={code} onChange={e => setCode(e.target.value)} data-testid="code" /></label>
          <button className="btn-primary" disabled={busy || code.replace(/\D/g, '').length < 6} onClick={go(() => verifyCode(email, code))} data-testid="verify">{busy ? 'Checking…' : 'Sign in'}</button>
          <button className="btn-ghost" onClick={() => { setSent(false); setCode(''); }}>Use a different email</button>
        </>}
        {err && <p className="text-coral-500 font-bold" role="alert">{err}</p>}
      </div>
      <p className="text-sm text-ink-soft">Players never need an account: joining a game only takes a room code and a nickname. We store your email to run your account and nothing else.</p>
    </div>
  );
}

// ---------- signed in ----------
function SignedIn() {
  const auth = useAuth()!;
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState('');
  const [space, setSpaceState] = useState<string | null>(() => { try { return localStorage.getItem(SPACE_KEY) || null; } catch { return null; } });
  const setSpace = (s: string | null) => { setSpaceState(s); try { s ? localStorage.setItem(SPACE_KEY, s) : localStorage.removeItem(SPACE_KEY); } catch { /* ignore */ } };
  const reload = useCallback(async () => {
    try { await api.acceptInvites(); const m = await api.me(); setMe(m); setErr(''); return m; } catch (e) { setErr((e as Error).message); return null; }
  }, []);
  useEffect(() => { reload().then(m => { if (m && space && !m.orgs.some(o => o.id === space)) setSpace(null); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const org = me?.orgs.find(o => o.id === space) ?? null;
  const [tab, setTab] = useState<'library' | 'members' | 'sessions'>('library');
  useEffect(() => { if (!org && tab === 'members') setTab('library'); }, [org, tab]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 grid gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl font-extrabold me-auto">🗂️ Workspace</h1>
        <span className="text-sm text-ink-soft" data-testid="who">{auth.email}</span>
        <button className="btn-ghost !min-h-[40px] text-sm" onClick={() => signOut()}>Sign out</button>
      </header>
      {err && <p className="text-coral-500 font-bold" role="alert">{err}</p>}
      {me && <SpaceBar me={me} space={space} setSpace={setSpace} reload={reload} />}
      {me && <>
        <div className="flex gap-1 border-b border-paper-line" role="tablist">
          <TabBtn on={tab === 'library'} onClick={() => setTab('library')}>Library</TabBtn>
          {org && <TabBtn on={tab === 'members'} onClick={() => setTab('members')}>Members</TabBtn>}
          <TabBtn on={tab === 'sessions'} onClick={() => setTab('sessions')}>Sessions & insights</TabBtn>
        </div>
        {tab === 'library' && <Library key={space ?? 'me'} org={org} />}
        {tab === 'members' && org && <Members key={org.id} org={org} me={me} reload={reload} />}
        {tab === 'sessions' && <Sessions key={space ?? 'me'} org={space} />}
      </>}
    </div>
  );
}

function TabBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button role="tab" aria-selected={on} onClick={onClick} className={`px-4 py-2 font-bold rounded-t-xl ${on ? 'bg-white border border-b-white border-paper-line -mb-px text-violet-700' : 'text-ink-soft'}`}>{children}</button>;
}

function SpaceBar({ me, space, setSpace, reload }: { me: Me; space: string | null; setSpace: (s: string | null) => void; reload: () => Promise<Me | null> }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const create = async () => {
    setErr('');
    try { const { id } = await api.createOrg(name); await reload(); setSpace(id); setAdding(false); setName(''); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="card p-4 grid gap-3">
      <div className="flex flex-wrap items-center gap-2" data-testid="spaces">
        <span className="text-sm font-bold text-ink-soft">Space</span>
        <SpaceBtn on={!space} onClick={() => setSpace(null)}>👤 Personal</SpaceBtn>
        {me.orgs.map(o => <SpaceBtn key={o.id} on={space === o.id} onClick={() => setSpace(o.id)}>🏢 {o.name} <span className="text-xs opacity-70">· {o.role}</span></SpaceBtn>)}
        <button className="btn-ghost !min-h-[36px] !px-3 text-sm" onClick={() => setAdding(a => !a)} data-testid="new-org">+ New organisation</button>
      </div>
      {adding && <div className="flex flex-wrap gap-2">
        <input className="field !min-h-[44px] flex-1 min-w-[200px]" placeholder="Organisation name" value={name} onChange={e => setName(e.target.value)} aria-label="Organisation name" data-testid="org-name" />
        <button className="btn-primary !min-h-[44px]" disabled={name.trim().length < 2} onClick={create} data-testid="org-create">Create</button>
      </div>}
      {err && <p className="text-coral-500 font-bold" role="alert">{err}</p>}
      <p className="text-sm text-ink-soft">{space ? 'Organisation spaces are shared with members according to their role. Other organisations can never see them.' : 'Your personal space is visible only to you.'}</p>
    </div>
  );
}
function SpaceBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} aria-pressed={on} className={`rounded-xl px-3 py-1.5 text-sm font-bold border ${on ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-paper-line'}`}>{children}</button>;
}

// ---------- library ----------
function Library({ org }: { org: Me['orgs'][number] | null }) {
  const nav = useNavigate();
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [err, setErr] = useState('');
  const [tpl, setTpl] = useState(EXPERIENCES[0].id);
  const canCreate = !org || ['owner', 'admin', 'creator'].includes(org.role);
  useEffect(() => { api.library(org?.id ?? null).then(setItems).catch(e => setErr(e.message)); }, [org?.id]);
  const blank = async (k: GameKind) => { try { const d = blankDraft(k); const { id } = await api.saveDraft(null, org?.id ?? null, d.title, d); nav(`/workspace/edit/${id}`); } catch (e) { setErr((e as Error).message); } };
  const copy = async () => { try { const { id } = await api.copyTemplate(tpl, org?.id ?? null); nav(`/workspace/edit/${id}`); } catch (e) { setErr((e as Error).message); } };
  return (
    <section className="grid gap-4" data-testid="library">
      {canCreate && <div className="card p-5 grid gap-4">
        <h2 className="text-xl font-extrabold">Create a game, no code needed</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{(Object.keys(KINDS) as GameKind[]).map(k =>
          <button key={k} className="text-left rounded-2xl p-4 border-2 border-paper-line bg-white hover:border-violet-500" onClick={() => blank(k)} data-testid={`new-${k}`}>
            <div className="text-lg font-extrabold">{KINDS[k].emoji} {KINDS[k].label}</div><div className="text-sm text-ink-soft mt-1">{KINDS[k].blurb}</div></button>)}</div>
        <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-paper-line">
          <label className="grid gap-1 text-sm font-bold flex-1 min-w-[220px]" htmlFor="tpl">…or copy a ready-made game and adapt it
            <select id="tpl" className="field !min-h-[46px] !text-base" value={tpl} onChange={e => setTpl(e.target.value)}>{EXPERIENCES.map(e => <option key={e.id} value={e.id}>{e.emoji} {e.title}</option>)}</select></label>
          <button className="btn-ghost !min-h-[46px]" onClick={copy} data-testid="copy-template">Copy and edit</button>
        </div>
      </div>}
      {err && <p className="text-coral-500 font-bold" role="alert">{err}</p>}
      {items === null ? <p className="text-ink-soft">Loading…</p> : items.length === 0
        ? <p className="text-ink-soft card p-6">No experiences here yet.{canCreate ? ' Start from a template above.' : ' Creators in this organisation can add some.'}</p>
        : <ul className="grid gap-3">{items.map(x => (
          <li key={x.id} className="card p-4 flex flex-wrap items-center gap-3" data-testid="lib-item">
            <div className="me-auto"><b className="text-lg">{x.title}</b>
              <div className="flex flex-wrap gap-2 mt-1"><Chip tone={x.status === 'published' ? 'teal' : 'sun'}>{x.status === 'published' ? `Published v${x.latestVersion}` : 'Draft'}</Chip>
                {x.status === 'published' && <Chip tone="sky">{x.visibility === 'org' ? 'Organisation' : x.visibility}</Chip>}
                {x.latestVersion && x.status !== 'published' && <Chip>v{x.latestVersion} live</Chip>}</div></div>
            <Link className="btn-ghost !min-h-[40px] text-sm" to={`/workspace/edit/${x.id}`}>Open</Link>
            {x.latestVersion && <Link className="btn-primary !min-h-[40px] text-sm" to={`/host/${x.id}`} data-testid="host-own">Host live</Link>}
          </li>))}</ul>}
    </section>
  );
}

// ---------- members ----------
function Members({ org, me, reload }: { org: Me['orgs'][number]; me: Me; reload: () => Promise<Me | null> }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.members>> | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('creator');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const manage = org.role === 'owner' || org.role === 'admin';
  const load = useCallback(() => api.members(org.id).then(setData).catch(e => setErr(e.message)), [org.id]);
  useEffect(() => { load(); }, [load]);
  const act = (f: () => Promise<unknown>, ok?: string) => async () => { setErr(''); setMsg(''); try { await f(); if (ok) setMsg(ok); await load(); await reload(); } catch (e) { setErr((e as Error).message); } };
  const roles: Role[] = org.role === 'owner' ? ['owner', 'admin', 'creator', 'facilitator'] : ['creator', 'facilitator'];
  return (
    <section className="grid gap-4" data-testid="members">
      {manage && <div className="card p-4 grid gap-3">
        <h2 className="font-extrabold text-lg">Invite someone</h2>
        <div className="flex flex-wrap gap-2">
          <input type="email" className="field !min-h-[46px] flex-1 min-w-[220px]" placeholder="name@organisation.org" value={email} onChange={e => setEmail(e.target.value)} aria-label="Email to invite" data-testid="invite-email" />
          <select className="field !min-h-[46px] !w-auto !text-base" value={role} onChange={e => setRole(e.target.value as Role)} aria-label="Role">{roles.filter(r => r !== 'owner').map(r => <option key={r} value={r}>{r}</option>)}</select>
          <button className="btn-primary !min-h-[46px]" disabled={!email} onClick={act(() => api.invite(org.id, email, role).then(() => setEmail('')), `Invited. They join ${org.name} the first time they sign in with that email.`)} data-testid="invite">Invite</button>
        </div>
        <p className="text-sm text-ink-soft">PulsePlay does not send invitation emails yet: tell them to sign in at this site with that address. {ROLE_INFO[role]}.</p>
      </div>}
      {msg && <p className="text-teal-600 font-bold" role="status">{msg}</p>}
      {err && <p className="text-coral-500 font-bold" role="alert">{err}</p>}
      {data && <div className="card divide-y divide-paper-line">
        {data.members.map(m => {
          const self = m.userId === me.userId;
          const canEditRow = manage && !self && (org.role === 'owner' || !['owner', 'admin'].includes(m.role));
          return <div key={m.userId} className="p-4 flex flex-wrap items-center gap-3" data-testid="member">
            <div className="me-auto"><b>{m.name || m.email || 'Member'}</b>{self && <span className="text-ink-soft"> (you)</span>}{m.name && m.email && <div className="text-sm text-ink-soft">{m.email}</div>}</div>
            {canEditRow ? <select className="field !min-h-[40px] !w-auto !text-base" value={m.role} onChange={e => act(() => api.setRole(org.id, m.userId, e.target.value as Role))()} aria-label={`Role of ${m.email ?? 'member'}`}>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select>
              : <Chip>{m.role}</Chip>}
            {(canEditRow || self) && <button className="btn-ghost !min-h-[40px] text-sm" onClick={() => { if (confirm(self ? `Leave ${org.name}?` : `Remove ${m.email ?? 'this member'} from ${org.name}?`)) act(() => api.removeMember(org.id, m.userId))(); }}>{self ? 'Leave' : 'Remove'}</button>}
          </div>;
        })}
        {data.invites?.map(i => <div key={i.email} className="p-4 flex items-center gap-3 text-ink-soft"><span className="me-auto">{i.email}</span><Chip tone="sun">invited · {i.role}</Chip></div>)}
      </div>}
    </section>
  );
}

// ---------- sessions ----------
function Sessions({ org }: { org: string | null }) {
  const [rows, setRows] = useState<SessionSummary[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.sessions(org).then(setRows).catch(e => setErr(e.message)); }, [org]);
  if (err) return <p className="text-coral-500 font-bold" role="alert">{err}</p>;
  if (!rows) return <p className="text-ink-soft">Loading…</p>;
  if (!rows.length) return <p className="card p-6 text-ink-soft">No finished sessions yet. Sessions you host while signed in appear here with anonymous totals only.</p>;
  return (
    <section className="card overflow-x-auto" data-testid="sessions">
      <table className="w-full text-left"><thead className="text-sm text-ink-soft"><tr><th className="p-3">Experience</th><th className="p-3">Date</th><th className="p-3">Joined</th><th className="p-3">Completed</th><th className="p-3">Group result</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-paper-line"><td className="p-3 font-bold">{r.title}</td><td className="p-3">{new Date(r.endedAt).toLocaleString()}</td><td className="p-3">{r.joined}</td><td className="p-3">{r.completed}</td><td className="p-3">{r.average ?? '—'}</td></tr>)}</tbody></table>
      <p className="p-3 text-sm text-ink-soft">Names, answers and personal results are deleted when a session ends. Only anonymous totals are kept.</p>
    </section>
  );
}
