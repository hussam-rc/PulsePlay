// DEVELOPMENT ONLY. Usage: npx vite --open /dev/result-v2.html?lang=ar&p=one
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { setLang } from '../src/i18n';
import { ResultCard } from '../src/ui/bits';
import { personalResult } from '../src/engine/scoring';
import { sessionExperience } from '../src/engine/bank';
import { egoCheckV2Draft } from '../src/experiences/drafts/egoCheckV2';

const qs = new URLSearchParams(location.search);
setLang((qs.get('lang') ?? 'en') as 'en');
const e = sessionExperience(egoCheckV2Draft, { n: 15, seed: 'preview' });
const acts = e.rounds[0].activities as any[];
const P: Record<string, (a: any, i: number) => number> = {
  open: () => 0, confident: () => 1, defensive: () => 2, ego: () => 3,
  one: (a, i) => (i === 4 ? 3 : i % 2 ? 1 : 0),                    // one notable moment
  pattern: a => (a.dimension === 'recognition' ? 2 : a.dimension === 'feedback' ? 1 : 0),
  mixed: (_, i) => [0, 1, 0, 2, 1, 0, 3, 1, 0, 1, 2, 0, 1, 0, 1][i],
};
const pick = P[qs.get('p') ?? 'one'];
const ans = Object.fromEntries(acts.map((a, i) => { const l = pick(a, i); return [a.id, a.options.find((o: any) => o.points === l).id]; }));
const r = personalResult(e, ans);
createRoot(document.getElementById('root')!).render(
  <div className="max-w-xl mx-auto px-4 py-6"><ResultCard r={r} disclaimer={e.disclaimer} showScore={qs.get('score') !== 'off'} onTakeaway={() => {}} onCopy={() => {}} /></div>);
