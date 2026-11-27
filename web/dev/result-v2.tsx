// DEVELOPMENT ONLY. Usage: npx vite --open /dev/result-v2.html?lang=ar&p=one
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { setLang } from '../src/i18n';
import { ResultCard } from '../src/ui/bits';
import { StageView } from '../src/live/screens';
import { personalResult } from '../src/engine/scoring';
import { sessionExperience } from '../src/engine/bank';
import { egoCheckV2Draft, egoCheckV2For, LANGUAGE_PACKS } from '../src/experiences/drafts/egoCheckV2';

const qs = new URLSearchParams(location.search);
setLang((qs.get('lang') ?? 'en') as 'en');
const pack = LANGUAGE_PACKS.find(p => p.lang === qs.get('lang'));
const e = sessionExperience(pack ? egoCheckV2For(pack) : egoCheckV2Draft, { n: 15, seed: 'preview' });
const acts = e.rounds[0].activities as any[];
const P: Record<string, (a: any, i: number) => number> = {
  open: () => 0, confident: () => 1, defensive: () => 2, ego: () => 3,
  one: (a, i) => (i === 4 ? 3 : i % 2 ? 1 : 0),                    // one notable moment
  pattern: a => (a.dimension === 'recognition' ? 2 : a.dimension === 'feedback' ? 1 : 0),
  mixed: (_, i) => [0, 1, 0, 2, 1, 0, 3, 1, 0, 1, 2, 0, 1, 0, 1][i],
};
const pick = P[qs.get('p') ?? 'one'];
// ties: when a question has no option at the wanted level, take the closest one below it
const near = (a: any, l: number) => [...a.options].filter((o: any) => o.points <= l).sort((x: any, y: any) => y.points - x.points)[0];
const ans = Object.fromEntries(acts.map((a, i) => [a.id, near(a, pick(a, i)).id]));
const r = personalResult(e, ans);
const avg = Number(qs.get('avg') ?? 34), n = Number(qs.get('n') ?? 12);
const groupView = { code: 'PREVIEW', stage: 'group', index: 0, total: acts.length, joined: n + 2, seq: 1, settings: { leaderboard: false },
  experience: { ...e, scoringKind: e.scoring.kind, scoring: { version: e.scoring.version } },
  group: { joined: n + 2, valid: n, average: avg, bands: n >= 10 ? [4, 5, 2, 1].map(x => Math.round(x * n / 12)) : null, suppressed: n < 5 } } as any;
createRoot(document.getElementById('root')!).render(qs.get('view') === 'group'
  ? <div className="min-h-screen bg-paper"><StageView v={groupView} off={0} joinUrl="" /></div>
  : <div className="max-w-xl mx-auto px-4 py-6"><ResultCard r={r} disclaimer={e.disclaimer} showScore={qs.get('score') !== 'off'} onTakeaway={() => {}} onCopy={() => {}} /></div>);
