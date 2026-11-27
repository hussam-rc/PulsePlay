// Small form controls shared by the builder and the question editor.
import { ReactNode, useState } from 'react';
import { newId } from './model';

export function Text({ label, hint, value, onChange, max, area, narrow, testid }: { label: string; hint?: string; value: string; onChange: (v: string) => void; max: number; area?: boolean; narrow?: boolean; testid?: string }) {
  const [id] = useState(() => newId('f'));
  const p = { id, value, maxLength: max, onChange: (e: { target: { value: string } }) => onChange(e.target.value), 'data-testid': testid };
  return <label htmlFor={id} className={`grid gap-1 ${narrow ? 'w-20' : ''}`}><span className="text-sm font-bold">{label}</span>
    {area ? <textarea {...p} rows={2} className="field py-2 !text-base" /> : <input {...p} className="field !min-h-[44px] !text-base" />}
    {hint && <span className="text-xs text-ink-soft">{hint}</span>}{!narrow && value.length > max * 0.8 && <span className="text-xs text-ink-soft">{value.length}/{max}</span>}</label>;
}
export function Num({ label, hint, value, onChange, min, max }: { label: string; hint?: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  const [id] = useState(() => newId('f'));
  return <label htmlFor={id} className="grid gap-1"><span className="text-sm font-bold">{label}</span>
    <input id={id} type="number" inputMode="numeric" min={min} max={max} value={Number.isFinite(value) ? value : ''} onChange={e => onChange(Math.round(+e.target.value))} className="field !min-h-[44px] !text-base w-28" />
    {hint && <span className="text-xs text-ink-soft">{hint}</span>}</label>;
}
export function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const [id] = useState(() => newId('f'));
  return <label htmlFor={id} className="grid gap-1"><span className="text-sm font-bold">{label}</span>
    <select id={id} value={value} onChange={e => onChange(e.target.value as T)} className="field !min-h-[44px] !text-base">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}
export function Slider({ label, unit, value, min, max, onChange }: { label: string; unit: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const [id] = useState(() => newId('f'));
  return <label htmlFor={id} className="grid gap-1"><span className="text-sm font-bold">{label}: {value}{unit}</span>
    <input id={id} type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)} className="accent-violet-600" /></label>;
}
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 font-bold text-sm"><input type="checkbox" className="w-5 h-5 accent-violet-600" checked={checked} onChange={e => onChange(e.target.checked)} />{label}</label>;
}
export function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="w-9 h-9 rounded-lg border border-paper-line bg-white disabled:opacity-30 hover:bg-paper">{children}</button>;
}
