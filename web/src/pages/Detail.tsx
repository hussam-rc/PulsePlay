import { Link, useParams, Navigate } from 'react-router-dom';
import { byId } from '../experiences';
import { flatActivities } from '../engine/schema';
import { Chip } from '../ui/bits';
import { t } from '../i18n';
import { localizedId, languagesOf } from '../experiences';

export function Detail() {
  const e = byId(useParams().id ?? '');
  if (!e) return <Navigate to="/discover" replace />;
  const acts = flatActivities(e);
  const L = localizedId(e.id), le = byId(L) ?? e;
  const rows: [string, string][] = [
    [t('d.duration'), t('d.about', { n: e.durationMin })], [t('d.players'), `${e.players.min}–${e.players.max}`], [t('d.questions'), String(acts.length)],
    [t('d.languages'), languagesOf(e.id).map(l => ({ en: 'English', ar: 'العربية', de: 'Deutsch', fr: 'Français' })[l.lang]).join(' · ')], [t('d.by'), e.creator],
  ];
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 grid gap-6">
      <Link to="/discover" className="text-sm font-bold text-ink-soft">{t('d.back')}</Link>
      <header className="grid gap-3">
        <div className="text-6xl" aria-hidden>{e.emoji}</div>
        <h1 className="text-4xl font-extrabold" dir="auto">{le.title}</h1>
        <p className="text-xl text-ink-soft" dir="auto">{le.tagline}</p>
      </header>
      <Link className="text-sm font-bold text-violet-700 underline justify-self-start" to={`/guide/${L}`} data-testid="guide-link">{t('d.guide')}</Link>
      <div className="grid gap-3 sm:grid-cols-3">
        {e.modes.includes('live') && <Link className="btn-primary" to={`/host/${L}`}>{t('hs.live')}</Link>}
        {e.modes.includes('practice') && <Link className="btn-ghost" to={`/practice/${L}`}>{t('d.practice')}</Link>}
        {e.modes.includes('self') && <Link className="btn-ghost" to={`/play/${L}`}>{t('d.solo')}</Link>}
      </div>
      <p className="text-lg" dir="auto">{le.description}</p>
      <dl className="card grid sm:grid-cols-2 gap-x-8 gap-y-3 p-6">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-paper-line pb-2"><dt className="text-ink-soft">{k}</dt><dd className="font-bold text-end">{v}</dd></div>)}
      </dl>
      <div className="rounded-2xl bg-violet-50 text-violet-700 p-5 grid gap-2">
        <b>{t('hl.privacy')}</b>
        <p>{e.privacy.individualResults ? t('d.privInd') : t('d.privGroup')} {t('d.privMin', { n: e.privacy.groupMinimum })}</p>
        <p className="text-sm" dir="auto">{le.disclaimer}</p>
      </div>
      {e.contentNotes && <p className="text-sm"><Chip tone="sun">Content note</Chip> {e.contentNotes}</p>}
    </div>
  );
}
