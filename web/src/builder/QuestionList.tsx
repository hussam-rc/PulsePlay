// Question list for banks of any size (Creator Studio C4a): compact rows, search, filters, expand-to-edit with
// Previous / Next, and a progressive "show all" mode. Only the open question renders its full editing card.
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { Activity } from '../engine/schema';
import { tagLabel } from './bankModel';
import { ACTIVITY_LABEL, GameKind, KINDS } from './model';
import { QuestionEditor, type BankGroups, type QuestionApi } from './QuestionEditor';
import { NO_FILTER, NO_GROUP, filterActivities, highlight, isFiltered, searchText, topScore, type ListFilter, type StatusFilter } from './listModel';
import { CHANGE_LABEL, summaryText, type Change, type DupIssue, type VersionDiff } from './qualityModel';

export const COMPACT_FROM = 16;       // banks this size or larger open in the compact view
const PAGE = 40;                      // "Show all" renders this many full cards at a time
type View = 'compact' | 'all';
/** `view` is only stored once the creator picks one; until then the size of the bank at load decides. */
interface UiState { view: View | null; filter: ListFilter; open: string | null }

const textCache = new WeakMap<Activity, string>();
const cachedText = (a: Activity) => { let t = textCache.get(a); if (t == null) { t = searchText(a); textCache.set(a, t); } return t; };

export function QuestionList({ acts, kind, bank, groupOptions, groupKey, problemIds, dups, diff, api, focus, storageKey }: {
  acts: Activity[]; kind: GameKind; bank: BankGroups | null; groupOptions: { tag: string; label: string }[]; groupKey: 'category' | 'dimension';
  problemIds: Set<string>; dups: Map<string, DupIssue[]>; diff: VersionDiff | null; api: QuestionApi; focus: number; storageKey?: string;
}) {
  const key = storageKey ? `pp_qlist:${storageKey}` : null;
  const [ui, setUi] = useState<UiState>(() => {
    const fallback: UiState = { view: null, filter: { ...NO_FILTER, groupKey }, open: null };
    if (!key) return fallback;
    try { const s = JSON.parse(sessionStorage.getItem(key) || 'null'); return s ? { ...fallback, ...s, filter: { ...fallback.filter, ...s.filter, groupKey } } : fallback; } catch { return fallback; }
  });
  useEffect(() => { if (key) try { sessionStorage.setItem(key, JSON.stringify(ui)); } catch { /* storage blocked: state lasts this page */ } }, [key, ui]);
  const [autoView] = useState<View>(() => (acts.length >= COMPACT_FROM ? 'compact' : 'all'));
  const view: View = ui.view ?? autoView;
  const [limit, setLimit] = useState(PAGE);
  const f = ui.filter, setF = (p: Partial<ListFilter>) => { setUi(u => ({ ...u, filter: { ...u.filter, ...p } })); setLimit(PAGE); };
  const query = useDeferredValue(f.query);

  const index = useMemo(() => new Map(acts.map(a => [a.id, cachedText(a)])), [acts]);
  const pos = useMemo(() => new Map(acts.map((a, i) => [a.id, i])), [acts]);
  const dupIds = useMemo(() => new Set(dups.keys()), [dups]);
  const changedIds = useMemo(() => new Set(diff?.changes.keys() ?? []), [diff]);
  const shown = useMemo(() => filterActivities(acts, { ...f, query, groupKey }, { problems: problemIds, duplicates: dupIds, changed: changedIds }, index), [acts, f, query, groupKey, problemIds, dupIds, changedIds, index]);
  const filtered = isFiltered({ ...f, query });

  // open the question a creator just added or duplicated, so they can type straight away
  const prevIds = useRef(new Set(acts.map(a => a.id)));
  useEffect(() => {
    const added = acts.filter(a => !prevIds.current.has(a.id));
    prevIds.current = new Set(acts.map(a => a.id));
    if (added.length === 1 && view === 'compact') openQ(added[0].id);
    if (ui.open && !pos.has(ui.open)) setUi(u => ({ ...u, open: null }));
  }, [acts]); // eslint-disable-line react-hooks/exhaustive-deps

  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const editorRef = useRef<HTMLDivElement>(null);
  const focusAfter = useRef<{ id: string; to: 'editor' | 'row' } | null>(null);
  useEffect(() => {
    const t = focusAfter.current; if (!t) return; focusAfter.current = null;
    if (t.to === 'editor') {
      const el = editorRef.current; if (!el) return;
      el.scrollIntoView({ block: 'nearest' });
      (el.querySelector('[data-testid=q-prompt]') as HTMLElement | null)?.focus({ preventScroll: true });
    } else { const r = rowRefs.current.get(t.id); r?.focus({ preventScroll: true }); r?.scrollIntoView({ block: 'nearest' }); }
  });
  function openQ(id: string) { focusAfter.current = { id, to: 'editor' }; setUi(u => ({ ...u, open: id })); const i = pos.get(id); if (i != null) api.focus(i); }
  function closeQ(id: string) { focusAfter.current = { id, to: 'row' }; setUi(u => ({ ...u, open: null })); }

  const shownIdx = (id: string) => shown.findIndex(a => a.id === id);
  const nav = (id: string) => {
    const k = shownIdx(id);
    return { prev: k > 0 ? () => openQ(shown[k - 1].id) : null, next: k >= 0 && k < shown.length - 1 ? () => openQ(shown[k + 1].id) : null,
      done: () => closeQ(id), pos: k >= 0 ? `${k + 1} of ${shown.length}` : '' };
  };
  const onRowKey = (e: React.KeyboardEvent, id: string) => {
    const k = shownIdx(id), go = (j: number) => { const t = shown[Math.max(0, Math.min(shown.length - 1, j))]; if (t) rowRefs.current.get(t.id)?.focus(); };
    if (e.key === 'ArrowDown') { e.preventDefault(); go(k + 1); } else if (e.key === 'ArrowUp') { e.preventDefault(); go(k - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); } else if (e.key === 'End') { e.preventDefault(); go(shown.length - 1); }
  };
  // stable callbacks so unchanged rows never re-render while the creator types
  const latest = useRef({ openQ, onRowKey }); latest.current = { openQ, onRowKey };
  const stableOpen = useCallback((id: string) => latest.current.openQ(id), []);
  const stableKey = useCallback((e: React.KeyboardEvent, id: string) => latest.current.onRowKey(e, id), []);
  const refCbs = useRef(new Map<string, (el: HTMLButtonElement | null) => void>());
  const refFor = (id: string) => { let f = refCbs.current.get(id); if (!f) { f = el => { if (el) rowRefs.current.set(id, el); else rowRefs.current.delete(id); }; refCbs.current.set(id, f); } return f; };
  const types = KINDS[kind].activity;
  const groupWord = groupKey === 'dimension' ? 'area' : 'category';
  const nProblems = problemIds.size, nArchived = acts.filter(a => a.active === false).length;

  return (
    <div className="grid gap-3" data-testid="qlist" data-view={view}>
      <div className="grid gap-2 sticky top-0 z-20 -mx-2 px-2 py-2 bg-white/95 backdrop-blur rounded-xl" role="search">
        <div className="flex flex-wrap gap-2 items-center">
          <input type="search" className="field !min-h-[44px] flex-1 min-w-[12rem]" placeholder="Search questions and answers" aria-label="Search questions and answers"
            value={f.query} onChange={e => setF({ query: e.target.value })} data-testid="q-search" />
          <div className="flex rounded-xl border border-paper-line overflow-hidden" role="group" aria-label="Question view">
            <button type="button" aria-pressed={view === 'compact'} onClick={() => setUi(u => ({ ...u, view: 'compact' }))} data-testid="view-compact"
              className={`px-3 min-h-[44px] text-sm font-bold ${view === 'compact' ? 'bg-violet-600 text-white' : 'bg-white'}`}>☰ Compact</button>
            <button type="button" aria-pressed={view === 'all'} onClick={() => { setUi(u => ({ ...u, view: 'all', open: null })); setLimit(PAGE); }} data-testid="view-all"
              className={`px-3 min-h-[44px] text-sm font-bold ${view === 'all' ? 'bg-violet-600 text-white' : 'bg-white'}`}>▤ Show all</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {groupOptions.length > 0 && <select className="field !min-h-[40px] !w-auto !text-sm" aria-label={`Filter by ${groupWord}`} value={f.group} onChange={e => setF({ group: e.target.value })} data-testid="f-group">
            <option value="">All {groupWord === 'area' ? 'areas' : 'categories'}</option>
            {groupOptions.map(g => <option key={g.tag} value={g.tag}>{g.label}</option>)}<option value={NO_GROUP}>No {groupWord}</option></select>}
          <select className="field !min-h-[40px] !w-auto !text-sm" aria-label="Filter by status" value={f.status} onChange={e => setF({ status: e.target.value as StatusFilter })} data-testid="f-status">
            <option value="all">All statuses</option><option value="active">In use</option><option value="archived">Archived ({nArchived})</option><option value="problems">Needs fixing ({nProblems})</option><option value="duplicates">Possible duplicates ({dupIds.size})</option>{diff && <option value="changed">Changed since v{diff.version} ({changedIds.size})</option>}</select>
          {types.length > 1 && <select className="field !min-h-[40px] !w-auto !text-sm" aria-label="Filter by question type" value={f.type} onChange={e => setF({ type: e.target.value as ListFilter['type'] })} data-testid="f-type">
            <option value="all">All types</option>{types.map(t => <option key={t} value={t}>{ACTIVITY_LABEL[t].split(' (')[0]}</option>)}</select>}
          <span className="text-sm text-ink-soft ms-auto" aria-live="polite" data-testid="q-count">{filtered ? `${shown.length} of ${acts.length} questions` : `${acts.length} question${acts.length === 1 ? '' : 's'}`}</span>
          {filtered && <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-sm" onClick={() => setF({ query: '', group: '', status: 'all', type: 'all' })} data-testid="f-clear">Clear</button>}
        </div>
      </div>

      {diff && <div className="flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 p-2 text-sm" data-testid="q-changes">
        <span className="me-auto" aria-live="polite">{summaryText(diff)}</span>
        {changedIds.size > 0 && f.status !== 'changed' && <button type="button" className="btn-ghost !min-h-[32px] !px-3 text-sm" onClick={() => setF({ status: 'changed' })} data-testid="q-show-changes">Show changed</button>}
        {diff.deleted.length > 0 && <details className="w-full"><summary className="cursor-pointer font-bold">Deleted since version {diff.version} ({diff.deleted.length})</summary>
          <ul className="list-disc ps-5">{diff.deleted.map(x => <li key={x.id} dir="auto">{x.prompt || x.id}</li>)}</ul></details>}</div>}
      {shown.length === 0 && <p className="rounded-xl bg-paper p-4 text-sm text-ink-soft" data-testid="q-empty">No question matches. Try fewer words or clear the filters.</p>}

      {view === 'compact'
        ? <ul className="grid gap-1.5" aria-label="Questions">{shown.map(a => {
            const i = pos.get(a.id)!;
            return <li key={a.id}>{ui.open === a.id
              ? <div ref={editorRef}><QuestionEditor a={a} i={i} total={acts.length} kind={kind} bank={bank} api={api} focused={i === focus} nav={nav(a.id)} /></div>
              : <Row a={a} i={i} query={query} groupKey={groupKey} groupOptions={groupOptions} problem={problemIds.has(a.id)} focused={i === focus} dup={dups.get(a.id)?.[0]?.kind} change={diff?.changes.get(a.id)}
                  refFn={refFor(a.id)} onOpen={stableOpen} onKey={stableKey} />}</li>;
          })}</ul>
        : <div className="grid gap-3">
            {shown.slice(0, limit).map(a => { const i = pos.get(a.id)!; return <QuestionEditor key={a.id} a={a} i={i} total={acts.length} kind={kind} bank={bank} api={api} focused={i === focus} />; })}
            {shown.length > limit && <button type="button" className="btn-ghost justify-self-center" onClick={() => setLimit(l => l + PAGE)} data-testid="show-more">
              Show {Math.min(PAGE, shown.length - limit)} more ({shown.length - limit} left)</button>}
          </div>}
    </div>
  );
}

const Row = memo(function Row({ a, i, query, groupKey, groupOptions, problem, focused, dup, change, refFn, onOpen, onKey }: {
  a: Activity; i: number; query: string; groupKey: 'category' | 'dimension'; groupOptions: { tag: string; label: string }[]; problem: boolean; focused: boolean;
  dup?: DupIssue['kind']; change?: Change;
  refFn: (el: HTMLButtonElement | null) => void; onOpen: (id: string) => void; onKey: (e: React.KeyboardEvent, id: string) => void;
}) {
  const archived = a.active === false, tag = a[groupKey], top = topScore(a);
  const label = tag ? groupOptions.find(g => g.tag === tag)?.label ?? tagLabel(tag) : null;
  const answerHit = query.trim() && 'options' in a ? a.options.find(o => highlight(o.text, query).some(p => p.hit)) : undefined;
  return (
    <button type="button" ref={refFn} id={`q-${i + 1}`} aria-expanded={false} onClick={() => onOpen(a.id)} onKeyDown={e => onKey(e, a.id)} data-testid="q-row" data-id={a.id}
      className={`w-full text-start rounded-xl border px-3 py-2 grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2 items-center scroll-mt-28 min-h-[52px] hover:border-violet-500
        ${focused ? 'border-violet-500' : 'border-paper-line'} ${archived ? 'bg-paper text-ink-soft' : 'bg-white'}`}>
      <span className="text-sm font-extrabold tabular-nums text-ink-soft">{i + 1}</span>
      <span className="min-w-0 grid gap-0.5">
        <span className="truncate font-bold" dir="auto" data-testid="q-row-prompt">{a.prompt.trim() ? highlight(a.prompt, query).map((p, k) => p.hit ? <mark key={k} className="bg-sun-50 rounded px-0.5">{p.text}</mark> : <span key={k}>{p.text}</span>) : <i className="text-ink-soft font-normal">Empty question</i>}</span>
        {answerHit && <span className="truncate text-xs text-ink-soft" dir="auto">↳ {highlight(answerHit.text, query).map((p, k) => p.hit ? <mark key={k} className="bg-sun-50 rounded px-0.5">{p.text}</mark> : <span key={k}>{p.text}</span>)}</span>}
        <span className="flex flex-wrap gap-1 text-xs">
          {label && <span className="rounded-full bg-violet-50 px-2 py-0.5 font-bold">{label}</span>}
          {archived && <span className="rounded-full bg-sun-50 px-2 py-0.5 font-bold">Archived</span>}
          {problem && <span className="rounded-full bg-coral-50 px-2 py-0.5 font-bold" data-testid="q-row-problem">⚠ Needs fixing</span>}
          {change && <span className="rounded-full bg-sky-50 px-2 py-0.5 font-bold" data-testid="q-row-change" data-change={change}>{CHANGE_LABEL[change]}</span>}
          {dup && <span className="rounded-full bg-sun-50 px-2 py-0.5 font-bold" data-testid="q-row-dup">{dup === 'answers' ? 'Repeated answer' : dup === 'same' ? 'Duplicate' : 'Very similar'}</span>}
          {top != null && <span className="rounded-full bg-paper px-2 py-0.5">up to {top} pts</span>}
          {a.type !== 'choice' && <span className="rounded-full bg-paper px-2 py-0.5">{ACTIVITY_LABEL[a.type].split(' (')[0]}</span>}
          {'options' in a && <span className="text-ink-soft">{a.options.length} answers</span>}
        </span>
      </span>
    </button>
  );
});
