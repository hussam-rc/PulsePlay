import { useEffect, useState, ReactNode } from 'react';
import qrcode from 'qrcode-generator';
import type { ResultBand } from '../engine/schema';
import type { PersonalResult } from '../engine/scoring';

/** Re-render every `ms` (for countdowns). */
export function useNow(ms = 200) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(h); }, [ms]);
  return now;
}

export function QR({ text, label }: { text: string; label: string }) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return <div role="img" aria-label={label} className="bg-white rounded-2xl p-3 shadow-soft w-48 sm:w-60 aspect-square [&>svg]:w-full [&>svg]:h-full"
    dangerouslySetInnerHTML={{ __html: q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }) }} />;
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

export function ResultCard({ r, disclaimer, onCopy }: { r: PersonalResult; disclaimer: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState('');
  if (!r.valid || !r.band) {
    return <div className="card p-6 text-center grid gap-3">
      <div className="text-6xl">🅿️</div>
      <h2 className="text-2xl font-extrabold">Parked before the finish line</h2>
      <p>You answered <b>{r.answered} of {r.total}</b>. That's not enough for a fair score this time.</p>
      <p className="text-ink-soft">Play again any time — speed isn't the point.</p>
    </div>;
  }
  const b: ResultBand = r.band;
  return (
    <div className="card p-6 text-center grid gap-3 relative overflow-hidden" data-testid="result-card">
      {(b.tone === 'great' || b.tone === 'good') && <Confetti />}
      <div className="text-7xl anim-rise">{b.emoji}</div>
      <h2 className="text-2xl font-extrabold">{b.title}</h2>
      <div className="text-5xl font-extrabold text-violet-600 leading-none" data-testid="score">{r.correct != null ? `${r.correct}/${r.total}` : r.score}
        <span className="text-lg text-ink-soft font-bold"> {r.correct != null ? 'correct' : '/ 100'}</span></div>
      <p className="italic text-ink-soft">"{b.message}"</p>
      <p>{b.explanation}</p>
      {(r.observations.length > 0 || r.habit) && <ul className="grid gap-2 text-start">
        {r.observations.map((o, i) => <li key={i} className="rounded-xl bg-paper p-3"><b className="block text-xs text-ink-soft">{o.kind === 'strength' ? 'Strength' : 'Worth noticing'}</b>{o.text}</li>)}
        {r.habit && <li className="rounded-xl bg-paper p-3"><b className="block text-xs text-ink-soft">Habit to try</b>{r.habit}</li>}
        {r.challenge && <li className="rounded-xl bg-paper p-3"><b className="block text-xs text-ink-soft">Tomorrow's challenge</b>{r.challenge}</li>}
      </ul>}
      <p className="text-xs text-ink-soft">{disclaimer}</p>
      {onCopy && <div><button className="btn-ghost" onClick={() => { try { onCopy(); setCopied('Copied. Nothing was shared automatically.'); } catch { setCopied('Copy blocked — take a screenshot instead.'); } }}>📋 Copy my result</button>
        <p className="text-xs text-ink-soft mt-2" aria-live="polite">{copied}</p></div>}
    </div>
  );
}

export function resultText(title: string, r: PersonalResult): string {
  if (!r.valid || !r.band) return `${title}: answered ${r.answered}/${r.total}, not enough for a score.`;
  const score = r.correct != null ? `${r.correct}/${r.total} correct` : `${r.score}/100`;
  return [`${title} — ${r.band.emoji} ${r.band.title} (${score})`, ...r.observations.map(o => '• ' + o.text), r.habit ? `Habit: ${r.habit}` : '', r.challenge ? `Tomorrow: ${r.challenge}` : ''].filter(Boolean).join('\n');
}
