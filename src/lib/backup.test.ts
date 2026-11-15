import { describe, expect, it } from 'vitest';
import { db } from '../db';
import { makeSession } from '../test/factory';
import { applyImport, BackupError, createBackup, parseBackup, previewImport } from './backup';
import { addOption, listOptions } from './options';

describe('JSON-Backup', () => {
  it('Export → alles löschen → Import stellt alles inkl. IDs und Listen wieder her', async () => {
    await addOption('posture', 'Kniebank');
    await addOption('anchor', 'Musik');
    await db.sessions.bulkAdd([
      makeSession({ id: 'x1', posture: 'Kniebank', anchor: 'Musik' }),
      makeSession({ id: 'x2', anchor: 'Keiner/Atem', anchorOriginal: 'Atem' }),
    ]);
    const text = JSON.stringify(await createBackup());

    await db.delete();
    await db.open();
    const res = await applyImport(parseBackup(text));
    expect(res).toEqual({ added: 2, duplicates: 0, optionsAdded: 2 });
    expect((await db.sessions.get('x2'))?.anchorOriginal).toBe('Atem');
    expect((await listOptions('posture')).map((p) => p.name)).toEqual(['Schneidersitz', 'Fersensitz', 'Liegen', 'Kniebank']);
    expect((await listOptions('anchor')).map((p) => p.name)).toContain('Musik');
  });

  it('überspringt Duplikate anhand der id', async () => {
    await db.sessions.bulkAdd([makeSession({ id: 'a', observation: 'lokal' }), makeSession({ id: 'b' })]);
    const backup = parseBackup(
      JSON.stringify({
        app: 'meditationsprotokoll',
        format: 2,
        exportedAt: '',
        options: [],
        sessions: [makeSession({ id: 'a', observation: 'aus Backup' }), makeSession({ id: 'c' }), makeSession({ id: 'c' })],
      }),
    );
    const preview = await previewImport(backup);
    expect(preview).toMatchObject({ total: 3, duplicates: 2 });
    expect(preview.newSessions.map((s) => s.id)).toEqual(['c']);
    expect((await applyImport(backup)).added).toBe(1);
    expect((await db.sessions.get('a'))?.observation).toBe('lokal');
  });

  it('liest alte Backups (Version 1): Haltungen, Hintergrund, Freitexte', async () => {
    const old = {
      app: 'meditationsprotokoll',
      format: 1,
      exportedAt: '2026-11-12T10:00:00.000Z',
      postures: [
        { id: 'zz', name: 'LIEGEN', order: 0, archived: false },
        { id: 'k', name: 'Kniebank', order: 1, archived: false },
      ],
      sessions: [
        { ...makeSession({ id: 'o1', anchor: 'Atem', location: 'Balkon', posture: 'Gehen' }), background: 'Vögel' },
      ],
    };
    const backup = parseBackup(JSON.stringify(old));
    expect(backup.sessions[0].observation).toBe('Ruhig\n\nHintergrund: Vögel');
    expect('background' in backup.sessions[0]).toBe(false);

    const preview = await previewImport(backup);
    // alte Freitexte bei Anker/Ort werden NICHT automatisch zu Optionen
    expect(preview.newOptionNames).toEqual(['Kniebank (Haltung)', 'Gehen (Haltung)']);
    await applyImport(backup);
    expect((await listOptions('posture')).map((p) => p.name)).toEqual(['Schneidersitz', 'Fersensitz', 'Liegen', 'Kniebank', 'Gehen']);
    expect((await db.sessions.get('o1'))?.anchor).toBe('Atem');
  });

  it('lehnt fremde oder kaputte Dateien ab', () => {
    expect(() => parseBackup('kein json')).toThrow(BackupError);
    expect(() => parseBackup('{"foo":1}')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ app: 'meditationsprotokoll', sessions: [{ id: 'x' }] }))).toThrow(/unvollständig/);
  });
});
