import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { byId } from '../experiences';
import { sessionExperience } from '../engine/bank';
import { Session, MAX_SIMULATED, Player } from '../engine/session';
import type { Experience } from '../engine/schema';
import { PracticeHost } from '../live/controllers';
import { Presenter, useController } from '../live/Presenter';
import { PhoneView } from '../live/screens';
import { JoinForm } from '../live/JoinForm';
import { t } from '../i18n';

export function Practice() {
  const e = byId(useParams().id ?? '');
  if (!e) return <Navigate to="/discover" replace />;
  return <PracticeRun key={e.id} e={e} />;
}

/** Practice mode: the real engine with simulated players, entirely in memory. Never touches the server. */
export function PracticeRun({ e, exitTo }: { e: Experience; exitTo?: string }) {
  const [gen, setGen] = useState(0);
  const c = useMemo(() => { const s = new Session(sessionExperience(e)); s.addSimulated(6); return new PracticeHost(s); }, [e, gen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => c.stop(), [c]);
  useController(c);
  const s = c.session, v = c.view!;
  const [me, setMe] = useState<Player | null>(null);
  useEffect(() => setMe(null), [c]);
  const pre = v.stage === 'lobby' || v.stage === 'intro';
  const sims = s.players.filter(p => p.simulated).length;
  const mine = me ? s.players.find(p => p.id === me.id) : null;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-7xl mx-auto px-4 py-4 grid gap-4">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sun-50 text-[#8A5A0A] px-4 py-3 font-bold text-sm" role="status">
          🧪 {t('practice.banner')}
          <span className="ms-auto flex gap-2"><button className="btn-ghost !min-h-[38px] !px-3 text-sm" onClick={() => setGen(g => g + 1)}>↺ Restart</button><Link className="btn-ghost !min-h-[38px] !px-3 text-sm" to={exitTo ?? `/x/${e.id}`}>Exit</Link></span>
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
          <div className="grid gap-4">
            <Presenter c={c} joinUrl={`practice:${v.code}`} practice extra={v.stage === 'closing' && <button className="btn-ghost" onClick={() => setGen(g => g + 1)}>🔁 New game</button>} />
            <div className="card p-4 grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-extrabold">🤖 Simulated players: {sims}</h2>
                <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" className="w-5 h-5 accent-violet-600" defaultChecked={s.autoSim} onChange={ev => { s.autoSim = ev.target.checked; }} /> Answer automatically</label></div>
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
              <div className="pt-10 px-4 pb-6">
                {mine ? <PhoneView v={v} off={0} my={{ answers: mine.responses, open: v.activity?.type === 'open' ? { [v.activity.id]: s.myOpen(mine.id, v.activity.id) } : undefined, openUsed: v.activity?.type === 'open' ? { [v.activity.id]: (s.open[v.activity.id] ?? []).filter(x => x.player === mine.id).length } : undefined }} seed={mine.id} nickname={mine.nickname} avatar={mine.avatar} onPick={(id, val) => s.answer(mine.id, id, val)}
                    onOpen={async (id, text, editId) => s.openSubmit(mine.id, id, text, editId).status} />
                  : <JoinForm title={e.title} privacyIndividual={e.privacy.individualResults} leaderboard={false} disabled={!pre} defaultName="You"
                      onJoin={async ({ nickname, avatar }) => { setMe(s.join(nickname, { avatar })); }} />}
              </div>
            </div>
            <p className="text-center text-sm text-ink-soft mt-2">This phone is you. Play along!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
