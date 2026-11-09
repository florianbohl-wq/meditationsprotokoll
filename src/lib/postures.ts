import { db } from '../db';
import type { Posture } from '../types';
import { uuid } from './id';

export class PostureError extends Error {}

const norm = (s: string) => s.trim().toLocaleLowerCase('de');

export async function listPostures(): Promise<Posture[]> {
  return db.postures.orderBy('order').toArray();
}

export async function findPostureByName(name: string): Promise<Posture | undefined> {
  const n = norm(name);
  return (await db.postures.toArray()).find((p) => norm(p.name) === n);
}

/**
 * Neue Haltung anlegen. Existiert der Name bereits (case-insensitiv), wird die vorhandene
 * zurückgegeben – eine archivierte wird dabei wieder aktiviert.
 */
export async function addPosture(rawName: string): Promise<Posture> {
  const name = rawName.trim();
  if (!name) throw new PostureError('Bitte einen Namen eingeben.');
  return db.transaction('rw', db.postures, async () => {
    const existing = await findPostureByName(name);
    if (existing) {
      if (existing.archived) {
        await db.postures.update(existing.id, { archived: false });
        return { ...existing, archived: false };
      }
      return existing;
    }
    const last = await db.postures.orderBy('order').last();
    const p: Posture = { id: uuid(), name, order: (last?.order ?? -1) + 1, archived: false };
    await db.postures.add(p);
    return p;
  });
}

/** Umbenennen inkl. aller bestehenden Einträge – in einer Transaktion. */
export async function renamePosture(id: string, rawName: string): Promise<void> {
  const name = rawName.trim();
  if (!name) throw new PostureError('Bitte einen Namen eingeben.');
  await db.transaction('rw', db.postures, db.sessions, async () => {
    const p = await db.postures.get(id);
    if (!p) throw new PostureError('Haltung nicht gefunden.');
    if (p.name === name) return;
    const clash = await findPostureByName(name);
    if (clash && clash.id !== id) throw new PostureError(`„${clash.name}“ gibt es bereits.`);
    const oldName = p.name;
    await db.postures.update(id, { name });
    const now = new Date().toISOString();
    await db.sessions.where('posture').equals(oldName).modify({ posture: name, updatedAt: now });
  });
}

export async function setPostureArchived(id: string, archived: boolean): Promise<void> {
  await db.postures.update(id, { archived });
}

export async function countSessionsWithPosture(name: string): Promise<number> {
  return db.sessions.where('posture').equals(name).count();
}

/** Endgültig löschen – nur wenn kein Eintrag die Haltung verwendet. */
export async function deletePosture(id: string): Promise<void> {
  await db.transaction('rw', db.postures, db.sessions, async () => {
    const p = await db.postures.get(id);
    if (!p) return;
    const used = await countSessionsWithPosture(p.name);
    if (used > 0) {
      throw new PostureError(
        `„${p.name}“ wird in ${used} Eintrag/Einträgen verwendet und kann nur archiviert werden.`,
      );
    }
    await db.postures.delete(id);
  });
}

/** Mit dem Nachbarn tauschen (direction -1 = hoch, +1 = runter). */
export async function movePosture(id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.postures, async () => {
    const all = await db.postures.orderBy('order').toArray();
    const i = all.findIndex((p) => p.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j], all[i]];
    await Promise.all(all.map((p, idx) => db.postures.update(p.id, { order: idx })));
  });
}
