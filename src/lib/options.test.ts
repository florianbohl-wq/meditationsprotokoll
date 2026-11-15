import { describe, expect, it } from 'vitest';
import { db } from '../db';
import { makeSession } from '../test/factory';
import {
  addOption,
  applyMapping,
  deleteOption,
  findUnmapped,
  listOptions,
  moveOption,
  OptionError,
  renameOption,
  setOptionArchived,
} from './options';
import { suggestOption } from './legacy';

const names = async (k: 'posture' | 'anchor' | 'location') => (await listOptions(k)).map((p) => p.name);

describe('Auswahllisten', () => {
  it('starten mit den Standardwerten', async () => {
    expect(await names('posture')).toEqual(['Schneidersitz', 'Fersensitz', 'Liegen']);
    expect(await names('anchor')).toEqual(['Podcast/Youtube', 'Spirio/App', 'Keiner/Atem', 'Person']);
    expect(await names('location')).toEqual(['Zu Hause oben', 'Zu Hause unten', 'Event', 'Bekannte/Familie', 'Reise']);
  });

  it('Umbenennen aktualisiert alle bestehenden Einträge (nur im richtigen Feld)', async () => {
    const person = (await listOptions('anchor'))[3];
    await db.sessions.bulkAdd([
      makeSession({ id: 'a', anchor: 'Person' }),
      makeSession({ id: 'b', anchor: 'Person', location: 'Reise' }),
      makeSession({ id: 'c', anchor: 'Keiner/Atem' }),
    ]);
    await renameOption(person.id, 'Lehrer/in');
    const byId = Object.fromEntries((await db.sessions.toArray()).map((s) => [s.id, s.anchor]));
    expect(byId).toEqual({ a: 'Lehrer/in', b: 'Lehrer/in', c: 'Keiner/Atem' });

    const schneidersitz = (await listOptions('posture'))[0];
    await db.sessions.add(makeSession({ id: 'd', posture: 'Schneidersitz' }));
    await renameOption(schneidersitz.id, 'Schneidersitz auf Kissen');
    expect((await db.sessions.get('d'))?.posture).toBe('Schneidersitz auf Kissen');
  });

  it('verhindert doppelte Namen innerhalb einer Liste, erlaubt sie listenübergreifend', async () => {
    const [oben] = await listOptions('location');
    await expect(renameOption(oben.id, 'reise')).rejects.toBeInstanceOf(OptionError);
    await renameOption(oben.id, 'ZU HAUSE OBEN');
    expect((await db.options.get(oben.id))?.name).toBe('ZU HAUSE OBEN');
    // gleicher Name in anderer Liste ist erlaubt
    const p = await addOption('posture', 'Person');
    expect(p.kind).toBe('posture');
  });

  it('Hinzufügen erkennt vorhandene Namen und reaktiviert archivierte', async () => {
    const reise = (await listOptions('location'))[4];
    await setOptionArchived(reise.id, true);
    const again = await addOption('location', '  REISE ');
    expect(again.id).toBe(reise.id);
    expect((await db.options.get(reise.id))?.archived).toBe(false);
    const park = await addOption('location', 'Park');
    expect(park.order).toBe(5);
  });

  it('löscht nur unbenutzte Optionen', async () => {
    const [podcast, spirio] = await listOptions('anchor');
    await db.sessions.add(makeSession({ anchor: 'Podcast/Youtube' }));
    await expect(deleteOption(podcast.id)).rejects.toBeInstanceOf(OptionError);
    await deleteOption(spirio.id);
    expect(await names('anchor')).toEqual(['Podcast/Youtube', 'Keiner/Atem', 'Person']);
  });

  it('ändert die Reihenfolge nur innerhalb der Liste', async () => {
    const liegen = (await listOptions('posture'))[2];
    await moveOption(liegen.id, -1);
    await moveOption(liegen.id, -1);
    await moveOption(liegen.id, -1); // bereits oben
    expect(await names('posture')).toEqual(['Liegen', 'Schneidersitz', 'Fersensitz']);
    expect(await names('anchor')).toEqual(['Podcast/Youtube', 'Spirio/App', 'Keiner/Atem', 'Person']);
  });
});

describe('Zuordnung alter Freitexte', () => {
  it('findet nicht zugeordnete Werte mit Anzahl', async () => {
    const sessions = [
      makeSession({ anchor: 'Atem an den Nasenlöchern', location: 'Wohnzimmer' }),
      makeSession({ anchor: 'Atem an den Nasenlöchern' }),
      makeSession({ anchor: 'Person', location: 'Reise' }),
    ];
    const options = await db.options.toArray();
    expect(findUnmapped('anchor', sessions, options)).toEqual([{ value: 'Atem an den Nasenlöchern', count: 2, variants: ['Atem an den Nasenlöchern'] }]);
    expect(findUnmapped('location', sessions, options)).toEqual([{ value: 'Wohnzimmer', count: 1, variants: ['Wohnzimmer'] }]);
  });

  it('fasst Schreibvarianten zusammen (häufigste zuerst)', async () => {
    const sessions = [
      makeSession({ location: 'wohnzimmer' }),
      makeSession({ location: 'Wohnzimmer' }),
      makeSession({ location: 'Wohnzimmer' }),
      makeSession({ location: 'WOHNZIMMER ' }),
    ];
    expect(findUnmapped('location', sessions, await db.options.toArray())).toEqual([
      { value: 'Wohnzimmer', count: 4, variants: ['Wohnzimmer', 'wohnzimmer', 'WOHNZIMMER '] },
    ]);
  });

  it('ordnet zu und bewahrt den ursprünglichen Text', async () => {
    await db.sessions.bulkAdd([
      makeSession({ id: '1', anchor: 'Atem an den Nasenlöchern', location: 'Wohnzimmer' }),
      makeSession({ id: '2', anchor: 'Atem an den Nasenlöchern', location: 'Garten' }),
      makeSession({ id: '3', anchor: 'Musik', location: 'irgendwo' }),
    ]);
    expect(await applyMapping('anchor', { 'Atem an den Nasenlöchern': { type: 'option', name: 'Keiner/Atem' }, Musik: { type: 'new' } })).toBe(3);
    expect(await applyMapping('location', { Wohnzimmer: { type: 'option', name: 'Zu Hause unten' }, irgendwo: { type: 'clear' } })).toBe(2);

    const s = Object.fromEntries((await db.sessions.toArray()).map((x) => [x.id, x]));
    expect(s['1']).toMatchObject({ anchor: 'Keiner/Atem', anchorOriginal: 'Atem an den Nasenlöchern', location: 'Zu Hause unten', locationOriginal: 'Wohnzimmer' });
    expect(s['2']).toMatchObject({ anchor: 'Keiner/Atem', location: 'Garten' }); // Garten bleibt offen
    expect(s['2'].locationOriginal).toBeUndefined();
    // „neu übernehmen“: Wert bleibt, wird zur Option
    expect(s['3']).toMatchObject({ anchor: 'Musik' });
    expect(s['3'].anchorOriginal).toBeUndefined();
    expect(await names('anchor')).toContain('Musik');
    // „leeren“: Ort weg, Text aufbewahrt
    expect(s['3'].location).toBeUndefined();
    expect(s['3'].locationOriginal).toBe('irgendwo');
  });

  it('Anker kann nicht geleert werden, Ziel muss existieren', async () => {
    await expect(applyMapping('anchor', { x: { type: 'clear' } })).rejects.toBeInstanceOf(OptionError);
    await db.sessions.add(makeSession({ anchor: 'x' }));
    await expect(applyMapping('anchor', { x: { type: 'option', name: 'Gibt es nicht' } })).rejects.toBeInstanceOf(OptionError);
    expect((await db.sessions.toArray())[0].anchor).toBe('x');
  });

  it('schlägt passende Optionen vor', () => {
    const a = ['Podcast/Youtube', 'Spirio/App', 'Keiner/Atem', 'Person'];
    expect(suggestOption('anchor', 'Atem an den Nasenlöchern', a)).toBe('Keiner/Atem');
    expect(suggestOption('anchor', 'Youtube-Meditation', a)).toBe('Podcast/Youtube');
    expect(suggestOption('anchor', 'Spirio Bodyscan', a)).toBe('Spirio/App');
    expect(suggestOption('anchor', 'Mantra', a)).toBeUndefined();
    const l = ['Zu Hause oben', 'Zu Hause unten', 'Event', 'Bekannte/Familie', 'Reise'];
    expect(suggestOption('location', 'Schlafzimmer oben', l)).toBe('Zu Hause oben');
    expect(suggestOption('location', 'Wohnzimmer', l)).toBe('Zu Hause unten');
    expect(suggestOption('location', 'Hotel Lissabon', l)).toBe('Reise');
    expect(suggestOption('location', 'Bei den Eltern', l)).toBe('Bekannte/Familie');
    expect(suggestOption('location', 'Bei Mama', l)).toBe('Bekannte/Familie');
    expect(suggestOption('location', 'Retreat im Allgäu', l)).toBe('Event');
    expect(suggestOption('location', 'Park', l)).toBeUndefined();
  });
});
