import { FOCUS_MAX, FOCUS_MIN } from '../lib/focus';
import { cx } from './ui';

const VALUES = Array.from({ length: FOCUS_MAX - FOCUS_MIN + 1 }, (_, i) => FOCUS_MIN + i);

/**
 * Fokus 1–10 mit einem Tipp. Ist der Wert nur ein automatischer Vorschlag,
 * wird er gestrichelt markiert, bis er bestätigt (gespeichert) wird.
 */
export function FocusPicker({
  value,
  onChange,
  suggestion,
  id,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  /** aktueller Wert ist ein unbestätigter Vorschlag */
  suggestion?: boolean;
  id?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        id={id}
        tabIndex={-1}
        role="radiogroup"
        aria-label="Fokus von 1 (sehr abgelenkt) bis 10 (sehr fokussiert)"
        className={cx('grid gap-1.5', compact ? 'grid-cols-10' : 'grid-cols-5 sm:grid-cols-10')}
      >
        {VALUES.map((n) => {
          const selected = value === String(n);
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(String(n))}
              className={cx(
                'rounded-xl text-base font-medium tabular transition-colors',
                compact ? 'min-h-10' : 'min-h-11',
                selected && !suggestion && 'bg-moss-800 text-white dark:bg-moss-600',
                selected &&
                  suggestion &&
                  'bg-amber-100 text-amber-950 outline-2 outline-offset-[-2px] outline-amber-500 outline-dashed dark:bg-amber-900/50 dark:text-amber-100',
                !selected &&
                  'bg-stone-100 text-stone-700 ring-1 ring-stone-200 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-700 dark:hover:bg-stone-700',
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      {!compact && (
        <div className="flex justify-between text-xs text-stone-500 dark:text-stone-400">
          <span>1 = sehr abgelenkt</span>
          <span>10 = sehr fokussiert</span>
        </div>
      )}
    </div>
  );
}
