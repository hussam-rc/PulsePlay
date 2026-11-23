import { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { byId } from '../experiences';
import { LiveHost, rpc, saveHost, savedHost } from '../live/controllers';
import { Presenter, useController } from '../live/Presenter';
import type { View } from '../live/view';
import { Chip } from '../ui/bits';

const READS = [3, 5, 8], ANSWERS = [3, 5, 8, 12, 20], AUTO = [0, 5, 8, 12];

export const joinUrlFor = (code: string) => `${location.origin}${location.pathname}#/j/${code}`;

export function HostLive() {
  const e = byId(useParams().id ?? '');
  const [c, setC] = useState<LiveHost | null>(null);
  const [read, setRead] = useState(e?.defaultTiming.readSec ?? 5);
  const [ans, setAns] = useState(e?.defaultTiming.answerSec ?? 5);
  const [auto, setAuto] = useState(0);
  const [board, setBoard] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [recap, setRecap] = useState<View | null>(null);
  const saved = savedHost();
  useController(c);
  useEffect(() => () => c?.stop(), [c]);
  useEffect(() => { if (c?.view?.ended) { setRecap(c.view); saveHost(null); } }, [c?.view?.ended]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!e) return <Navigate to="/host" replace />;

  const create = async () => {
    setBusy(true); setErr('');
    try {
      const settings: Record<string, unknown> = { readSec: read, answerSec: ans };
      if (auto) settings.autoAdvanceSec = auto;
      if (board) settings.leaderboard = true;
      const { data } = await rpc<{ code: string; hostToken: string }>('pp_create_session', { p_experience: e.id, p_settings: settings });
      saveHost({ code: data.code, token: data.hostToken, experienceId: e.id, at: Date.now() });
      setC(new LiveHost(data.code, data.hostToken));
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const resume = async () => {
    if (!saved) return;
    try { const { data } = await rpc<View>('pp_host_state', { p_code: saved.code, p_token: saved.token }); if (data.ended) throw new Error('That room has ended.'); setC(new LiveHost(saved.code, saved.token)); }
    catch (x) { saveHost(null); setErr((x as Error).message); }
  };

  if (recap) return (
    <div className="max-w-3xl mx-auto px-4 py-10 grid gap-5" data-testid="recap">
      <h1 className="text-4xl font-extrabold">{e.emoji} Session finished</h1>
      <div className="card p-6 grid gap-3">
        <h2 className="text-xl font-extrabold">Session insights</h2>
        <div className="flex flex-wrap gap-2"><Chip tone="sky">{recap.joined} joined</Chip>{recap.group && <Chip tone="teal">{recap.group.valid} completed</Chip>}
          {recap.group && !recap.group.suppressed && <Chip>Group average {recap.group.average}{e.scoring.kind === 'correct' ? '% correct' : '/100'}</Chip>}</div>
        <p className="text-ink-soft">Room data (names, answers, private results) has been deleted. Only anonymous totals remain for insights.</p>
      </div>
      <div className="flex gap-2"><button className="btn-primary" onClick={() => { setRecap(null); setC(null); }}>Host another round</button><Link className="btn-ghost" to="/host">Choose another game</Link></div>
    </div>
  );

  if (c) return (
    <div className="min-h-screen bg-paper"><div className="max-w-6xl mx-auto px-4 py-4 grid gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-teal-50 text-teal-600 px-4 py-3 font-bold text-sm" role="status">
        🟢 LIVE · real participants · answers stay private on their phones
        <span className="ms-auto"><button className="btn-ghost !min-h-[38px] !px-3 text-sm" onClick={() => setConfirmEnd(true)} data-testid="end">End game</button></span>
      </div>
      <Presenter c={c} joinUrl={joinUrlFor(c.code)} />
      {confirmEnd && <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="end-title">
        <div className="card p-6 max-w-md grid gap-3"><h2 id="end-title" className="text-xl font-extrabold">End the game and delete room data?</h2>
          <p className="text-ink-soft">Names, answers and private results are deleted. Players keep what is on their own phone. Anonymous totals are kept for insights.</p>
          <div className="flex gap-2"><button className="btn-primary" onClick={() => { setConfirmEnd(false); c.command('end'); }} data-testid="end-confirm">End game</button><button className="btn-ghost" onClick={() => setConfirmEnd(false)}>Cancel</button></div></div></div>}
    </div></div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 grid gap-6">
      <Link to="/host" className="text-sm font-bold text-ink-soft">← Host Studio</Link>
      <header className="flex items-center gap-4"><span className="text-5xl" aria-hidden>{e.emoji}</span><div><h1 className="text-3xl font-extrabold">{e.title}</h1><p className="text-ink-soft">{e.tagline}</p></div></header>
      {saved && <div className="rounded-2xl bg-sky-50 p-4 flex flex-wrap items-center gap-3"><span className="font-bold">You have an open room: {saved.code.slice(0, 3)} {saved.code.slice(3)}</span>
        <button className="btn-primary ms-auto" onClick={resume} data-testid="resume">Resume that room</button></div>}
      <div className="card p-6 grid gap-5">
        <h2 className="text-xl font-extrabold">Settings</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Select label="Reading time" value={read} options={READS.map(x => [x, `${x} s`])} onChange={setRead} id="read" />
          <Select label="Answer time" value={ans} options={ANSWERS.map(x => [x, `${x} s${x === 3 ? ' — Lightning ⚡' : x === 20 ? ' — Reflective 🪞' : ''}`])} onChange={setAns} id="answer" />
          <Select label="After each question" value={auto} options={AUTO.map(x => [x, x ? `Auto-advance after ${x} s` : 'Wait for me'])} onChange={setAuto} id="auto" />
        </div>
        {e.scoring.kind === 'correct' && <label className="flex gap-2 items-start font-bold"><input type="checkbox" className="w-5 h-5 accent-violet-600 mt-0.5" checked={board} onChange={x => setBoard(x.target.checked)} data-testid="leaderboard" />
          <span>Optional leaderboard<span className="block text-sm font-normal text-ink-soft">Players choose whether to appear. Everyone else stays anonymous.</span></span></label>}
        <div className="rounded-2xl bg-violet-50 text-violet-700 p-4 text-sm"><b>🔒 Privacy</b> {e.privacy.individualResults ? 'Personal results stay on each phone; you only see attendance and counts.' : 'Only group totals are shown.'} Group results need {e.privacy.groupMinimum}+ players.{e.scoring.kind === 'behaviour' ? ' This reflection game never shows a leaderboard.' : ''}</div>
        {err && <p className="text-coral-500 font-bold" role="alert">{err}</p>}
        <button className="btn-primary" onClick={create} disabled={busy} data-testid="create">{busy ? 'Creating…' : 'Create room'}</button>
        <p className="text-sm text-ink-soft">Tip: practise first with simulated players — <Link className="underline" to={`/practice/${e.id}`}>open practice mode</Link>.</p>
      </div>
    </div>
  );
}

function Select({ label, value, options, onChange, id }: { label: string; value: number; options: [number, string][]; onChange: (n: number) => void; id: string }) {
  return <label className="grid gap-1 text-sm font-bold" htmlFor={id}>{label}
    <select id={id} className="field !min-h-[48px] !text-base" value={value} onChange={x => onChange(+x.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}
