import Dexie, { type EntityTable, type Transaction } from 'dexie';
import type { MetaEntry, Option, OptionKind, Session } from './types';
import { uuid } from './lib/id';
import { matchOptionName, migrateLegacySession } from './lib/legacy';
import { withFocusSuggestion } from './lib/focus';

export const DEFAULT_OPTIONS: Record<OptionKind, string[]> = {
  posture: ['Schneidersitz', 'Fersensitz', 'Liegen'],
  anchor: ['Podcast/Youtube', 'Spirio/App', 'Keiner/Atem', 'Person'],
  location: ['Zu Hause oben', 'Zu Hause unten', 'Event', 'Bekannte/Familie', 'Reise'],
};

export function defaultOptions(kinds: readonly OptionKind[] = ['posture', 'anchor', 'location']): Option[] {
  return kinds.flatMap((kind) =>
    DEFAULT_OPTIONS[kind].map((name, order) => ({ id: uuid(), kind, name, order, archived: false })),
  );
}

export const DB_NAME = 'meditationsprotokoll';

/** Schema von Version 1 – nur noch nötig, damit bestehende Datenbanken umgestellt werden können. */
export const SCHEMA_V1 = {
  sessions: 'id, date, posture',
  postures: 'id, order',
  meta: 'key',
};

/**
 * Umstellung Version 1 → 2:
 * - Haltungen wandern in die gemeinsame Tabelle „options“
 * - Standard-Anker und -Orte werden angelegt
 * - Hintergrund wird an die Beobachtung angehängt
 * - Anker/Ort, die exakt einer Option entsprechen, bekommen deren Schreibweise
 * Alle anderen alten Anker-/Orts-Texte bleiben unverändert und werden später im
 * Zuordnungs-Assistenten einsortiert.
 */
export async function upgradeV1toV2(tx: Transaction): Promise<void> {
  const oldPostures = (await tx.table('postures').toArray()) as { id: string; name: string; order: number; archived?: boolean }[];
  const postures: Option[] = oldPostures
    .sort((a, b) => a.order - b.order)
    .map((p, order) => ({ id: p.id, kind: 'posture', name: p.name, order, archived: !!p.archived }));
  const others = defaultOptions(['anchor', 'location']);
  await tx.table('options').bulkAdd([...postures, ...others]);

  const anchorNames = DEFAULT_OPTIONS.anchor;
  const locationNames = DEFAULT_OPTIONS.location;
  await tx
    .table('sessions')
    .toCollection()
    .modify((s: Record<string, unknown>, ref: { value: unknown }) => {
      const m = migrateLegacySession(s) as Session;
      m.anchor = matchOptionName(m.anchor, anchorNames) ?? m.anchor;
      if (m.location) m.location = matchOptionName(m.location, locationNames) ?? m.location;
      ref.value = m;
    });
}

/**
 * Umstellung Version 2 → 3: Fokus-Feld.
 * Alle bisherigen Einträge bekommen einen Fokus-Vorschlag (1–6) aus der Beobachtung,
 * der im Fokus-Assistenten bestätigt oder geändert wird.
 */
export async function upgradeV2toV3(tx: Transaction): Promise<void> {
  await tx
    .table('sessions')
    .toCollection()
    .modify((s: Session, ref: { value: unknown }) => {
      ref.value = withFocusSuggestion(s);
    });
}

export class ProtocolDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  options!: EntityTable<Option, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    this.version(2)
      .stores({
        sessions: 'id, date, posture, anchor, location',
        postures: null,
        options: 'id, kind, [kind+order]',
        meta: 'key',
      })
      .upgrade(upgradeV1toV2);
    this.version(3).stores({}).upgrade(upgradeV2toV3);
    this.on('populate', (tx) => {
      tx.table('options').bulkAdd(defaultOptions());
    });
  }
}

export const db = new ProtocolDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const e = await db.meta.get(key);
  return e?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function deleteMeta(key: string): Promise<void> {
  await db.meta.delete(key);
}

export const META = {
  timer: 'timer',
  lastBackup: 'lastBackupAt',
  wakeLock: 'wakeLock',
  persistAsked: 'persistAsked',
} as const;
