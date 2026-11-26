// Scoring simulation for the 3.0B draft bank: response patterns x 1,000 balanced selections per game length.
// Usage: npx tsx scripts/simulate-ego-bank.ts > ../docs/EGO_BANK_SIMULATION.md
import { egoCheckV2Draft as e } from '../src/experiences/drafts/egoCheckV2';
import { selectActivities } from '../src/engine/bank';
import { personalResult } from '../src/engine/scoring';
import { rng, hash } from '../src/engine/random';

type Pattern = { name: string; note: string; pick: (dim: string, r: () => number) => number };
const weighted = (w: number[]) => (_: string, r: () => number) => { let x = r() * w.reduce((s, v) => s + v, 0); for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; } return w.length - 1; };
const PATTERNS: Pattern[] = [
  { name: 'Always open', note: 'always the 0-point answer', pick: () => 0 },
  { name: 'Healthy confident', note: 'always the 1-point answer (states views, names feelings, asks for fair credit)', pick: () => 1 },
  { name: 'Open or confident', note: '50% level 0, 50% level 1', pick: weighted([1, 1, 0, 0]) },
  { name: 'Realistic mix', note: '35% / 35% / 20% / 10% for levels 0-3', pick: weighted([35, 35, 20, 10]) },
  { name: 'Uniform random', note: 'any answer, equally likely', pick: weighted([1, 1, 1, 1]) },
  { name: 'Self-protective', note: 'always the 2-point answer', pick: () => 2 },
  { name: 'Ego in one area', note: 'level 3 in recognition, level 0 elsewhere', pick: d => (d === 'recognition' ? 3 : 0) },
  { name: 'Ego driving', note: 'always the 3-point answer', pick: () => 3 },
];
const BANDS = e.results!.map(b => `${b.emoji} ${b.min}-${b.max}`);
const RUNS = 1000;
const out: string[] = ['# Who is in Control? v2 draft: scoring simulation', '',
  `Scoring model unchanged (v1 formula): points ÷ maximum of answered questions → 0–100 → bands ${BANDS.join(' · ')}.`,
  `Each cell: share of ${RUNS} simulated players landing in each band, each on a fresh balanced selection.`, ''];
for (const n of [10, 15, 20]) {
  out.push(`## ${n} questions`, '', `| Pattern | ${BANDS.join(' | ')} | Mean score | Same band as most common |`, `|---|${BANDS.map(() => '---:').join('|')}|---:|---:|`);
  for (const p of PATTERNS) {
    const counts = [0, 0, 0, 0]; let sum = 0;
    for (let k = 0; k < RUNS; k++) {
      const r = rng(hash(`${p.name}-${n}-${k}`));
      const acts = selectActivities(e, n, { random: r });
      const answers = Object.fromEntries(acts.map(a => { const lvl = p.pick(a.dimension!, r); return [a.id, (a as any).options.find((o: any) => o.points === lvl).id]; }));
      const res = personalResult({ ...e, rounds: [{ id: 'main', activities: acts }] }, answers);
      sum += res.score!; counts[e.results!.findIndex(b => b === res.band)]++;
    }
    const pct = counts.map(c => `${Math.round((100 * c) / RUNS)}%`);
    out.push(`| ${p.name} (${p.note}) | ${pct.join(' | ')} | ${Math.round(sum / RUNS)} | ${Math.round((100 * Math.max(...counts)) / RUNS)}% |`);
  }
  out.push('');
}
console.log(out.join('\n'));
