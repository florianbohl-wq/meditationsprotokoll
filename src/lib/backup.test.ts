import { describe, expect, it } from 'vitest';
import { db } from '../db';
import { makeSession } from '../test/factory';
import { applyImport, BackupError, createBackup, parseBackup, previewImport } from './backup';
import { addPosture, listPostures } from './postures';

describe('JSON-Backup', () => {
  it('Export → alles löschen → Import stellt alles inkl. IDs wieder her', async () => {
    await addPosture('Kniebank');
    await db.sessions.bulkAdd([makeSession({ id: 'x1', posture: 'Kniebank' }), makeSession({ id: 'x2' })]);
    const text = JSON.stringify(await createBackup());

    await db.delete();
    await db.open();
    const backup = parseBackup(text);
    const res = await applyImport(backup);
    expect(res).toEqual({ added: 2, duplicates: 0, posturesAdded: 1 });
    expect((await db.sessions.toArray()).map((s) => s.id).sort()).toEqual(['x1', 'x2']);
    expect((await listPostures()).map((p) => p.name)).toEqual(['Schneidersitz', 'Fersensitz', 'Liegen', 'Kniebank']);
  });

  it('überspringt Duplikate anhand der id', async () => {
    await db.sessions.bulkAdd([makeSession({ id: 'a', anchor: 'lokal' }), makeSession({ id: 'b' })]);
    const backup = parseBackup(
      JSON.stringify({
        app: 'meditationsprotokoll',
        format: 1,
        exportedAt: '',
        postures: [],
        sessions: [makeSession({ id: 'a', anchor: 'aus Backup' }), makeSession({ id: 'c' }), makeSession({ id: 'c' })],
      }),
    );
    const preview = await previewImport(backup);
    expect(preview.total).toBe(3);
    expect(preview.duplicates).toBe(2);
    expect(preview.newSessions.map((s) => s.id)).toEqual(['c']);

    const res = await applyImport(backup);
    expect(res.added).toBe(1);
    expect((await db.sessions.get('a'))?.anchor).toBe('lokal');
    expect(await db.sessions.count()).toBe(3);
  });

  it('legt Haltungen aus Einträgen an, ohne Duplikate (case-insensitiv)', async () => {
    const backup = parseBackup(
      JSON.stringify({
        app: 'meditationsprotokoll',
        format: 1,
        sessions: [makeSession({ id: 'p1', posture: 'liegen' }), makeSession({ id: 'p2', posture: 'Gehen' })],
        postures: [{ id: 'zz', name: 'LIEGEN', order: 0, archived: false }],
      }),
    );
    expect((await previewImport(backup)).newPostureNames).toEqual(['Gehen']);
    await applyImport(backup);
    expect((await listPostures()).map((p) => p.name)).toEqual(['Schneidersitz', 'Fersensitz', 'Liegen', 'Gehen']);
  });

  it('lehnt fremde oder kaputte Dateien ab', () => {
    expect(() => parseBackup('kein json')).toThrow(BackupError);
    expect(() => parseBackup('{"foo":1}')).toThrow(BackupError);
    expect(() =>
      parseBackup(JSON.stringify({ app: 'meditationsprotokoll', sessions: [{ id: 'x' }] })),
    ).toThrow(/unvollständig/);
  });
});
