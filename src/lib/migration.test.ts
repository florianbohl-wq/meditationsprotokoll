import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { ProtocolDB, SCHEMA_V1 } from '../db';

/** Simuliert das Handy: Datenbank der veröffentlichten Version 1 → Update auf Version 2. */
describe('Umstellung Datenbank Version 1 → 2', () => {
  it('übernimmt Haltungen, legt Anker/Orte an, hängt Hintergrund an, behält alte Freitexte', async () => {
    const name = `migration-${Math.random()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores(SCHEMA_V1);
    await v1.open();
    await v1.table('postures').bulkAdd([
      { id: 'p1', name: 'Schneidersitz', order: 0, archived: false },
      { id: 'p2', name: 'Fersensitz', order: 1, archived: false },
      { id: 'p3', name: 'Liegen', order: 2, archived: true },
    ]);
    const base = { durationSeconds: 1200, durationMinutes: 20, createdAt: '2026-11-10T07:00:00.000Z', updatedAt: '2026-11-10T07:00:00.000Z' };
    await v1.table('sessions').bulkAdd([
      { ...base, id: 's1', date: '2026-11-10', anchor: 'Atem an den Nasenlöchern', observation: 'Ruhig.', posture: 'Schneidersitz', location: 'Wohnzimmer', background: 'Regengeräusche' },
      { ...base, id: 's2', date: '2026-11-11', anchor: 'person', observation: 'Gut.', location: 'reise' },
      { ...base, id: 's3', date: '2026-11-12', anchor: 'Spirio', observation: 'Müde.', background: '  ' },
    ]);
    v1.close();

    const v2 = new ProtocolDB(name);
    await v2.open();

    const opts = await v2.options.toArray();
    const byKind = (k: string) => opts.filter((o) => o.kind === k).sort((a, b) => a.order - b.order);
    expect(byKind('posture').map((o) => [o.id, o.name, o.archived])).toEqual([
      ['p1', 'Schneidersitz', false],
      ['p2', 'Fersensitz', false],
      ['p3', 'Liegen', true],
    ]);
    expect(byKind('anchor').map((o) => o.name)).toEqual(['Podcast/Youtube', 'Spirio/App', 'Keiner/Atem', 'Person']);
    expect(byKind('location').map((o) => o.name)).toEqual(['Zu Hause oben', 'Zu Hause unten', 'Event', 'Bekannte/Familie', 'Reise']);

    const s = Object.fromEntries((await v2.sessions.toArray()).map((x) => [x.id, x]));
    // Hintergrund an Beobachtung angehängt, Feld entfernt
    expect(s.s1.observation).toBe('Ruhig.\n\nHintergrund: Regengeräusche');
    expect('background' in s.s1).toBe(false);
    expect(s.s3.observation).toBe('Müde.');
    expect('background' in s.s3).toBe(false);
    // Freitexte bleiben unverändert, bis sie zugeordnet werden
    expect(s.s1.anchor).toBe('Atem an den Nasenlöchern');
    expect(s.s1.location).toBe('Wohnzimmer');
    expect(s.s3.anchor).toBe('Spirio');
    // exakte Treffer (Groß/Klein egal) bekommen die Schreibweise der Option
    expect(s.s2.anchor).toBe('Person');
    expect(s.s2.location).toBe('Reise');
    // übrige Felder unverändert
    expect(s.s1).toMatchObject({ date: '2026-11-10', posture: 'Schneidersitz', durationMinutes: 20, createdAt: base.createdAt });
    // neue Indizes funktionieren
    expect(await v2.sessions.where('location').equals('Reise').count()).toBe(1);
    expect(await v2.sessions.count()).toBe(3);

    v2.close();
    await Dexie.delete(name);
  });

  it('neue Datenbank startet mit allen Standardlisten', async () => {
    const name = `fresh-${Math.random()}`;
    const d = new ProtocolDB(name);
    await d.open();
    expect(await d.options.where('kind').equals('anchor').count()).toBe(4);
    expect(await d.options.where('kind').equals('location').count()).toBe(5);
    expect(await d.options.where('kind').equals('posture').count()).toBe(3);
    d.close();
    await Dexie.delete(name);
  });
});
