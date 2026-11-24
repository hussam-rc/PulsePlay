import { Link, useParams, Navigate } from 'react-router-dom';
import { byId, localizedId, languagesOf } from '../experiences';
import { flatActivities } from '../engine/util';
import { meta } from '../experiences/catalog';
import { Chip } from '../ui/bits';
import { t, Key } from '../i18n';

const LANG_NAME = { en: 'English', ar: 'العربية', de: 'Deutsch', fr: 'Français' } as const;

/** A non-interactive phone showing the first question, so hosts know exactly what players will see. */
function SamplePhone({ prompt, options }: { prompt: string; options: string[] }) {
  return (
    <figure className="grid gap-2 justify-items-center" data-testid="sample">
      <div className="w-[260px] rounded-[2rem] border-[6px] border-ink bg-paper p-4 grid gap-3 shadow-soft" aria-hidden>
        <div className="mx-auto h-1.5 w-14 rounded-full bg-ink/20" />
        <p className="font-extrabold leading-snug" dir="auto">{prompt}</p>
        {options.map((o, i) => <div key={i} className="rounded-xl bg-white border border-paper-line px-3 py-2.5 text-sm font-bold" dir="auto">{o}</div>)}
      </div>
      <figcaption className="text-sm text-ink-soft">{t('dt.sampleNote')}</figcaption>
    </figure>
  );
}

export function Detail() {
  const e = byId(useParams().id ?? '');
  if (!e) return <Navigate to="/discover" replace />;
  const L = localizedId(e.id), le = byId(L) ?? e, m = meta(e.id);
  const acts = flatActivities(le);
  const first = acts.find(a => a.type === 'choice' || a.type === 'poll') as { prompt: string; options: { text: string }[] } | undefined;
  const rows: [string, string][] = [
    [t('d.duration'), t('d.about', { n: e.durationMin })], [t('d.players'), `${e.players.min}–${e.players.max}`], [t('d.questions'), String(acts.length)],
    [t('d.languages'), languagesOf(e.id).map(l => LANG_NAME[l.lang]).join(' · ')], [t('d.by'), e.creator],
  ];
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 grid gap-8">
      <Link to="/discover" className="text-sm font-bold text-ink-soft justify-self-start">{t('d.back')}</Link>
      <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
        <div className="grid gap-5">
          <header className="grid gap-3">
            <div className="flex items-center gap-3"><span className="text-5xl" aria-hidden>{e.emoji}</span>{m && <Chip tone="sky">{t(`fmt.${m.format}` as Key)}</Chip>}</div>
            <h1 className="text-4xl font-extrabold" dir="auto">{le.title}</h1>
            <p className="text-xl text-ink-soft" dir="auto">{le.tagline}</p>
          </header>
          <p className="text-lg">{t(`do.${e.id}` as Key)}</p>
          <div className="flex flex-wrap gap-2">
            {e.modes.includes('live') && <Link className="btn-primary" to={`/host/${L}`} data-testid="detail-host">{t('hs.live')}</Link>}
            {e.modes.includes('self') && <Link className="btn-ghost" to={`/play/${L}`}>{t('d.solo')}</Link>}
          </div>
          {e.modes.includes('practice') && <p className="text-sm text-ink-soft">{t('dt.tryFirst')} <Link className="font-bold text-violet-700 underline" to={`/practice/${L}`}>{t('d.practice')}</Link></p>}
          {e.modes.includes('live') && <section aria-labelledby="how-h" className="grid gap-3">
            <h2 id="how-h" className="text-xl font-extrabold">{t('dt.how')}</h2>
            <ol className="grid gap-2 sm:grid-cols-3">
              {(['dt.h1', 'dt.h2', 'dt.h3'] as Key[]).map((k, i) => <li key={k} className="card p-4 flex gap-3 items-start"><span className="w-8 h-8 shrink-0 rounded-full bg-violet-600 text-white grid place-items-center font-extrabold">{i + 1}</span><span>{t(k)}</span></li>)}
            </ol>
          </section>}
        </div>
        {first && <section aria-label={t('dt.sample')} className="grid gap-2 justify-items-center"><h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-soft">{t('dt.sample')}</h2><SamplePhone prompt={first.prompt} options={first.options.map(o => o.text)} /></section>}
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
      <Link className="text-sm font-bold text-violet-700 underline justify-self-start" to={`/guide/${L}`} data-testid="guide-link">{t('d.guide')}</Link>
      {e.contentNotes && <p className="text-sm"><Chip tone="sun">Content note</Chip> {e.contentNotes}</p>}
    </div>
  );
}
