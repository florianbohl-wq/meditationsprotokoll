import { useState } from 'react';
import { OPTION_LABELS, type Option, type OptionKind, type Session } from '../types';
import {
  addOption,
  deleteOption,
  FIELD,
  moveOption,
  OptionError,
  renameOption,
  setOptionArchived,
} from '../lib/options';
import { Button, cx, inputClass, useConfirm } from './ui';

/** Verwaltung einer Auswahlliste (Haltungen, Anker oder Orte). */
export function OptionManager({ kind, options, sessions }: { kind: OptionKind; options: Option[]; sessions: Session[] }) {
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');
  const [confirmEl, confirm] = useConfirm();
  const L = OPTION_LABELS[kind];
  const list = options.filter((o) => o.kind === kind).sort((a, b) => a.order - b.order);

  const usage = (name: string) => sessions.filter((s) => s[FIELD[kind]] === name).length;

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setError('');
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof OptionError ? e.message : 'Aktion fehlgeschlagen.');
      return false;
    }
  };

  const add = async () => {
    if (await run(() => addOption(kind, newName))) setNewName('');
  };

  const saveRename = async (p: Option) => {
    const n = usage(p.name);
    if (editName.trim() && editName.trim() !== p.name && n > 0) {
      const ok = await confirm({
        title: `${L.singular} umbenennen?`,
        message: `„${p.name}“ wird in ${n} ${n === 1 ? 'Eintrag' : 'Einträgen'} zu „${editName.trim()}“ geändert.`,
        confirmLabel: 'Umbenennen',
      });
      if (!ok) return;
    }
    if (await run(() => renameOption(p.id, editName))) setEditing(null);
  };

  const remove = async (p: Option) => {
    const ok = await confirm({
      title: `${L.singular} löschen?`,
      message: `„${p.name}“ wird endgültig aus der Liste entfernt.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (ok) await run(() => deleteOption(p.id));
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-stone-200 rounded-2xl bg-white ring-1 ring-stone-200 dark:divide-stone-800 dark:bg-stone-900 dark:ring-stone-800">
        {list.map((p, i) => {
          const n = usage(p.name);
          return (
            <li key={p.id} className={cx('flex flex-wrap items-center gap-2 px-3 py-2', p.archived && 'opacity-60')}>
              {editing === p.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveRename(p);
                  }}
                >
                  <input
                    autoFocus
                    aria-label="Neuer Name"
                    className={inputClass()}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditing(null);
                      }
                    }}
                  />
                  <Button type="submit" variant="primary">
                    OK
                  </Button>
                  <Button onClick={() => setEditing(null)}>Abbrechen</Button>
                </form>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-sm text-stone-500 dark:text-stone-400">
                      {n} {n === 1 ? 'Eintrag' : 'Einträge'}
                      {p.archived && ' · archiviert'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <IconBtn label={`${p.name} nach oben`} disabled={i === 0} onClick={() => void run(() => moveOption(p.id, -1))}>
                      ↑
                    </IconBtn>
                    <IconBtn
                      label={`${p.name} nach unten`}
                      disabled={i === list.length - 1}
                      onClick={() => void run(() => moveOption(p.id, 1))}
                    >
                      ↓
                    </IconBtn>
                    <SmallBtn
                      onClick={() => {
                        setEditing(p.id);
                        setEditName(p.name);
                      }}
                    >
                      Umbenennen
                    </SmallBtn>
                    <SmallBtn onClick={() => void run(() => setOptionArchived(p.id, !p.archived))}>
                      {p.archived ? 'Wiederherstellen' : 'Archivieren'}
                    </SmallBtn>
                    {n === 0 && (
                      <SmallBtn danger onClick={() => void remove(p)}>
                        Löschen
                      </SmallBtn>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          aria-label={`Neue Option für ${L.singular}`}
          placeholder={`Neu, ${L.example}`}
          className={inputClass()}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit" variant="primary" disabled={!newName.trim()}>
          Hinzufügen
        </Button>
      </form>
      {error && (
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {confirmEl}
    </div>
  );
}

function IconBtn(props: { label: string; disabled?: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="h-11 w-11 rounded-lg text-lg text-stone-600 hover:bg-stone-100 disabled:opacity-30 dark:text-stone-300 dark:hover:bg-stone-800"
    >
      {props.children}
    </button>
  );
}

function SmallBtn({ danger, onClick, children }: { danger?: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'min-h-11 rounded-lg px-2.5 text-sm font-medium hover:bg-stone-100 dark:hover:bg-stone-800',
        danger ? 'text-red-700 dark:text-red-400' : 'text-moss-800 dark:text-moss-300',
      )}
    >
      {children}
    </button>
  );
}
