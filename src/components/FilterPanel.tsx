import { useState } from 'react';
import { TIMES_OF_DAY, type Option, type OptionKind, type Session } from '../types';
import { FIELD } from '../lib/options';
import { activeFilterChips, DEFAULT_FILTERS, NO_VALUE, RANGE_LABELS, type Filters, type RangeKey } from '../lib/filters';
import { Button, Chip, cx, Field, inputClass } from './ui';

interface Props {
  filters: Filters;
  setFilters: (f: Filters) => void;
  options: Option[];
  sessions: Session[];
  /** Freitextsuche anzeigen (im Protokoll ja) */
  withSearch?: boolean;
}

/** Filterleiste: Suchfeld, Button zum Ausklappen, aktive Filter als entfernbare Chips. */
export function FilterBar({ filters, setFilters, options, sessions, withSearch = true }: Props) {
  const [open, setOpen] = useState(false);
  const chips = activeFilterChips(filters);
  const panelChips = chips.filter((c) => c.key !== 'text');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {withSearch && (
          <input
            type="search"
            aria-label="Suche"
            placeholder="Suchen in Anker, Beobachtung, Ort …"
            className={inputClass() + ' flex-1'}
            value={filters.text}
            onChange={(e) => setFilters({ ...filters, text: e.target.value })}
          />
        )}
        <Button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={cx(!withSearch && 'w-full md:w-auto')}
          variant={open ? 'primary' : 'secondary'}
        >
          Filter{panelChips.length ? ` (${panelChips.length})` : ''}
        </Button>
      </div>

      {open && <FilterPanel filters={filters} setFilters={setFilters} options={options} sessions={sessions} />}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilters(c.clear(filters))}
              className="flex min-h-9 items-center gap-1.5 rounded-full bg-moss-100 py-1 pr-2 pl-3 text-sm text-moss-900 hover:bg-moss-200 dark:bg-moss-900 dark:text-moss-100 dark:hover:bg-moss-800"
              aria-label={`Filter entfernen: ${c.label}`}
            >
              {c.label}
              <span aria-hidden="true" className="text-base leading-none">
                ×
              </span>
            </button>
          ))}
          {chips.length > 1 && (
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="min-h-9 px-2 text-sm text-stone-500 underline underline-offset-2 dark:text-stone-400"
            >
              Alle zurücksetzen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Alle Werte einer Liste inkl. archivierter und solcher, die nur noch in Einträgen vorkommen. */
function valuesFor(kind: OptionKind, options: Option[], sessions: Session[]): string[] {
  const names = options.filter((o) => o.kind === kind).sort((a, b) => a.order - b.order).map((o) => o.name);
  const extra = new Set<string>();
  for (const s of sessions) {
    const v = s[FIELD[kind]];
    if (v && !names.includes(v)) extra.add(v);
  }
  return [...names, ...[...extra].sort((a, b) => a.localeCompare(b, 'de'))];
}

function FilterPanel({ filters: f, setFilters, options, sessions }: Omit<Props, 'withSearch'>) {
  const set = (patch: Partial<Filters>) => setFilters({ ...f, ...patch });

  const selects: { kind: OptionKind; key: 'posture' | 'anchor' | 'location'; label: string; withEmpty: boolean }[] = [
    { kind: 'anchor', key: 'anchor', label: 'Anker', withEmpty: false },
    { kind: 'posture', key: 'posture', label: 'Haltung', withEmpty: true },
    { kind: 'location', key: 'location', label: 'Ort', withEmpty: true },
  ];

  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-white p-4 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
      <Field label="Zeitraum">
        <div className="flex flex-wrap gap-2">
          {(['7', '30', 'year', 'all', 'custom'] as RangeKey[]).map((r) => (
            <Chip key={r} selected={f.range === r} onClick={() => set({ range: r })}>
              {RANGE_LABELS[r]}
            </Chip>
          ))}
        </div>
        {f.range === 'custom' && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <input type="date" aria-label="Von" className={inputClass()} value={f.from} onChange={(e) => set({ from: e.target.value })} />
            <input type="date" aria-label="Bis" className={inputClass()} value={f.to} onChange={(e) => set({ to: e.target.value })} />
          </div>
        )}
      </Field>

      <div className="grid gap-4 md:grid-cols-3">
        {selects.map(({ kind, key, label, withEmpty }) => (
          <Field key={key} label={label} htmlFor={`flt-${key}`}>
            <select id={`flt-${key}`} className={inputClass()} value={f[key]} onChange={(e) => set({ [key]: e.target.value })}>
              <option value="">Alle</option>
              {valuesFor(kind, options, sessions).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              {withEmpty && <option value={NO_VALUE}>ohne Angabe</option>}
            </select>
          </Field>
        ))}

        <Field label="Tageszeit" htmlFor="flt-tod">
          <select id="flt-tod" className={inputClass()} value={f.timeOfDay} onChange={(e) => set({ timeOfDay: e.target.value })}>
            <option value="">Alle</option>
            {TIMES_OF_DAY.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value={NO_VALUE}>ohne Angabe</option>
          </select>
        </Field>

        <Field label="Dauer (Minuten)">
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              aria-label="Dauer von"
              placeholder="von"
              className={inputClass()}
              value={f.minDuration}
              onChange={(e) => set({ minDuration: e.target.value })}
            />
            <span className="text-stone-400">–</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              aria-label="Dauer bis"
              placeholder="bis"
              className={inputClass()}
              value={f.maxDuration}
              onChange={(e) => set({ maxDuration: e.target.value })}
            />
          </div>
        </Field>

        <Field label="Fokus (1–10)" hint="Nur bestätigte Werte">
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              aria-label="Fokus von"
              placeholder="von"
              className={inputClass()}
              value={f.minFocus}
              onChange={(e) => set({ minFocus: e.target.value })}
            />
            <span className="text-stone-400">–</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              aria-label="Fokus bis"
              placeholder="bis"
              className={inputClass()}
              value={f.maxFocus}
              onChange={(e) => set({ maxFocus: e.target.value })}
            />
          </div>
        </Field>
      </div>
    </div>
  );
}
