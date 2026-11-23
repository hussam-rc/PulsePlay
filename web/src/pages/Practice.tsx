import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { byId } from '../experiences';
import { Session, MAX_SIMULATED, Player } from '../engine/session';
import { timingOf, Experience } from '../engine/schema';
import { ActivityInput } from '../ui/Activity';
import { Bar, Chip, Gauge, QR, ResultCard, resultText, useNow } from '../ui/bits';
import { t } from '../i18n';

function useSession(s: Session) { useSyncExternalStore(s.subscribe.bind(s), () => s.state.seq + ':' + s.players.length + ':' + s.answeredCount() + ':' + s.players.reduce((n, p) => n + Object.keys(p.responses).length, 0)); return s; }

export function Practice() {
  const e = byId(useParams().id ?? '');
  if (!e) return <Navigate to="/discover" replace />;
  return <PracticeRun key={e.id} e={e} />;
}

function PracticeRun({ e }: { e: Experience }) {
  const [gen, setGen] = useState(0);
  const session = useMemo(() => { const s = new Session(e); s.addSimulated(6); return s; }, [e, gen]); // eslint-disable-line
  useEffect(() => () => session.end(), [session]);
  const s = useSession(session);
  const [me, setMe] = useState<Player | null>(null);
  const [fs, setFs] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setMe(null); }, [session]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '');
      if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(tag)) return;
      if (ev.key === ' ' || ev.key === 'ArrowRight') { ev.preventDefault(); s.next(); }
      if (ev.key.toLowerCase() === 'p') s.state.paused ? s.resume() : s.pause();
      if (ev.key.toLowerCase() === 'f') toggleFs();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => { const f = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  const toggleFs = async () => { try { document.fullscreenElement ? await document.exitFullscreen() : await stageRef.current?.requestFullscreen(); } catch { /* not allowed */ } };

  const st = s.state, pre = st.stage === 'lobby' || st.stage === 'intro';
  const sims = s.players.filter(p => p.simulated).length;
  const label = st.stage === 'lobby' ? 'Start ▶' : st.stage === 'intro' ? 'First question 🚦' : st.stage === 'activity'
    ? (st.phase === 'read' ? 'Open answers now' : st.phase === 'answer' ? 'Waiting for answers…' : st.index < s.activities.length - 1 ? 'Next question ▶' : 'Show results 🪞')
    : st.stage === 'results' ? (e.scoring.kind === 'aggregate' || e.scoring.kind === 'none' ? 'Wrap up ▶' : 'Reveal group result 🏢') : st.stage === 'group' ? 'Reflection ▶' : 'Finished 💜';

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-7xl mx-auto px-4 py-4 grid gap-4">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sun-50 text-[#8A5A0A] px-4 py-3 font-bold text-sm" role="status">
          🧪 {t('practice.banner')}
          <span className="ms-auto flex gap-2"><button className="btn-ghost !min-h-[38px] !px-3 text-sm" onClick={() => setGen(g => g + 1)}>↺ Restart</button><Link className="btn-ghost !min-h-[38px] !px-3 text-sm" to={`/x/${e.id}`}>Exit</Link></span>
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
          <div className="grid gap-4">
            <div ref={stageRef} className={`bg-white border border-paper-line shadow-soft flex flex-col overflow-hidden ${fs ? 'min-h-screen' : 'rounded-3xl min-h-[540px]'}`} data-testid="stage">
              <Stage s={s} />
              <div className="flex flex-wrap items-center gap-2 border-t border-paper-line bg-paper px-4 py-3">
                <button className="btn-primary" onClick={() => s.next()} disabled={st.stage === 'closing' || (st.stage === 'activity' && st.phase === 'answer' && s.answeredCount() < s.players.length)} data-testid="next">{label}</button>
                {st.stage === 'activity' && st.phase === 'answer' && <button className="btn-ghost" onClick={() => st.paused ? s.resume() : s.pause()}>{st.paused ? '▶ Resume' : '⏸ Pause'}</button>}
                <button className="btn-ghost" onClick={toggleFs}>⛶ Full screen</button>
                {st.stage === 'closing' && <button className="btn-ghost" onClick={() => setGen(g => g + 1)}>🔁 New game</button>}
                <span className="ms-auto text-xs text-ink-soft hidden md:inline"><kbd>Space</kbd>/<kbd>→</kbd> next · <kbd>P</kbd> pause · <kbd>F</kbd> full screen</span>
              </div>
            </div>
            <div className="card p-4 grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-extrabold">🤖 Simulated players: {sims}</h2>
                <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" className="w-5 h-5 accent-violet-600" checked={s.autoSim} onChange={ev => { s.autoSim = ev.target.checked; }} /> Answer automatically</label></div>
              <div className="flex flex-wrap gap-2 items-center">
                <button className="btn-ghost" disabled={!pre || sims >= MAX_SIMULATED} onClick={() => s.addSimulated(1)}>+1</button>
                <button className="btn-ghost" disabled={!pre || sims >= MAX_SIMULATED} onClick={() => s.addSimulated(5)}>+5</button>
                <span className="text-sm text-ink-soft">Up to {MAX_SIMULATED}, before the first question. Simulated answers are never saved or counted in analytics.</span>
              </div>
            </div>
          </div>
          <div>
            <div className="rounded-[2.5rem] border-[10px] border-ink bg-paper min-h-[680px] overflow-hidden relative" data-testid="phone">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 rounded-full bg-ink" aria-hidden />
              <div className="pt-10 px-4 pb-6"><Phone s={s} me={me} setMe={setMe} e={e} /></div>
            </div>
            <p className="text-center text-sm text-ink-soft mt-2">This phone is you. Play along!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Countdown({ until, alarm }: { until: number; alarm?: boolean }) {
  const now = useNow(200); const left = Math.max(0, Math.ceil((until - now) / 1000));
  return <>{alarm && left === 0 ? '⏰' : left}</>;
}

function Stage({ s }: { s: Session }) {
  const e = s.experience, st = s.state, n = s.players.length;
  const pad = 'flex-1 flex flex-col justify-center gap-5 p-6 sm:p-12';
  if (st.stage === 'lobby') return (
    <div className={pad}><div className="grid sm:grid-cols-[auto_1fr] gap-8 items-center">
      <QR text={`practice:${s.code}`} label="Practice QR code (not a real join link)" />
      <div className="grid gap-3">
        <p className="font-bold text-ink-soft">Practice room · in a live session, players scan this to join</p>
        <div className="text-6xl sm:text-7xl font-extrabold tracking-wider text-violet-600 tabular-nums">{s.code.slice(0, 3)} {s.code.slice(3)}</div>
        <div className="flex items-baseline gap-3"><span className="text-5xl font-extrabold" data-testid="joined">{n}</span><span className="font-bold">joined</span>
          {n < e.privacy.groupMinimum && <Chip tone="sun">{e.privacy.groupMinimum - n} more for group results</Chip>}</div>
        <div className="flex flex-wrap gap-2 max-h-40 overflow-auto">{s.players.map(p => <span key={p.id} className="chip bg-paper border border-paper-line anim-pop">{p.avatar} {p.nickname}</span>)}</div>
      </div></div></div>
  );
  if (st.stage === 'intro') { const tm = e.defaultTiming; return (
    <div className={`${pad} items-center text-center`}><div className="text-7xl" aria-hidden>{e.emoji}</div><h1 className="text-4xl sm:text-5xl font-extrabold">{e.title}</h1>
      <p className="text-xl text-ink-soft max-w-2xl">{e.tagline}</p>
      <div className="grid gap-2 text-lg font-bold text-start"><p>👀 {tm.readSec} s to read</p><p>📱 {tm.answerSec} s to answer on your phone</p><p>🔒 {e.privacy.individualResults ? 'Your answers stay private' : 'Only group totals are shown'}</p></div>
      <p className="text-sm text-ink-soft max-w-xl">{e.disclaimer}</p></div>); }
  if (st.stage === 'activity') {
    const a = s.activities[st.index], tm = timingOf(e, a), answered = s.answeredCount(), pct = n ? Math.round((100 * answered) / n) : 0;
    const d = s.distributionFor(a);
    return (
      <>
        <div className="px-6 sm:px-12 pt-6"><Bar pct={(100 * (st.index + (st.phase === 'reveal' ? 1 : 0))) / s.activities.length} tone="teal" /></div>
        <div className={pad}>
          <div className="flex flex-wrap gap-2"><Chip>Question {st.index + 1} / {s.activities.length}</Chip>{a.theme && e.insights && <Chip tone="sun">{e.insights.themes[a.theme].label}</Chip>}{st.paused && <Chip tone="coral">⏸ Paused</Chip>}</div>
          <h2 className="text-3xl sm:text-5xl font-extrabold leading-[1.1] max-w-[22ch]" data-testid="prompt">{a.prompt}</h2>
          {st.phase !== 'reveal' && (a.type === 'poll' || (a.type === 'choice' && !a.shuffle)) && (
            <div className="grid sm:grid-cols-2 gap-3 max-w-3xl" data-testid="stage-options">
              {a.options.map((o, k) => <div key={o.id} className="rounded-2xl border-2 border-paper-line px-5 py-4 text-xl sm:text-2xl font-extrabold flex items-center gap-3">
                <span className="w-10 h-10 shrink-0 rounded-xl grid place-items-center text-white text-base" style={{ background: ['#5A36F0', '#2F6FEB', '#14A38B', '#E59A1C'][k % 4] }}>{'emoji' in o && o.emoji ? o.emoji : 'ABCD'[k]}</span>{o.text}</div>)}
            </div>
          )}
          {st.phase === 'read' && <p className="text-xl font-bold text-ink-soft">👀 Read… answers open in <Countdown until={st.phaseStartedAt + tm.readSec * 1000} /> s</p>}
          {st.phase === 'answer' && <div className="flex items-center justify-between gap-4"><Chip tone="sky">📱 Answer on your phone!</Chip>
            <span className="text-7xl sm:text-8xl font-extrabold text-violet-600 tabular-nums anim-pulse">{st.paused ? '⏸' : <Countdown until={st.deadline ?? 0} alarm />}</span></div>}
          {st.phase === 'reveal' && e.reveal === 'none' && <p className="text-3xl font-extrabold anim-pop">{e.transitions?.[st.index % (e.transitions.length || 1)] ?? 'Answers locked.'}</p>}
          {st.phase === 'reveal' && e.reveal !== 'none' && (a.type === 'choice' || a.type === 'poll') && (
            d.suppressed ? <p className="text-xl text-ink-soft">Results appear once {e.privacy.groupMinimum}+ people answer.</p> :
            <div className="grid gap-3 max-w-2xl anim-pop" data-testid="distribution">
              {a.options.map(o => { const p = d.n ? Math.round((100 * d.counts[o.id]) / d.n) : 0; const ok = 'correct' in o && !!o.correct;
                return <div key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-center">
                  <span className={`text-xl sm:text-2xl font-extrabold ${e.reveal === 'correct' && !ok ? 'text-ink-soft' : ''}`}>{'emoji' in o && o.emoji} {o.text} {e.reveal === 'correct' && ok && '✅'}</span><span className="text-xl sm:text-2xl font-extrabold tabular-nums">{p}%</span>
                  <div className="col-span-2"><Bar pct={p} tone={ok ? 'teal' : 'violet'} /></div></div>; })}
              {e.reveal === 'correct' && a.type === 'choice' && a.explanation && <p className="text-lg">{a.explanation}</p>}
            </div>
          )}
          <div className="grid gap-1.5 max-w-xl"><div className="flex justify-between font-bold"><span data-testid="answered">{answered} of {n} answered</span><span className="text-ink-soft">{pct}%</span></div><Bar pct={pct} tone="sky" /></div>
          {a.type === 'choice' && a.shuffle && <p className="text-sm text-ink-soft">Options are shuffled on each phone and never shown here.</p>}
        </div>
      </>
    );
  }
  if (st.stage === 'results') return (
    <div className={`${pad} items-center text-center`}><div className="text-7xl" aria-hidden>{e.privacy.individualResults ? '🪞' : '🎉'}</div>
      <h1 className="text-4xl sm:text-5xl font-extrabold">{e.privacy.individualResults ? 'Look at your phone' : 'That was fun!'}</h1>
      <p className="text-xl text-ink-soft">{e.privacy.individualResults ? 'Your personal result is private — only you can see it.' : `${n} people played. Thank you!`}</p></div>
  );
  if (st.stage === 'group') {
    const g = s.group();
    if (g.suppressed) return <div className={`${pad} items-center text-center`}><div className="text-6xl" aria-hidden>🚗💨</div><h2 className="text-3xl font-extrabold">Not enough players for a group result… yet!</h2>
      <p className="text-lg text-ink-soft max-w-xl">We need at least {e.privacy.groupMinimum} completed games to show an anonymous average — today we have {g.valid}. That protects everyone's privacy.</p></div>;
    return (
      <div className={`${pad} items-center text-center !gap-3`} data-testid="group">
        <Chip>🏢 Our group result</Chip>
        {e.scoring.kind === 'behaviour' && <Gauge value={g.average!} />}
        <div className="text-7xl font-extrabold text-violet-600 leading-none tabular-nums">{g.average}<span className="text-3xl text-ink-soft">{e.scoring.kind === 'correct' ? '% correct' : ' / 100'}</span> {g.band?.emoji}</div>
        <h2 className="text-3xl font-extrabold">{g.band?.groupTitle ?? g.band?.title}</h2>
        {g.band?.groupMessage && <p className="text-xl text-ink-soft">"{g.band.groupMessage}"</p>}
        <div className="flex gap-2 flex-wrap justify-center"><Chip tone="sky">{g.joined} joined</Chip><Chip tone="teal">{g.valid} completed</Chip></div>
        {g.bands ? <div className="grid gap-2 w-full max-w-lg text-start">{(e.results ?? []).map((b, i) => { const p = Math.round((100 * g.bands![i]) / g.valid); return <div key={b.title} className="grid grid-cols-[2rem_minmax(0,1fr)_3rem] gap-2 items-center font-bold"><span>{b.emoji}</span><Bar pct={p} /><span className="text-end text-ink-soft">{p}%</span></div>; })}</div>
          : <p className="text-sm text-ink-soft">The breakdown appears from {2 * e.privacy.groupMinimum} completed games, so small groups stay anonymous.</p>}
        <p className="text-sm text-ink-soft">This is the average of the people who played today, not a measurement.</p>
      </div>
    );
  }
  return (
    <div className={`${pad} items-center text-center`}><h2 className="text-4xl font-extrabold">Before you go… 💜</h2>
      <div className="grid gap-3 w-full max-w-2xl text-start">{e.closing?.questions.map((q, i) => <div key={i} className="rounded-2xl bg-paper border border-paper-line p-4 text-xl font-bold flex gap-3 items-center"><span className="w-9 h-9 shrink-0 rounded-full bg-violet-600 text-white grid place-items-center">{i + 1}</span>{q}</div>)}</div>
      <p className="text-2xl font-extrabold text-violet-600">{e.closing?.message}</p></div>
  );
}

function Phone({ s, me, setMe, e }: { s: Session; me: Player | null; setMe: (p: Player) => void; e: Experience }) {
  const [nick, setNick] = useState('You');
  const [ok, setOk] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [err, setErr] = useState('');
  const now = useNow(250);
  const st = s.state;
  if (!me) return (
    <form className="grid gap-3" onSubmit={ev => { ev.preventDefault(); if (!ok) return setErr('Tick the box to confirm you want to play.'); try { setMe(s.join(nick)); } catch (x) { setErr((x as Error).message); } }}>
      <div className="text-center"><div className="text-4xl" aria-hidden>📱</div><h2 className="text-2xl font-extrabold">Join {e.title}</h2></div>
      <label className="grid gap-1 text-sm font-bold">Nickname<input className="field" value={nick} maxLength={20} onChange={ev => setNick(ev.target.value)} /></label>
      <div className="rounded-2xl bg-violet-50 text-violet-700 p-3 text-sm"><b>🔒 Before you join</b><p>Your nickname appears in the lobby. {e.privacy.individualResults ? 'Your answers and result stay private on your phone.' : 'Only group totals are shown.'} Joining is voluntary.</p></div>
      <label className="flex gap-2 items-start text-sm font-bold"><input type="checkbox" className="w-5 h-5 accent-violet-600" checked={ok} onChange={ev => setOk(ev.target.checked)} /> I understand and want to play.</label>
      {err && <p className="text-coral-500 text-sm font-bold">{err}</p>}
      <button className="btn-primary" disabled={st.stage !== 'lobby' && st.stage !== 'intro'}>{st.stage === 'lobby' || st.stage === 'intro' ? 'Join 🚗' : 'Game already started'}</button>
    </form>
  );
  const p = s.players.find(x => x.id === me.id)!;
  if (st.stage === 'lobby' || st.stage === 'intro') return <div className="text-center grid gap-3 py-10"><div className="text-6xl" aria-hidden>{p.avatar}</div><h3 className="text-xl font-extrabold">You're in, {p.nickname}!</h3><p className="text-ink-soft">Watch the big screen.</p></div>;
  if (st.stage === 'activity') {
    const a = s.activities[st.index], mine = p.responses[a.id];
    const open = st.phase === 'answer' && !st.paused && (st.deadline ?? 0) > now && mine == null;
    return (
      <div className="grid gap-3">
        <div className="flex justify-between"><Chip>Q{st.index + 1}/{s.activities.length}</Chip><span className="text-sm text-ink-soft">{p.avatar} {p.nickname}</span></div>
        <p className="text-xl font-extrabold leading-tight">{a.prompt}</p>
        <div className="flex justify-between items-center font-extrabold min-h-[44px]" aria-live="polite">
          {st.phase === 'read' && <span>👀 Read… <span className="text-ink-soft text-sm">answers open soon</span></span>}
          {open && <><span>Choose now!</span><span className="text-4xl text-violet-600 tabular-nums"><Countdown until={st.deadline ?? 0} alarm /></span></>}
          {st.paused && <span>⏸ Paused by the host</span>}
          {mine != null && <span className="text-teal-600">✅ Locked in</span>}
          {mine == null && !open && st.phase !== 'read' && !st.paused && <span>⏰ Time's up — skipped, not counted against you</span>}
        </div>
        <ActivityInput activity={a} seed={p.id} value={mine} disabled={!open} onPick={v => s.answer(p.id, a.id, v)} reveal={st.phase === 'reveal' && e.reveal === 'correct' ? 'correct' : null} />
      </div>
    );
  }
  const r = s.resultFor(p.id)!;
  if (!e.privacy.individualResults) return <div className="text-center grid gap-3 py-10"><div className="text-6xl" aria-hidden>🎉</div><h3 className="text-xl font-extrabold">Thanks for playing!</h3><p className="text-ink-soft">Look at the big screen for how the group voted.</p></div>;
  if (!revealed) return <button className="w-full grid gap-3 place-items-center py-12 text-center" onClick={() => setRevealed(true)} data-testid="reveal"><span className="text-7xl" aria-hidden>🪞</span><span className="text-2xl font-extrabold">Your result is ready</span><span className="text-ink-soft">Tap to see it. Only you can see this.</span></button>;
  return <div className="grid gap-3"><ResultCard r={r} disclaimer={e.disclaimer} onCopy={() => navigator.clipboard.writeText(resultText(e.title, r))} />
    {st.stage === 'closing' && e.closing && <div className="card p-4 grid gap-1 text-sm">{e.closing.questions.map((q, i) => <p key={i}>{i + 1}. {q}</p>)}</div>}</div>;
}
