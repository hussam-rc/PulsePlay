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
// ---------- Feedback coherence (scoring v2) ----------
type Combo = { name: string; target?: string[]; pick: (dim: string, r: () => number) => number };
const COMBOS: Combo[] = [
  { name: 'Strongly reflective', pick: () => 0 },
  { name: 'Healthy confidence', pick: () => 1 },
  { name: 'Realistic mix', pick: weighted([35, 35, 20, 10]) },
  { name: 'Defensive (all 2)', pick: () => 2 },
  { name: 'Strongly ego-driven', pick: () => 3 },
  { name: 'Ego in recognition only', target: ['recognition'], pick: d => (d === 'recognition' ? 3 : 0) },
  { name: 'Self-protective in feedback + collaboration', target: ['feedback', 'collaboration'], pick: d => (d === 'feedback' || d === 'collaboration' ? 2 : weighted([1, 1, 0, 0])(d, Math.random)) },
  { name: 'Confident, but ego in humility', target: ['humility'], pick: d => (d === 'humility' ? 3 : 1) },
  { name: 'Uniform random', pick: weighted([1, 1, 1, 1]) },
];
out.push('# Feedback coherence (scoring v2)', '',
  'Per pattern and game length, over 1,000 simulated players on fresh balanced selections:',
  '- "≥1 strength" and the reflection mix (pattern / single situation / none).',
  '- "Hits target": share of reflections naming one of the dimensions the pattern was built to stress.',
  '- "Incoherent": count of feedback that contradicts the answers. It should be 0. It counts:',
  '  - a reflection without any 2-3 point answer',
  '  - a single situation without a 3-point answer',
  '  - a pattern based on fewer than 2 answers',
  '  - a strength in a dimension with a 2-3 point answer',
  '  - the same dimension named as a strength and as the reflection', '');
for (const n of [10, 15, 20]) {
  out.push(`## ${n} questions`, '', '| Pattern | Category (most common) | ≥1 strength | Pattern | Single situation | Nothing to reflect on | Hits target | Incoherent |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const c of COMBOS) {
    let st = 0, pat = 0, mom = 0, none = 0, hit = 0, bad = 0; const cat: Record<string, number> = {};
    for (let k = 0; k < RUNS; k++) {
      const r = rng(hash(`fb-${c.name}-${n}-${k}`));
      const acts = selectActivities(e, n, { random: r }) as any[];
      const levels: Record<string, number> = {};
      const answers = Object.fromEntries(acts.map(a => { const l = c.pick(a.dimension, r); levels[a.id] = l; return [a.id, a.options.find((o: any) => o.points === l).id]; }));
      const res = personalResult({ ...e, rounds: [{ id: 'main', activities: acts }] }, answers); const f = res.feedback!;
      cat[res.band!.emoji] = (cat[res.band!.emoji] ?? 0) + 1;
      if (f.strengths.length) st++;
      const ref = f.reflection; if (!ref) none++; else if (ref.kind === 'pattern') pat++; else mom++;
      if (ref && c.target?.includes(ref.theme)) hit++;
      const inDim = (d: string) => acts.filter(a => a.dimension === d).map(a => levels[a.id]);
      if (ref && !Object.values(levels).some(l => l >= 2)) bad++;
      if (ref?.kind === 'moment' && levels[ref.activityId] !== 3) bad++;
      if (ref?.kind === 'pattern' && inDim(ref.theme).filter(l => l >= 2).length < 2) bad++;
      if (f.strengths.some(s => inDim(s.theme).some(l => l >= 2))) bad++;
      if (f.strengths.some(s => s.theme === ref?.theme)) bad++;
    }
    const top = Object.entries(cat).sort((a, b) => b[1] - a[1])[0];
    const p = (x: number) => `${Math.round((100 * x) / RUNS)}%`;
    out.push(`| ${c.name} | ${top[0]} ${p(top[1])} | ${p(st)} | ${p(pat)} | ${p(mom)} | ${p(none)} | ${c.target ? p(hit) : '–'} | ${bad} |`);
  }
  out.push('');
}
console.log(out.join('\n'));
