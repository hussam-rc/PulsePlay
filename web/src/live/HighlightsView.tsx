import { moments, opinionHighlights, quizHighlights, Moment } from './highlights';
import { SplitBar, GrowBar } from '../ui/reveal';
import { t } from '../i18n';

const opt = (m: Moment, i: number) => `${m.options[i]?.emoji ?? ''} ${m.options[i]?.text ?? ''}`.trim();

/** End-of-game highlights for opinion games (split votes) and quizzes (toughest/easiest). Renders nothing if too few moments were shown. */
export function HighlightsView({ code, kind, compact }: { code: string; kind: 'aggregate' | 'correct' | string; compact?: boolean }) {
  const ms = moments(code);
  if (kind === 'aggregate') {
    const h = opinionHighlights(ms); if (!h) return null;
    const two = (m: Moment) => m.options.length === 2;
    return (
      <section className="grid gap-4 w-full max-w-3xl text-start" data-testid="highlights" aria-label={t('hi.title')}>
        <h2 className="text-2xl font-extrabold text-center">✨ {t('hi.title')}</h2>
        <div className={`grid gap-4 ${h.united ? 'md:grid-cols-2' : ''}`}>
          <article className="card p-5 grid gap-3 anim-in" data-testid="hi-divided">
            <p className="chip bg-coral-50 text-coral-500 justify-self-start">⚖️ {t('hi.divided')}</p>
            {two(h.divided) ? <SplitBar a={h.divided.options[0].pct} b={h.divided.options[1].pct} labelA={opt(h.divided, 0)} labelB={opt(h.divided, 1)} />
              : h.divided.options.map(o => <div key={o.id} className="grid gap-1"><span className="font-bold" dir="auto">{o.emoji} {o.text} · {o.pct}%</span><GrowBar pct={o.pct} /></div>)}
            <p className="font-bold text-violet-700">💬 {t('hi.talk')}</p>
          </article>
          {h.united && <article className="card p-5 grid gap-3 anim-in" style={{ animationDelay: '200ms' }} data-testid="hi-united">
            <p className="chip bg-teal-50 text-teal-600 justify-self-start">🤝 {t('hi.united')}</p>
            {(() => { const w = [...h.united.options].sort((a, b) => b.pct - a.pct)[0]; return <><p className="text-2xl font-extrabold" dir="auto">{w.emoji} {w.text}</p><div className="flex items-center gap-3"><span className="flex-1"><GrowBar pct={w.pct} color="#14A38B" /></span><b className="text-xl tabular-nums">{w.pct}%</b></div></>; })()}
          </article>}
        </div>
        {!compact && ms.length > 2 && <details className="card p-4">
          <summary className="font-extrabold cursor-pointer">{t('hi.recap')} ({ms.length})</summary>
          <ol className="grid gap-3 mt-3">{ms.map(m => <li key={m.idx} className="grid gap-1">{two(m) ? <SplitBar a={m.options[0].pct} b={m.options[1].pct} labelA={opt(m, 0)} labelB={opt(m, 1)} />
            : <span dir="auto">{m.prompt}</span>}</li>)}</ol>
        </details>}
      </section>
    );
  }
  if (kind === 'correct') {
    const h = quizHighlights(ms); if (!h) return null;
    const card = (m: Moment, label: string, tone: string, testid: string, delay: number) => (
      <article className="card p-5 grid gap-2 anim-in" style={{ animationDelay: `${delay}ms` }} data-testid={testid}>
        <p className={`chip justify-self-start ${tone}`}>{label}</p>
        <p className="text-lg font-extrabold" dir="auto">{m.prompt}</p>
        <div className="flex items-center gap-3"><span className="flex-1"><GrowBar pct={h.pc(m)} color="#14A38B" /></span><b className="tabular-nums">{t('hi.correct', { p: h.pc(m) })}</b></div>
        {m.explanation && !compact && <p className="text-sm text-ink-soft" dir="auto">{m.explanation}</p>}
      </article>);
    return (
      <section className="grid gap-4 w-full max-w-3xl text-start" data-testid="highlights" aria-label={t('hi.title')}>
        <h2 className="text-2xl font-extrabold text-center">✨ {t('hi.title')}</h2>
        <div className="grid gap-4 md:grid-cols-2">{card(h.toughest, '🧗 ' + t('hi.toughest'), 'bg-coral-50 text-coral-500', 'hi-toughest', 0)}{h.easiest.idx !== h.toughest.idx && card(h.easiest, '🎯 ' + t('hi.easiest'), 'bg-teal-50 text-teal-600', 'hi-easiest', 200)}</div>
      </section>
    );
  }
  return null;
}
