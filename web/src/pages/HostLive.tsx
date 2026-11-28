import { useEffect, useState } from 'react';
import { Link, useParams, Navigate, useNavigate } from 'react-router-dom';
import { byId, languagesOf } from '../experiences';
import { HighlightsView } from '../live/HighlightsView';
import { clearMoments } from '../live/highlights';
import { t } from '../i18n';
import { LangSwitch } from '../ui/LangSwitch';
import { LiveHost, rpc, saveHost, savedHost } from '../live/controllers';
import { Presenter, useController } from '../live/Presenter';
import type { View } from '../live/view';
import { Chip } from '../ui/bits';
import type { Experience } from '../engine/schema';
import { api, isUuid, useAuth } from '../live/workspace';
import { validateExperience } from '../engine/schema';
import { SignIn } from './Workspace';
import { lengthOptions, defaultLength, strategyOf, strategiesFor, estimateMinutes, type Strategy } from '../engine/bank';
import { BrandBar, useRoomBrand } from '../ui/Brand';
function RoomBrandBar({ code }: { code: string }) { return <BrandBar brand={useRoomBrand(code)} />; }

const READS = [5, 8, 10], ANSWERS = [3, 5, 8, 12], AUTO = [0, 5, 8, 12];
const withDefault = (xs: number[], d: number) => [...new Set([...xs, d])].sort((a, b) => a - b);
type K = Parameters<typeof t>[0];
const LENGTH_LABEL: Record<number, [string, K]> = { 10: ['⚡', 'qb.quick'], 15: ['🎯', 'qb.standard'], 20: ['🚀', 'qb.extended'] };
const RECENT_KEY = (id: string) => `pp_recent_q:${id}`;
/** The host's own recent selections for this game, on this device only (repeat avoidance for hosts without an account). */
function recentSelections(id: string): string[][] { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY(id)) ?? '[]'); return Array.isArray(v) ? v.slice(0, 5) : []; } catch { return []; } }
function rememberSelection(id: string, ids: string[]) { try { localStorage.setItem(RECENT_KEY(id), JSON.stringify([ids, ...recentSelections(id)].slice(0, 5))); } catch { /* ignore */ } }
const LANG_NAME: Record<string, string> = { en: 'English', de: 'Deutsch', fr: 'Français', ar: 'العربية' };

export const joinUrlFor = (code: string) => `${location.origin}${location.pathname}#/j/${code}`;

export function HostLive() {
  const id = useParams().id ?? '';
  const builtIn = byId(id);
  if (builtIn) return <HostLiveFor key={id} e={builtIn} expKey={id} />;
  if (isUuid(id)) return <HostServer id={id} />;
  return <Navigate to="/host" replace />;
}

/** Organisation and personal experiences: loaded as the signed-in user (RLS decides), hosted by id. */
function HostServer({ id }: { id: string }) {
  const auth = useAuth();
  const [st, setSt] = useState<{ e?: Experience; err?: string } | null>(null);
  useEffect(() => {
    if (!auth) return;
    api.published(id).then(p => {
      if (!p) return setSt({ err: 'This experience is not published, or you do not have access to it.' });
      const v = validateExperience(p.content); setSt(v.ok ? { e: v.experience! } : { err: 'This published version cannot be hosted.' });
    }).catch(e => setSt({ err: e.message }));
  }, [id, auth?.userId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!auth) return <SignIn title="Sign in to host this experience" />;
  if (!st) return <p className="p-10 text-ink-soft">Loading…</p>;
  if (st.err) return <div className="max-w-xl mx-auto p-10 grid gap-3"><p className="font-bold" role="alert">{st.err}</p><Link className="btn-ghost" to="/workspace">Back to workspace</Link></div>;
  return <HostLiveFor e={st.e!} expKey={id} practiceTo={`/workspace/edit/${id}`} />;
}

function HostLiveFor({ e, expKey, practiceTo }: { e: Experience; expKey: string; practiceTo?: string }) {
  const [c, setC] = useState<LiveHost | null>(null);
  const [read, setRead] = useState(e?.defaultTiming.readSec ?? 5);
  const [ans, setAns] = useState(e?.defaultTiming.answerSec ?? 5);
  const [auto, setAuto] = useState(0);
  const [board, setBoard] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>(strategyOf(e));
  const lengths = lengthOptions(e, strategy);
  const [count, setCount] = useState(defaultLength(e, strategy));
  const n = lengths.some(o => o.available && o.n === count) ? count : defaultLength(e, strategy);
  const minutesFor = (q: number) => estimateMinutes({ questions: q, readSec: read, answerSec: ans, reveal: e.reveal, scored: e.scoring.kind === 'behaviour' || e.scoring.kind === 'correct', autoAdvanceSec: auto || undefined });
  const minutes = minutesFor(n);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [recap, setRecap] = useState<View | null>(null);
  const saved = savedHost();
  const nav = useNavigate();
  const langs = practiceTo ? [] : languagesOf(expKey);
  useController(c);
  useEffect(() => () => c?.stop(), [c]);
  useEffect(() => { if (c?.view?.ended) { setRecap(c.view); saveHost(null); } }, [c?.view?.ended]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    setBusy(true); setErr('');
    try {
      const settings: Record<string, unknown> = { readSec: read, answerSec: ans, questions: n, selection: strategy };
      if (strategy !== 'fixed') settings.recent = recentSelections(expKey);
      if (auto) settings.autoAdvanceSec = auto;
      if (board) settings.leaderboard = true;
      const { data } = await rpc<{ code: string; hostToken: string; selection?: { ids: string[] } }>('pp_create_session', { p_experience: expKey, p_settings: settings });
      if (strategy !== 'fixed' && data.selection?.ids) rememberSelection(expKey, data.selection.ids);
      saveHost({ code: data.code, token: data.hostToken, experienceId: expKey, at: Date.now() });
      setC(new LiveHost(data.code, data.hostToken));
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const resume = async () => {
    if (!saved) return;
    try { const { data } = await rpc<View>('pp_host_state', { p_code: saved.code, p_token: saved.token }); if (data.ended) throw new Error(t('hl.roomEnded')); setC(new LiveHost(saved.code, saved.token)); }
    catch (x) { saveHost(null); setErr((x as Error).message); }
  };

  if (recap) return (
    <div className="max-w-3xl mx-auto px-4 py-10 grid gap-5" data-testid="recap">
      <h1 className="text-4xl font-extrabold">{e.emoji} {t('hl.finished')}</h1>
      <div className="card p-6 grid gap-3">
        <h2 className="text-xl font-extrabold">{t('hl.insights')}</h2>
        <div className="flex flex-wrap gap-2"><Chip tone="sky">{t('join.joined', { n: recap.joined })}</Chip>{recap.group && <Chip tone="teal">{t('stage.completed', { n: recap.group.valid })}</Chip>}
          {recap.group && !recap.group.suppressed && <Chip>{t('hl.avg', { n: recap.group.average ?? '' })}{e.scoring.kind === 'correct' ? t('stage.pctCorrect') : '/100'}</Chip>}</div>
        <p className="text-ink-soft">{t('hl.deleted')}</p>
      </div>
      <HighlightsView code={recap.code} kind={e.scoring.kind} compact />
      <section className="card p-5 grid gap-3" data-testid="next-steps"><h2 className="text-xl font-extrabold">{t('next.title')}</h2>
        <div className="grid sm:grid-cols-3 gap-2">
          <button className="btn-primary" onClick={() => { clearMoments(recap.code); setRecap(null); setC(null); }}>↻ {t('hl.another')}</button>
          <Link className="btn-ghost" to="/find">✨ {t('next.find')}</Link>
          <Link className="btn-ghost" to="/host">🎤 {t('hl.choose')}</Link>
        </div></section>
    </div>
  );

  if (c) return (
    <div className="min-h-screen bg-paper"><div className="max-w-6xl mx-auto px-4 py-4 grid gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-teal-50 text-teal-600 px-4 py-3 font-bold text-sm" role="status">
        {t('hl.live')}
        <span className="ms-auto"><button className="btn-ghost !min-h-[38px] !px-3 text-sm" onClick={() => setConfirmEnd(true)} data-testid="end">{t('hl.end')}</button></span>
      </div>
      <RoomBrandBar code={c.code} />
      <Presenter c={c} joinUrl={joinUrlFor(c.code)} extra={<button className="btn-ghost" onClick={() => window.open(`${location.pathname}#/screen`, 'pp-projector', 'popup,width=1280,height=760')} data-testid="open-screen">🖥 {t('oa.screen.open')}</button>} onEnd={() => setConfirmEnd(true)} onKick={(seat, name) => { if (confirm(t('stage.kickQ', { name }))) c.kick(seat); }} />
      {confirmEnd && <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="end-title">
        <div className="card p-6 max-w-md grid gap-3"><h2 id="end-title" className="text-xl font-extrabold">{t('hl.endQ')}</h2>
          <p className="text-ink-soft">{t('hl.endText')}</p>
          <div className="flex gap-2"><button className="btn-primary" onClick={() => { setConfirmEnd(false); c.command('end'); }} data-testid="end-confirm">{t('host.endInsights')}</button><button className="btn-ghost" onClick={() => setConfirmEnd(false)}>{t('hl.cancel')}</button></div></div></div>}
    </div></div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 grid gap-6">
      <div className="flex items-center"><Link to="/host" className="text-sm font-bold text-ink-soft me-auto">{t('hl.back')}</Link><LangSwitch /></div>
      <header className="flex items-center gap-4"><span className="text-5xl" aria-hidden>{e.emoji}</span><div><h1 className="text-3xl font-extrabold" dir="auto">{e.title}</h1><p className="text-ink-soft" dir="auto">{e.tagline}</p></div></header>
      {saved && <div className="rounded-2xl bg-sky-50 p-4 flex flex-wrap items-center gap-3"><span className="font-bold">{t('hl.openRoom', { code: `${saved.code.slice(0, 3)} ${saved.code.slice(3)}` })}</span>
        <button className="btn-primary ms-auto" onClick={resume} data-testid="resume">{t('hl.resume')}</button></div>}
      <div className="card p-6 grid gap-5">
        <h2 className="text-xl font-extrabold">{t('hl.settings')}</h2>
        {langs.length > 1 && <label className="grid gap-1 text-sm font-bold" htmlFor="glang">{t('hl.lang')}
          <select id="glang" className="field !min-h-[48px] !text-base" value={expKey} onChange={x => nav(`/host/${x.target.value}`)} data-testid="game-lang">{langs.map(l => <option key={l.id} value={l.id}>{LANG_NAME[l.lang] ?? l.lang}</option>)}</select></label>}
        <fieldset className="grid gap-2" data-testid="lengths"><legend className="text-sm font-bold mb-1">{t('qb.questions')}</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {lengths.map(o => { const [icon, key]: [string, K] = LENGTH_LABEL[o.n] ?? ['📋', o.all ? 'qb.all' : 'qb.nQ']; const on = o.available && o.n === n; return (
              <button key={o.n} type="button" disabled={!o.available} aria-pressed={on} onClick={() => setCount(o.n)} data-testid={`len-${o.n}`}
                className={`rounded-2xl border-2 p-3 text-start grid gap-0.5 transition ${on ? 'border-violet-600 bg-violet-50' : 'border-paper-line'} ${o.available ? 'hover:border-violet-400' : 'opacity-50 cursor-not-allowed'}`}>
                <span className="font-extrabold"><span aria-hidden>{icon} </span>{o.n}</span>
                <span className="text-sm font-bold">{t(key, { n: o.n })}</span>
                <span className="text-xs text-ink-soft" data-testid={`len-${o.n}-time`}>{o.available ? `⏱ ${t('qb.cardMin', { m: minutesFor(o.n) })}${o.all && LENGTH_LABEL[o.n] ? ` · ${t('qb.allShort')}` : ''}` : t('qb.needs', { n: o.missing })}</span>
              </button>); })}
          </div>
          <p className="text-xs text-ink-soft" data-testid="bank-size">{t('qb.bank', { n: lengths.reduce((m, o) => (o.available ? Math.max(m, o.n) : m), 0) })}</p>
        </fieldset>
        <label className="grid gap-1 text-sm font-bold" htmlFor="selection">{t('qb.selection')}
          <select id="selection" className="field !min-h-[48px] !text-base" value={strategy} onChange={x => setStrategy(x.target.value as Strategy)} data-testid="selection">
            {strategiesFor(e).map(s => <option key={s} value={s}>{t(`qb.s.${s}`)}{s === strategyOf(e) ? ` (${t('hl.recommended')})` : ''}</option>)}</select>
          <span className="font-normal text-ink-soft">{t(`qb.sd.${strategy}`)}</span></label>
        <div className="grid sm:grid-cols-3 gap-4">
          <Select label={t('hl.read')} value={read} options={withDefault(READS, e.defaultTiming.readSec).map(x => [x, `${x} s${x === e.defaultTiming.readSec ? ` (${t('hl.recommended')})` : ''}`])} onChange={setRead} id="read" />
          <Select label={t('hl.answer')} value={ans} options={withDefault(ANSWERS, e.defaultTiming.answerSec).map(x => [x, `${x} s${x === 3 ? ` · ${t('hl.lightning')}` : x >= 15 ? ` · ${t('hl.reflective')}` : ''}${x === e.defaultTiming.answerSec ? ` (${t('hl.recommended')})` : ''}`])} onChange={setAns} id="answer" />
          <Select label={t('hl.after')} value={auto} options={AUTO.map(x => [x, x ? t('hl.auto', { n: x }) : t('hl.wait')])} onChange={setAuto} id="auto" />
        </div>
        {e.scoring.kind === 'correct' && <label className="flex gap-2 items-start font-bold"><input type="checkbox" className="w-5 h-5 accent-violet-600 mt-0.5" checked={board} onChange={x => setBoard(x.target.checked)} data-testid="leaderboard" />
          <span>{t('hl.board')}<span className="block text-sm font-normal text-ink-soft">{t('hl.boardSub')}</span></span></label>}
        <section className="rounded-2xl border-2 border-paper-line p-4 grid gap-1" aria-live="polite" data-testid="game-summary">
          <h3 className="font-extrabold">{t('qb.yourGame')}</h3>
          <p className="text-sm">{t('qb.summary', { n, sel: t(`qb.s.${strategy}`), r: read, a: ans })}</p>
          <p className="text-lg font-extrabold text-violet-700" data-testid="duration">⏱ {t('qb.duration', { m: minutes })}</p>
          <p className="text-xs text-ink-soft">{t('qb.durationNote')} {t('qb.later')}</p>
        </section>
        <div className="rounded-2xl bg-violet-50 text-violet-700 p-4 text-sm"><b>{t('hl.privacy')}</b> {e.privacy.individualResults ? t('hl.privInd') : t('stage.groupOnly') + '.'} {t('hl.privMin', { n: e.privacy.groupMinimum })}{e.scoring.kind === 'behaviour' ? ` ${t('hl.noBoard')}` : ''}</div>
        {err && <p className="text-coral-500 font-bold" role="alert">{err}</p>}
        <button className="btn-primary" onClick={create} disabled={busy} data-testid="create">{busy ? t('hl.creating') : t('hl.create')}</button>
        <p className="text-sm text-ink-soft">{t('hl.tip')} <Link className="underline" to={practiceTo ?? `/practice/${e.id}`}>{practiceTo ? 'preview it in the editor' : t('hl.openPractice')}</Link>.</p>
      </div>
    </div>
  );
}

function Select({ label, value, options, onChange, id }: { label: string; value: number; options: [number, string][]; onChange: (n: number) => void; id: string }) {
  return <label className="grid gap-1 text-sm font-bold" htmlFor={id}>{label}
    <select id={id} className="field !min-h-[48px] !text-base" value={value} onChange={x => onChange(+x.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}
