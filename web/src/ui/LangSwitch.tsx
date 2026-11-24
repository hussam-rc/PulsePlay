import { LOCALES, Locale, lang, setLang, t } from '../i18n';

/** Interface language for this device only. Game content keeps the language its creator wrote it in. */
export function LangSwitch({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  return <label className={`inline-flex items-center gap-1 text-sm font-bold ${className}`}>
    <span aria-hidden className={compact ? "hidden sm:inline" : ""}>🌐</span><span className="sr-only">{t('lang.label')}</span>
    <select value={lang()} onChange={e => setLang(e.target.value as Locale)} className="bg-transparent rounded-lg border border-paper-line px-1.5 py-1" data-testid="lang" aria-label={t('lang.label')}>
      {(Object.keys(LOCALES) as Locale[]).map(l => <option key={l} value={l}>{compact ? l.toUpperCase() : LOCALES[l].label}</option>)}
    </select>
  </label>;
}
