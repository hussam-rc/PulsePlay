// Scoring simulation for the 3.0B bank after the final review (tied scores, variable maximum points).
// Usage: npx tsx scripts/simulate-ego-bank.ts > ../docs/EGO_BANK_SIMULATION.md
import { egoCheckV2Draft as e } from '../src/experiences/drafts/egoCheckV2';
import { AUTHORED, BANK_EN } from '../src/experiences/drafts/egoCheckV2.en';
import { selectActivities } from '../src/engine/bank';
import { personalResult } from '../src/engine/scoring';
import { rng, hash } from '../src/engine/random';

type Q = typeof BANK_EN[number];
const at = (q: Q, pos: number) => q.options[AUTHORED[q.id].indexOf(pos)];
const RUNS = 1000;
const pct = (x: number, n = RUNS) => `${Math.round((100 * x) / n)}%`;
const weighted = (w: number[]) => (_: Q, r: () => number) => { let x = r() * w.reduce((s, v) => s + v, 0); for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; } return w.length - 1; };
const fixed = (pos: number) => () => pos;
type Pattern = { name: string; note: string; pos: (q: Q, r: () => number) => number; target?: string[] };
// Positions: 0 open · 1 assertive · 2 self-protective · 3 ego-driven (the authored reaction; its points come from the review).
const PATTERNS: Pattern[] = [
  { name: 'Strongly reflective', note: 'always the open reaction', pos: fixed(0) },
  { name: 'Healthy confidence', note: 'always the assertive reaction (states views, boundaries, neutral)', pos: fixed(1) },
  { name: 'Open or assertive', note: '50/50', pos: weighted([1, 1, 0, 0]) },
  { name: 'Realistic mix', note: '35% open, 35% assertive, 20% self-protective, 10% ego-driven', pos: weighted([35, 35, 20, 10]) },
  { name: 'Defensive', note: 'always the self-protective reaction', pos: fixed(2) },
  { name: 'Strongly ego-driven', note: 'always the ego-driven reaction', pos: fixed(3) },
  { name: 'Uniform random', note: 'any reaction, equally likely', pos: weighted([1, 1, 1, 1]) },
  { name: 'Ego in recognition only', note: 'ego-driven in recognition, open elsewhere', target: ['recognition'], pos: q => (q.dimension === 'recognition' ? 3 : 0) },
  { name: 'Defensive in feedback + collaboration', note: 'self-protective there, open/assertive elsewhere', target: ['feedback', 'collaboration'], pos: (q, r) => (q.dimension === 'feedback' || q.dimension === 'collaboration' ? 2 : weighted([1, 1, 0, 0])(q, r)) },
  { name: 'Assertive, ego in humility', note: 'ego-driven in learning, assertive elsewhere', target: ['humility'], pos: q => (q.dimension === 'humility' ? 3 : 1) },
];

const pointsHist: Record<string, number> = {};
for (const q of BANK_EN) { const k = [...q.options.map(o => o.points)].sort().join(''); pointsHist[k] = (pointsHist[k] ?? 0) + 1; }
const max2 = BANK_EN.filter(q => Math.max(...q.options.map(o => o.points)) === 2).length;
const out: string[] = ['# Who is in Control? v2: scoring validation (final review, tied scores)', '',
  '## Point patterns in the bank', '',
  '| Points (sorted) | Questions |', '|---|---:|', ...Object.entries(pointsHist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k.split('').join(', ')} | ${v} |`), '',
  `Questions whose highest reaction is self-protective (max 2): **${max2} of 60**. Every question has at least one 0-point reaction.`, '',
  '## Formula', '',
  'Ego Driving Score = 100 × (ego points of the answers given) ÷ (highest ego points available in the questions answered). Unanswered questions are excluded from both, so 10, 15 and 20 questions are on the same 0–100 scale. 100 means "the most ego-driven reaction on every question answered", not "3 points per question". The feedback levels use the bank\'s point scale (3), so a 2-point answer always reads as self-protective, never as ego-driven.', ''];

// ---------- Distortion check: approved formula vs two alternatives ----------
type F = (acts: Q[], ans: Record<string, string>) => number;
const pts = (q: Q, id: string) => q.options.find(o => o.id === id)!.points;
const mx = (q: Q) => Math.max(...q.options.map(o => o.points));
const FORMULAS: [string, F][] = [
  ['Approved: Σ points ÷ Σ question maxima', (a, ans) => (100 * a.reduce((s, q) => s + pts(q, ans[q.id]), 0)) / a.reduce((s, q) => s + mx(q), 0)],
  ['Alternative A: Σ points ÷ (3 × questions)', (a, ans) => (100 * a.reduce((s, q) => s + pts(q, ans[q.id]), 0)) / (3 * a.length)],
  ['Alternative B: mean of (points ÷ question maximum)', (a, ans) => (100 * a.reduce((s, q) => s + pts(q, ans[q.id]) / mx(q), 0)) / a.length],
];
out.push('## Does normalising across different questions distort the score?', '',
  'Same answers, three formulas, 1,000 random balanced selections per length. "Spread" = how much the score moves only because different questions were drawn (standard deviation).', '');
for (const n of [10, 20]) {
  out.push(`### ${n} questions`, '', `| Pattern | ${FORMULAS.map(f => f[0]).join(' | ')} |`, `|---|${FORMULAS.map(() => '---').join('|')}|`);
  for (const p of PATTERNS.filter(x => ['Healthy confidence', 'Realistic mix', 'Defensive', 'Strongly ego-driven'].includes(x.name))) {
    const vals: number[][] = FORMULAS.map(() => []);
    for (let k = 0; k < RUNS; k++) {
      const r = rng(hash(`dist-${p.name}-${n}-${k}`));
      const acts = selectActivities(e, n, { random: r }) as Q[];
      const ans = Object.fromEntries(acts.map(q => [q.id, at(q, p.pos(q, r)).id]));
      FORMULAS.forEach(([, f], i) => vals[i].push(f(acts, ans)));
    }
    const cell = (v: number[]) => { const m = v.reduce((s, x) => s + x, 0) / v.length; const sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length); return `mean ${Math.round(m)}, spread ±${sd.toFixed(1)}`; };
    out.push(`| ${p.name} | ${vals.map(cell).join(' | ')} |`);
  }
  out.push('');
}

// ---------- Category stability ----------
const BANDS = e.results!.map(b => `${b.emoji} ${b.min}-${b.max}`);
out.push('## Category stability (approved formula)', '', `Share of ${RUNS} simulated players in each category, each on a fresh balanced selection.`, '');
for (const n of [10, 15, 20]) {
  out.push(`### ${n} questions`, '', `| Pattern | ${BANDS.join(' | ')} | Mean score |`, `|---|${BANDS.map(() => '---:').join('|')}|---:|`);
  for (const p of PATTERNS.slice(0, 7)) {
    const c = [0, 0, 0, 0]; let sum = 0;
    for (let k = 0; k < RUNS; k++) {
      const r = rng(hash(`band-${p.name}-${n}-${k}`));
      const acts = selectActivities(e, n, { random: r }) as Q[];
      const res = personalResult({ ...e, rounds: [{ id: 'main', activities: acts }] }, Object.fromEntries(acts.map(q => [q.id, at(q, p.pos(q, r)).id])));
      sum += res.score!; c[e.results!.findIndex(b => b === res.band)]++;
    }
    out.push(`| ${p.name} (${p.note}) | ${c.map(x => pct(x)).join(' | ')} | ${Math.round(sum / RUNS)} |`);
  }
  out.push('');
}

// ---------- Feedback coherence ----------
out.push('## Feedback coherence', '',
  '"Incoherent" counts feedback that contradicts the answers and must be 0. It counts five cases:',
  '- a reflection without any self-protective or ego-driven answer',
  '- a single situation without an ego-driven answer',
  '- a pattern based on fewer than 2 answers',
  '- a strength contradicted by a self-protective or ego-driven answer',
  '- the same area named as a strength and as the reflection',
  '',
  '"Hits target" is the share of reflections naming an area the pattern was built to stress.', '');
for (const n of [10, 15, 20]) {
  out.push(`### ${n} questions`, '', '| Pattern | Most common category | ≥ 1 strength | Pattern found | Single situation | Nothing to reflect on | Hits target | Incoherent |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const p of PATTERNS) {
    let st = 0, pat = 0, mom = 0, none = 0, hit = 0, bad = 0; const cat: Record<string, number> = {};
    for (let k = 0; k < RUNS; k++) {
      const r = rng(hash(`fb-${p.name}-${n}-${k}`));
      const acts = selectActivities(e, n, { random: r }) as Q[];
      const lv: Record<string, number> = {};
      const ans = Object.fromEntries(acts.map(q => { const o = at(q, p.pos(q, r)); lv[q.id] = o.points; return [q.id, o.id]; }));
      const res = personalResult({ ...e, rounds: [{ id: 'main', activities: acts }] }, ans); const f = res.feedback!;
      cat[res.band!.emoji] = (cat[res.band!.emoji] ?? 0) + 1;
      if (f.strengths.length) st++;
      const ref = f.reflection; if (!ref) none++; else if (ref.kind === 'pattern') pat++; else mom++;
      if (ref && p.target?.includes(ref.theme)) hit++;
      const inDim = (d: string) => acts.filter(q => q.dimension === d).map(q => lv[q.id]);
      if (ref && !Object.values(lv).some(l => l >= 2)) bad++;
      if (ref?.kind === 'moment' && lv[ref.activityId] !== 3) bad++;
      if (ref?.kind === 'pattern' && inDim(ref.theme).filter(l => l >= 2).length < 2) bad++;
      if (f.strengths.some(s => inDim(s.theme).some(l => l >= 2))) bad++;
      if (f.strengths.some(s => s.theme === ref?.theme)) bad++;
    }
    const top = Object.entries(cat).sort((a, b) => b[1] - a[1])[0];
    out.push(`| ${p.name} | ${top[0]} ${pct(top[1])} | ${pct(st)} | ${pct(pat)} | ${pct(mom)} | ${pct(none)} | ${p.target ? pct(hit) : '–'} | ${bad} |`);
  }
  out.push('');
}
console.log(out.join('\n'));
