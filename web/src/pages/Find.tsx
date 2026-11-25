import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EXPERIENCES, byId, localizedId } from '../experiences';
import { AUDIENCES, meta } from '../experiences/catalog';
import { GOALS, SIZES, TIMES, Answers, Reason, metadataRecommender } from '../experiences/recommend';
import { t, Key } from '../i18n';

// "Find your perfect experience": 4 questions → up to 3 explained suggestions. Answers live in the URL, so results can be shared and refreshed.
const STEPS = [
  { key: 'a', q: 'fx.q.audience', opts: AUDIENCES.map(v => [v, `aud.${v}`] as [string, string]), icons: ['💼', '🏘️', '🎓', '🍕', '🎤', '✨'] },
  { key: 'g', q: 'fx.q.goal', opts: GOALS.map(v => [v, `goal.${v}`] as [string, string]), icons: ['😂', '🤝', '🧩', '🧠', '💡', '💬', '🎉'] },
  { key: 's', q: 'fx.q.size', opts: SIZES.map(v => [v, v === '1' ? 'size.1' : 'size.n'] as [string, string]), icons: ['🙋', '👥', '👥', '🏟️', '🏟️'] },
  { key: 't', q: 'fx.q.time', opts: TIMES.map(v => [v, `time.${v}`] as [string, string]), icons: ['⚡', '⏱️', '⏱️', '🕰️', '🕰️'] },
] as const;

const label = (k: string, v: string) => t(k as Key, { n: v });
const audL = (a: string) => t(`aud.${a}` as Key);
function reasonText(r: Reason) {
  switch (r.k) {
    case 'goal': return t('why.goal', { goal: t(`goal.${r.goal}` as Key) });
    case 'goalPartly': return t('why.goalPartly', { goal: t(`goal.${r.goal}` as Key) });
    case 'audience': return t('why.audience', { aud: audL(r.audience) });
    case 'audienceMaybe': return t('warn.audienceMaybe', { aud: audL(r.audience) });
    case 'size': return t('why.size', { n: r.size });
    case 'solo': return t('why.solo');
    case 'time': return t('why.time', { m: r.min });
    case 'tooLong': return t('warn.tooLong', { m: r.min });
  }
}

export function Find() {
  const [sp, setSp] = useSearchParams();
  const val = (k: string) => sp.get(k) ?? '';
  const valid = (i: number) => STEPS[i].opts.some(([v]) => v === val(STEPS[i].key));
  const step = STEPS.findIndex((_, i) => !valid(i)); // first unanswered, -1 = done
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus(); }, [step]);
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); n.set(k, v); setSp(n); };
  const back = () => { const n = new URLSearchParams(sp); const i = step === -1 ? STEPS.length - 1 : step - 1; if (i >= 0) n.delete(STEPS[i].key); setSp(n); };

  if (step === -1) {
    const a: Answers = { audience: val('a') as Answers['audience'], goal: val('g') as Answers['goal'], size: val('s') as Answers['size'], time: val('t') as Answers['time'] };
    const recs = metadataRecommender.recommend(a, EXPERIENCES);
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 grid gap-6" data-testid="find-results">
        <header className="grid gap-3">
          <p className="text-sm font-extrabold text-violet-700">✨ {t('fx.title')}</p>
          <h1 ref={head} tabIndex={-1} className="text-3xl sm:text-4xl font-extrabold outline-none">{t('fx.results')}</h1>
          <div className="flex flex-wrap gap-2 text-sm">
            {STEPS.map((s, i) => <button key={s.key} className="chip bg-white border border-paper-line hover:border-violet-500" onClick={() => { const n = new URLSearchParams(sp); for (const x of STEPS.slice(i)) n.delete(x.key); setSp(n); }} aria-label={`${t(s.q as Key)} ${label((s.opts.find(([v]) => v === val(s.key)) ?? ['', ''])[1], val(s.key))}`}>
              <span aria-hidden>{s.icons[s.opts.findIndex(([v]) => v === val(s.key))]}</span> {label((s.opts.find(([v]) => v === val(s.key)) ?? ['', ''])[1], val(s.key))} <span aria-hidden className="text-ink-soft">✎</span></button>)}
          </div>
        </header>
        {recs.length === 0
          ? <div className="card p-6 grid gap-3 justify-items-start" data-testid="find-none"><p className="text-lg">{t('fx.none')}</p><Link to="/create" className="btn-primary">{t('fx.noneCta')}</Link></div>
          : <ol className="grid gap-4">
            {recs.map((r, i) => {
              const e = byId(r.id)!, L = localizedId(r.id), le = byId(L) ?? e, m = meta(r.id), solo = a.size === '1';
              return (
                <li key={r.id} className={`card overflow-hidden anim-in ${i === 0 ? 'ring-2 ring-violet-500' : ''}`} style={{ animationDelay: `${i * 90}ms` }} data-testid={`rec-${r.id}`}>
                  <div className={`bg-gradient-to-br ${m?.tone} text-white px-5 py-4 flex items-center gap-4`}>
                    <span className="text-4xl" aria-hidden>{e.emoji}</span>
                    <div className="min-w-0 flex-1"><span className="chip bg-white/20 text-white text-xs">{i === 0 ? '🏅 ' + t('fx.best') : t('fx.alt')}</span>
                      <h2 className="text-2xl font-extrabold mt-1" dir="auto">{le.title}</h2></div>
                  </div>
                  <div className="p-5 grid gap-3">
                    <p>{t(`do.${r.id}` as Key)}</p>
                    <ul className="grid gap-1.5" aria-label="Why">
                      {r.reasons.map((x, k) => <li key={k} className="flex gap-2"><span aria-hidden className="text-teal-600 font-extrabold">✓</span><span>{reasonText(x)}</span></li>)}
                      {r.warnings.map((x, k) => <li key={'w' + k} className="flex gap-2 text-ink-soft"><span aria-hidden>⚠️</span><span>{reasonText(x)}</span></li>)}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      {solo ? <Link className="btn-primary" to={`/play/${L}`}>{t('card.solo')}</Link> : <Link className="btn-primary" to={`/host/${L}`} data-testid={`rec-host-${r.id}`}>🎤 {t('card.host')}</Link>}
                      {!solo && e.modes.includes('practice') && <Link className="btn-ghost" to={`/practice/${L}`}>{t('card.preview')}</Link>}
                      <Link className="btn-ghost" to={`/x/${r.id}`}>{t('dt.how')}</Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>}
        <div className="flex flex-wrap gap-3 text-sm font-bold">
          <button className="text-violet-700 underline" onClick={() => setSp(new URLSearchParams())}>{t('fx.restart')}</button>
          <Link className="text-violet-700 underline" to="/discover">{t('x.browse')}</Link>
          <Link className="text-violet-700 underline" to="/create">{t('x.ownGame')}</Link>
        </div>
      </div>
    );
  }

  const s = STEPS[step];
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 grid gap-6" data-testid="find">
      <header className="grid gap-2">
        <p className="text-sm font-extrabold text-violet-700">✨ {t('fx.title')}</p>
        {step === 0 && <p className="text-ink-soft">{t('fx.sub')}</p>}
        <div className="flex items-center gap-3" aria-hidden>
          {STEPS.map((_, i) => <span key={i} className={`h-2 rounded-full transition-all ${i < step ? 'w-8 bg-violet-600' : i === step ? 'w-12 bg-violet-600' : 'w-8 bg-paper-line'}`} />)}
          <span className="text-sm font-bold text-ink-soft">{t('fx.step', { i: step + 1, n: STEPS.length })}</span>
        </div>
      </header>
      <fieldset className="grid gap-4" key={s.key}>
        <legend className="contents"><h1 ref={head} tabIndex={-1} className="text-3xl sm:text-4xl font-extrabold outline-none" data-testid="find-q">{t(s.q as Key)}</h1></legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {s.opts.map(([v, k], i) => (
            <button key={v} className="anim-in flex flex-col items-start gap-2 rounded-2xl border border-paper-line bg-white p-4 text-start font-extrabold text-lg hover:border-violet-500 hover:shadow-soft focus-visible:border-violet-500 min-h-[88px]"
              style={{ animationDelay: `${i * 40}ms` }} onClick={() => set(s.key, v)} data-testid={`opt-${s.key}-${v}`}>
              <span className="text-3xl" aria-hidden>{s.icons[i]}</span>{label(k, v)}
            </button>
          ))}
        </div>
      </fieldset>
      {step > 0 && <button className="justify-self-start text-sm font-bold text-ink-soft" onClick={back}>← {t('fx.back')}</button>}
    </div>
  );
}
