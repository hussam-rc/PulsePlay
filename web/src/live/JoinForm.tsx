import { useState } from 'react';
import { t } from '../i18n';

const AVATARS = ['🦊', '🐼', '🐙', '🦉', '🐢', '🦁', '🐧', '🦄', '🐝', '🐳', '🦜', '🐨'];

/** Join form used by practice and live. Collects only a nickname, an emoji, an optional leaderboard opt-in and consent. */
export function JoinForm({ title, privacyIndividual, leaderboard, disabled, defaultName = '', code, onCode, codeState, onJoin }: {
  title: string; privacyIndividual: boolean; leaderboard: boolean; disabled?: boolean; defaultName?: string;
  code?: string; onCode?: (c: string) => void; codeState?: { ok: boolean; msg: string } | null;
  onJoin: (x: { nickname: string; avatar: string; boardName: string | null }) => Promise<void>;
}) {
  const [nick, setNick] = useState(defaultName);
  const [avatar, setAvatar] = useState(() => AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const [board, setBoard] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (onCode && !/^\d{6}$/.test(code ?? '')) return setErr(t('join.err.code'));
    if (!nick.trim()) return setErr(t('join.err.nick'));
    if (!ok) return setErr(t('join.err.consent'));
    setBusy(true); setErr('');
    try { await onJoin({ nickname: nick.trim(), avatar, boardName: leaderboard && board ? nick.trim() : null }); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <form className="grid gap-3" onSubmit={submit} data-testid="join-form">
      <div className="text-center"><div className="text-4xl" aria-hidden>📱</div><h2 className="text-2xl font-extrabold">{t('join.title', { title })}</h2></div>
      {onCode && <label className="grid gap-1 text-sm font-bold">{t('join.code')}<input className={`field text-center !text-2xl tracking-[.3em] font-extrabold ${codeState && !codeState.ok ? '!border-coral-500' : ''}`} inputMode="numeric" maxLength={6} value={code} onChange={ev => onCode(ev.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" aria-invalid={codeState ? !codeState.ok : undefined} aria-describedby="code-state" data-testid="code" autoFocus={!code} />
        <span id="code-state" role="status" aria-live="polite" data-testid="code-state" className={`text-sm ${codeState?.ok ? 'text-teal-600' : 'text-coral-500'}`}>{codeState?.msg}</span></label>}
      <fieldset disabled={!!onCode && !codeState?.ok} className="grid gap-3 disabled:opacity-40">
      <label className="grid gap-1 text-sm font-bold">{t('join.nickname')}<input className="field" value={nick} maxLength={20} onChange={ev => setNick(ev.target.value)} autoComplete="nickname" data-testid="nickname" /></label>
      <fieldset className="grid gap-1"><legend className="text-sm font-bold mb-1">{t('join.avatar')}</legend>
        <div className="flex flex-wrap gap-1.5">{AVATARS.map(a => <button type="button" key={a} onClick={() => setAvatar(a)} aria-pressed={avatar === a} aria-label={`Avatar ${a}`}
          className={`w-11 h-11 rounded-xl text-2xl border-2 ${avatar === a ? 'border-violet-600 bg-violet-50' : 'border-paper-line bg-white'}`}>{a}</button>)}</div></fieldset>
      <div className="rounded-2xl bg-violet-50 text-violet-700 p-3 text-sm grid gap-1"><b>{t('join.before')}</b>
        <p>{t('join.screen')} {privacyIndividual ? t('join.private') : t('join.groupOnly')} {t('join.noData')}</p></div>
      {leaderboard && <label className="flex gap-2 items-start text-sm font-bold"><input type="checkbox" className="w-5 h-5 accent-violet-600" checked={board} onChange={ev => setBoard(ev.target.checked)} data-testid="board" /> {t('join.board')}</label>}
      <label className="flex gap-2 items-start text-sm font-bold"><input type="checkbox" className="w-5 h-5 accent-violet-600" checked={ok} onChange={ev => setOk(ev.target.checked)} data-testid="consent" /> {t('join.consent')}</label>
      {err && <p className="text-coral-500 text-sm font-bold" role="alert">{err}</p>}
      <button className="btn-primary" disabled={disabled || busy} data-testid="join">{disabled ? t('join.started') : busy ? t('join.joining') : t('join.go')}</button>
      </fieldset>
    </form>
  );
}
