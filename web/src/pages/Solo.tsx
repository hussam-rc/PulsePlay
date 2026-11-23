import { useMemo, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { byId } from '../experiences';
import { flatActivities } from '../engine/schema';
import { personalResult, Responses, ResponseValue } from '../engine/scoring';
import { randomId } from '../engine/random';
import { ActivityInput } from '../ui/Activity';
import { Bar, ResultCard, resultText } from '../ui/bits';

/** Self-paced mode: one person, no timer, nothing sent anywhere. */
export function Solo() {
  const e = byId(useParams().id ?? '');
  const seed = useMemo(() => randomId(), []);
  const [i, setI] = useState(-1);
  const [resp, setResp] = useState<Responses>({});
  const [revealed, setRevealed] = useState(false);
  if (!e) return <Navigate to="/discover" replace />;
  const acts = flatActivities(e);
  const a = acts[i];
  const done = i >= acts.length;

  const pick = (v: ResponseValue) => { if (resp[a.id] != null) return; setResp({ ...resp, [a.id]: v }); setRevealed(e.reveal !== 'none'); if (e.reveal === 'none') setTimeout(() => setI(x => x + 1), 450); };
  const next = () => { setRevealed(false); setI(i + 1); };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 grid gap-5">
      <Link to={`/x/${e.id}`} className="text-sm font-bold text-ink-soft">← {e.title}</Link>
      {i === -1 && (
        <div className="card p-6 grid gap-4 text-center">
          <div className="text-6xl" aria-hidden>{e.emoji}</div>
          <h1 className="text-3xl font-extrabold">{e.title}</h1>
          <p className="text-ink-soft">{e.tagline}</p>
          <p>{acts.length} questions, at your own pace. Nothing leaves this device.</p>
          <button className="btn-primary" onClick={() => setI(0)}>Start</button>
          <p className="text-xs text-ink-soft">{e.disclaimer}</p>
        </div>
      )}
      {a && !done && (
        <div className="card p-5 grid gap-4">
          <div className="flex justify-between items-center"><span className="chip bg-violet-50 text-violet-700">{i + 1} / {acts.length}</span><span className="text-sm text-ink-soft">{e.title}</span></div>
          <Bar pct={(100 * i) / acts.length} />
          <h2 className="text-2xl font-extrabold leading-tight">{a.prompt}</h2>
          <ActivityInput activity={a} seed={seed} value={resp[a.id]} disabled={resp[a.id] != null} onPick={pick} reveal={revealed && e.reveal === 'correct' ? 'correct' : null} />
          {revealed && (
            <div className="grid gap-3 anim-pop">
              {e.reveal === 'correct' && a.type === 'choice' && (
                <div className={`rounded-2xl p-4 ${a.options.find(o => o.id === resp[a.id])?.correct ? 'bg-teal-50' : 'bg-sun-50'}`}>
                  <b>{a.options.find(o => o.id === resp[a.id])?.correct ? '✅ Correct!' : '🤔 Not quite.'}</b> {a.explanation}
                </div>
              )}
              {e.reveal === 'distribution' && <p className="text-ink-soft">In a live session, the room would now see how everyone voted.</p>}
              <button className="btn-primary" onClick={next}>{i < acts.length - 1 ? 'Next' : 'See my result'}</button>
            </div>
          )}
        </div>
      )}
      {done && (
        <div className="grid gap-4">
          {e.privacy.individualResults
            ? <ResultCard r={personalResult(e, resp, seed)} disclaimer={e.disclaimer} onCopy={() => navigator.clipboard.writeText(resultText(e.title, personalResult(e, resp, seed)))} />
            : <div className="card p-6 grid gap-3"><div className="text-5xl text-center" aria-hidden>🎉</div><h2 className="text-2xl font-extrabold text-center">Your picks</h2>
                <ul className="grid gap-2">{acts.map(x => x.type === 'poll' && <li key={x.id} className="rounded-xl bg-paper p-3">{x.options.find(o => o.id === resp[x.id])?.emoji} {x.options.find(o => o.id === resp[x.id])?.text ?? 'skipped'}</li>)}</ul></div>}
          {e.closing && <div className="card p-5 grid gap-2"><h3 className="font-extrabold">Take these with you</h3>{e.closing.questions.map((q, k) => <p key={k}>{k + 1}. {q}</p>)}<p className="font-extrabold text-violet-600">{e.closing.message}</p></div>}
          <div className="flex gap-2"><button className="btn-ghost flex-1" onClick={() => { setResp({}); setI(-1); }}>Play again</button><Link className="btn-primary flex-1" to="/discover">More games</Link></div>
        </div>
      )}
    </div>
  );
}
