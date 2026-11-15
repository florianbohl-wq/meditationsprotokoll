import { db } from '../db';
import { OPTION_LABELS, type Option, type OptionKind, type Session } from '../types';
import { uuid } from './id';

export class OptionError extends Error {}

/** Feld im Eintrag, in dem der Options-Name gespeichert ist */
export const FIELD: Record<OptionKind, 'posture' | 'anchor' | 'location'> = {
  posture: 'posture',
  anchor: 'anchor',
  location: 'location',
};

const norm = (s: string) => s.trim().toLocaleLowerCase('de');

export async function listOptions(kind: OptionKind): Promise<Option[]> {
  return db.options.where('[kind+order]').between([kind, -Infinity], [kind, Infinity]).toArray();
}

export async function findOptionByName(kind: OptionKind, name: string): Promise<Option | undefined> {
  const n = norm(name);
  return (await db.options.where('kind').equals(kind).toArray()).find((p) => norm(p.name) === n);
}

/**
 * Neue Option anlegen. Existiert der Name bereits (case-insensitiv), wird die vorhandene
 * zurückgegeben – eine archivierte wird dabei wieder aktiviert.
 */
export async function addOption(kind: OptionKind, rawName: string): Promise<Option> {
  const name = rawName.trim();
  if (!name) throw new OptionError('Bitte einen Namen eingeben.');
  return db.transaction('rw', db.options, async () => {
    const existing = await findOptionByName(kind, name);
    if (existing) {
      if (existing.archived) {
        await db.options.update(existing.id, { archived: false });
        return { ...existing, archived: false };
      }
      return existing;
    }
    const all = await listOptions(kind);
    const p: Option = { id: uuid(), kind, name, order: (all.at(-1)?.order ?? -1) + 1, archived: false };
    await db.options.add(p);
    return p;
  });
}

/** Umbenennen inkl. aller bestehenden Einträge – in einer Transaktion. */
export async function renameOption(id: string, rawName: string): Promise<void> {
  const name = rawName.trim();
  if (!name) throw new OptionError('Bitte einen Namen eingeben.');
  await db.transaction('rw', db.options, db.sessions, async () => {
    const p = await db.options.get(id);
    if (!p) throw new OptionError('Eintrag nicht gefunden.');
    if (p.name === name) return;
    const clash = await findOptionByName(p.kind, name);
    if (clash && clash.id !== id) throw new OptionError(`„${clash.name}“ gibt es bereits.`);
    const oldName = p.name;
    await db.options.update(id, { name });
    const now = new Date().toISOString();
    await db.sessions.where(FIELD[p.kind]).equals(oldName).modify({ [FIELD[p.kind]]: name, updatedAt: now });
  });
}

export async function setOptionArchived(id: string, archived: boolean): Promise<void> {
  await db.options.update(id, { archived });
}

export async function countSessionsWithOption(kind: OptionKind, name: string): Promise<number> {
  return db.sessions.where(FIELD[kind]).equals(name).count();
}

/** Endgültig löschen – nur wenn kein Eintrag die Option verwendet. */
export async function deleteOption(id: string): Promise<void> {
  await db.transaction('rw', db.options, db.sessions, async () => {
    const p = await db.options.get(id);
    if (!p) return;
    const used = await countSessionsWithOption(p.kind, p.name);
    if (used > 0) {
      throw new OptionError(
        `„${p.name}“ wird in ${used} ${used === 1 ? 'Eintrag' : 'Einträgen'} verwendet und kann nur archiviert werden.`,
      );
    }
    await db.options.delete(id);
  });
}

/** Mit dem Nachbarn tauschen (direction -1 = hoch, +1 = runter). */
export async function moveOption(id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.options, async () => {
    const p = await db.options.get(id);
    if (!p) return;
    const all = await listOptions(p.kind);
    const i = all.findIndex((x) => x.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j], all[i]];
    await Promise.all(all.map((x, idx) => db.options.update(x.id, { order: idx })));
  });
}

/* ---------- Zuordnung alter Freitexte ---------- */

export type MappableKind = 'anchor' | 'location';

export interface UnmappedValue {
  value: string;
  count: number;
  /** alle Schreibweisen dieses Texts (Groß/Klein, Leerzeichen am Rand) */
  variants: string[];
}

/**
 * Werte in Einträgen, die zu keiner Option (auch keiner archivierten) passen.
 * Schreibvarianten („Wohnzimmer“, „wohnzimmer “) werden zusammengefasst; angezeigt wird die häufigste.
 */
export function findUnmapped(kind: MappableKind, sessions: Session[], options: Option[]): UnmappedValue[] {
  const names = new Set(options.filter((o) => o.kind === kind).map((o) => o.name));
  const groups = new Map<string, Map<string, number>>();
  for (const s of sessions) {
    const v = s[FIELD[kind]];
    if (!v || names.has(v)) continue;
    const key = norm(v);
    const g = groups.get(key) ?? new Map<string, number>();
    g.set(v, (g.get(v) ?? 0) + 1);
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => {
      const sorted = [...g.entries()].sort((a, b) => b[1] - a[1]);
      return { value: sorted[0][0], count: sorted.reduce((a, [, n]) => a + n, 0), variants: sorted.map(([v]) => v) };
    })
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'de'));
}

export type MappingTarget =
  | { type: 'option'; name: string }
  /** alten Text als neue Option in die Liste aufnehmen */
  | { type: 'new' }
  /** Feld leeren (nur beim optionalen Ort) */
  | { type: 'clear' };

/**
 * Ordnet alte Freitexte zu. Der bisherige Text wird in anchorOriginal/locationOriginal
 * aufbewahrt, damit nichts verloren geht.
 */
export async function applyMapping(kind: MappableKind, mapping: Record<string, MappingTarget>): Promise<number> {
  const field = kind;
  const origField = kind === 'anchor' ? 'anchorOriginal' : 'locationOriginal';
  if (kind === 'anchor' && Object.values(mapping).some((t) => t.type === 'clear')) {
    throw new OptionError(`${OPTION_LABELS.anchor.singular} ist ein Pflichtfeld und kann nicht geleert werden.`);
  }
  return db.transaction('rw', db.options, db.sessions, async () => {
    let changed = 0;
    const now = new Date().toISOString();
    for (const [oldValue, target] of Object.entries(mapping)) {
      if (target.type === 'new') {
        await addOption(kind, oldValue);
        const opt = await findOptionByName(kind, oldValue);
        if (opt && opt.name !== oldValue) {
          // gleicher Name in anderer Schreibweise vorhanden → wie Zuordnung behandeln
          changed += await reassign(field, origField, oldValue, opt.name, now);
        } else {
          changed += await db.sessions.where(field).equals(oldValue).count();
        }
        continue;
      }
      const newValue = target.type === 'clear' ? undefined : target.name;
      if (target.type === 'option' && !(await findOptionByName(kind, target.name))) {
        throw new OptionError(`„${target.name}“ ist keine gültige Auswahl.`);
      }
      changed += await reassign(field, origField, oldValue, newValue, now);
    }
    return changed;
  });
}

async function reassign(
  field: 'anchor' | 'location',
  origField: 'anchorOriginal' | 'locationOriginal',
  oldValue: string,
  newValue: string | undefined,
  now: string,
): Promise<number> {
  return db.sessions
    .where(field)
    .equals(oldValue)
    .modify((s: Session) => {
      if (!s[origField]) s[origField] = oldValue;
      if (newValue === undefined) delete s[field];
      else s[field] = newValue;
      s.updatedAt = now;
    });
}
