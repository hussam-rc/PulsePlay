import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EXPERIENCES, PLANNED, byId, localizedId, languagesOf } from '../experiences';
import type { Experience } from '../engine/schema';
import { PURPOSES, Purpose, meta, DURATIONS, Duration, fitsDuration, GROUPS, Group, fitsGroup } from '../experiences/catalog';
import { t, Key } from '../i18n';

const SAVED = 'pp_saved';
const readSaved = (): string[] => { try { return JSON.parse(localStorage.getItem(SAVED) || '[]'); } catch { return []; } };

/** Room-code entry right in the hero: players should never need to look for the join page. */
function JoinCode() {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();
  return (
    <form className="grid gap-1.5" onSubmit={e => { e.preventDefault(); if (!/^\d{6}$/.test(code)) return setErr(t('join.err.code')); nav(`/j/${code}`); }}>
      <label htmlFor="hero-code" className="text-sm font-bold text-ink-soft">{t('v2.joinHint')}</label>
      <div className="flex gap-2">
        <input id="hero-code" data-testid="hero-code" className="field !min-h-[48px] !text-xl tracking-[.25em] font-extrabold text-center w-40" inputMode="numeric" autoComplete="off"
          maxLength={6} placeholder="000000" value={code} aria-invalid={!!err} aria-describedby={err ? 'hero-code-err' : undefined}
          onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(''); }} />
        <button className="btn-ghost" data-testid="hero-join">{t('v2.join')}</button>
      </div>
      {err && <p id="hero-code-err" role="alert" className="text-coral-500 font-bold text-sm">{err}</p>}
    </form>
  );
}

function Card({ e, saved, onSave }: { e: Experience; saved: boolean; onSave: () => void }) {
  const m = meta(e.id), L = localizedId(e.id), le = byId(L) ?? e;
  return (
    <article className="card overflow-hidden flex flex-col" data-testid={`card-${e.id}`}>
      <Link to={`/x/${e.id}`} className={`block bg-gradient-to-br ${m?.tone ?? 'from-violet-600 to-teal-500'} px-5 py-5 text-white`}>
        <div className="flex items-start justify-between gap-3">
          <span className="text-4xl" aria-hidden>{e.emoji}</span>
          {m && <span className="chip bg-white/20 text-white text-xs">{t(`fmt.${m.format}` as Key)}</span>}
        </div>
        <h2 className="text-2xl font-extrabold mt-2" dir="auto">{le.title}</h2>
        <p className="opacity-90" dir="auto">{le.tagline}</p>
      </Link>
      <div className="p-5 grid gap-3 flex-1 content-start">
        <p className="text-[15px]" data-testid="what-you-do">{t(`do.${e.id}` as Key)}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-ink-soft" aria-label={t('d.duration')}>
          <li>⏱ {e.durationMin} min</li>
          <li>👥 {e.players.min}–{e.players.max}</li>
          {e.modes.includes('live') && <li>📱 {t('badge.live')}</li>}
          {m && <li>{m.competitive ? '🏆 ' + t('badge.scores') : '🤝 ' + t('badge.noWinners')}</li>}
          <li aria-label={t('d.languages')}>🌐 {languagesOf(e.id).map(l => l.lang.toUpperCase()).join(' ')}</li>
        </ul>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mt-auto pt-1">
          {e.modes.includes('live') && <Link to={`/host/${L}`} className="btn-primary col-span-3 whitespace-nowrap" data-testid={`card-host-${e.id}`}>🎤 {t('card.host')}</Link>}
          {e.modes.includes('practice') && <Link to={`/practice/${L}`} className="btn-ghost !px-3 whitespace-nowrap">{t('card.preview')}</Link>}
          {e.modes.includes('self') && <Link to={`/play/${L}`} className="btn-ghost !px-3 whitespace-nowrap">{t('card.solo')}</Link>}
          <button className="btn-ghost !px-3" onClick={onSave} aria-pressed={saved} aria-label={saved ? t('card.unsave') : t('card.save')} title={saved ? t('card.unsave') : t('card.save')}>{saved ? '★' : '☆'}</button>
        </div>
      </div>
    </article>
  );
}

export function Discover() {
  const [q, setQ] = useState('');
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [dur, setDur] = useState<Duration>('any');
  const [group, setGroup] = useState<Group>('any');
  const [onlySaved, setOnlySaved] = useState(false);
  const [saved, setSaved] = useState<string[]>(readSaved);
  const toggleSave = (id: string) => { const n = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id]; setSaved(n); try { localStorage.setItem(SAVED, JSON.stringify(n)); } catch { /* storage unavailable */ } };
  const counts = useMemo(() => Object.fromEntries(PURPOSES.map(([p]) => [p, EXPERIENCES.filter(e => meta(e.id)?.purposes.includes(p)).length])), []);
  const needle = q.trim().toLowerCase();
  const list = EXPERIENCES.filter(e => {
    const le = byId(localizedId(e.id)) ?? e;
    return (!purpose || meta(e.id)?.purposes.includes(purpose)) && fitsDuration(e, dur) && fitsGroup(e, group) && (!onlySaved || saved.includes(e.id))
      && (!needle || [e.title, e.tagline, e.description, le.title, le.tagline, t(`do.${e.id}` as Key)].join(' ').toLowerCase().includes(needle));
  });
  const filtersOn = dur !== 'any' || group !== 'any' || onlySaved;
  const groupLabel = (g: Group) => g === 'any' ? t('v2.grp.any') : g === '1' ? t('v2.grp.1') : t('v2.grp.people', { n: g });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 grid gap-10 sm:gap-14">
      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div className="grid gap-4">
          <p className="text-sm font-extrabold text-violet-700">PulsePlay · {t('tagline')}</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.05]">{t('v2.title')}</h1>
          <p className="text-lg text-ink-soft max-w-2xl">{t('v2.sub')}</p>
          <div className="flex flex-wrap gap-2">
            <a href="#catalogue" className="btn-primary" onClick={ev => { ev.preventDefault(); document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' }); }}>{t('v2.explore')}</a>
            <Link to="/create" className="btn-ghost">🛠️ {t('v2.create')}</Link>
          </div>
          <Link to="/find" className="justify-self-start inline-flex items-center gap-2 rounded-full bg-violet-50 text-violet-700 px-4 py-2 font-extrabold hover:bg-violet-100" data-testid="open-find">✨ {t('fx.open')} <span aria-hidden>→</span></Link>
        </div>
        <div className="card p-5"><JoinCode /></div>
      </section>

      <section aria-labelledby="purpose-h" className="grid gap-4">
        <h2 id="purpose-h" className="text-2xl font-extrabold">{t('v2.purposeQ')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {PURPOSES.map(([p, emoji]) => (
            <button key={p} onClick={() => { setPurpose(purpose === p ? null : p); document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              aria-pressed={purpose === p} data-testid={`purpose-${p}`}
              className={`flex items-center gap-3 rounded-2xl border p-3 sm:p-4 text-start font-bold transition ${purpose === p ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-paper-line hover:border-violet-500'}`}>
              <span className="text-2xl" aria-hidden>{emoji}</span>
              <span className="min-w-0 leading-tight">{t(`p.${p}` as Key)}<span className={`block text-xs font-bold ${purpose === p ? 'text-white/80' : 'text-ink-soft'}`}>{counts[p] ? t('v2.ready', { n: counts[p] }) : t('v2.soon')}</span></span>
            </button>
          ))}
        </div>
      </section>

      <section id="catalogue" aria-labelledby="cat-h" className="grid gap-4 scroll-mt-20">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="cat-h" className="text-2xl font-extrabold me-auto">{purpose ? t('v2.for', { p: t(`p.${purpose}` as Key) }) : t('v2.all')}</h2>
          {(purpose || filtersOn || needle) && <button className="text-sm font-bold text-violet-700 underline" onClick={() => { setPurpose(null); setDur('any'); setGroup('any'); setOnlySaved(false); setQ(''); }}>{t('v2.clear')}</button>}
        </div>
        <div className="flex flex-wrap gap-2 items-start">
          <label className="sr-only" htmlFor="search">{t('disc.search')}</label>
          <input id="search" type="search" className="field max-w-xs !min-h-[44px] !text-base" placeholder={t('disc.search')} value={q} onChange={e => setQ(e.target.value)} />
          <details className="group">
            <summary className="btn-ghost !min-h-[44px] cursor-pointer list-none">⚙️ {t('v2.more')}{filtersOn ? ' •' : ''}</summary>
            <div className="card p-4 mt-2 grid gap-3 sm:grid-cols-3 sm:min-w-[560px]">
              <label className="grid gap-1 text-sm font-bold">{t('v2.duration')}
                <select className="field !min-h-[44px] !text-base" value={dur} onChange={e => setDur(e.target.value as Duration)} data-testid="f-duration">
                  {DURATIONS.map(d => <option key={d} value={d}>{t(`v2.dur.${d}` as Key)}</option>)}</select></label>
              <label className="grid gap-1 text-sm font-bold">{t('v2.group')}
                <select className="field !min-h-[44px] !text-base" value={group} onChange={e => setGroup(e.target.value as Group)} data-testid="f-group">
                  {GROUPS.map(g => <option key={g} value={g}>{groupLabel(g)}</option>)}</select></label>
              <label className="flex items-center gap-2 text-sm font-bold self-end min-h-[44px]">
                <input type="checkbox" className="w-5 h-5" checked={onlySaved} onChange={e => setOnlySaved(e.target.checked)} />{t('v2.savedOnly')} ({saved.length})</label>
            </div>
          </details>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
          {list.map(e => <Card key={e.id} e={e} saved={saved.includes(e.id)} onSave={() => toggleSave(e.id)} />)}
        </div>
        {list.length === 0 && (purpose && !counts[purpose]
          ? <div className="card p-6 grid gap-3 justify-items-start" data-testid="empty-purpose"><p>{t('v2.emptyPurpose')}</p><Link className="btn-primary" to="/create">{t('v2.emptyCreate')}</Link></div>
          : <p className="text-ink-soft">{t('disc.none')}</p>)}
      </section>

      <details className="rounded-2xl border border-dashed border-paper-line bg-white/60 p-4" data-testid="coming-next">
        <summary className="cursor-pointer font-extrabold">🗺️ {t('v2.next')} <span className="font-bold text-ink-soft text-sm">· {t('v2.nextSub', { n: PLANNED.length })}</span></summary>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mt-3">
          {PLANNED.map(p => (
            <li key={p.title} className="flex items-center gap-3 rounded-xl bg-white p-3 border border-paper-line">
              <span className="text-2xl" aria-hidden>{p.emoji}</span>
              <span className="min-w-0"><b className="block text-sm">{p.title}</b><span className="text-xs text-ink-soft">{p.tagline}</span></span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
