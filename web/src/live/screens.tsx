// The projector and phone screens. They render a View, whether it came from the server or from practice mode.
import { useState } from 'react';
import type { View, MyState } from './view';
import type { ResponseValue } from '../engine/scoring';
import { personalResult } from '../engine/scoring';
import { ActivityInput } from '../ui/Activity';
import { Bar, Chip, Gauge, QR, ResultCard, resultText, useNow } from '../ui/bits';

export function Countdown({ until, alarm }: { until: number; alarm?: boolean }) {
  const now = useNow(200); const left = Math.max(0, Math.ceil((until - now) / 1000));
  return <>{alarm && left === 0 ? '⏰' : left}</>;
}

const PAD = 'flex-1 flex flex-col justify-center gap-5 p-6 sm:p-12';
const TILE = ['#5A36F0', '#2F6FEB', '#14A38B', '#E59A1C'];

/** Projector. `off` = server clock offset; all deadlines are server times. */
export function StageView({ v, off, joinUrl, practice }: { v: View; off: number; joinUrl: string; practice?: boolean }) {
  const e = v.experience, n = v.joined, local = (t?: number) => (t ?? 0) - off;
  if (v.stage === 'lobby') return (
    <div className={PAD}><div className="grid sm:grid-cols-[auto_1fr] gap-8 items-center">
      <QR text={joinUrl} label={practice ? 'Practice QR code (not a real join link)' : 'QR code to join this game'} />
      <div className="grid gap-3">
        <p className="font-bold text-ink-soft">{practice ? 'Practice room · in a live game, players scan this code' : 'Scan the code, or go to the link and enter'}</p>
        <div className="text-6xl sm:text-7xl font-extrabold tracking-wider text-violet-600 tabular-nums" data-testid="room-code">{v.code.slice(0, 3)} {v.code.slice(3)}</div>
        {!practice && <p className="text-sm text-ink-soft break-all" data-testid="join-url">{joinUrl}</p>}
        <div className="flex items-baseline gap-3 flex-wrap"><span className="text-5xl font-extrabold" data-testid="joined">{n}</span><span className="font-bold">joined</span>
          {n < e.privacy.groupMinimum && <Chip tone="sun">{e.privacy.groupMinimum - n} more for group results</Chip>}</div>
        <div className="flex flex-wrap gap-2 max-h-40 overflow-auto">{(v.names ?? []).map((p, i) => <span key={i} className="chip bg-paper border border-paper-line anim-pop">{p.a} {p.n}</span>)}</div>
      </div></div></div>
  );
  if (v.stage === 'intro') { const tm = { ...e.defaultTiming, ...(v.timing ?? {}) }; return (
    <div className={`${PAD} items-center text-center`}><div className="text-7xl" aria-hidden>{e.emoji}</div><h1 className="text-4xl sm:text-5xl font-extrabold">{e.title}</h1>
      <p className="text-xl text-ink-soft max-w-2xl">{e.tagline}</p>
      <div className="grid gap-2 text-lg font-bold text-start"><p>👀 {tm.readSec} s to read</p><p>📱 {tm.answerSec} s to answer on your phone</p>
        <p>🔒 {e.privacy.individualResults ? 'Your answers and score stay on your phone' : 'Only group totals are shown'}</p>
        {v.settings.leaderboard && <p>🏆 Optional leaderboard: only names people chose to share</p>}</div>
      <p className="text-sm text-ink-soft max-w-xl">{e.disclaimer}</p></div>); }
  if (v.stage === 'activity' && v.activity) {
    const a = v.activity, answered = v.answered ?? 0, pct = n ? Math.round((100 * answered) / n) : 0;
    const showOptions = v.phase !== 'reveal' && (a.type === 'poll' || (a.type === 'choice' && !a.shuffle)) && a.options;
    const d = v.reveal?.distribution;
    return (
      <>
        <div className="px-6 sm:px-12 pt-6"><Bar pct={(100 * (v.index + (v.phase === 'reveal' ? 1 : 0))) / v.total} tone="teal" /></div>
        <div className={PAD}>
          <div className="flex flex-wrap gap-2"><Chip>Question {v.index + 1} / {v.total}</Chip>{a.theme && e.insights?.themes[a.theme] && <Chip tone="sun">{e.insights.themes[a.theme].label}</Chip>}{v.paused && <Chip tone="coral">⏸ Paused</Chip>}</div>
          <h2 className="text-3xl sm:text-5xl font-extrabold leading-[1.1] max-w-[22ch]" data-testid="prompt">{a.prompt}</h2>
          {showOptions && <div className="grid sm:grid-cols-2 gap-3 max-w-3xl" data-testid="stage-options">
            {a.options!.map((o, k) => <div key={o.id} className="rounded-2xl border-2 border-paper-line px-5 py-4 text-xl sm:text-2xl font-extrabold flex items-center gap-3">
              <span className="w-10 h-10 shrink-0 rounded-xl grid place-items-center text-white text-base" style={{ background: TILE[k % 4] }}>{o.emoji ?? 'ABCD'[k]}</span>{o.text}</div>)}
          </div>}
          {v.phase === 'read' && <p className="text-xl font-bold text-ink-soft">👀 Read… answers open in <Countdown until={local(v.phaseAt) + (v.timing?.readSec ?? 5) * 1000} /> s</p>}
          {v.phase === 'answer' && <div className="flex items-center justify-between gap-4"><Chip tone="sky">📱 Answer on your phone!</Chip>
            <span className="text-7xl sm:text-8xl font-extrabold text-violet-600 tabular-nums anim-pulse" data-testid="countdown">{v.paused ? '⏸' : <Countdown until={local(v.deadline)} alarm />}</span></div>}
          {v.phase === 'reveal' && e.reveal === 'none' && <p className="text-3xl font-extrabold anim-pop" data-testid="transition">{e.transitions?.[v.index % (e.transitions.length || 1)] ?? 'Answers locked.'}</p>}
          {v.phase === 'reveal' && d && a.options && (d.suppressed
            ? <p className="text-xl text-ink-soft" data-testid="suppressed">Results appear once {e.privacy.groupMinimum}+ people answer.</p>
            : <div className="grid gap-3 max-w-2xl anim-pop" data-testid="distribution">
                {e.transitions && e.reveal === 'distribution' && <p className="text-2xl font-extrabold">{e.transitions[v.index % e.transitions.length]}</p>}
                {a.options.map(o => { const p = d.n ? Math.round((100 * (d.counts[o.id] ?? 0)) / d.n) : 0; const ok = v.reveal?.correct === o.id;
                  return <div key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-center">
                    <span className={`text-xl sm:text-2xl font-extrabold ${v.reveal?.correct && !ok ? 'text-ink-soft' : ''}`}>{o.emoji} {o.text} {ok && '✅'}</span><span className="text-xl sm:text-2xl font-extrabold tabular-nums">{p}%</span>
                    <div className="col-span-2"><Bar pct={p} tone={ok ? 'teal' : 'violet'} /></div></div>; })}
                {v.reveal?.explanation && <p className="text-lg" data-testid="explanation">{v.reveal.explanation}</p>}
              </div>)}
          <div className="grid gap-1.5 max-w-xl"><div className="flex justify-between font-bold"><span data-testid="answered">{answered} of {n} answered</span><span className="text-ink-soft">{pct}%</span></div><Bar pct={pct} tone="sky" /></div>
          {a.type === 'choice' && a.shuffle && <p className="text-sm text-ink-soft">Options are shuffled on each phone and never shown here.</p>}
        </div>
      </>
    );
  }
  if (v.stage === 'results') return (
    <div className={`${PAD} items-center text-center`}><div className="text-7xl" aria-hidden>{e.privacy.individualResults ? '🪞' : '🎉'}</div>
      <h1 className="text-4xl sm:text-5xl font-extrabold">{e.privacy.individualResults ? 'Look at your phone' : 'That was fun!'}</h1>
      <p className="text-xl text-ink-soft">{e.privacy.individualResults ? 'Your personal result is private — only you can see it.' : `${n} people played. Thank you!`}</p>
      {v.leaderboard && <Leaderboard rows={v.leaderboard} total={v.total} />}</div>
  );
  if (v.stage === 'group' && v.group) {
    const g = v.group, band = g.average != null ? (e.results ?? []).find(b => g.average! >= b.min && g.average! <= b.max) : undefined;
    if (g.suppressed) return <div className={`${PAD} items-center text-center`}><div className="text-6xl" aria-hidden>🚗💨</div><h2 className="text-3xl font-extrabold">Not enough players for a group result… yet!</h2>
      <p className="text-lg text-ink-soft max-w-xl">We need at least {e.privacy.groupMinimum} completed games to show an anonymous average — today we have {g.valid}. That protects everyone's privacy.</p></div>;
    return (
      <div className={`${PAD} items-center text-center !gap-3`} data-testid="group">
        <Chip>🏢 Our group result</Chip>
        {e.scoringKind === 'behaviour' && <Gauge value={g.average!} />}
        <div className="text-7xl font-extrabold text-violet-600 leading-none tabular-nums" data-testid="group-average">{g.average}<span className="text-3xl text-ink-soft">{e.scoringKind === 'correct' ? '% correct' : ' / 100'}</span> {band?.emoji}</div>
        <h2 className="text-3xl font-extrabold">{band?.groupTitle ?? band?.title}</h2>
        {band?.groupMessage && <p className="text-xl text-ink-soft">"{band.groupMessage}"</p>}
        <div className="flex gap-2 flex-wrap justify-center"><Chip tone="sky">{g.joined} joined</Chip><Chip tone="teal">{g.valid} completed</Chip></div>
        {g.bands ? <div className="grid gap-2 w-full max-w-lg text-start">{(e.results ?? []).map((b, i) => { const p = Math.round((100 * (g.bands![i] ?? 0)) / g.valid); return <div key={b.title} className="grid grid-cols-[2rem_minmax(0,1fr)_3rem] gap-2 items-center font-bold"><span>{b.emoji}</span><Bar pct={p} /><span className="text-end text-ink-soft">{p}%</span></div>; })}</div>
          : <p className="text-sm text-ink-soft">The breakdown appears from {2 * e.privacy.groupMinimum} completed games, so small groups stay anonymous.</p>}
        <p className="text-sm text-ink-soft">This is the average of the people who played today, not a measurement.</p>
      </div>
    );
  }
  return (
    <div className={`${PAD} items-center text-center`}><h2 className="text-4xl font-extrabold">Before you go… 💜</h2>
      <div className="grid gap-3 w-full max-w-2xl text-start">{e.closing?.questions.map((q, i) => <div key={i} className="rounded-2xl bg-paper border border-paper-line p-4 text-xl font-bold flex gap-3 items-center"><span className="w-9 h-9 shrink-0 rounded-full bg-violet-600 text-white grid place-items-center">{i + 1}</span>{q}</div>)}</div>
      <p className="text-2xl font-extrabold text-violet-600">{e.closing?.message}</p></div>
  );
}

function Leaderboard({ rows, total }: { rows: { name: string; correct: number }[]; total: number }) {
  if (!rows.length) return <p className="text-ink-soft">Nobody chose to appear on the leaderboard. That's fine too!</p>;
  return <div className="w-full max-w-md grid gap-2 text-start" data-testid="leaderboard"><h3 className="text-xl font-extrabold text-center">🏆 Leaderboard <span className="text-sm text-ink-soft font-bold">(volunteers only)</span></h3>
    {rows.map((r, i) => <div key={i} className="flex items-center gap-3 rounded-xl bg-paper border border-paper-line px-4 py-2 font-bold"><span className="w-7 text-ink-soft">{i + 1}.</span><span className="flex-1 min-w-0 truncate">{r.name}</span><span className="tabular-nums">{r.correct}/{total}</span></div>)}</div>;
}

/** Phone, after joining. */
export function PhoneView({ v, off, my, seed, nickname, avatar, onPick }: {
  v: View; off: number; my: MyState; seed: string; nickname: string; avatar: string; onPick: (activityId: string, value: ResponseValue) => void;
}) {
  const now = useNow(250);
  const [revealed, setRevealed] = useState(false);
  const e = v.experience;
  if (v.ended) return <div className="text-center grid gap-3 py-10"><div className="text-6xl" aria-hidden>🧹</div><h3 className="text-xl font-extrabold">This game has ended</h3><p className="text-ink-soft">Thanks for playing!</p></div>;
  if (v.stage === 'lobby' || v.stage === 'intro') return <div className="text-center grid gap-3 py-10"><div className="text-6xl anim-pop" aria-hidden>{avatar}</div><h3 className="text-xl font-extrabold">You're in, {nickname}!</h3><p className="text-ink-soft">{v.stage === 'intro' ? 'Get ready — first question coming up.' : 'Watch the big screen. The host will start soon.'}</p></div>;
  if (v.stage === 'activity' && v.activity) {
    const a = v.activity, mine = my.answers[a.id], deadline = (v.deadline ?? 0) - off - 150;
    const open = v.phase === 'answer' && !v.paused && deadline > now && mine == null;
    return (
      <div className="grid gap-3">
        <div className="flex justify-between"><Chip>Q{v.index + 1}/{v.total}</Chip><span className="text-sm text-ink-soft">{avatar} {nickname}</span></div>
        <p className="text-xl font-extrabold leading-tight" data-testid="phone-prompt">{a.prompt}</p>
        <div className="flex justify-between items-center font-extrabold min-h-[44px]" aria-live="polite">
          {v.phase === 'read' && <span>👀 Read… <span className="text-ink-soft text-sm">answers open soon</span></span>}
          {open && <><span>Choose now!</span><span className="text-4xl text-violet-600 tabular-nums"><Countdown until={deadline} alarm /></span></>}
          {v.paused && <span>⏸ Paused by the host</span>}
          {mine != null && <span className="text-teal-600">✅ Locked in</span>}
          {mine == null && !open && v.phase !== 'read' && !v.paused && <span>⏰ Time's up — skipped, not counted against you</span>}
        </div>
        <ActivityInput activity={a} seed={seed} value={mine} disabled={!open} onPick={val => onPick(a.id, val)} correctId={v.reveal?.correct ?? null} />
        {v.reveal?.explanation && <p className={`rounded-2xl p-3 text-sm ${mine === v.reveal.correct ? 'bg-teal-50' : 'bg-sun-50'}`}><b>{mine === v.reveal.correct ? '✅ Correct!' : mine == null ? '⏰ Missed.' : '🤔 Not quite.'}</b> {v.reveal.explanation}</p>}
      </div>
    );
  }
  if (!e.privacy.individualResults || !v.snapshot) return <div className="text-center grid gap-3 py-10"><div className="text-6xl" aria-hidden>🎉</div><h3 className="text-xl font-extrabold">Thanks for playing!</h3><p className="text-ink-soft">Look at the big screen for how the group voted.</p>
    {v.stage === 'closing' && e.closing && <div className="card p-4 grid gap-1 text-sm text-start">{e.closing.questions.map((q, i) => <p key={i}>{i + 1}. {q}</p>)}</div>}</div>;
  const r = personalResult(v.snapshot, my.answers, seed);
  if (!revealed) return <button className="w-full grid gap-3 place-items-center py-12 text-center" onClick={() => setRevealed(true)} data-testid="reveal"><span className="text-7xl" aria-hidden>🪞</span><span className="text-2xl font-extrabold">Your result is ready</span><span className="text-ink-soft">Tap to see it. Only you can see this.</span></button>;
  return <div className="grid gap-3">
    <ResultCard r={r} disclaimer={e.disclaimer} onCopy={() => navigator.clipboard.writeText(resultText(e.title, r))} />
    {my.boardName && <p className="text-sm text-center text-ink-soft">You're on the leaderboard as <b>{my.boardName}</b>.</p>}
    {v.stage === 'closing' && e.closing && <div className="card p-4 grid gap-1 text-sm">{e.closing.questions.map((q, i) => <p key={i}>{i + 1}. {q}</p>)}</div>}
  </div>;
}

/** Host controls shared by practice and live. */
export function HostBar({ v, busy, onCmd, onFs, extra }: { v: View; busy?: boolean; onCmd: (c: 'next' | 'pause' | 'resume') => void; onFs: () => void; extra?: React.ReactNode }) {
  const label = v.stage === 'lobby' ? 'Start ▶' : v.stage === 'intro' ? 'First question 🚦' : v.stage === 'activity'
    ? (v.phase === 'read' ? 'Open answers now' : v.phase === 'answer' ? 'Waiting for answers…' : v.index < v.total - 1 ? 'Next question ▶' : 'Show results 🪞')
    : v.stage === 'results' ? (v.experience.scoringKind === 'aggregate' || v.experience.scoringKind === 'none' ? 'Wrap up ▶' : 'Reveal group result 🏢') : v.stage === 'group' ? 'Reflection ▶' : 'Finished 💜';
  const waiting = v.stage === 'activity' && v.phase === 'answer' && (v.answered ?? 0) < v.joined;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-paper-line bg-paper px-4 py-3">
      <button className="btn-primary" onClick={() => onCmd('next')} disabled={busy || v.stage === 'closing' || waiting} data-testid="next">{label}</button>
      {v.stage === 'activity' && v.phase === 'answer' && <button className="btn-ghost" onClick={() => onCmd(v.paused ? 'resume' : 'pause')} data-testid="pause">{v.paused ? '▶ Resume' : '⏸ Pause'}</button>}
      <button className="btn-ghost" onClick={onFs}>⛶ Full screen</button>
      {extra}
      <span className="ms-auto text-xs text-ink-soft hidden md:inline"><kbd>Space</kbd>/<kbd>→</kbd> next · <kbd>P</kbd> pause · <kbd>F</kbd> full screen</span>
    </div>
  );
}
