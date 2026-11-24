import { Link } from 'react-router-dom';
import { EXPERIENCES } from '../experiences';
import { t } from '../i18n';
import { byId, localizedId } from '../experiences';

export function Host() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 grid gap-6">
      <header><h1 className="text-4xl font-extrabold">{t('hs.title')}</h1>
        <p className="text-ink-soft text-lg mt-2">{t('hs.sub')}</p></header>
      <div className="grid gap-4">
        {EXPERIENCES.map(e => (
          <div key={e.id} className="card p-5 flex flex-wrap items-center gap-4">
            <span className="text-4xl" aria-hidden>{e.emoji}</span>
            <div className="min-w-0 flex-1"><b className="text-lg block" dir="auto">{(byId(localizedId(e.id)) ?? e).title}</b><span className="text-ink-soft" dir="auto">{(byId(localizedId(e.id)) ?? e).tagline} · {t('hs.min', { n: e.durationMin })}</span></div>
            <div className="flex gap-2 flex-wrap">
              <Link className="btn-ghost" to={`/practice/${localizedId(e.id)}`}>{t('hs.practice')}</Link>
              <Link className="btn-primary" to={`/host/${localizedId(e.id)}`} data-testid={`host-${e.id}`}>{t('hs.live')}</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
