import { Link, useParams, Navigate } from 'react-router-dom';
import { byId, CATEGORY_LABEL } from '../experiences';
import { flatActivities } from '../engine/schema';
import { Chip } from '../ui/bits';

export function Detail() {
  const e = byId(useParams().id ?? '');
  if (!e) return <Navigate to="/discover" replace />;
  const acts = flatActivities(e);
  const rows: [string, string][] = [
    ['Category', CATEGORY_LABEL[e.category]], ['Duration', `about ${e.durationMin} minutes`], ['Players', `${e.players.min}–${e.players.max}`],
    ['Activities', `${acts.length} (${Array.from(new Set(acts.map(a => ({ choice: 'multiple choice', poll: 'poll', scale: 'scale', reflection: 'reflection' })[a.type]))).join(', ')})`],
    ['Facilitator', e.facilitator === 'required' ? 'Required' : 'Optional'], ['Languages', e.languages.map(l => ({ en: 'English', ar: 'Arabic', de: 'German', fr: 'French' })[l]).join(', ')],
    ['Age', e.ageRating === 'all' ? 'All ages' : e.ageRating], ['Created by', e.creator],
  ];
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 grid gap-6">
      <Link to="/discover" className="text-sm font-bold text-ink-soft">← All experiences</Link>
      <header className="grid gap-3">
        <div className="text-6xl" aria-hidden>{e.emoji}</div>
        <h1 className="text-4xl font-extrabold">{e.title}</h1>
        <p className="text-xl text-ink-soft">{e.tagline}</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        {e.modes.includes('live') && <Link className="btn-primary" to={`/host/${e.id}`}>🎤 Host live</Link>}
        {e.modes.includes('practice') && <Link className="btn-ghost" to={`/practice/${e.id}`}>🧪 Practice with simulated players</Link>}
        {e.modes.includes('self') && <Link className="btn-ghost" to={`/play/${e.id}`}>📱 Play solo</Link>}
      </div>
      <p className="text-lg">{e.description}</p>
      <dl className="card grid sm:grid-cols-2 gap-x-8 gap-y-3 p-6">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-paper-line pb-2"><dt className="text-ink-soft">{k}</dt><dd className="font-bold text-end">{v}</dd></div>)}
      </dl>
      <div className="rounded-2xl bg-violet-50 text-violet-700 p-5 grid gap-2">
        <b>🔒 Privacy</b>
        <p>{e.privacy.individualResults ? 'Personal results are shown only on each person\'s own device.' : 'No personal results: only group totals.'} Group results appear only when at least {e.privacy.groupMinimum} people take part. {e.privacy.retainResponses ? '' : 'Individual answers are not kept after the session.'}</p>
        <p className="text-sm">{e.disclaimer}</p>
      </div>
      {e.contentNotes && <p className="text-sm"><Chip tone="sun">Content note</Chip> {e.contentNotes}</p>}
    </div>
  );
}
