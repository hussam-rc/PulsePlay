// Open Answer questions on screens: the phone input, the projector visualisation and the host's moderation panel.
// Answers are always rendered as plain text (React escapes them); nothing typed by a participant is ever interpreted as HTML.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { checkAnswer, cloud, cloudSize, type CloudWord, type OpenActivity } from '../engine/openAnswer';
import { lang, t } from '../i18n';
import type { OpenCmd } from './controllers';
import type { MyOpenAnswer, OpenView, OpenViewItem, PublicActivity, View } from './view';

type Send = (text: string, editId?: string) => Promise<string>;
const ERR = (s: string, a: PublicActivity) => {
  const o = a.open!, k = `oa.err.${s}`;
  return t((['empty', 'too_long', 'too_many_words', 'link', 'limit', 'duplicate', 'edit_closed', 'late', 'not_open', 'rate'].includes(s) ? k : 'oa.err.other') as never,
    { max: o.maxChars, n: o.maxWords ?? 0 });
};
/** Settings as the engine's rule checker needs them (the phone checks before sending; the server checks again). */
const asActivity = (a: PublicActivity) => ({ ...a.open!, id: a.id, type: 'open', prompt: a.prompt, submitSec: 0 }) as unknown as OpenActivity;

// ---------------------------------------------------------------- phone ----------------------------------------------------------------
export function OpenPhone({ a, mine, used, canSend, now, onSend, contentLangs }: { a: PublicActivity; mine: MyOpenAnswer[]; used?: number; canSend: boolean; now: number; onSend: Send; contentLangs?: string[] }) {
  const o = a.open!, key = `pp_oa_draft:${a.id}`;
  const [text, setText] = useState(() => { try { return sessionStorage.getItem(key) ?? ''; } catch { return ''; } });
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { try { sessionStorage.setItem(key, text); } catch { /* private mode: draft lasts this page */ } }, [key, text]);
  const left = o.maxResponses - Math.max(used ?? 0, mine.length), len = [...text].length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tooMany = !!o.maxWords && words > o.maxWords;
  const send = async () => {
    if (busy) return;                                   // one request at a time: no accidental double submissions
    const c = checkAnswer(asActivity(a), text);
    if (!c.ok) { setMsg({ ok: false, text: ERR(c.error, a) }); return; }
    if (!editing && mine.some(m => m.t.toLowerCase() === c.text.toLowerCase())) { setMsg({ ok: false, text: ERR('duplicate', a) }); return; }
    setBusy(true); setMsg(null);
    try {
      const s = await onSend(c.text, editing ?? undefined);
      if (s === 'ok') { setText(''); setEditing(null); setMsg({ ok: true, text: t('oa.sent') }); }
      else setMsg({ ok: false, text: ERR(s, a) });
    } finally { setBusy(false); }
  };
  const showInput = canSend && (left > 0 || editing);
  const ui = lang(), written = contentLangs?.length && !contentLangs.includes(ui) ? contentLangs[0] : null;
  let langName = written ?? '';
  try { if (written) langName = new Intl.DisplayNames([ui], { type: 'language' }).of(written) ?? written; } catch { /* old browser: show the code */ }
  return (
    <div className="grid gap-3" data-testid="oa-phone">
      {written && <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm" data-testid="oa-content-lang">🌐 {t('oa.contentLang', { lang: langName })}</p>}
      <div className="flex flex-wrap gap-2 text-xs text-ink-soft">
        {o.maxWords && <span className="chip bg-paper">{o.maxWords === 1 ? t('oa.words1') : t('oa.wordsN', { n: o.maxWords })}</span>}
        {o.maxResponses > 1 && canSend && <span className="chip bg-paper" data-testid="oa-left">{t('oa.left', { n: Math.max(0, left), max: o.maxResponses })}</span>}
      </div>
      {showInput && <form className="grid gap-2" onSubmit={ev => { ev.preventDefault(); send(); }}>
        <label className="sr-only" htmlFor={`oa-${a.id}`}>{t('oa.type')}</label>
        {o.maxChars > 40
          ? <textarea id={`oa-${a.id}`} className="field min-h-[96px] text-lg" dir="auto" value={text} maxLength={o.maxChars + 20} placeholder={o.placeholder || t(mine.length && !editing ? 'oa.typeMore' : 'oa.type')}
              onChange={ev => { setText(ev.target.value); setMsg(null); }} data-testid="oa-input" autoComplete="off" />
          : <input id={`oa-${a.id}`} className="field text-xl !min-h-[56px]" dir="auto" value={text} maxLength={o.maxChars + 10} enterKeyHint="send" autoComplete="off" autoCorrect="on"
              placeholder={o.placeholder || t(mine.length && !editing ? 'oa.typeMore' : 'oa.type')} onChange={ev => { setText(ev.target.value); setMsg(null); }} data-testid="oa-input" />}
        <div className="flex items-center gap-2">
          <span className={`text-sm tabular-nums ${len > o.maxChars || tooMany ? 'text-coral-500 font-bold' : 'text-ink-soft'}`} aria-live="polite" data-testid="oa-count">{t('oa.chars', { n: len, max: o.maxChars })}</span>
          {editing && <button type="button" className="btn-ghost ms-auto" onClick={() => { setEditing(null); setText(''); }}>{t('oa.cancel')}</button>}
          <button type="submit" className={`btn-primary ${editing ? '' : 'ms-auto'} min-w-[8rem]`} disabled={busy || !text.trim()} aria-busy={busy} data-testid="oa-send">
            {busy ? t('oa.sending') : editing ? t('oa.save') : t('oa.send')}</button>
        </div>
      </form>}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-xl p-2.5 text-sm font-bold ${msg.ok ? 'bg-teal-50 text-teal-700' : 'bg-coral-50'}`} data-testid={msg.ok ? 'oa-ok' : 'oa-error'}>{msg.text}</p>}
      {canSend && left <= 0 && !editing && <p className="text-sm font-bold text-teal-700" data-testid="oa-done">{t('oa.done')}</p>}
      {!canSend && <p className="text-sm font-bold text-ink-soft" data-testid="oa-closed">{t('oa.closed')}</p>}
      {mine.length > 0 && <div className="grid gap-1.5"><b className="text-sm">{t('oa.yours')}</b>
        <ul className="grid gap-1.5" data-testid="oa-mine">{mine.map(m => { const secs = Math.ceil((m.editUntil - now) / 1000);
          return <li key={m.id} className="flex items-center gap-2 rounded-xl border border-paper-line bg-white px-3 py-2">
            <span className="font-bold break-words min-w-0" dir="auto">{m.t}</span>
            {canSend && secs > 0 && o.editSec > 0 && <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-sm ms-auto" onClick={() => { setEditing(m.id); setText(m.t); setMsg(null); }}
              data-testid="oa-edit">{t('oa.edit')} <span className="text-xs text-ink-soft tabular-nums">{secs}s</span><span className="sr-only">: {m.t}</span></button>}</li>; })}</ul></div>}
      <p className="text-xs text-ink-soft">🔒 {t('oa.anon')}{o.moderation === 'approve' ? ` ${t('oa.review')}` : ''}</p>
    </div>
  );
}

// ---------------------------------------------------------------- projector ----------------------------------------------------------------
const PALETTE = ['#4c2fd6', '#0b6b5c', '#b33c0a', '#155ea6', '#a61e4d', '#226f33', '#5f3dc4', '#9c4a00']; // all ≥ 5.8:1 on white, readable on washed-out projectors
const hue = (k: string) => { let h = 0; for (const ch of k) h = (h * 31 + ch.codePointAt(0)!) >>> 0; return PALETTE[h % PALETTE.length]; };
export const MAX_CLOUD_WORDS = 120;

interface Placed { key: string; x: number; y: number; w: number; h: number; size: number }
/** The same font stack as the rendered words, so measured widths match what is drawn (Latin and Arabic). */
export const CLOUD_FONT = '"Plus Jakarta Sans", "Noto Sans Arabic", "Segoe UI", Tahoma, system-ui, sans-serif';
const ARABIC = /[\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]/;
let measureCtx: CanvasRenderingContext2D | null = null;
function measure(text: string, px: number): number {
  if (typeof document === 'undefined') return text.length * px * 0.62;
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * px * 0.62;
  measureCtx.font = `800 ${px}px ${CLOUD_FONT}`;
  return measureCtx.measureText(text).width * 1.04;           // small safety margin for font hinting differences
}
/**
 * Stable layout: every word keeps its centre once placed. When the cloud gets crowded, all words shrink around their own
 * centres (which can never create an overlap), and only new words search for a free spot on a spiral from the middle.
 * The scale only ever goes down while the box size stays the same, so the cloud grows calmly instead of reshuffling.
 * Size caps: the most repeated word is at most ~5.5x the smallest and never wider than 60% or taller than 22% of the
 * box, so one popular answer cannot take over the screen; long answers shrink to fit instead of overflowing.
 */
export function layoutCloud(words: CloudWord[], W: number, H: number, prev: Map<string, Placed>, prevScale = 1, remPx = 16): { placed: Placed[]; scale: number } {
  const max = Math.max(1, ...words.map(w => w.count)), fit = Math.min(1, W / 900 + 0.25);
  const base = (w: CloudWord) => cloudSize(w.count, max) * remPx * fit;
  const need = words.reduce((n, w) => { const b = base(w); return n + (measure(w.text, b) + 14) * b * 1.3; }, 0);
  const dens = Math.min(1, Math.sqrt((W * H * 0.6) / Math.max(1, need)));
  let scale = Math.min(prevScale, 1);
  if (dens < scale * 0.85) scale = dens;                       // only shrink in noticeable steps, so one new word changes nothing else
  const floor = 17 * Math.min(1, W / 700);                      // smallest words stay readable from the back of the room
  const box = (w: CloudWord, sc: number) => {
    let size = Math.min(Math.max(floor, base(w) * sc), H * 0.22);
    const width = measure(w.text, size);
    if (width > W * 0.6) size = Math.max(10, size * (W * 0.6) / width);
    const lh = ARABIC.test(w.text) ? 1.45 : 1.2;                 // Arabic needs more height for its marks
    return { size, w: measure(w.text, size) + 6, h: size * lh };
  };
  for (let tries = 0; tries < 14; tries++, scale *= 0.9) {
    const out: Placed[] = [];
    const hit = (r: { x: number; y: number; w: number; h: number }) => out.some(o => Math.abs(o.x - r.x) * 2 < o.w + r.w + 8 && Math.abs(o.y - r.y) * 2 < o.h + r.h + 2);
    const inside = (r: { x: number; y: number; w: number; h: number }) => r.x - r.w / 2 >= 4 && r.x + r.w / 2 <= W - 4 && r.y - r.h / 2 >= 4 && r.y + r.h / 2 <= H - 4;
    const fresh: CloudWord[] = [];
    for (const w of words) {                                   // 1) words already on screen keep their centre
      const p = prev.get(w.key); if (!p) { fresh.push(w); continue; }
      const r = { ...box(w, scale), x: p.x, y: p.y };
      if (inside(r) && !hit(r)) out.push({ key: w.key, ...r }); else fresh.push(w);
    }
    let ok = true;
    for (const w of fresh) {                                   // 2) new (or displaced) words: Archimedean spiral, wider than tall like a screen
      const r = { ...box(w, scale), x: 0, y: 0 };
      let found = false;
      for (let ang = 0, i = 0; i < 9000 && !found; i++) {
        const rad = 2.5 * ang;
        r.x = W / 2 + rad * Math.cos(ang) * 1.6; r.y = H / 2 + rad * Math.sin(ang);
        if (inside(r) && !hit(r)) found = true;
        ang += Math.min(0.4, 6 / Math.max(1, rad));
        if (rad > Math.max(W, H)) break;
      }
      if (!found) { ok = false; break; }
      out.push({ key: w.key, ...r });
    }
    if (ok) return { placed: out, scale };
  }
  return { placed: [], scale };
}

export const WordCloud = memo(function WordCloud({ words }: { words: CloudWord[] }) {
  const box = useRef<HTMLDivElement>(null), placed = useRef(new Map<string, Placed>()), scale = useRef({ w: 0, h: 0, s: 1, f: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [fonts, setFonts] = useState(0);
  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight }); return () => ro.disconnect();
  }, []);
  // web fonts (incl. Arabic) may arrive after the first layout: measure again once they are ready
  useEffect(() => { let on = true; document.fonts?.ready.then(() => { if (on) setFonts(f => f + 1); }).catch(() => {}); return () => { on = false; }; }, [words.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const layout = useMemo(() => {
    if (!size.w || !size.h) return [];
    if (scale.current.w !== size.w || scale.current.h !== size.h || scale.current.f !== fonts) { placed.current = new Map(); scale.current = { w: size.w, h: size.h, s: 1, f: fonts }; }
    const { placed: l, scale: sc } = layoutCloud(words, size.w, size.h, placed.current, scale.current.s);
    scale.current.s = sc; placed.current = new Map(l.map(p => [p.key, p])); return l;
  }, [words, size.w, size.h, fonts]);
  const byKey = new Map(words.map(w => [w.key, w]));
  return (
    <div ref={box} className="relative w-full h-full min-h-[320px] overflow-hidden" data-testid="oa-cloud">
      <ul className="sr-only">{words.map(w => <li key={w.key} dir="auto">{w.text}: {w.count}</li>)}</ul>
      {layout.map(p => { const w = byKey.get(p.key)!; return (
        <span key={p.key} aria-hidden dir="auto" data-testid="oa-word" data-count={w.count}
          className="absolute left-0 top-0 whitespace-nowrap font-extrabold select-none oa-word-in transition-[transform,font-size] duration-[600ms] ease-out motion-reduce:transition-none"
          style={{ transform: `translate(${p.x - p.w / 2}px, ${p.y - p.h / 2}px)`, fontSize: `${p.size}px`, lineHeight: `${p.h}px`, width: `${p.w}px`, textAlign: 'center',
            fontFamily: CLOUD_FONT, color: hue(p.key) }}>{w.text}</span>); })}
    </div>
  );
});

/** Answer wall: one card per distinct answer, in the order they arrived, so existing cards never move. */
export const AnswerWall = memo(function AnswerWall({ words }: { words: CloudWord[] }) {
  const recent = words.slice(-60);
  return (
    <ul className="grid gap-3 p-4 content-start overflow-hidden" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 18rem), 1fr))', fontFamily: CLOUD_FONT }} data-testid="oa-wall">
      {recent.map(w => <li key={w.key} className="rounded-2xl border-2 px-5 py-4 text-2xl sm:text-3xl font-extrabold oa-word-in break-words" style={{ borderColor: hue(w.key) }} dir="auto" data-testid="oa-word" data-count={w.count}>
        {w.text}{w.count > 1 && <span className="ms-2 text-base font-bold text-ink-soft tabular-nums">×{w.count}</span>}</li>)}
    </ul>
  );
});

/** Live list: ranked by how many people gave each answer. Rows glide to their new place instead of jumping. */
export const LiveList = memo(function LiveList({ words }: { words: CloudWord[] }) {
  const ranked = [...words].map((w, i) => ({ w, i })).sort((a, b) => b.w.count - a.w.count || a.i - b.i).slice(0, 12).map(x => x.w);
  const max = Math.max(1, ...ranked.map(w => w.count)), ROW = 56;
  return (
    <div className="relative m-4" style={{ height: ranked.length * ROW }} data-testid="oa-list">
      <ol className="sr-only">{ranked.map(w => <li key={w.key}>{w.text}: {w.count}</li>)}</ol>
      {ranked.map((w, i) => <div key={w.key} aria-hidden className="absolute inset-x-0 flex items-center gap-3" style={{ height: ROW - 8, transform: `translateY(${i * ROW}px)`, transition: 'transform 500ms ease' }} data-testid="oa-word" data-count={w.count}>
        <span className="w-8 text-xl font-extrabold text-ink-soft tabular-nums text-end">{i + 1}</span>
        <div className="relative flex-1 h-full rounded-xl bg-paper overflow-hidden">
          <div className="absolute inset-y-0 start-0 rounded-xl opacity-20" style={{ width: `${(100 * w.count) / max}%`, background: hue(w.key), transition: 'width 500ms ease' }} />
          <span className="relative flex h-full items-center px-4 text-2xl font-extrabold truncate" dir="auto">{w.text}</span>
        </div>
        <span className="w-12 text-2xl font-extrabold tabular-nums">{w.count}</span>
      </div>)}
    </div>
  );
});

/** Items the projector shows right now, the same for cloud, wall and list: approved, not removed, not shown before a clear, and only once answers are visible. */
export function visibleItems(o: OpenView | undefined): OpenViewItem[] {
  if (!o?.items || !o.visible) return [];
  return o.items.filter(x => x.s === 'shown' && (!o.clearedAt || (x.sa ?? x.at) > o.clearedAt));
}

export function OpenStage({ v }: { v: View }) {
  const o = v.open, items = visibleItems(o), display = v.activity?.open?.display ?? 'cloud';
  const words = useMemo(() => cloud(items.map(x => ({ text: x.t, key: x.k, status: 'shown' as const, at: x.at })))
    , [items.map(x => x.id + x.t).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0" data-testid="oa-stage">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1" aria-live="polite">
        <span className="text-3xl font-extrabold tabular-nums" data-testid="oa-n">{t('oa.onScreen', { n: words.reduce((m, w) => m + w.count, 0) })}</span>
        <span className="text-lg text-ink-soft tabular-nums" data-testid="oa-received">{t('oa.received', { n: o?.n ?? 0 })}{(o?.people ?? 0) > 0 ? ` · ${t('oa.people', { n: o!.people })}` : ''}</span>
        {v.phase === 'answer' && <span className="text-lg text-ink-soft ms-auto">📱 {t('oa.joinHint')}</span>}
      </div>
      <div className="rounded-3xl bg-white border border-paper-line flex-1 min-h-[340px] flex flex-col">
        {!o?.visible ? <p className="m-auto text-2xl font-bold text-ink-soft text-center px-6" data-testid="oa-hidden">🔒 {t('oa.hiddenUntil')}</p>
          : items.length === 0 ? <p className="m-auto text-2xl font-bold text-ink-soft text-center px-6" data-testid="oa-empty">{o.clearedAt ? t('oa.cleared') : t('oa.waiting')}</p>
          : display === 'wall' ? <AnswerWall words={words} /> : display === 'list' ? <LiveList words={words} /> : <WordCloud words={words.slice(0, MAX_CLOUD_WORDS)} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- host moderation ----------------------------------------------------------------
export function OpenModeration({ v, onCmd }: { v: View; onCmd: (cmd: OpenCmd, args?: { ids?: string[]; all?: boolean }) => Promise<void> | void }) {
  const o = v.open, a = v.activity;
  const [tab, setTab] = useState<'pending' | 'shown' | 'hidden'>('pending');
  const [busy, setBusy] = useState(false);
  if (!o || !a?.open) return null;
  const items = o.items ?? [];
  const by = { pending: items.filter(x => x.s === 'pending'), shown: items.filter(x => x.s === 'shown'), hidden: items.filter(x => x.s === 'hidden') };
  const run = async (cmd: OpenCmd, args?: { ids?: string[]; all?: boolean }) => { setBusy(true); try { await onCmd(cmd, args); } finally { setBusy(false); } };
  const approvable = by.pending.filter(x => !x.f).map(x => x.id);   // exactly what the host sees; later arrivals are not included
  // identical answers (same grouping key and status) are one row with a count, so a large group stays manageable;
  // Show / Remove act on every answer in the row. Newest first.
  const groups: { key: string; t: string; f: boolean; r?: string; ids: string[] }[] = [];
  for (const x of [...by[tab]].reverse()) {
    const g = groups.find(y => y.key === x.k && y.f === x.f);
    if (g) g.ids.push(x.id); else groups.push({ key: x.k, t: x.t, f: x.f, r: x.r, ids: [x.id] });
  }
  return (
    <section className="card p-4 grid gap-3" aria-label={t('oa.mod.title')} data-testid="oa-mod">
      <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-extrabold me-auto">🛡️ {t('oa.mod.title')}</h2>
        <span className="text-sm font-bold text-ink-soft tabular-nums" data-testid="oa-mod-received">{t('oa.mod.received', { n: o.n })}</span>
        <button type="button" className="btn-ghost" disabled={busy || !by.shown.length} onClick={() => run('open_clear')} data-testid="oa-clear">🧹 {t('oa.mod.clear')}</button>
      </div>
      {!o.visible && <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-violet-50 px-4 py-3" data-testid="oa-reveal-box">
        <span className="text-sm font-bold me-auto">{t('oa.mod.revealReady', { n: by.shown.length })}</span>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => run('open_reveal')} data-testid="oa-reveal">👁 {t('oa.mod.reveal')}</button></div>}
      <p className="text-xs text-ink-soft">🔒 {t('oa.mod.anon')}{a.open.moderation === 'live' ? ` ${t('oa.mod.live')}` : ''}</p>
      <div className="flex flex-wrap gap-2 items-center">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('oa.mod.title')}>
        {(['pending', 'shown', 'hidden'] as const).map(k => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`oa-tab-${k}`}
          className={`rounded-full px-3 py-1.5 text-sm font-bold border ${tab === k ? 'bg-violet-600 text-white border-violet-600' : 'border-paper-line'}`}>{t(`oa.mod.${k}` as never, { n: by[k].length })}</button>)}</div>
        {tab === 'pending' && approvable.length > 0 && <button type="button" className="btn-primary !min-h-[36px] text-sm ms-auto" disabled={busy} onClick={() => run('open_approve', { all: true, ids: approvable })} data-testid="oa-approve-all">{t('oa.mod.approveAll', { n: approvable.length })}</button>}
      </div>
      {groups.length === 0 ? <p className="text-sm text-ink-soft" data-testid="oa-mod-empty">{t('oa.mod.none')}</p>
        : <ul className="grid gap-1.5 max-h-[420px] overflow-auto" data-testid="oa-mod-list">{groups.map(x => (
          <li key={x.ids[0]} className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${x.f ? 'border-coral-500 bg-coral-50' : 'border-paper-line bg-white'}`} data-testid="oa-mod-item" data-flagged={x.f || undefined} data-n={x.ids.length}>
            <span className="font-bold break-words min-w-0" dir="auto">{x.t}</span>
            {x.ids.length > 1 && <span className="text-sm font-bold text-ink-soft tabular-nums" data-testid="oa-mod-n">×{x.ids.length}</span>}
            <span className="me-auto" />
            {x.f && <span className="chip bg-white text-xs font-bold" data-testid="oa-flag" data-reason={x.r}>⚠ {t(x.r === 'markup' ? 'oa.mod.flagMarkup' : 'oa.mod.flagged')}</span>}
            {tab !== 'shown' && <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-sm" disabled={busy} onClick={() => run('open_approve', { ids: x.ids })} aria-label={`${t(tab === 'hidden' ? 'oa.mod.restore' : 'oa.mod.approve')}: ${x.t}`} data-testid="oa-approve">{t(tab === 'hidden' ? 'oa.mod.restore' : 'oa.mod.approve')}</button>}
            {tab !== 'hidden' && <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-sm text-[#B03A22]" disabled={busy} onClick={() => run('open_hide', { ids: x.ids })} aria-label={`${t('oa.mod.hide')}: ${x.t}`} data-testid="oa-hide">{t('oa.mod.hide')}</button>}
          </li>))}</ul>}
    </section>
  );
}
