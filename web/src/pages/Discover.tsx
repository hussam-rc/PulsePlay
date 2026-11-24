import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EXPERIENCES, CATEGORY_LABEL, PLANNED } from '../experiences';
import type { Experience } from '../engine/schema';
import { flatActivities } from '../engine/schema';
import { Chip } from '../ui/bits';
import { t } from '../i18n';
import { byId, localizedId, languagesOf } from '../experiences';

const GRADIENT: Record<string, string> = {
  'ego-check': 'from-violet-600 to-sky-500', 'would-you-rather': 'from-sky-500 to-teal-500', 'myth-or-fact': 'from-teal-500 to-violet-600',
};

export function Discover() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [saved, setSaved] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('pp_saved') || '[]'); } catch { return []; } });
  const toggleSave = (id: string) => { const n = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id]; setSaved(n); try { localStorage.setItem('pp_saved', JSON.stringify(n)); } catch { /* storage unavailable */ } };
  const cats = useMemo(() => Array.from(new Set(EXPERIENCES.map(e => e.category))), []);
  const list = EXPERIENCES.filter(e => (cat === 'all' || e.category === cat || (cat === 'saved' && saved.includes(e.id)))
    && (e.title + e.tagline + e.description).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
      <section className="grid gap-4 mb-8">
        <Chip>✨ {t('tagline')}</Chip>
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.05] max-w-3xl">{t('disc.title')}</h1>
        <p className="text-lg text-ink-soft max-w-2xl">{t('disc.sub')}</p>
      </section>

      <div className="flex flex-wrap gap-2 items-center mb-6">
        <label className="sr-only" htmlFor="search">Search experiences</label>
        <input id="search" className="field max-w-xs !min-h-[44px] !text-base" placeholder={t('disc.search')} value={q} onChange={e => setQ(e.target.value)} />
        {['all', ...cats, 'saved'].map(c => (
          <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c}
            className={`chip !py-2 border ${cat === c ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-paper-line text-ink-soft'}`}>
            {c === 'all' ? t('disc.all') : c === 'saved' ? t('disc.saved', { n: saved.length }) : CATEGORY_LABEL[c as Experience['category']]}
          </button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(e => (
          <article key={e.id} className="card overflow-hidden flex flex-col">
            <Link to={`/x/${e.id}`} className={`block bg-gradient-to-br ${GRADIENT[e.id] ?? 'from-violet-600 to-teal-500'} p-6 text-white`}>
              <div className="text-5xl mb-3" aria-hidden>{e.emoji}</div>
              <h2 className="text-2xl font-extrabold" dir="auto">{(byId(localizedId(e.id)) ?? e).title}</h2>
              <p className="opacity-90" dir="auto">{(byId(localizedId(e.id)) ?? e).tagline}</p>
            </Link>
            <div className="p-5 grid gap-3 flex-1 content-start">
              <div className="flex flex-wrap gap-2 text-sm">
                <Chip tone="sky">{CATEGORY_LABEL[e.category]}</Chip>
                <Chip tone="teal">⏱ {e.durationMin} min</Chip>
                <Chip tone="sun">👥 {e.players.min}–{e.players.max}</Chip>
              </div>
              <p className="text-ink-soft text-[15px]">{t('disc.count', { n: flatActivities(e).length })} · {languagesOf(e.id).map(l => l.lang.toUpperCase()).join(' ')}</p>
              <div className="flex gap-2 mt-auto">
                <Link to={`/x/${e.id}`} className="btn-primary flex-1">{t('disc.open')}</Link>
                <button className="btn-ghost" onClick={() => toggleSave(e.id)} aria-pressed={saved.includes(e.id)} aria-label={saved.includes(e.id) ? 'Remove bookmark' : 'Bookmark'}>{saved.includes(e.id) ? '★' : '☆'}</button>
              </div>
            </div>
          </article>
        ))}
        {list.length === 0 && <p className="text-ink-soft">{t('disc.none')}</p>}
      </div>

      <section className="mt-14">
        <h2 className="text-2xl font-extrabold mb-1">{t('disc.dev')}</h2>
        <p className="text-ink-soft mb-4">{t('disc.devSub')}</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLANNED.map(p => (
            <li key={p.title} className="flex items-center gap-3 rounded-2xl border border-dashed border-paper-line p-4 bg-white/60">
              <span className="text-3xl" aria-hidden>{p.emoji}</span>
              <span className="min-w-0"><b className="block">{p.title}</b><span className="text-sm text-ink-soft">{p.tagline}</span></span>
              <span className="ms-auto chip bg-paper text-ink-soft text-xs whitespace-nowrap">{p.phase}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
