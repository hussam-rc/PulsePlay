// Facilitator guide, generated from the game itself, printable (or "Save as PDF") from the browser.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { byId } from '../experiences';
import { Experience, flatActivities, timingOf, validateExperience } from '../engine/schema';
import { api, isUuid, useAuth } from '../live/workspace';
import { SignIn } from './Workspace';

export function Guide() {
  const id = useParams().id ?? '';
  const builtIn = byId(id);
  const auth = useAuth();
  const [e, setE] = useState<Experience | null | undefined>(builtIn ?? undefined);
  useEffect(() => {
    if (builtIn || !isUuid(id) || !auth) return;
    api.published(id).then(p => { const v = p && validateExperience(p.content); setE(v && v.ok ? v.experience! : null); }).catch(() => setE(null));
  }, [id, auth?.userId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!builtIn && !auth) return <SignIn title="Sign in to open this guide" />;
  if (e === undefined) return <p className="p-10 text-ink-soft">Loading…</p>;
  if (!e) return <p className="p-10" role="alert">This game is not published, or you do not have access to it.</p>;
  return <GuideBody e={e} hostTo={`/host/${id}`} />;
}

function GuideBody({ e, hostTo }: { e: Experience; hostTo: string }) {
  const acts = flatActivities(e);
  const secs = acts.reduce((s, a) => { const t = timingOf(e, a); return s + t.readSec + t.answerSec + 8; }, 0);
  const kind = e.scoring.kind;
  const what = kind === 'correct' ? 'a quiz: everyone answers on their phone, then sees the right answer and why'
    : kind === 'behaviour' ? 'a private self-reflection: everyone answers on their phone and gets a private result; the room sees only an anonymous group result'
    : kind === 'aggregate' ? 'an opinion poll: everyone votes on their phone and the room sees the anonymous split' : 'a conversation starter with anonymous polls';
  return (
    <article className="guide max-w-3xl mx-auto px-4 py-8 grid gap-6 print:px-0 print:py-0" data-testid="guide">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Link to={hostTo} className="btn-primary">🎤 Host this game</Link>
        <button className="btn-ghost" onClick={() => window.print()} data-testid="print">🖨️ Print or save as PDF</button>
      </div>
      <header><p className="text-sm font-bold text-violet-700">FACILITATOR GUIDE</p><h1 className="text-4xl font-extrabold">{e.emoji} {e.title}</h1><p className="text-lg text-ink-soft">{e.tagline}</p></header>

      <Block title="At a glance">
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
          <li><b>What it is:</b> {what}.</li><li><b>Time:</b> about {Math.max(e.durationMin, Math.round(secs / 60) + 5)} minutes including intro and debrief</li>
          <li><b>Group size:</b> {e.players.min}–{e.players.max} people</li><li><b>Questions:</b> {acts.length}</li>
          <li><b>You need:</b> a screen or projector, internet, and everyone's phone</li><li><b>Accounts:</b> players need none, only a nickname</li>
        </ul>
      </Block>

      <Block title="Before the session (5 minutes)">
        <ol className="list-decimal ps-6 grid gap-1">
          <li>Open PulsePlay on the presenting laptop, choose the game and press <b>Create room</b>. Keep the tab open; if it closes, open it again and press <b>Resume</b>.</li>
          <li>Put the room on the big screen. The QR code and the 6-digit code are on it.</li>
          <li>Optional: run a practice round with simulated players to see the flow.</li>
          <li>Check the Wi-Fi. If connections are weak, ask people to switch to mobile data.</li>
        </ol>
      </Block>

      <Block title="What to say at the start">
        <Say>"We're going to play {e.title}. Scan the QR code or go to the address on screen and type the code. Pick any nickname: you don't need an account."</Say>
        <Say>"{privacyLine(e)}"</Say>
        {kind === 'behaviour' && <Say>"Go with your first instinct. There are no wrong feelings: the game only looks at how we react."</Say>}
        {kind === 'correct' && <Say>"Speed doesn't matter, only the right answer. {e.disclaimer.includes('leaderboard') ? 'If you like, you can join the leaderboard with a nickname.' : ''}"</Say>}
      </Block>

      <Block title="Running it">
        <ul className="list-disc ps-6 grid gap-1">
          <li>Press <b>Next</b> (or the space bar) to move on. Each question shows for {e.defaultTiming.readSec}s, then people have {e.defaultTiming.answerSec}s to answer. The room moves on by itself when everyone has answered.</li>
          <li><b>Pause</b> if you need to explain something. Late joiners can still come in with the code.</li>
          <li>If someone's phone drops, they open the link again: they rejoin automatically and keep their answers.</li>
          {kind === 'correct' && <li>After each question, take 20 seconds for the explanation. Ask: "Who was surprised?"</li>}
          {kind === 'aggregate' && <li>After each result, ask one or two volunteers why they chose their side. Never ask a specific person to justify their answer.</li>}
          {kind === 'behaviour' && <li>Don't comment on individual results. Talk about the group result and the situations, never about who answered what.</li>}
        </ul>
      </Block>

      <Block title={`The questions (${acts.length})`}>
        <ol className="list-decimal ps-6 grid gap-2">{acts.map(a => <li key={a.id}>{a.prompt}
          {a.type === 'choice' && kind === 'correct' && <div className="text-sm text-ink-soft">Answer: <b>{a.options.find(o => o.correct)?.text}</b>{a.explanation ? `. ${a.explanation}` : ''}</div>}
          {(a.type === 'poll' || (a.type === 'choice' && kind !== 'correct')) && <div className="text-sm text-ink-soft">{a.options.map(o => o.text).join(' · ')}</div>}
        </li>)}</ol>
      </Block>

      <Block title="Debrief (10 minutes)">
        {e.closing?.questions.length ? <ol className="list-decimal ps-6 grid gap-1">{e.closing.questions.map((q, i) => <li key={i}>{q}</li>)}</ol> : <p>Ask what surprised people and what they will do differently.</p>}
        <p className="text-sm text-ink-soft">Tip: let people talk in pairs for two minutes first, then collect a few thoughts from the room.</p>
        {e.closing?.message && <Say>"{e.closing.message}"</Say>}
      </Block>

      <Block title="Privacy and care">
        <ul className="list-disc ps-6 grid gap-1">
          <li>{privacyLine(e)}</li>
          <li>Group results appear only when at least {e.privacy.groupMinimum} people have answered.</li>
          <li>Names and answers are deleted when you end the session. Only anonymous totals are kept.</li>
          <li>{e.disclaimer}</li>
          <li>Taking part is voluntary. Anyone can watch without joining.</li>
        </ul>
      </Block>
      <p className="text-xs text-ink-soft">Generated by PulsePlay from version-controlled game content.</p>
    </article>
  );
}

const privacyLine = (e: Experience) => e.scoring.kind === 'behaviour' ? 'Your answers and your result are private. Only you see them on your phone. The screen shows only an anonymous group result.'
  : e.scoring.kind === 'correct' ? 'Your score is shown only on your phone, unless you choose to join the leaderboard with a nickname.'
  : 'Votes are anonymous. The screen shows only how the group split.';
function Block({ title, children }: { title: string; children: React.ReactNode }) { return <section className="card p-5 grid gap-3 break-inside-avoid print:shadow-none print:border print:border-paper-line"><h2 className="text-xl font-extrabold">{title}</h2>{children}</section>; }
function Say({ children }: { children: React.ReactNode }) { return <blockquote className="border-s-4 border-violet-500 ps-4 italic">{children}</blockquote>; }
