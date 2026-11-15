import { useMemo, useState } from 'react';
import { OPTION_LABELS, type Option, type Session } from '../types';
import { applyMapping, findUnmapped, OptionError, type MappableKind, type MappingTarget } from '../lib/options';
import { suggestOption } from '../lib/legacy';
import { Button, Card, inputClass } from './ui';

const NEW = '__neu__';
const CLEAR = '__leer__';
const SKIP = '';

/**
 * Zuordnung alter Freitexte (aus der Zeit vor den Auswahllisten) zu den neuen Optionen.
 * Jeder unterschiedliche Text erscheint einmal, mit Anzahl und Vorschlag.
 */
export function MappingAssistant({
  kind,
  sessions,
  options,
  toast,
}: {
  kind: MappableKind;
  sessions: Session[];
  options: Option[];
  toast: (m: string) => void;
}) {
  const L = OPTION_LABELS[kind];
  const list = useMemo(() => findUnmapped(kind, sessions, options), [kind, sessions, options]);
  const active = options.filter((o) => o.kind === kind && !o.archived).sort((a, b) => a.order - b.order);
  const names = active.map((o) => o.name);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (list.length === 0) return null;

  const valueFor = (v: string) => (v in choice ? choice[v] : (suggestOption(kind, v, names) ?? SKIP));
  const selected = list.filter((u) => valueFor(u.value) !== SKIP);

  const apply = async () => {
    const mapping: Record<string, MappingTarget> = {};
    for (const u of selected) {
      const c = valueFor(u.value);
      // „Neu übernehmen“: häufigste Schreibweise wird die Option, die übrigen Varianten werden ihr zugeordnet
      const target: MappingTarget = c === NEW ? { type: 'new' } : c === CLEAR ? { type: 'clear' } : { type: 'option', name: c };
      mapping[u.value] = target;
      for (const v of u.variants.slice(1)) mapping[v] = c === NEW ? { type: 'option', name: u.value } : target;
    }
    setBusy(true);
    try {
      const n = await applyMapping(kind, mapping);
      setChoice({});
      toast(`${n} ${n === 1 ? 'Eintrag' : 'Einträge'} zugeordnet`);
    } catch (e) {
      toast(e instanceof OptionError ? e.message : 'Zuordnung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 ring-2 ring-amber-300 dark:ring-amber-800">
      <div>
        <h3 className="text-base font-semibold">
          Alte {L.plural} zuordnen ({list.length})
        </h3>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          Diese Texte stammen aus der Zeit vor der festen Auswahl. Wähle jeweils die passende Option – alle Einträge mit
          diesem Text werden dann umgestellt. Der ursprüngliche Text bleibt im Eintrag als „ursprünglich“ erhalten.
          Vorschläge sind schon ausgewählt; prüfe sie kurz. Was du auf „später“ lässt, bleibt unverändert.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {list.map((u) => (
          <li key={u.value} className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-4">
            <div className="min-w-0 md:w-1/2">
              <span className="break-words">„{u.value}“</span>
              <span className="ml-2 text-sm text-stone-500 dark:text-stone-400">
                {u.count} {u.count === 1 ? 'Eintrag' : 'Einträge'}
                {u.variants.length > 1 && ` · auch als ${u.variants.slice(1).map((v) => `„${v}“`).join(', ')}`}
              </span>
            </div>
            <select
              aria-label={`Zuordnung für ${u.value}`}
              className={inputClass() + ' md:w-1/2'}
              value={valueFor(u.value)}
              onChange={(e) => setChoice({ ...choice, [u.value]: e.target.value })}
            >
              <option value={SKIP}>– später –</option>
              {names.map((n) => (
                <option key={n} value={n}>
                  → {n}
                </option>
              ))}
              <option value={NEW}>Als neue Option übernehmen</option>
              {kind === 'location' && <option value={CLEAR}>Ort leer lassen</option>}
            </select>
          </li>
        ))}
      </ul>
      <Button variant="primary" disabled={busy || selected.length === 0} onClick={() => void apply()}>
        {selected.length === 0
          ? 'Nichts ausgewählt'
          : `${selected.length} ${selected.length === 1 ? 'Text' : 'Texte'} zuordnen (${selected.reduce((a, u) => a + u.count, 0)} Einträge)`}
      </Button>
    </Card>
  );
}
