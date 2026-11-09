import { useMemo } from 'react';
import type { Posture, Session } from '../types';
import { DEFAULT_FILTERS, type Filters } from '../lib/filters';
import { sortNewestFirst } from '../lib/sessions';
import { formatDateDE, formatMinutes, weekdayShort } from '../lib/time';
import { useLocalState, useMediaQuery } from '../lib/hooks';
import { FilterBar } from '../components/FilterPanel';
import { Button, cx, EmptyState } from '../components/ui';

interface Props {
  total: number;
  sessions: Session[];
  filtered: Session[];
  filters: Filters;
  setFilters: (f: Filters) => void;
  postures: Posture[];
  onOpen: (id: string) => void;
  onNew: () => void;
}

type View = 'auto' | 'cards' | 'table';

export function LogScreen(p: Props) {
  const wide = useMediaQuery('(min-width: 768px)');
  const [viewPref, setViewPref] = useLocalState<View>('logView', 'auto');
  const view: 'cards' | 'table' = viewPref === 'auto' ? (wide ? 'table' : 'cards') : viewPref;
  const list = useMemo(() => sortNewestFirst(p.filtered), [p.filtered]);
  const minutes = list.reduce((a, s) => a + s.durationMinutes, 0);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Protokoll</h1>
        <div className="flex gap-2">
          <div className="flex rounded-xl ring-1 ring-stone-300 dark:ring-stone-700" role="group" aria-label="Ansicht">
            {(['cards', 'table'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setViewPref(v)}
                className={cx(
                  'min-h-11 px-3 text-sm first:rounded-l-xl last:rounded-r-xl',
                  view === v ? 'bg-moss-800 text-white dark:bg-moss-600' : 'text-stone-600 dark:text-stone-300',
                )}
              >
                {v === 'cards' ? 'Karten' : 'Tabelle'}
              </button>
            ))}
          </div>
          <Button variant="primary" onClick={p.onNew} aria-label="Neuer Eintrag" className="px-3">
            + <span className="hidden sm:inline">Neu</span>
          </Button>
        </div>
      </header>

      {p.total === 0 ? (
        <EmptyState title="Noch keine Einträge">
          <p className="text-stone-500 dark:text-stone-400">Starte eine Sitzung oder erfasse einen Eintrag nachträglich.</p>
          <Button variant="primary" onClick={p.onNew}>
            Ersten Eintrag erfassen
          </Button>
        </EmptyState>
      ) : (
        <>
          <FilterBar filters={p.filters} setFilters={p.setFilters} postures={p.postures} sessions={p.sessions} />

          <p className="text-sm text-stone-600 dark:text-stone-400" aria-live="polite">
            <strong className="text-stone-900 dark:text-stone-100">{list.length}</strong>{' '}
            {list.length === 1 ? 'Eintrag' : 'Einträge'} · <strong className="text-stone-900 dark:text-stone-100">{minutes}</strong> Min.
          </p>

          {list.length === 0 ? (
            <EmptyState title="Keine Treffer">
              <p className="text-stone-500 dark:text-stone-400">Für diese Filter gibt es keine Einträge.</p>
              <Button onClick={() => p.setFilters(DEFAULT_FILTERS)}>Filter zurücksetzen</Button>
            </EmptyState>
          ) : view === 'cards' ? (
            <ul className="flex flex-col gap-3">
              {list.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => p.onOpen(s.id)}
                    className="w-full rounded-2xl bg-white p-4 text-left ring-1 ring-stone-200 transition-colors hover:bg-stone-100 dark:bg-stone-900 dark:ring-stone-800 dark:hover:bg-stone-800"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">
                        {weekdayShort(s.date)}, {formatDateDE(s.date)}
                        {s.startTime && <span className="font-normal text-stone-500 dark:text-stone-400"> · {s.startTime}</span>}
                      </span>
                      <span className="shrink-0 font-semibold text-moss-800 tabular dark:text-moss-300">{formatMinutes(s.durationMinutes)}</span>
                    </div>
                    <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                      {s.anchor}
                      {s.posture && <span className="text-stone-400 dark:text-stone-500"> · {s.posture}</span>}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">{s.observation}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead className="border-b border-stone-200 text-stone-500 dark:border-stone-800 dark:text-stone-400">
                  <tr>
                    {['Datum', 'Zeit', 'Tageszeit', 'Dauer', 'Anker', 'Beobachtung', 'Haltung', 'Ort', 'Hintergrund'].map((h) => (
                      <th key={h} className="px-3 py-3 font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => (
                    <tr
                      key={s.id}
                      tabIndex={0}
                      onClick={() => p.onOpen(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          p.onOpen(s.id);
                        }
                      }}
                      className="cursor-pointer border-b border-stone-100 align-top last:border-0 hover:bg-stone-50 focus:bg-moss-50 dark:border-stone-800 dark:hover:bg-stone-800 dark:focus:bg-stone-800"
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap tabular">{formatDateDE(s.date)}</td>
                      <td className="px-3 py-2.5 tabular">{s.startTime ?? ''}</td>
                      <td className="px-3 py-2.5">{s.timeOfDay ?? ''}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap tabular">{s.durationMinutes} Min.</td>
                      <td className="max-w-48 px-3 py-2.5">{s.anchor}</td>
                      <td className="max-w-80 px-3 py-2.5">
                        <span className="line-clamp-2">{s.observation}</span>
                      </td>
                      <td className="px-3 py-2.5">{s.posture ?? ''}</td>
                      <td className="px-3 py-2.5">{s.location ?? ''}</td>
                      <td className="px-3 py-2.5">{s.background ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
