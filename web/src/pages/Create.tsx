import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../live/workspace';
import { SectionHeader } from '../ui/SectionHeader';
import { TEMPLATES, templateById, PENDING_TEMPLATE } from '../builder/templates';
import { validateExperience } from '../engine/schema';
import { PracticeRun } from './Practice';
import { t } from '../i18n';

/** Creator Studio entry: start from a working template, try it without an account, then make it yours. */
export function Create() {
  const auth = useAuth();
  const nav = useNavigate();
  const use = (id: string) => { try { sessionStorage.setItem(PENDING_TEMPLATE, id); } catch { /* storage blocked: Workspace still offers templates */ } nav('/workspace'); };
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 grid gap-6">
      <SectionHeader icon="🛠️" title={t('nav.create')} purpose={t('sec.create')} links={[{ lead: t('x.notSure'), label: t('x.browse'), to: '/discover' }]} />
      <p className="text-ink-soft -mt-3">Start from a template that already works. Try it with simulated players, no account needed. When you like it, make it yours: change the questions, preview, publish and host.</p>
      <section aria-labelledby="tpl-h" className="grid gap-3">
        <h2 id="tpl-h" className="text-2xl font-extrabold">Start from a template</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map(tp => (
            <article key={tp.id} className="card p-5 grid gap-3 content-start" data-testid={`tpl-${tp.id}`}>
              <div className="flex items-center gap-3"><span className="text-4xl" aria-hidden>{tp.emoji}</span><h3 className="text-xl font-extrabold">{tp.name}</h3></div>
              <p>{tp.blurb}</p>
              <p className="text-sm font-bold text-ink-soft">⏱ about {tp.minutes} min · 👥 {tp.players}</p>
              <div className="flex flex-wrap gap-2 mt-auto">
                <button className="btn-primary" onClick={() => use(tp.id)} data-testid={`use-${tp.id}`}>Use this template</button>
                <Link className="btn-ghost" to={`/create/try/${tp.id}`} data-testid={`try-${tp.id}`}>▶ Try it</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      <ol className="card p-5 grid gap-2 list-decimal ps-10">
        <li>Try a template with simulated players (no account).</li>
        <li>Sign in with your email (no password) and choose your personal space or an organisation.</li>
        <li>Change the questions, answers and results. The checker tells you in plain words what is missing.</li>
        <li>Preview, publish, host. Changes save automatically.</li>
      </ol>
      <p className="text-sm">Prefer a blank page? <Link className="font-bold text-violet-700 underline" to="/workspace" data-testid="open-builder">{auth ? 'Open the builder' : 'Sign in and start from scratch'}</Link></p>
    </div>
  );
}

/** A template in practice mode: nothing is saved, no account, no network. */
export function TryTemplate() {
  const tp = templateById(useParams().id ?? '');
  if (!tp) return <Navigate to="/create" replace />;
  const v = validateExperience({ ...tp.build(), status: 'published' });
  if (!v.ok) return <Navigate to="/create" replace />;
  return <PracticeRun e={v.experience!} exitTo="/create" />;
}
