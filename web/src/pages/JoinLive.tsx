import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivePlayer, rpc, savePlayer, savedPlayer } from '../live/controllers';
import { useController } from '../live/Presenter';
import { PhoneView } from '../live/screens';
import { JoinForm } from '../live/JoinForm';
import type { View } from '../live/view';

/** Phone page. No account: a room code, a nickname and consent. Refreshing rejoins with the same private token. */
export function JoinLive() {
  const params = useParams(); const nav = useNavigate();
  const [code, setCode] = useState(params.code ?? '');
  const [preview, setPreview] = useState<View | null>(null);
  const [c, setC] = useState<LivePlayer | null>(null);
  const [me, setMe] = useState<{ nickname: string; avatar: string } | null>(null);
  const [msg, setMsg] = useState('');
  useController(c);
  useEffect(() => () => c?.stop(), [c]);

  // Reconnect after a refresh.
  useEffect(() => {
    const p = savedPlayer(params.code);
    if (!p) return;
    rpc('pp_my_state', { p_token: p.token }).then(({ data }) => {
      if (!data) { savePlayer(null); return; }
      setMe({ nickname: p.nickname, avatar: p.avatar }); setC(new LivePlayer(p.code, p.token));
    }).catch(() => { /* offline: the form stays; poller retries once joined */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Look up the room as soon as a full code is entered, to show the right title and options.
  useEffect(() => {
    setPreview(null); setMsg('');
    if (!/^\d{6}$/.test(code)) return;
    rpc<View>('pp_state', { p_code: code }).then(({ data }) => data.ended ? setMsg('No game with that code is running.') : setPreview(data)).catch(x => setMsg((x as Error).message));
  }, [code]);

  if (c && me) {
    const v = c.view;
    return (
      <div className="min-h-screen bg-paper"><div className="max-w-md mx-auto px-4 py-6 grid gap-3">
        {c.error && <p className="rounded-xl bg-coral-50 text-coral-500 font-bold text-sm p-3" role="alert">⚠️ {c.error} We'll keep trying.</p>}
        {v ? <PhoneView v={v} off={c.offset} my={c.my} seed={c.token.slice(0, 16)} nickname={me.nickname} avatar={me.avatar} onPick={(id, val) => c.submit(id, val)} />
          : <p className="text-center text-ink-soft py-10" role="status">Connecting…</p>}
        {v && (v.stage === 'closing' || v.ended) && <button className="btn-ghost text-sm" onClick={async () => { try { await rpc('pp_forget_me', { p_token: c.token }); } catch { /* already gone */ } savePlayer(null); c.stop(); setC(null); setMe(null); nav('/play'); }}>Leave and delete my answers</button>}
      </div></div>
    );
  }

  return (
    <div className="min-h-screen bg-paper"><div className="max-w-md mx-auto px-4 py-8 grid gap-3">
      <JoinForm title={preview?.experience.title ?? 'a game'} privacyIndividual={preview?.experience.privacy.individualResults ?? true} leaderboard={!!preview?.settings.leaderboard}
        code={code} onCode={setCode}
        onJoin={async ({ nickname, avatar, boardName }) => {
          const { data } = await rpc<{ token: string }>('pp_join', { p_code: code, p_nickname: nickname, p_avatar: avatar, p_board_name: boardName, p_consent: true });
          savePlayer({ code, token: data.token, nickname, avatar, at: Date.now() });
          setMe({ nickname, avatar }); setC(new LivePlayer(code, data.token));
        }} />
      {msg && <p className="text-coral-500 font-bold text-sm text-center" role="alert">{msg}</p>}
      {preview && <p className="text-center text-sm text-ink-soft">{preview.experience.emoji} {preview.experience.title} · {preview.joined} joined</p>}
    </div></div>
  );
}
