import { describe, expect, it } from 'vitest';
import { db } from '../db';
import { makeSession } from '../test/factory';
import {
  addPosture,
  deletePosture,
  listPostures,
  movePosture,
  PostureError,
  renamePosture,
  setPostureArchived,
} from './postures';

const names = async () => (await listPostures()).map((p) => p.name);

describe('Haltungen', () => {
  it('startet mit Schneidersitz, Fersensitz und Liegen', async () => {
    expect(await names()).toEqual(['Schneidersitz', 'Fersensitz', 'Liegen']);
  });

  it('Umbenennen aktualisiert alle bestehenden Einträge', async () => {
    const schneidersitz = (await listPostures())[0];
    await db.sessions.bulkAdd([
      makeSession({ id: 'a', posture: 'Schneidersitz' }),
      makeSession({ id: 'b', posture: 'Schneidersitz' }),
      makeSession({ id: 'c', posture: 'Liegen' }),
      makeSession({ id: 'd' }),
    ]);
    await renamePosture(schneidersitz.id, 'Schneidersitz auf Kissen');
    const byId = Object.fromEntries((await db.sessions.toArray()).map((s) => [s.id, s.posture]));
    expect(byId).toEqual({ a: 'Schneidersitz auf Kissen', b: 'Schneidersitz auf Kissen', c: 'Liegen', d: undefined });
    expect((await db.postures.get(schneidersitz.id))?.name).toBe('Schneidersitz auf Kissen');
  });

  it('verhindert doppelte Namen (case-insensitiv) beim Umbenennen', async () => {
    const [schneidersitz] = await listPostures();
    await expect(renamePosture(schneidersitz.id, 'liegen')).rejects.toBeInstanceOf(PostureError);
    // Groß-/Kleinschreibung der eigenen Haltung ändern ist erlaubt
    await renamePosture(schneidersitz.id, 'SCHNEIDERSITZ');
    expect((await db.postures.get(schneidersitz.id))?.name).toBe('SCHNEIDERSITZ');
  });

  it('Hinzufügen erkennt vorhandene Namen und reaktiviert archivierte', async () => {
    const liegen = (await listPostures())[2];
    await setPostureArchived(liegen.id, true);
    const again = await addPosture('  LIEGEN ');
    expect(again.id).toBe(liegen.id);
    expect((await db.postures.get(liegen.id))?.archived).toBe(false);
    const k = await addPosture('Kniebank');
    expect(k.order).toBe(3);
    expect(await db.postures.count()).toBe(4);
  });

  it('löscht nur unbenutzte Haltungen', async () => {
    const [schneidersitz, , liegen] = await listPostures();
    await db.sessions.add(makeSession({ posture: 'Schneidersitz' }));
    await expect(deletePosture(schneidersitz.id)).rejects.toBeInstanceOf(PostureError);
    await deletePosture(liegen.id);
    expect(await names()).toEqual(['Schneidersitz', 'Fersensitz']);
  });

  it('ändert die Reihenfolge', async () => {
    const k = await addPosture('Kniebank');
    await movePosture(k.id, -1);
    expect(await names()).toEqual(['Schneidersitz', 'Fersensitz', 'Kniebank', 'Liegen']);
    await movePosture(k.id, -1);
    await movePosture(k.id, -1);
    await movePosture(k.id, -1); // bereits oben: keine Änderung
    expect(await names()).toEqual(['Kniebank', 'Schneidersitz', 'Fersensitz', 'Liegen']);
  });
});
