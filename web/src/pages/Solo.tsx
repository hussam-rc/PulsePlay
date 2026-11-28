import { useMemo, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { byId } from '../experiences';
import { flatActivities } from '../engine/util';
import { sessionExperience } from '../engine/bank';
import { personalResult, Responses, ResponseValue } from '../engine/scoring';
import { randomId } from '../engine/random';
import { ActivityInput } from '../ui/Activity';
import { publicActivity } from '../live/view';
import { Bar, ResultCard, resultText, takeawayText } from '../ui/bits';
import { t } from '../i18n';

/** Self-paced mode: one person, no timer, nothing sent anywhere. */
export function Solo() {
  const base = byId(useParams().id ?? '');
  const e = useMemo(() => base && sessionExperience(base), [base]); // this play's questions (all of them for games without a bank)
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
          <h1 className="text-3xl font-extrabold" dir="auto">{e.title}</h1>
          <p className="text-ink-soft">{e.tagline}</p>
          <p>{t('solo.intro', { n: acts.length })}</p>
          <button className="btn-primary" onClick={() => setI(0)} data-testid="solo-start">{t('host.start')}</button>
          <p className="text-xs text-ink-soft">{e.disclaimer}</p>
        </div>
      )}
      {a && !done && (
        <div className="card p-5 grid gap-4">
          <div className="flex justify-between items-center"><span className="chip bg-violet-50 text-violet-700">{i + 1} / {acts.length}</span><span className="text-sm text-ink-soft">{e.title}</span></div>
          <Bar pct={(100 * i) / acts.length} />
          <h2 className="text-2xl font-extrabold leading-tight">{a.prompt}</h2>
          <ActivityInput activity={publicActivity(a)} seed={seed} value={resp[a.id]} disabled={resp[a.id] != null} onPick={pick} correctId={revealed && e.reveal === 'correct' && a.type === 'choice' ? a.options.find(o => o.correct)?.id : null} />
          {revealed && (
            <div className="grid gap-3 anim-pop">
              {e.reveal === 'correct' && a.type === 'choice' && (
                <div className={`rounded-2xl p-4 ${a.options.find(o => o.id === resp[a.id])?.correct ? 'bg-teal-50' : 'bg-sun-50'}`}>
                  <b>{a.options.find(o => o.id === resp[a.id])?.correct ? '✅ ' + t('solo.correct') : '🤔 ' + t('solo.notQuite')}</b> {a.explanation}
                </div>
              )}
              {e.reveal === 'distribution' && <p className="text-ink-soft">{t('solo.liveNote')}</p>}
              <button className="btn-primary" onClick={next}>{i < acts.length - 1 ? t('solo.next') : t('solo.see')}</button>
            </div>
          )}
        </div>
      )}
      {done && (
        <div className="grid gap-4">
          {e.privacy.individualResults
            ? <ResultCard r={personalResult(e, resp, seed)} disclaimer={e.disclaimer} showScore={e.scoring.showScore ?? true} onCopy={() => navigator.clipboard.writeText(resultText(e.title, personalResult(e, resp, seed)))} onTakeaway={() => navigator.clipboard.writeText(takeawayText(e.title, personalResult(e, resp, seed)))} />
            : <div className="card p-6 grid gap-3"><div className="text-5xl text-center" aria-hidden>🎉</div><h2 className="text-2xl font-extrabold text-center">{t('solo.picks')}</h2>
                <ul className="grid gap-2">{acts.map(x => x.type === 'poll' && <li key={x.id} className="rounded-xl bg-paper p-3">{x.options.find(o => o.id === resp[x.id])?.emoji} {x.options.find(o => o.id === resp[x.id])?.text ?? t('solo.skipped')}</li>)}</ul></div>}
          {e.closing && <div className="card p-5 grid gap-2"><h3 className="font-extrabold">{t('solo.take')}</h3>{e.closing.questions.map((q, k) => <p key={k}>{k + 1}. {q}</p>)}<p className="font-extrabold text-violet-600">{e.closing.message}</p></div>}
          <section className="card p-5 grid gap-3" data-testid="next-steps"><h3 className="font-extrabold">{t('next.title')}</h3>
            <div className="grid sm:grid-cols-3 gap-2">
              {e.modes.includes('live') && <Link className="btn-primary" to={`/host/${e.id}`}>🎤 {t('next.hostThis')}</Link>}
              <Link className="btn-ghost" to="/find">✨ {t('next.find')}</Link>
              <button className="btn-ghost" onClick={() => { setResp({}); setI(-1); }}>↻ {t('next.again')}</button>
            </div></section>
        </div>
      )}
    </div>
  );
}
