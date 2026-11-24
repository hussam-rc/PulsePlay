import type { PublicActivity } from '../live/view';
import type { ResponseValue } from '../engine/scoring';
import { order } from '../engine/random';
import { t } from '../i18n';

const LETTER = 'ABCDEF';
const TONES = ['bg-violet-600', 'bg-sky-500', 'bg-teal-500', 'bg-sun-500', 'bg-coral-500', 'bg-ink'];

/** Renders the answer controls for one activity on a phone or in solo play. */
export function ActivityInput({ activity: a, seed, value, disabled, onPick, correctId }: {
  activity: PublicActivity; seed: string; value: ResponseValue | undefined; disabled: boolean;
  onPick: (v: ResponseValue) => void; correctId?: string | null;
}) {
  if ((a.type === 'choice' || a.type === 'poll') && a.options) {
    const opts = a.options;
    const idx = a.shuffle ? order(seed, a.id, opts.length) : opts.map((_, i) => i);
    return (
      <div className="grid gap-2.5" role="group" aria-label={t('phone.options')}>
        {idx.map((oi, k) => {
          const o = opts[oi];
          const picked = value === o.id;
          const correct = correctId != null && correctId === o.id;
          return (
            <button key={o.id} data-option={o.id} disabled={disabled} onClick={() => onPick(o.id)}
              className={`flex items-center gap-3 text-start w-full min-h-[58px] px-3.5 py-3 rounded-2xl border-2 font-bold text-[16.5px] transition
                ${picked ? 'border-violet-600 bg-violet-50' : 'border-paper-line bg-white'} ${correct ? '!border-teal-500 !bg-teal-50' : ''}
                ${disabled && !picked && !correct ? 'opacity-55' : ''} ${!disabled ? 'hover:border-violet-500 hover:-translate-y-px' : ''}`}>
              <span className={`shrink-0 w-9 h-9 rounded-xl grid place-items-center text-white text-sm ${TONES[k]}`}>{o.emoji ? o.emoji : LETTER[k]}</span>
              <span dir="auto">{o.text}</span>
              {correct && <span className="ms-auto" aria-label="correct answer">✅</span>}
            </button>
          );
        })}
      </div>
    );
  }
  if (a.type === 'scale' && a.min != null && a.max != null) {
    const min = a.min, max = a.max;
    return (
      <div className="grid gap-2">
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Scale">
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(n => (
            <button key={n} disabled={disabled} onClick={() => onPick(n)}
              className={`w-12 h-12 rounded-xl border-2 font-extrabold ${value === n ? 'border-violet-600 bg-violet-50' : 'border-paper-line bg-white'}`}>{n}</button>
          ))}
        </div>
        <div className="flex justify-between text-sm text-ink-soft"><span>{a.minLabel}</span><span>{a.maxLabel}</span></div>
      </div>
    );
  }
  return <ReflectionInput disabled={disabled} onSubmit={onPick} />;
}

function ReflectionInput({ disabled, onSubmit }: { disabled: boolean; onSubmit: (v: string) => void }) {
  return (
    <form className="grid gap-2" onSubmit={e => { e.preventDefault(); const v = (new FormData(e.currentTarget).get('r') as string || '').trim(); if (v) onSubmit(v); }}>
      <label className="text-sm font-bold" htmlFor="refl">{t('phone.note')}</label>
      <textarea id="refl" name="r" maxLength={500} rows={3} disabled={disabled} className="field py-3" />
      <button className="btn-primary" disabled={disabled}>{t('phone.save')}</button>
    </form>
  );
}
