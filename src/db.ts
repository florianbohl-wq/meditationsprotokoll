import Dexie, { type EntityTable } from 'dexie';
import type { MetaEntry, Posture, Session } from './types';
import { uuid } from './lib/id';

export const DEFAULT_POSTURES = ['Schneidersitz', 'Fersensitz', 'Liegen'];

class ProtocolDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  postures!: EntityTable<Posture, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;

  constructor() {
    super('meditationsprotokoll');
    this.version(1).stores({
      sessions: 'id, date, posture',
      postures: 'id, order',
      meta: 'key',
    });
    this.on('populate', (tx) => {
      tx.table('postures').bulkAdd(
        DEFAULT_POSTURES.map((name, i) => ({ id: uuid(), name, order: i, archived: false })),
      );
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
