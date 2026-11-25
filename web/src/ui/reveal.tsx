// Reusable reveal pieces for result moments. All respect prefers-reduced-motion (numbers and bars jump straight to their value).
import { useEffect, useState } from 'react';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Counts up to a number in ~0.9 s. */
export function CountUp({ to, ms = 900 }: { to: number; ms?: number }) {
  const [v, setV] = useState(() => (reduced() ? to : 0));
  useEffect(() => {
    if (reduced()) { setV(to); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (now: number) => { const p = Math.min(1, (now - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <span className="tabular-nums" data-value={to}><span aria-hidden>{v}</span><span className="sr-only">{to}</span></span>;
}

/** Bar that grows from zero when it appears. */
export function GrowBar({ pct, color = '#5B3DF5', h = 'h-4' }: { pct: number; color?: string; h?: string }) {
  const [w, setW] = useState(() => (reduced() ? pct : 0));
  useEffect(() => { const id = requestAnimationFrame(() => setW(pct)); return () => cancelAnimationFrame(id); }, [pct]);
  return <span className={`block ${h} rounded-full bg-paper-line overflow-hidden`}><span className="block h-full rounded-full transition-[width] duration-1000 ease-out" style={{ width: `${Math.max(0, Math.min(100, w))}%`, background: color }} /></span>;
}

/** Two options side by side as one split bar, e.g. 62% | 38%. */
export function SplitBar({ a, b, labelA, labelB }: { a: number; b: number; labelA: string; labelB: string }) {
  const [on, setOn] = useState(reduced());
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  const total = a + b || 1, wa = on ? (100 * a) / total : 50;
  return (
    <div className="grid gap-1.5">
      <div className="flex h-10 rounded-2xl overflow-hidden font-extrabold text-white text-lg" role="img" aria-label={`${labelA} ${a}%, ${labelB} ${b}%`}>
        <span className="grid place-items-center bg-violet-600 transition-[width] duration-1000 ease-out min-w-[3rem]" style={{ width: `${wa}%` }}>{a}%</span>
        <span className="grid place-items-center bg-sky-500 flex-1 min-w-[3rem]">{b}%</span>
      </div>
      <div className="flex justify-between gap-4 text-sm font-bold"><span dir="auto" className="min-w-0">{labelA}</span><span dir="auto" className="min-w-0 text-end">{labelB}</span></div>
    </div>
  );
}

/** Top three on a podium, others as a list. Only volunteers who chose a leaderboard name appear. */
export function Podium({ rows, total, title, note }: { rows: { name: string; correct: number }[]; total: number; title: string; note: string }) {
  const [first, second, third] = rows, rest = rows.slice(3);
  // DOM order is 1st, 2nd, 3rd (what screen readers announce); CSS order places 2nd left and 3rd right.
  const step = (r: typeof first | undefined, medal: string, hgt: string, delay: number, order: string) => r && (
    <li className={`grid justify-items-center gap-1 anim-in ${order}`} style={{ animationDelay: `${delay}ms` }}>
      <span className="text-3xl" aria-hidden>{medal}</span><b className="max-w-[9rem] truncate" dir="auto">{r.name}</b>
      <span className="text-sm font-bold text-ink-soft tabular-nums">{r.correct}/{total}</span>
      <span className={`w-24 sm:w-28 ${hgt} rounded-t-2xl bg-gradient-to-b from-violet-500 to-violet-700`} aria-hidden />
    </li>);
  return (
    <section className="grid gap-3 w-full max-w-xl" data-testid="leaderboard" aria-label={title}>
      <h3 className="text-xl font-extrabold text-center">🏆 {title} <span className="text-sm text-ink-soft font-bold">{note}</span></h3>
      <ol className="flex items-end justify-center gap-2">{step(first, '🥇', 'h-24', 0, 'order-2')}{step(second, '🥈', 'h-16', 250, 'order-1')}{step(third, '🥉', 'h-10', 450, 'order-3')}</ol>
      {rest.length > 0 && <ol start={4} className="grid gap-1.5">{rest.map((r, i) => <li key={i} className="flex items-center gap-3 rounded-xl bg-paper border border-paper-line px-4 py-2 font-bold"><span className="w-7 text-ink-soft">{i + 4}.</span><span className="flex-1 min-w-0 truncate" dir="auto">{r.name}</span><span className="tabular-nums">{r.correct}/{total}</span></li>)}</ol>}
    </section>
  );
}
