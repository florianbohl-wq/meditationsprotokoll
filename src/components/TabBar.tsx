import { cx } from './ui';

export type Tab = 'sitzen' | 'protokoll' | 'statistik' | 'einstellungen';

const ICONS: Record<Tab, JSX.Element> = {
  sitzen: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M16.6 5.4A8 8 0 1 0 20 12" />
    </svg>
  ),
  protokoll: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  ),
  statistik: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M5 20V12M12 20V5M19 20v-9M3 20h18" />
    </svg>
  ),
  einstellungen: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  ),
};

const LABELS: Record<Tab, string> = {
  sitzen: 'Sitzen',
  protokoll: 'Protokoll',
  statistik: 'Statistik',
  einstellungen: 'Einstellungen',
};

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95"
      aria-label="Hauptnavigation"
    >
      <ul className="mx-auto flex max-w-xl md:max-w-5xl">
        {(Object.keys(LABELS) as Tab[]).map((t) => (
          <li key={t} className="flex-1">
            <button
              type="button"
              onClick={() => onChange(t)}
              aria-current={tab === t ? 'page' : undefined}
              className={cx(
                'flex w-full flex-col items-center gap-0.5 pt-2 pb-2 text-xs font-medium transition-colors md:flex-row md:justify-center md:gap-2 md:py-3 md:text-sm',
                tab === t
                  ? 'text-moss-800 dark:text-moss-300'
                  : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200',
              )}
            >
              {ICONS[t]}
              {LABELS[t]}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
