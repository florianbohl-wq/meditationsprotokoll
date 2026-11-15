import { useState, type KeyboardEvent } from 'react';
import { OPTION_LABELS, type Option, type OptionKind } from '../types';
import { addOption, OptionError } from '../lib/options';
import { Button, Chip, inputClass } from './ui';

/**
 * Auswahl als Chips mit „+ Neu“. Erneutes Tippen auf den gewählten Chip hebt die Auswahl auf.
 * Ein Wert, der nicht (mehr) in der aktiven Liste steht (archiviert oder alter Freitext),
 * wird zusätzlich als Chip angezeigt, damit er beim Bearbeiten nicht verloren geht.
 */
export function ChipSelect({
  kind,
  options,
  value,
  onChange,
  idPrefix,
}: {
  kind: OptionKind;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  idPrefix: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const active = options.filter((o) => o.kind === kind && !o.archived).sort((a, b) => a.order - b.order);
  const names = active.map((o) => o.name);
  const extra = value && !names.includes(value) ? value : undefined;
  const isLegacy = extra !== undefined && !options.some((o) => o.kind === kind && o.name === extra);

  const create = async () => {
    try {
      const o = await addOption(kind, name);
      onChange(o.name);
      setName('');
      setOpen(false);
      setError('');
    } catch (e) {
      setError(e instanceof OptionError ? e.message : 'Konnte nicht angelegt werden.');
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void create();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" id={`${idPrefix}-chips`} tabIndex={-1}>
        {names.map((n) => (
          <Chip key={n} selected={value === n} onClick={() => onChange(value === n ? '' : n)}>
            {n}
          </Chip>
        ))}
        {extra && (
          <Chip selected onClick={() => onChange('')} title={isLegacy ? 'Alter Freitext – noch keiner Option zugeordnet' : 'Archiviert'}>
            {extra}
            {isLegacy ? ' (alt)' : ''}
          </Chip>
        )}
        {!open && <Chip onClick={() => setOpen(true)}>+ Neu</Chip>}
      </div>
      {open && (
        <div className="flex gap-2">
          <input
            autoFocus
            type="text"
            aria-label={`Neue Option für ${OPTION_LABELS[kind].singular}`}
            placeholder={OPTION_LABELS[kind].example}
            className={inputClass(error)}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onKey}
          />
          <Button variant="primary" onClick={() => void create()}>
            Hinzufügen
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} aria-label="Abbrechen">
            ×
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
