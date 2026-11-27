// Writes the human review sheet for the 3.0B bank. Usage: npx tsx scripts/review-ego-bank.ts > ../docs/EGO_BANK_REVIEW.md
import { BANK_EN, DIMENSIONS, INSIGHTS_EN, RESULTS_EN, AUTHORED } from '../src/experiences/drafts/egoCheckV2.en';
const POS = ['Open', 'Assertive', 'Self-protective', 'Ego-driven'];
const out = ['# Who is in Control? v2: question bank for review (English master, final scoring review)', '',
  'Status: **draft for final approval, not published.** Generated from `web/src/experiences/drafts/egoCheckV2.en.ts`.', '',
  'Points: 0 open or healthy assertive · 1 mild self-focus · 2 self-protective · 3 ego-driven. **Ties mean "equally reasonable".**',
  'The column headings show which kind of reaction each answer was written as; the number in brackets is its score. Players see the answers shuffled, without points.', ''];
for (const d of DIMENSIONS) {
  const t = INSIGHTS_EN.themes[d];
  out.push(`## ${t.label} (\`${d}\`)`, '', `| # | Situation | ${POS.join(' | ')} |`, '|---|---|---|---|---|---|');
  for (const q of BANK_EN.filter(x => x.dimension === d)) {
    const cells = [0, 1, 2, 3].map(pos => { const o = q.options[AUTHORED[q.id].indexOf(pos)]; return `${o.text} **(${o.points})**`; });
    out.push(`| ${q.id} | ${q.prompt} | ${cells.join(' | ')} |`);
  }
  out.push('', `Strength: "${t.strength}" · Growth: "${t.growth}" · Challenge: "${t.challenge}"`, '');
}
out.push('## Result categories', '', '| Range | Personal | Group |', '|---|---|---|');
for (const b of RESULTS_EN) out.push(`| ${b.min}–${b.max} | ${b.emoji} **${b.title}** ${b.message} | **${b.groupTitle}** ${b.groupMessage} |`);
console.log(out.join('\n'));
