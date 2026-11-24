import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { validateExperience, Experience } from '../engine/schema';
import { Builder } from '../builder/Builder';
import type { Draft } from '../builder/model';
import { api, asExperience, useAuth, ServerExperience } from '../live/workspace';
import { PracticeRun } from './Practice';
import { SignIn } from './Workspace';
import { Chip } from '../ui/bits';

type Vis = 'private' | 'org' | 'unlisted';
const VIS_LABEL: Record<Vis, string> = { private: 'Only me (personal) / only editors', org: 'Everyone in the organisation', unlisted: 'Anyone with the link can host it (not listed in Discover)' };

/** Practice run of the saved draft: in memory, simulated players, never touches live data. */
export function Preview() {
  const id = useParams().id ?? '';
  const auth = useAuth();
  const [st, setSt] = useState<{ e?: Experience; err?: string } | null>(null);
  useEffect(() => { if (auth) api.get(id).then(x => { if (!x) return setSt({ err: 'Not found.' }); const r = asExperience(x); setSt(r.e ? { e: r.e } : { err: r.errors.join('; ') }); }).catch(e => setSt({ err: e.message })); }, [id, auth?.userId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!auth) return <SignIn title="Sign in to preview" />;
  if (!st) return <p className="p-10 text-ink-soft">Loading…</p>;
  if (st.err) return <div className="max-w-xl mx-auto p-10 grid gap-3"><p className="font-bold" role="alert">{st.err}</p><Link className="btn-ghost" to={`/workspace/edit/${id}`}>Back to editor</Link></div>;
  return <PracticeRun e={st.e!} exitTo={`/workspace/edit/${id}`} />;
}

/** No-code editor: the Builder edits the draft, saved automatically. Publishing creates an immutable, server-checked version. */
export function Editor() {
  const id = useParams().id ?? '';
  const auth = useAuth();
  const nav = useNavigate();
  const [x, setX] = useState<ServerExperience | null | undefined>(undefined);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [save, setSave] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [vis, setVis] = useState<Vis>('private');
  const [json, setJson] = useState<string | null>(null);
  const timer = useRef<number>();
  const load = useCallback(() => api.get(id).then(r => { setX(r); if (r) { setDraft(r.draft as Draft); setVis(r.orgId ? 'org' : (r.visibility === 'unlisted' ? 'unlisted' : 'private')); } }).catch(e => { setErr(e.message); setX(null); }), [id]);
  useEffect(() => { if (auth) load(); }, [id, auth?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback(async (d: Draft) => {
    if (!x) return; setSave('saving');
    try { await api.saveDraft(x.id, x.orgId, d.title || x.title, d); setSave('saved'); } catch (e) { setSave('error'); setErr((e as Error).message); }
  }, [x]);
  const onChange = (d: Draft) => { setDraft(d); setSave('dirty'); setMsg(''); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => persist(d), 1200); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (save === 'dirty' || save === 'saving') e.preventDefault(); }; addEventListener('beforeunload', h); return () => removeEventListener('beforeunload', h); }, [save]);

  if (!auth) return <SignIn title="Sign in to edit" />;
  if (x === undefined) return <p className="p-10 text-ink-soft">Loading…</p>;
  if (x === null || !draft) return <div className="max-w-xl mx-auto p-10 grid gap-3"><h1 className="text-2xl font-extrabold">Not found</h1><p>This experience does not exist or you do not have access to it.</p><Link className="btn-ghost" to="/workspace">Back to workspace</Link></div>;

  const ok = validateExperience({ ...draft, status: 'published' }).ok;
  const flush = async () => { window.clearTimeout(timer.current); if (x.canEdit && save !== 'saved') await persist(draft); };
  const run = (f: () => Promise<void>) => async () => { setBusy(true); setErr(''); setMsg(''); try { await f(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const publish = run(async () => { await flush(); const r = await api.publish(x.id, vis); setMsg(`Published version ${r.version}. New rooms use it; earlier sessions keep theirs.`); await load(); });
  const preview = run(async () => { await flush(); nav(`/workspace/preview/${x.id}`); });
  const latest = x.versions[0]?.version;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/workspace" className="text-sm font-bold text-ink-soft me-auto">← Workspace</Link>
        {x.canEdit && <span className="text-sm text-ink-soft" role="status" data-testid="save-state">{{ saved: '✓ All changes saved', saving: 'Saving…', dirty: 'Unsaved changes…', error: '⚠ Not saved' }[save]}</span>}
      </div>
      <header className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-extrabold me-auto">{draft.emoji} {draft.title || 'Untitled game'}</h1>
        <Chip tone={x.status === 'published' ? 'teal' : 'sun'}>{x.status === 'published' ? 'published' : 'draft'}</Chip>{latest && <Chip tone="sky">live version v{latest}</Chip>}{!x.canEdit && <Chip tone="coral">view only</Chip>}</header>

      <Builder value={draft} onChange={onChange} readOnly={!x.canEdit} />

      <section className="card p-5 grid gap-3">
        <h2 className="text-xl font-extrabold">Try it and publish</h2>
        <div><button className="btn-ghost" disabled={busy || !ok} onClick={preview} data-testid="preview">▶ Preview with simulated players</button></div>
        {x.canPublish ? <>
          <p className="text-ink-soft text-sm">Publishing saves a fixed version, checked again on the server. Rooms run on a snapshot, so later edits never change a game in progress.</p>
          <fieldset className="grid gap-2"><legend className="font-bold text-sm mb-1">Who can host it</legend>
            {(x.orgId ? ['org', 'unlisted'] as Vis[] : ['private', 'unlisted'] as Vis[]).map(v => <label key={v} className="flex gap-2 items-center"><input type="radio" name="vis" className="w-5 h-5 accent-violet-600" checked={vis === v} onChange={() => setVis(v)} />{VIS_LABEL[v]}</label>)}
          </fieldset>
          <p className="text-sm text-ink-soft">Listing in public Discover needs a platform review, which is not available yet.</p>
          <div><button className="btn-primary" disabled={busy || !ok} onClick={publish} data-testid="publish">{busy ? 'Working…' : latest ? `Publish version ${latest + 1}` : 'Publish'}</button>{!ok && <span className="ms-3 text-sm text-ink-soft">Fix the items in the checker first.</span>}</div>
        </> : <p className="text-sm text-ink-soft">Your role can host published versions but not edit or publish.</p>}
        {msg && <p className="text-teal-600 font-bold" role="status" data-testid="msg">{msg}</p>}
        {err && <p className="text-coral-500 font-bold" role="alert" data-testid="err">{err}</p>}
        {x.versions.length > 0 && <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-paper-line">
          <span className="text-sm text-ink-soft me-auto">Versions: {x.versions.map(v => `v${v.version} (${new Date(v.publishedAt).toLocaleDateString()})`).join(' · ')}</span>
          <Link className="btn-ghost" to={`/guide/${x.id}`} data-testid="guide">📋 Facilitator guide</Link>
          <Link className="btn-primary" to={`/host/${x.id}`} data-testid="host">Host live</Link></div>}
      </section>

      <details className="card p-5" onToggle={e => setJson((e.target as HTMLDetailsElement).open ? JSON.stringify(draft, null, 2) : null)}>
        <summary className="font-bold cursor-pointer">Advanced: view the game file</summary>
        {json !== null && <><p className="text-sm text-ink-soft my-2">Optional, for technical users. You never need this to build a game.</p>
          <textarea aria-label="Game file" className="field font-mono !text-sm py-3 h-80 w-full" value={json} readOnly={!x.canEdit} spellCheck={false} onChange={e => setJson(e.target.value)} />
          {x.canEdit && <button className="btn-ghost mt-2" onClick={() => { try { onChange(JSON.parse(json)); setErr(''); } catch (e) { setErr('The game file is not valid: ' + (e as Error).message); } }}>Apply file changes</button>}</>}
      </details>
    </div>
  );
}
