// Writes the human review sheet for the 3.0B draft bank. Usage: npx tsx scripts/review-ego-bank.ts > ../docs/EGO_BANK_REVIEW.md
import { BANK_EN, DIMENSIONS, INSIGHTS_EN, RESULTS_EN } from '../src/experiences/drafts/egoCheckV2.en';
const L = ['0 · open', '1 · confident', '2 · self-protective', '3 · ego'];
const out = ['# Who is in Control? v2: question bank for review (English master)', '',
  'Status: **draft for review, not published.** Generated from `web/src/experiences/drafts/egoCheckV2.en.ts`; edit there, then regenerate.', '',
  'Rubric: 0 curious/open · 1 healthy self-regard (states views, names feelings, asks for fair credit) · 2 self-protective · 3 ego takes the wheel.',
  'Players see the four answers in a shuffled order without points. Letters below are the stored ids.', ''];
for (const d of DIMENSIONS) {
  const t = INSIGHTS_EN.themes[d];
  out.push(`## ${t.label} (\`${d}\`)`, '', `| # | Situation | ${L.join(' | ')} |`, '|---|---|---|---|---|---|');
  for (const q of BANK_EN.filter(x => x.dimension === d)) {
    const by = [0, 1, 2, 3].map(p => { const o = q.options.find(o => o.points === p)!; return `${o.text} *(${o.id})*`; });
    out.push(`| ${q.id} | ${q.prompt} | ${by.join(' | ')} |`);
  }
  out.push('', `Insights: strength "${t.strength}" · growth "${t.growth}" · habit "${t.habit}" · challenge "${t.challenge}"`, '');
}
out.push('## Result categories', '', '| Range | Personal | Group |', '|---|---|---|');
for (const b of RESULTS_EN) out.push(`| ${b.min}–${b.max} | ${b.emoji} **${b.title}** ${b.message} | **${b.groupTitle}** ${b.groupMessage} |`);
console.log(out.join('\n'));
