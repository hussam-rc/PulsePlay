import { Link } from 'react-router-dom';
import { KINDS, GameKind } from '../builder/model';
import { useAuth } from '../live/workspace';

/** Entry to the no-code builder. Building happens in the Workspace so drafts are saved to your space or organisation. */
export function Create() {
  const auth = useAuth();
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 grid gap-6">
      <header><h1 className="text-4xl font-extrabold">🛠️ Create a game</h1>
        <p className="text-ink-soft text-lg mt-2">Pick a type, write your questions, choose the results. No code, no files. The checker tells you in plain words what is missing, you preview it with simulated players, then publish and host.</p></header>
      <div className="grid sm:grid-cols-2 gap-4">{(Object.keys(KINDS) as GameKind[]).map(k =>
        <div key={k} className="card p-5"><div className="text-xl font-extrabold">{KINDS[k].emoji} {KINDS[k].label}</div><p className="text-ink-soft mt-1">{KINDS[k].blurb}</p></div>)}</div>
      <ol className="card p-5 grid gap-2 list-decimal ps-10">
        <li>Sign in with your email (no password).</li>
        <li>Choose your personal space or an organisation.</li>
        <li>Start from scratch or copy a ready-made game.</li>
        <li>Edit, preview, publish. Changes save automatically.</li>
      </ol>
      <div><Link className="btn-primary" to="/workspace" data-testid="open-builder">{auth ? 'Open the builder' : 'Sign in and start building'}</Link></div>
    </div>
  );
}
