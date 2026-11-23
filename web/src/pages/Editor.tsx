import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { validateExperience, ValidationResult, Experience } from '../engine/schema';
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

/** Draft editor (Phase 1b): JSON + the shared checker, save, preview with simulated players, versioned publish.
 *  The visual builder in Phase 2 writes the same draft format through the same API. */
export function Editor() {
  const id = useParams().id ?? '';
  const auth = useAuth();
  const [x, setX] = useState<ServerExperience | null | undefined>(undefined);
  const [src, setSrc] = useState('');
  const [check, setCheck] = useState<ValidationResult | null>(null);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [vis, setVis] = useState<Vis>('private');
  const nav = useNavigate();
  const load = () => api.get(id).then(r => { setX(r); if (r) { setSrc(JSON.stringify(r.draft, null, 2)); setVis(r.orgId ? 'org' : (r.visibility === 'unlisted' ? 'unlisted' : 'private')); } }).catch(e => { setErr(e.message); setX(null); });
  useEffect(() => { if (auth) load(); }, [id, auth?.userId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!auth) return <SignIn title="Sign in to edit" />;
  if (x === undefined) return <p className="p-10 text-ink-soft">Loading…</p>;
  if (x === null) return <div className="max-w-xl mx-auto p-10 grid gap-3"><h1 className="text-2xl font-extrabold">Not found</h1><p>This experience does not exist or you do not have access to it.</p><Link className="btn-ghost" to="/workspace">Back to workspace</Link></div>;

  const parse = (): unknown | null => { try { return JSON.parse(src); } catch (e) { setCheck({ ok: false, errors: ['Not valid JSON: ' + (e as Error).message], warnings: [] }); return null; } };
  const run = (f: () => Promise<void>) => async () => { setBusy(true); setErr(''); setMsg(''); try { await f(); } catch (e) { setErr((e as Error).message); const d = (e as { details?: string[] }).details; if (d) setCheck({ ok: false, errors: d, warnings: [] }); } finally { setBusy(false); } };
  const save = run(async () => {
    const d = parse(); if (d === null) return;
    const title = (d as { title?: string }).title || x.title;
    await api.saveDraft(x.id, x.orgId, title, d); setCheck(validateExperience({ ...(d as object), status: 'published' })); setMsg('Draft saved.'); await load();
  });
  const publish = run(async () => {
    const d = parse(); if (d === null) return;
    const v = validateExperience({ ...(d as object), status: 'published' }); setCheck(v); if (!v.ok) return;
    await api.saveDraft(x.id, x.orgId, (d as { title: string }).title, d);
    const r = await api.publish(x.id, vis); setMsg(`Published version ${r.version}. Hosts now get this version; earlier sessions keep theirs.`); await load();
  });

  const latest = x.versions[0]?.version;
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 grid gap-5">
      <Link to="/workspace" className="text-sm font-bold text-ink-soft">← Workspace</Link>
      <header className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-extrabold me-auto">{x.title}</h1>
        <Chip tone={x.status === 'published' ? 'teal' : 'sun'}>{x.status}</Chip>{latest && <Chip tone="sky">latest v{latest}</Chip>}{!x.canEdit && <Chip tone="coral">read only</Chip>}</header>
      <section className="card p-5 grid gap-3">
        <h2 className="text-xl font-extrabold">Draft</h2>
        <p className="text-ink-soft text-sm">Edit activities, scoring and result bands. The visual builder (Phase 2) will edit this same format. Drafts are never visible to players.</p>
        <label className="sr-only" htmlFor="draft">Experience JSON</label>
        <textarea id="draft" className="field font-mono !text-sm py-3 h-96" value={src} onChange={e => setSrc(e.target.value)} readOnly={!x.canEdit} spellCheck={false} data-testid="draft" />
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => { const d = parse(); if (d !== null) setCheck(validateExperience({ ...(d as object), status: 'published' })); }} data-testid="check">Check</button>
          {x.canEdit && <button className="btn-ghost" disabled={busy} onClick={save} data-testid="save">Save draft</button>}
          <button className="btn-ghost" disabled={busy} onClick={run(async () => { const d = parse(); if (d === null) return; const v = validateExperience({ ...(d as object), status: 'published' }); setCheck(v); if (!v.ok) return;
            if (x.canEdit) await api.saveDraft(x.id, x.orgId, (d as { title: string }).title, d); nav(`/workspace/preview/${x.id}`); })} data-testid="preview">Preview with simulated players</button>
        </div>
        {check && <div className={`rounded-2xl p-4 ${check.ok ? 'bg-teal-50' : 'bg-coral-50'}`} aria-live="polite" data-testid="check-result">
          <b>{check.ok ? '✅ Ready to publish' : `❌ ${check.errors.length} problem${check.errors.length === 1 ? '' : 's'} to fix`}</b>
          {check.errors.length > 0 && <ul className="list-disc ps-5 mt-2">{check.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
          {check.warnings.length > 0 && <><b className="block mt-2">Warnings</b><ul className="list-disc ps-5">{check.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></>}
        </div>}
      </section>
      {x.canPublish ? <section className="card p-5 grid gap-3">
        <h2 className="text-xl font-extrabold">Publish</h2>
        <p className="text-ink-soft text-sm">Publishing saves an immutable version, checked again on the server. Live sessions use a snapshot, so editing later never changes a running game.</p>
        <fieldset className="grid gap-2"><legend className="font-bold text-sm mb-1">Who can host it</legend>
          {(x.orgId ? ['org', 'unlisted'] as Vis[] : ['private', 'unlisted'] as Vis[]).map(v => <label key={v} className="flex gap-2 items-center"><input type="radio" name="vis" className="w-5 h-5 accent-violet-600" checked={vis === v} onChange={() => setVis(v)} />{VIS_LABEL[v]}</label>)}
        </fieldset>
        <p className="text-sm text-ink-soft">Listing in public Discover needs a platform review, which is not available yet.</p>
        <div><button className="btn-primary" disabled={busy} onClick={publish} data-testid="publish">{busy ? 'Publishing…' : latest ? `Publish version ${latest + 1}` : 'Publish version 1'}</button></div>
      </section> : <p className="text-sm text-ink-soft">Your role can host published versions but not publish.</p>}
      {msg && <p className="text-teal-600 font-bold" role="status" data-testid="msg">{msg}</p>}
      {err && <p className="text-coral-500 font-bold" role="alert" data-testid="err">{err}</p>}
      {x.versions.length > 0 && <section className="card p-5"><h2 className="text-lg font-extrabold mb-2">Versions</h2>
        <ul className="grid gap-1">{x.versions.map(v => <li key={v.version} className="text-sm">v{v.version} · {new Date(v.publishedAt).toLocaleString()}</li>)}</ul>
        <div className="mt-3"><Link className="btn-primary" to={`/host/${x.id}`}>Host latest version live</Link></div></section>}
    </div>
  );
}
