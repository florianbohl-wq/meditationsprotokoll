import { useMemo, useState } from 'react';
import type { Session } from '../types';
import { needsFocusConfirmation } from '../lib/focus';
import { confirmFocus, sortNewestFirst } from '../lib/sessions';
import { formatDateDE, formatMinutes, weekdayShort } from '../lib/time';
import { FocusPicker } from './FocusPicker';
import { Button, Card } from './ui';

const PAGE = 10;

/**
 * Prüfen und Bestätigen der automatisch vorgeschlagenen Fokus-Werte für alte Einträge.
 * Es werden immer 10 Einträge gezeigt (neueste zuerst); bestätigte verschwinden aus der Liste.
 */
export function FocusAssistant({ sessions, toast }: { sessions: Session[]; toast: (m: string) => void }) {
  const open = useMemo(() => sortNewestFirst(sessions.filter(needsFocusConfirmation)), [sessions]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (open.length === 0) return null;
  const page = open.slice(0, PAGE);
  const valueOf = (s: Session) => values[s.id] ?? (s.focusSuggestion ? String(s.focusSuggestion) : '');
  const ready = page.filter((s) => valueOf(s) !== '');

  const save = async (list: Session[]) => {
    setBusy(true);
    try {
      const n = await confirmFocus(list.map((s) => ({ id: s.id, focus: Number(valueOf(s)) })));
      toast(n === 1 ? 'Fokus bestätigt' : `${n} Fokus-Werte bestätigt`);
    } catch {
      toast('Speichern fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 ring-2 ring-amber-300 dark:ring-amber-800">
      <div>
        <h3 className="text-base font-semibold">Fokus-Vorschläge prüfen ({open.length} offen)</h3>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          Für deine bisherigen Einträge hat die App aus der Beobachtung einen Fokus-Wert vorgeschlagen (höchstens 6,
          gestrichelt markiert). Ändere ihn bei Bedarf mit einem Tipp und bestätige. Bis dahin zählt der Wert nicht in
          die Statistik.
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-stone-200 dark:divide-stone-800">
        {page.map((s) => {
          const v = valueOf(s);
          const changed = s.id in values && values[s.id] !== String(s.focusSuggestion ?? '');
          return (
            <li key={s.id} className="flex flex-col gap-2 py-3 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">
                  {weekdayShort(s.date)}, {formatDateDE(s.date)}
                  {s.startTime && <span className="font-normal text-stone-500 dark:text-stone-400"> · {s.startTime}</span>}
                </span>
                <span className="text-sm text-stone-500 dark:text-stone-400">
                  {formatMinutes(s.durationMinutes)} · {s.anchor}
                </span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-stone-700 dark:text-stone-300">
                {s.observation.trim() || <span className="italic text-stone-400">keine Beobachtung</span>}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <FocusPicker compact value={v} suggestion={!changed} onChange={(x) => setValues({ ...values, [s.id]: x })} />
                </div>
                <Button variant="secondary" disabled={busy || !v} onClick={() => void save([s])} className="shrink-0">
                  Bestätigen
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Button variant="primary" disabled={busy || ready.length === 0} onClick={() => void save(ready)}>
        {ready.length === page.length ? `Alle ${ready.length} angezeigten bestätigen` : `${ready.length} angezeigte bestätigen`}
      </Button>
      {open.length > PAGE && (
        <p className="text-center text-sm text-stone-500 dark:text-stone-400">
          Danach folgen die nächsten {Math.min(PAGE, open.length - PAGE)} von {open.length - PAGE} weiteren.
        </p>
      )}
    </Card>
  );
}
