import { Link } from 'react-router-dom';
import { EXPERIENCES } from '../experiences';

export function Host() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 grid gap-6">
      <header><h1 className="text-4xl font-extrabold">🎤 Host Studio</h1>
        <p className="text-ink-soft text-lg mt-2">Pick an experience. Practise first with simulated players, then run it live on the projector.</p></header>
      <div className="grid gap-4">
        {EXPERIENCES.map(e => (
          <div key={e.id} className="card p-5 flex flex-wrap items-center gap-4">
            <span className="text-4xl" aria-hidden>{e.emoji}</span>
            <div className="min-w-0 flex-1"><b className="text-lg block">{e.title}</b><span className="text-ink-soft">{e.tagline} · {e.durationMin} min</span></div>
            <div className="flex gap-2 flex-wrap">
              <Link className="btn-ghost" to={`/practice/${e.id}`}>🧪 Practice</Link>
              <Link className="btn-primary" to={`/host/${e.id}`} data-testid={`host-${e.id}`}>🎤 Host live</Link>
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm text-ink-soft">All three games run live on one shared engine: a QR code to join, server-checked timers, private results and anonymous group totals.</p>
    </div>
  );
}
