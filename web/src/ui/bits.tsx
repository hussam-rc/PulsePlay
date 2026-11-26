import { useEffect, useState, ReactNode } from 'react';
import type { ResultBand } from '../engine/schema';
import type { PersonalResult } from '../engine/scoring';
import { t } from '../i18n';

/** Re-render every `ms` (for countdowns). */
export function useNow(ms = 200) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(h); }, [ms]);
  return now;
}

export function Chip({ children, tone = 'violet' }: { children: ReactNode; tone?: 'violet' | 'sky' | 'teal' | 'sun' | 'coral' }) {
  const c = { violet: 'bg-violet-50 text-violet-700', sky: 'bg-sky-50 text-sky-600', teal: 'bg-teal-50 text-teal-600', sun: 'bg-sun-50 text-[#9A6510]', coral: 'bg-coral-50 text-coral-500' }[tone];
  return <span className={`chip ${c}`}>{children}</span>;
}

export function Bar({ pct, tone = 'violet' }: { pct: number; tone?: 'violet' | 'teal' | 'sky' }) {
  const c = { violet: 'bg-violet-600', teal: 'bg-teal-500', sky: 'bg-sky-500' }[tone];
  return <div className="h-3 rounded-full bg-paper-line overflow-hidden"><div className={`h-full rounded-full ${c} transition-all duration-500`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>;
}

export function Gauge({ value }: { value: number }) {
  const cx = 200, cy = 200, r = 160;
  const pt = (v: number) => { const a = Math.PI * (1 - v / 100); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const seg = (f: number, to: number, c: string) => { const [x1, y1] = pt(f), [x2, y2] = pt(to); return <path d={`M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`} stroke={c} strokeWidth="30" fill="none" />; };
  const [nx, ny] = pt(value);
  return (
    <svg viewBox="0 0 400 230" className="w-[min(480px,90%)]" role="img" aria-label={`Gauge at ${value} of 100`}>
      {seg(0, 25, '#14A38B')}{seg(25.5, 50, '#2F6FEB')}{seg(50.5, 75, '#E59A1C')}{seg(75.5, 100, '#E2553A')}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1B1830" strokeWidth="8" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="14" fill="#1B1830" />
    </svg>
  );
}

export function Confetti() {
  return <div aria-hidden className="confetti pointer-events-none absolute inset-0 overflow-hidden">
    {Array.from({ length: 36 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: ['#6D4AFF', '#2F6FEB', '#14A38B', '#E59A1C'][i % 4], animationDelay: `${(i % 9) * 0.12}s` }} />)}
  </div>;
}

const TONE: Record<ResultBand['tone'], { bg: string; ink: string; bar: string }> = {
  great: { bg: 'from-teal-500 to-[#0E8370]', ink: 'text-teal-600', bar: '#14A38B' },
  good: { bg: 'from-violet-600 to-sky-500', ink: 'text-violet-700', bar: '#2F6FEB' },
  watch: { bg: 'from-sun-500 to-[#E2553A]', ink: 'text-[#9A6510]', bar: '#E59A1C' },
  grow: { bg: 'from-coral-500 to-violet-600', ink: 'text-coral-500', bar: '#E2553A' },
};

/** "You drive ↔ ego drives": a road with a car at the player's score. */
export function Meter({ value }: { value: number }) {
  return <div className="grid gap-1" dir="ltr" role="img" aria-label={`${t('res.score')}: ${value} / 100`}>
    <div className="relative h-4 rounded-full" style={{ background: 'linear-gradient(90deg,#14A38B,#2F6FEB,#E59A1C,#E2553A)' }}>
      <span className="absolute -top-5 text-3xl transition-all duration-1000 ease-out" style={{ insetInlineStart: `calc(${value}% - 1rem)` }} aria-hidden>🚗</span>
    </div>
    <div className="flex justify-between text-xs font-bold text-ink-soft"><span>{t('res.meterLow')}</span><span>{t('res.meterHigh')}</span></div>
  </div>;
}

export function ResultCard({ r, disclaimer, onCopy, onDelete, onTakeaway, showScore = true }: { r: PersonalResult; disclaimer: string; onCopy?: () => void; onDelete?: () => void; onTakeaway?: () => void; showScore?: boolean }) {
  const [copied, setCopied] = useState('');
  const footer = (onCopy || onDelete || onTakeaway) && <div className="grid gap-2 justify-items-center">
    <div className="flex flex-wrap gap-2 justify-center">
      {onTakeaway && (r.habit || r.feedback) && <button className="btn-primary" data-testid="copy-takeaway" onClick={() => { try { onTakeaway(); setCopied(t('res.takeawayCopied')); } catch { setCopied(t('res.copyBlocked')); } }}>📋 {r.feedback ? t('r2.takeaway') : t('res.takeaway')}</button>}
      {onCopy && <button className="btn-ghost" onClick={() => { try { onCopy(); setCopied(t('res.copied')); } catch { setCopied(t('res.copyBlocked')); } }}>{t('res.copy')}</button>}
      {onDelete && <button className="btn-ghost" onClick={() => { if (confirm(t('keep.confirm'))) onDelete(); }} data-testid="delete-result">{t('keep.delete')}</button>}
    </div>
    {onDelete && <p className="text-xs text-ink-soft">{t('keep.saved')}</p>}
    <p className="text-xs text-ink-soft" aria-live="polite">{copied}</p></div>;
  if (!r.valid || !r.band) {
    return <div className="card p-6 text-center grid gap-3" data-testid="result-card">
      <div className="text-7xl anim-rise">🅿️</div>
      <h2 className="text-2xl font-extrabold">{t('res.parked')}</h2>
      <p>{t('res.notEnough', { a: r.answered, t: r.total })}</p>
      <p className="text-ink-soft">{t('res.again')}</p>{footer}
    </div>;
  }
  if (r.feedback) return <ResultCardV2 r={r} disclaimer={disclaimer} footer={footer} showScore={showScore} />;
  const b: ResultBand = r.band, tone = TONE[b.tone];
  const tip = (icon: string, label: string, text: string, bg: string) => <li className={`rounded-2xl p-3 flex gap-3 items-start ${bg}`}><span className="text-2xl" aria-hidden>{icon}</span><span><b className="block text-xs uppercase tracking-wide text-ink-soft">{label}</b><span dir="auto">{text}</span></span></li>;
  return (
    <div className="card overflow-hidden grid text-center relative" data-testid="result-card">
      <div className={`bg-gradient-to-br ${tone.bg} text-white px-6 pt-8 pb-6 grid gap-2 relative overflow-hidden`}>
        {(b.tone === 'great' || b.tone === 'good') && <Confetti />}
        <div className="text-8xl anim-rise drop-shadow-lg" aria-hidden>{b.emoji}</div>
        <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight" dir="auto">{b.title}</h2>
      </div>
      <div className="p-6 grid gap-4">
        {r.correct != null
          ? <div className={`text-6xl font-extrabold leading-none anim-pop ${tone.ink}`} data-testid="score">{r.correct}/{r.total}<span className="text-lg text-ink-soft font-bold"> {t('res.correct')}</span></div>
          : <div className="grid gap-3"><div className={`text-5xl font-extrabold leading-none anim-pop ${tone.ink}`} data-testid="score">{r.score}<span className="text-lg text-ink-soft font-bold"> / 100</span></div><Meter value={r.score ?? 0} /></div>}
        <p className="text-lg font-bold" dir="auto">{b.message}</p>
        <p className="text-ink-soft" dir="auto">{b.explanation}</p>
        {(r.observations.length > 0 || r.habit) && <ul className="grid gap-2 text-start">
          {r.observations.map((o, i) => <span key={i}>{tip(o.kind === 'strength' ? '💪' : '👀', o.kind === 'strength' ? t('res.strength') : t('res.notice'), o.text, o.kind === 'strength' ? 'bg-teal-50' : 'bg-sun-50')}</span>)}
          {r.habit && tip('🔁', t('res.habit'), r.habit, 'bg-violet-50')}
          {r.challenge && tip('🎯', t('res.challenge'), r.challenge, 'bg-sky-50')}
        </ul>}
        <p className="text-xs text-ink-soft">{disclaimer}</p>
        {footer}
      </div>
    </div>
  );
}

/** Scoring v2: result, evidence-based strengths, one reflection (only with evidence), one challenge, optional labelled score. */
function ResultCardV2({ r, disclaimer, footer, showScore }: { r: PersonalResult; disclaimer: string; footer: React.ReactNode; showScore: boolean }) {
  const b = r.band!, tone = TONE[b.tone], f = r.feedback!;
  const section = (icon: string, title: string, body: React.ReactNode, bg: string, id: string) => (
    <section className={`rounded-2xl p-4 grid gap-1 text-start ${bg}`} data-testid={id}>
      <h3 className="font-extrabold flex items-center gap-2"><span aria-hidden>{icon}</span>{title}</h3>{body}</section>);
  return (
    <div className="card overflow-hidden grid text-center relative" data-testid="result-card" data-version="2">
      <div className={`bg-gradient-to-br ${tone.bg} text-white px-6 pt-6 pb-6 grid gap-2 relative overflow-hidden`}>
        {(b.tone === 'great' || b.tone === 'good') && <Confetti />}
        <p className="text-sm font-bold uppercase tracking-wide opacity-90">{t('r2.heading')}</p>
        <div className="text-8xl anim-rise drop-shadow-lg" aria-hidden>{b.emoji}</div>
        <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight" dir="auto" data-testid="result-title">{b.title}</h2>
      </div>
      <div className="p-5 sm:p-6 grid gap-3">
        <p className="text-lg font-bold" dir="auto">{b.message}</p>
        <p className="text-ink-soft" dir="auto">{b.explanation}</p>
        {f.strengths.length > 0 && section('✨', t('r2.well'), <ul className="grid gap-2">{f.strengths.map(x => (
          <li key={x.theme} dir="auto"><span>{x.kind === 'open' ? x.text : t('r2.confident', { label: x.label })}</span>
            <span className="block text-xs text-ink-soft">{t('r2.evidence', { n: x.evidence, label: x.label })}</span></li>))}</ul>, 'bg-teal-50', 'r2-well')}
        {f.reflection && section('🪞', t('r2.reflect'), f.reflection.kind === 'pattern'
          ? <p dir="auto">{t('r2.pattern', { text: f.reflection.text })}<span className="block text-xs text-ink-soft">{t('r2.patternEvidence', { n: f.reflection.evidence, of: f.reflection.of, label: f.reflection.label })}</span></p>
          : <p dir="auto">{t('r2.moment', { prompt: f.reflection.prompt })}</p>, 'bg-sun-50', 'r2-reflect')}
        {section('🎯', t('r2.challenge'), <p className="font-bold" dir="auto">{f.challenge.text}</p>, 'bg-violet-50', 'r2-challenge')}
        {showScore && r.score != null && section('📊', t('r2.score'), <div className="grid gap-2">
          <div className={`text-4xl font-extrabold leading-none ${tone.ink}`} data-testid="score">{r.score}<span className="text-base text-ink-soft font-bold"> / 100</span></div>
          <Meter value={r.score} /><p className="text-xs text-ink-soft">{t('r2.scoreNote')}</p></div>, 'bg-paper', 'r2-score')}
        <p className="text-xs text-ink-soft">{disclaimer || t('r2.playful')}</p>
        {footer}
      </div>
    </div>
  );
}

/** Share-safe: the habit and challenge only, never the score or result band. */
export function takeawayText(title: string, r: PersonalResult): string {
  if (r.feedback) { const f = r.feedback; // v2: strengths, reflection and challenge; never the score or the category
    return [t('r2.takeawayHead', { title }), ...f.strengths.map(x => `✨ ${x.kind === 'open' ? x.text : t('r2.confident', { label: x.label })}`),
      f.reflection ? `🪞 ${f.reflection.kind === 'pattern' ? f.reflection.text : f.reflection.prompt}` : '', `🎯 ${f.challenge.text}`].filter(Boolean).join('\n'); }
  return [t('res.takeawayHead', { title }), r.habit ? `🔁 ${r.habit}` : '', r.challenge ? `🎯 ${r.challenge}` : ''].filter(Boolean).join('\n');
}

export function resultText(title: string, r: PersonalResult): string {
  if (!r.valid || !r.band) return `${title}: answered ${r.answered}/${r.total}, not enough for a score.`;
  const score = r.correct != null ? `${r.correct}/${r.total} correct` : `${r.score}/100`;
  return [`${title} — ${r.band.emoji} ${r.band.title} (${score})`, ...r.observations.map(o => '• ' + o.text), r.habit ? `Habit: ${r.habit}` : '', r.challenge ? `Tomorrow: ${r.challenge}` : ''].filter(Boolean).join('\n');
}
