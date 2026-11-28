import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivePlayer, rpc, savePlayer, savedPlayer } from '../live/controllers';
import { useController } from '../live/Presenter';
import { PhoneView } from '../live/screens';
import { JoinForm } from '../live/JoinForm';
import type { View } from '../live/view';
import { t } from '../i18n';
import { savedResult } from '../live/savedResults';
import { SavedResultView } from '../live/screens';
import { LangSwitch } from '../ui/LangSwitch';
import { BrandBar, useRoomBrand } from '../ui/Brand';

/** Phone page. No account: a room code, a nickname and consent. Refreshing rejoins with the same private token. */
export function JoinLive() {
  const params = useParams(); const nav = useNavigate();
  const [code, setCode] = useState(params.code ?? '');
  const [preview, setPreview] = useState<View | null>(null);
  const [c, setC] = useState<LivePlayer | null>(null);
  const [endedCode, setEndedCode] = useState<string | null>(null);
  const [me, setMe] = useState<{ nickname: string; avatar: string } | null>(null);
  const [codeState, setCodeState] = useState<{ ok: boolean; msg: string } | null>(null);
  const [kicked, setKicked] = useState(false);
  useController(c);
  const brand = useRoomBrand(c?.code ?? (/^\d{6}$/.test(code) ? code : null));
  useEffect(() => () => c?.stop(), [c]);

  // Reconnect after a refresh.
  useEffect(() => {
    const p = savedPlayer(params.code);
    if (!p) return;
    rpc('pp_my_state', { p_token: p.token }).then(({ data }) => {
      if (!data) { savePlayer(null); if (savedResult(p.code)) setEndedCode(p.code); return; }
      setMe({ nickname: p.nickname, avatar: p.avatar }); const lp = new LivePlayer(p.code, p.token); lp.seat = p.seat; setC(lp);
    }).catch(() => { /* offline: the form stays; poller retries once joined */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Look up the room as soon as a full code is entered, to show the right title and options.
  useEffect(() => {
    setPreview(null);
    if (!/^\d{6}$/.test(code)) { setCodeState(code.length ? { ok: false, msg: t('join.err.code') } : null); return; }
    setCodeState({ ok: false, msg: t('join.checking') });
    rpc<View>('pp_state', { p_code: code }).then(({ data }) => {
      if (data.ended) setCodeState({ ok: false, msg: t('join.noRoom') });
      else if (!['lobby', 'intro', 'activity'].includes(data.stage)) setCodeState({ ok: false, msg: t('join.started') });
      else { setPreview(data); setCodeState({ ok: true, msg: `✓ ${t('join.found', { title: data.experience.title })} · ${t('join.joined', { n: data.joined })}` }); }
    }).catch(x => setCodeState({ ok: false, msg: (x as Error).message }));
  }, [code]);

  if (endedCode && !c) return (
    <div className="min-h-screen bg-paper"><div className="max-w-md mx-auto px-4 py-6 grid gap-3">
      <div className="justify-self-end"><LangSwitch /></div>
      <SavedResultView code={endedCode} />
      <button className="btn-ghost" onClick={() => { setEndedCode(null); setCode(''); nav('/j'); }}>{t('nav.play')} →</button>
    </div></div>);
  if (kicked || c?.kicked) return (
    <div className="min-h-screen bg-paper"><div className="max-w-md mx-auto px-4 py-10 grid gap-4 text-center">
      <div className="text-6xl" aria-hidden>👋</div><p className="font-bold" role="alert" data-testid="kicked">{t('phone.kicked')}</p>
      <button className="btn-ghost" onClick={() => { setKicked(false); setC(null); setMe(null); }}>{t('join.go')}</button>
    </div></div>);
  if (c && me) {
    const v = c.view;
    return (
      <div className="min-h-screen bg-paper"><div className="max-w-md mx-auto px-4 py-6 grid gap-3">
        <BrandBar brand={brand} />
        {c.error && <p className="rounded-xl bg-coral-50 text-coral-500 font-bold text-sm p-3" role="alert">⚠️ {c.error} {t('join.keepTrying')}</p>}
        {v ? <PhoneView v={v} off={c.offset} my={c.my} seed={c.token.slice(0, 16)} nickname={me.nickname} avatar={me.avatar} onPick={(id, val) => c.submit(id, val)} onOpen={(id, text, editId) => c.openSend(id, text, editId)} />
          : <p className="text-center text-ink-soft py-10" role="status">{t('join.connecting')}</p>}
        {v && (v.stage === 'closing' || v.ended) && <button className="btn-ghost text-sm" onClick={async () => { try { await rpc('pp_forget_me', { p_token: c.token }); } catch { /* already gone */ } savePlayer(null); c.stop(); setC(null); setMe(null); nav('/play'); }}>{t('join.leave')}</button>}
      </div></div>
    );
  }

  return (
    <div className="min-h-screen bg-paper"><div className="max-w-md mx-auto px-4 py-8 grid gap-3">
      <div className="justify-self-end"><LangSwitch /></div>
      <BrandBar brand={brand} />
      <JoinForm title={preview?.experience.title ?? t('join.aGame')} privacyIndividual={preview?.experience.privacy.individualResults ?? true} leaderboard={!!preview?.settings.leaderboard}
        code={code} onCode={setCode} codeState={codeState}
        onJoin={async ({ nickname, avatar, boardName }) => {
          const { data } = await rpc<{ token: string; seat?: string }>('pp_join', { p_code: code, p_nickname: nickname, p_avatar: avatar, p_board_name: boardName, p_consent: true });
          savePlayer({ code, token: data.token, nickname, avatar, at: Date.now(), seat: data.seat });
          setMe({ nickname, avatar }); const lp = new LivePlayer(code, data.token); lp.seat = data.seat; setC(lp);
        }} />
    </div></div>
  );
}
