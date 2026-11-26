// The projector and phone screens. They render a View, whether it came from the server or from practice mode.
import { useEffect, useState } from 'react';
import type { View, MyState } from './view';
import type { ResponseValue } from '../engine/scoring';
import { personalResult } from '../engine/scoring';
import { estimateMinutes } from '../engine/bank';
import { ActivityInput } from '../ui/Activity';
import { Bar, Chip, Confetti, Gauge, ResultCard, resultText, takeawayText, useNow } from '../ui/bits';
import { QR } from '../ui/LazyQR';
import { CountUp, Podium } from '../ui/reveal';
import { recordMoment } from './highlights';
import { HighlightsView } from './HighlightsView';
import { t } from '../i18n';
import { deleteResult, saveResult, savedResult } from './savedResults';
import { LangSwitch } from '../ui/LangSwitch';

export function Countdown({ until, alarm }: { until: number; alarm?: boolean }) {
  const now = useNow(200); const left = Math.max(0, Math.ceil((until - now) / 1000));
  return <>{alarm && left === 0 ? '⏰' : left}</>;
}

const PAD = 'flex-1 flex flex-col justify-center gap-5 p-6 sm:p-12';
const TILE = ['#5A36F0', '#2F6FEB', '#14A38B', '#E59A1C'];

/** Projector. `off` = server clock offset; all deadlines are server times. */
export function StageView({ v, off, joinUrl, practice, onKick }: { v: View; off: number; joinUrl: string; practice?: boolean; onKick?: (seat: string, name: string) => void }) {
  const e = v.experience, n = v.joined, local = (t?: number) => (t ?? 0) - off;
  useEffect(() => { recordMoment(v); }, [v.code, v.index, v.phase, v.reveal?.distribution?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  if (v.stage === 'lobby') return (
    <div className={PAD}><div className="grid sm:grid-cols-[auto_1fr] gap-8 items-center">
      <QR text={joinUrl} label={practice ? 'Practice QR code (not a real join link)' : 'QR code to join this game'} />
      <div className="grid gap-3">
        <p className="font-bold text-ink-soft">{practice ? t('stage.practiceQr') : t('stage.scan')}</p>
        <div className="text-6xl sm:text-7xl font-extrabold tracking-wider text-violet-600 tabular-nums" data-testid="room-code">{v.code.slice(0, 3)} {v.code.slice(3)}</div>
        {!practice && <p className="text-sm text-ink-soft break-all" data-testid="join-url">{joinUrl}</p>}
        <div className="flex items-baseline gap-3 flex-wrap"><span className="text-5xl font-extrabold" data-testid="joined">{n}</span><span className="font-bold">{t('stage.joined')}</span>
          {n < e.privacy.groupMinimum && <Chip tone="sun">{t('stage.more', { n: e.privacy.groupMinimum - n })}</Chip>}</div>
        <div className="flex flex-wrap gap-2" data-testid="lobby-length"><Chip tone="sky">{t('qb.lobby', { n: v.total, m: estimateMinutes({ questions: v.total,
            readSec: v.settings.readSec ?? e.defaultTiming.readSec, answerSec: v.settings.answerSec ?? e.defaultTiming.answerSec, reveal: e.reveal,
            scored: e.scoringKind === 'behaviour' || e.scoringKind === 'correct', autoAdvanceSec: v.settings.autoAdvanceSec }) })}</Chip>
          {v.selection && v.selection.bankSize > v.selection.count && <Chip>{t('qb.lobbyOf', { n: v.selection.count, b: v.selection.bankSize })}</Chip>}</div>
        <div className="flex flex-wrap gap-2 max-h-40 overflow-auto">{(v.names ?? []).map((p, i) => <span key={p.i ?? i} className="chip bg-paper border border-paper-line anim-pop" data-testid="lobby-name"><span dir="auto">{p.a} {p.n}</span>{onKick && p.i && <button className="ms-1 w-6 h-6 rounded-full hover:bg-coral-50 text-ink-soft hover:text-coral-500" aria-label={`${t('stage.kick')} ${p.n}`} title={t('stage.kick')} onClick={() => onKick(p.i!, p.n)} data-testid="kick">✕</button>}</span>)}</div>
      </div></div></div>
  );
  if (v.stage === 'intro') { const tm = { ...e.defaultTiming, ...(v.timing ?? {}) }; return (
    <div className={`${PAD} items-center text-center`}><div className="text-7xl" aria-hidden>{e.emoji}</div><h1 className="text-4xl sm:text-5xl font-extrabold" dir="auto">{e.title}</h1>
      <p className="text-xl text-ink-soft max-w-2xl" dir="auto">{e.tagline}</p>
      <div className="grid gap-2 text-lg font-bold text-start"><p>👀 {t('stage.readS', { n: tm.readSec })}</p><p>📱 {t('stage.answerS', { n: tm.answerSec })}</p>
        <p>🔒 {e.privacy.individualResults ? t('stage.privateOn') : t('stage.groupOnly')}</p>
        {v.settings.leaderboard && <p>🏆 {t('stage.boardNote')}</p>}</div>
      <p className="text-sm text-ink-soft max-w-xl">{e.disclaimer}</p></div>); }
  if (v.stage === 'activity' && v.activity) {
    const a = v.activity, answered = v.answered ?? 0, pct = n ? Math.round((100 * answered) / n) : 0;
    const showOptions = v.phase !== 'reveal' && (a.type === 'poll' || (a.type === 'choice' && !a.shuffle)) && a.options;
    const d = v.reveal?.distribution;
    return (
      <>
        <div className="px-6 sm:px-12 pt-6"><Bar pct={(100 * (v.index + (v.phase === 'reveal' ? 1 : 0))) / v.total} tone="teal" /></div>
        <div className={PAD}>
          <div className="flex flex-wrap gap-2"><Chip>{t('stage.q', { i: v.index + 1, n: v.total })}</Chip>{a.theme && e.insights?.themes[a.theme] && <Chip tone="sun">{e.insights.themes[a.theme].label}</Chip>}{v.paused && <Chip tone="coral">{t('stage.paused')}</Chip>}</div>
          <h2 className="text-3xl sm:text-5xl font-extrabold leading-[1.1] max-w-[22ch]" dir="auto" data-testid="prompt" data-idx={v.index}>{a.prompt}</h2>
          {showOptions && <div className="grid sm:grid-cols-2 gap-3 max-w-3xl" data-testid="stage-options">
            {a.options!.map((o, k) => <div key={o.id} className="rounded-2xl border-2 border-paper-line px-5 py-4 text-xl sm:text-2xl font-extrabold flex items-center gap-3">
              <span className="w-10 h-10 shrink-0 rounded-xl grid place-items-center text-white text-base" style={{ background: TILE[k % 4] }}>{o.emoji ?? 'ABCD'[k]}</span><span dir="auto">{o.text}</span></div>)}
          </div>}
          {v.phase === 'read' && <p className="text-xl font-bold text-ink-soft">{t('stage.readOpen')} <Countdown until={local(v.phaseAt) + (v.timing?.readSec ?? 5) * 1000} /> {t('stage.s')}</p>}
          {v.phase === 'answer' && <div className="flex items-center justify-between gap-4"><Chip tone="sky">{t('stage.answerNow')}</Chip>
            <span className="text-7xl sm:text-8xl font-extrabold text-violet-600 tabular-nums anim-pulse" data-testid="countdown">{v.paused ? '⏸' : <Countdown until={local(v.deadline)} alarm />}</span></div>}
          {v.phase === 'reveal' && e.reveal === 'none' && <p className="text-3xl font-extrabold anim-pop" dir="auto" data-testid="transition">{e.transitions?.[v.index % (e.transitions.length || 1)] ?? t('stage.locked')}</p>}
          {v.phase === 'reveal' && d && a.options && (d.suppressed
            ? <p className="text-xl text-ink-soft" data-testid="suppressed">{t('stage.suppressed', { n: e.privacy.groupMinimum })}</p>
            : <div className="grid gap-3 max-w-2xl anim-pop" data-testid="distribution">
                {e.reveal === 'distribution' && !d.suppressed && d.n > 0 && <p className="text-2xl font-extrabold" data-testid="reaction">{reaction(d.counts, d.n)}</p>}
                {a.options.map(o => { const p = d.n ? Math.round((100 * (d.counts[o.id] ?? 0)) / d.n) : 0; const ok = v.reveal?.correct === o.id;
                  return <div key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-center">
                    <span className={`text-xl sm:text-2xl font-extrabold ${v.reveal?.correct && !ok ? 'text-ink-soft' : ''}`}><span dir="auto">{o.emoji} {o.text}</span> {ok && '✅'}</span><span className="text-xl sm:text-2xl font-extrabold tabular-nums">{p}%</span>
                    <div className="col-span-2"><Bar pct={p} tone={ok ? 'teal' : 'violet'} /></div></div>; })}
                {v.reveal?.explanation && <p className="text-lg" data-testid="explanation">{v.reveal.explanation}</p>}
              </div>)}
          <div className="grid gap-1.5 max-w-xl"><div className="flex justify-between font-bold"><span data-testid="answered">{t('stage.answered', { a: answered, n })}</span><span className="text-ink-soft">{pct}%</span></div><Bar pct={pct} tone="sky" /></div>
          {a.type === 'choice' && a.shuffle && <p className="text-sm text-ink-soft">{t('stage.shuffled')}</p>}
        </div>
      </>
    );
  }
  if (v.stage === 'results') return (
    <div className={`${PAD} items-center text-center`} data-testid={`results-${e.scoringKind}`}>
      <div className="text-[6rem] sm:text-[8rem] leading-none anim-rise" aria-hidden>{e.privacy.individualResults ? '📱' : '🎉'}</div>
      <h1 className="text-4xl sm:text-5xl font-extrabold">{e.privacy.individualResults ? t('stage.lookPhone') : t('stage.fun')}</h1>
      <p className="text-xl text-ink-soft">{e.privacy.individualResults ? t('stage.privateRes') : t('stage.played', { n })}</p>
      {e.scoringKind === 'aggregate' && <Confetti />}
      <HighlightsView code={v.code} kind={e.scoringKind} />
      {v.leaderboard && (v.leaderboard.length ? <Podium rows={v.leaderboard} total={v.total} title={t('stage.board')} note={t('stage.volunteers')} /> : <p className="text-ink-soft">{t('stage.nobodyBoard')}</p>)}</div>
  );
  if (v.stage === 'group' && v.group) {
    const g = v.group, band = g.average != null ? (e.results ?? []).find(b => g.average! >= b.min && g.average! <= b.max) : undefined;
    if (g.suppressed) return <div className={`${PAD} items-center text-center`}><div className="text-6xl" aria-hidden>🚗💨</div><h2 className="text-3xl font-extrabold">{t('stage.noGroup')}</h2>
      <p className="text-lg text-ink-soft max-w-xl">{t('stage.noGroupWhy', { min: e.privacy.groupMinimum, n: g.valid })}</p></div>;
    const tone = band?.tone ?? 'good';
    const grad = { great: 'from-teal-500 to-[#0E8370]', good: 'from-violet-600 to-sky-500', watch: 'from-sun-500 to-[#E2553A]', grow: 'from-coral-500 to-violet-600' }[tone];
    const barC = { great: '#14A38B', good: '#2F6FEB', watch: '#E59A1C', grow: '#E2553A' } as const;
    return (
      <div className={`${PAD} items-center text-center !gap-4`} data-testid="group">
        <div className={`relative overflow-hidden w-full max-w-3xl rounded-[2rem] bg-gradient-to-br ${grad} text-white px-6 py-8 grid gap-2 place-items-center shadow-soft`}>
          {(tone === 'great' || tone === 'good') && <Confetti />}
          <Chip>{t('stage.groupResult')}</Chip>
          <div className="text-[7rem] leading-none anim-rise drop-shadow-lg" aria-hidden>{band?.emoji}</div>
          <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight" dir="auto">{band?.groupTitle ?? band?.title}</h2>
          {band?.groupMessage && <p className="text-2xl font-bold opacity-95" dir="auto">{band.groupMessage}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6">
          {e.scoringKind === 'behaviour' && <div className="w-72"><Gauge value={g.average!} /></div>}
          <div className="text-7xl font-extrabold text-violet-600 leading-none tabular-nums anim-pop" data-testid="group-average"><CountUp to={g.average!} /><span className="text-3xl text-ink-soft">{e.scoringKind === 'correct' ? t('stage.pctCorrect') : ' / 100'}</span></div>
        </div>
        <div className="flex gap-2 flex-wrap justify-center"><Chip tone="sky">{t('join.joined', { n: g.joined })}</Chip><Chip tone="teal">{t('stage.completed', { n: g.valid })}</Chip></div>
        {g.bands ? <div className="grid gap-2 w-full max-w-2xl text-start">{(e.results ?? []).map((b, i) => { const p = Math.round((100 * (g.bands![i] ?? 0)) / g.valid), mine = b === band;
          return <div key={b.title} className={`grid grid-cols-[3rem_minmax(0,1fr)_4rem] gap-3 items-center rounded-2xl px-3 py-2 ${mine ? 'bg-violet-50 ring-2 ring-violet-500' : ''}`}>
            <span className="text-4xl" aria-hidden>{b.emoji}</span>
            <span className="grid gap-1"><span className="font-bold text-sm truncate" dir="auto">{b.groupTitle ?? b.title}</span>
              <span className="h-4 rounded-full bg-paper-line overflow-hidden"><span className="block h-full rounded-full transition-all duration-1000" style={{ width: `${p}%`, background: barC[b.tone] }} /></span></span>
            <span className="text-end text-2xl font-extrabold tabular-nums">{p}%</span></div>; })}</div>
          : <p className="text-sm text-ink-soft">{t('stage.breakdownLater', { n: 2 * e.privacy.groupMinimum })}</p>}
        <p className="text-sm text-ink-soft">{t('stage.notMeasure')}</p>
      </div>
    );
  }
  return (
    <div className={`${PAD} items-center text-center`}><h2 className="text-4xl font-extrabold">{t('stage.beforeGo')}</h2>
      <div className="grid gap-3 w-full max-w-2xl text-start">{e.closing?.questions.map((q, i) => <div key={i} dir="auto" className="rounded-2xl bg-paper border border-paper-line p-4 text-xl font-bold flex gap-3 items-center"><span className="w-9 h-9 shrink-0 rounded-full bg-violet-600 text-white grid place-items-center">{i + 1}</span>{q}</div>)}</div>
      <p className="text-2xl font-extrabold text-violet-600" dir="auto">{e.closing?.message}</p></div>
  );
}


/** Phone, after joining. */
export function PhoneView({ v, off, my, seed, nickname, avatar, onPick }: {
  v: View; off: number; my: MyState; seed: string; nickname: string; avatar: string; onPick: (activityId: string, value: ResponseValue) => void;
}) {
  const now = useNow(250);
  const [revealed, setRevealed] = useState(false);
  const e = v.experience;
  if (v.ended) return <SavedResultView code={v.code} />;
  if (v.stage === 'lobby' || v.stage === 'intro') return <div className="text-center grid gap-3 py-10"><div className="text-6xl anim-pop" aria-hidden>{avatar}</div><h3 className="text-xl font-extrabold">{t('phone.in', { name: nickname })}</h3><p className="text-ink-soft">{v.stage === 'intro' ? t('phone.getReady') : t('phone.watch')}</p></div>;
  if (v.stage === 'activity' && v.activity) {
    const a = v.activity, mine = my.answers[a.id], deadline = (v.deadline ?? 0) - off - 150;
    const open = v.phase === 'answer' && !v.paused && deadline > now && mine == null;
    return (
      <div className="grid gap-3">
        <div className="flex justify-between"><Chip>Q{v.index + 1}/{v.total}</Chip><span className="text-sm text-ink-soft">{avatar} {nickname}</span></div>
        <p className="text-xl font-extrabold leading-tight" dir="auto" data-testid="phone-prompt">{a.prompt}</p>
        <div className="flex justify-between items-center font-extrabold min-h-[44px]" aria-live="polite">
          {v.phase === 'read' && <span>{t('phone.read')} <span className="text-ink-soft text-sm">{t('phone.openSoon')}</span></span>}
          {open && <><span>{t('phone.choose')}</span><span className="text-4xl text-violet-600 tabular-nums"><Countdown until={deadline} alarm /></span></>}
          {v.paused && <span>{t('phone.paused')}</span>}
          {mine != null && <span className="text-teal-600">{t('phone.locked')}</span>}
          {mine == null && !open && v.phase !== 'read' && !v.paused && <span>{t('phone.timeUp')}</span>}
        </div>
        <ActivityInput activity={a} seed={seed} value={mine} disabled={!open} onPick={val => onPick(a.id, val)} correctId={v.reveal?.correct ?? null} />
        {v.reveal?.explanation && <p className={`rounded-2xl p-3 text-sm ${mine === v.reveal.correct ? 'bg-teal-50' : 'bg-sun-50'}`}><b>{mine === v.reveal.correct ? t('phone.correct') : mine == null ? t('phone.missed') : t('phone.notQuite')}</b> {v.reveal.explanation}</p>}
      </div>
    );
  }
  if (!e.privacy.individualResults || !v.snapshot) return <div className="text-center grid gap-3 py-10"><div className="text-6xl" aria-hidden>🎉</div><h3 className="text-xl font-extrabold">{t('phone.thanks')}</h3><p className="text-ink-soft">{t('phone.lookScreen')}</p>
    {v.stage === 'closing' && e.closing && <div className="card p-4 grid gap-1 text-sm text-start">{e.closing.questions.map((q, i) => <p key={i} dir="auto">{i + 1}. {q}</p>)}</div>}</div>;
  return <MyResult v={v} my={my} seed={seed} revealed={revealed} onReveal={() => setRevealed(true)} />;
}

/** Host controls shared by practice and live. */
export function HostBar({ v, busy, onCmd, onFs, extra, onEnd }: { v: View; busy?: boolean; onCmd: (c: 'next' | 'pause' | 'resume') => void; onFs: () => void; extra?: React.ReactNode; onEnd?: () => void }) {
  const label = v.stage === 'lobby' ? t('host.start') : v.stage === 'intro' ? t('host.first') : v.stage === 'activity'
    ? (v.phase === 'read' ? t('host.open') : v.phase === 'answer' ? t('host.waiting') : v.index < v.total - 1 ? t('host.next') : t('host.results'))
    : v.stage === 'results' ? (v.experience.scoringKind === 'aggregate' || v.experience.scoringKind === 'none' ? t('host.wrap') : t('host.group')) : v.stage === 'group' ? t('host.reflect') : t('host.done');
  const waiting = v.stage === 'activity' && v.phase === 'answer' && (v.answered ?? 0) < v.joined;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-paper-line bg-paper px-4 py-3">
      {v.stage === 'closing' && onEnd ? <button className="btn-primary" onClick={onEnd} data-testid="end-insights">{t('host.endInsights')}</button>
        : <button className="btn-primary" onClick={() => onCmd('next')} disabled={busy || v.stage === 'closing' || waiting} data-testid="next">{label}</button>}
      {v.stage === 'activity' && (v.phase === 'answer' || v.phase === 'read') && <button className="btn-ghost" onClick={() => onCmd(v.paused ? 'resume' : 'pause')} data-testid="pause">{v.paused ? t('host.resume') : t('host.pause')}</button>}
      <button className="btn-ghost" onClick={onFs}>{t('host.fs')}</button>
      <LangSwitch />
      {extra}
      <span className="ms-auto text-xs text-ink-soft hidden md:inline">{t('host.keys')}</span>
    </div>
  );
}

/** The player's private result. Saved on this phone only (so a refresh or the end of the game never loses it), deletable at any time. */
function MyResult({ v, my, seed, revealed, onReveal }: { v: View; my: MyState; seed: string; revealed: boolean; onReveal: () => void }) {
  const e = v.experience;
  const r = personalResult(v.snapshot!, my.answers, seed);
  const [gone, setGone] = useState(false);
  useEffect(() => { if (!gone && Object.keys(my.answers).length) saveResult({ code: v.code, title: e.title, emoji: e.emoji, disclaimer: e.disclaimer, r }); }, [v.code, JSON.stringify(r), gone]); // eslint-disable-line react-hooks/exhaustive-deps
  if (gone) return <p className="card p-6 text-center" role="status">{t('keep.deleted')}</p>;
  if (!revealed) return <button className="w-full grid gap-3 place-items-center py-12 text-center" onClick={onReveal} data-testid="reveal"><span className="text-7xl anim-pulse" aria-hidden>🪞</span><span className="text-2xl font-extrabold">{t('phone.ready')}</span><span className="text-ink-soft">{t('phone.tap')}</span></button>;
  return <div className="grid gap-3">
    <ResultCard r={r} disclaimer={e.disclaimer} onCopy={() => navigator.clipboard.writeText(resultText(e.title, r))} onTakeaway={() => navigator.clipboard.writeText(takeawayText(e.title, r))} onDelete={() => { deleteResult(v.code); setGone(true); }} />
    {my.boardName && <p className="text-sm text-center text-ink-soft">{t('phone.onBoard', { name: my.boardName })}</p>}
    {v.stage === 'closing' && e.closing && <div className="card p-4 grid gap-1 text-sm">{e.closing.questions.map((q, i) => <p key={i} dir="auto">{i + 1}. {q}</p>)}</div>}
  </div>;
}

/** After the host ends the game (or after a refresh once it has ended): the result saved on this phone, if the player kept one. */
export function SavedResultView({ code }: { code: string }) {
  const [x, setX] = useState(() => savedResult(code));
  if (!x) return <div className="text-center grid gap-3 py-10"><div className="text-6xl" aria-hidden>👋</div><h3 className="text-xl font-extrabold">{t('phone.ended')}</h3><p className="text-ink-soft">{t('phone.thanks')}</p></div>;
  return <div className="grid gap-3" data-testid="saved-result">
    <p className="text-center text-ink-soft">{t('keep.ended')}</p>
    <ResultCard r={x.r} disclaimer={x.disclaimer} onCopy={() => navigator.clipboard.writeText(resultText(x.title, x.r))} onDelete={() => { deleteResult(code); setX(null); }} />
  </div>;
}

/** A reaction line that matches the actual vote: split, leaning, clear or near-unanimous. */
export function reaction(counts: Record<string, number>, n: number) {
  const top = Math.max(0, ...Object.values(counts)) / n;
  return t(top >= 0.9 ? 'react.unanimous' : top >= 0.75 ? 'react.clear' : top >= 0.65 ? 'react.lean' : 'react.split');
}
