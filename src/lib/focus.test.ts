import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { db, ProtocolDB } from '../db';
import { makeSession } from '../test/factory';
import { suggestFocus, SUGGESTION_MAX, withFocusSuggestion } from './focus';
import { confirmFocus, draftFromSession, emptyDraft, sessionFromDraft, validateDraft } from './sessions';

describe('Fokus-Vorschlag aus der Beobachtung', () => {
  it.each([
    ['', 4],
    ['Heute gesessen.', 4],
    ['Sehr klar und wach, ruhig und präsent.', 6],
    ['Ruhig, klar, stabil, präsent, Weite, still, gesammelt.', SUGGESTION_MAX],
    ['Müde, mehrmals eingeschlafen.', 2],
    ['Unruhig, viele Gedanken, abgelenkt, Planen, schwierig.', 1],
    ['Anfangs viel Planen, nach etwa zehn Minuten ruhiger.', 4],
    ['Nicht ruhig, kaum konzentriert.', 2],
    ['Nicht abgelenkt.', 5],
  ])('„%s“ → %i', (text, expected) => {
    expect(suggestFocus(text)).toBe(expected);
  });

  it('ignoriert die angehängte Hintergrund-Zeile aus Version 1.1', () => {
    expect(suggestFocus('Ruhig.\n\nHintergrund: Straßenlärm, laut')).toBe(5);
  });

  it('schlägt nie mehr als 6 und nie weniger als 1 vor', () => {
    const many = 'ruhig klar wach präsent stabil still tief gesammelt angenehm leicht entspannt '.repeat(5);
    expect(suggestFocus(many)).toBe(6);
    expect(suggestFocus('unruhig abgelenkt müde eingeschlafen gedanken planen '.repeat(5))).toBe(1);
  });

  it('bestätigte Werte bleiben, sonst kommt ein Vorschlag dazu', () => {
    expect(withFocusSuggestion(makeSession({ focus: 8 }))).toMatchObject({ focus: 8 });
    expect(withFocusSuggestion(makeSession({ focus: 8 })).focusSuggestion).toBeUndefined();
    const s = withFocusSuggestion(makeSession({ observation: 'müde' }));
    expect(s.focus).toBeUndefined();
    expect(s.focusSuggestion).toBe(3);
  });
});

describe('Fokus im Formular', () => {
  it('ist Pflicht (1–10), Beobachtung ist optional', () => {
    const base = { ...emptyDraft(), durationMinutes: '10', anchor: 'Person' };
    expect(validateDraft(base).focus).toBeTruthy();
    expect(validateDraft({ ...base, focus: '0' }).focus).toBeTruthy();
    expect(validateDraft({ ...base, focus: '11' }).focus).toBeTruthy();
    expect(validateDraft({ ...base, focus: '7' })).toEqual({});
  });

  it('zeigt beim Bearbeiten den Vorschlag; Speichern bestätigt ihn', () => {
    const old = makeSession({ focusSuggestion: 3 });
    const d = draftFromSession(old);
    expect(d).toMatchObject({ focus: '3', focusIsSuggestion: true });
    const saved = sessionFromDraft(d, old);
    expect(saved.focus).toBe(3);
    expect(saved.focusSuggestion).toBeUndefined();
  });

  it('bestätigt mehrere Vorschläge auf einmal', async () => {
    await db.sessions.bulkAdd([makeSession({ id: 'a', focusSuggestion: 3 }), makeSession({ id: 'b', focusSuggestion: 5 })]);
    expect(await confirmFocus([{ id: 'a', focus: 3 }, { id: 'b', focus: 7 }])).toBe(2);
    const a = await db.sessions.get('a');
    const b = await db.sessions.get('b');
    expect([a?.focus, a?.focusSuggestion, b?.focus, b?.focusSuggestion]).toEqual([3, undefined, 7, undefined]);
    await expect(confirmFocus([{ id: 'a', focus: 12 }])).rejects.toThrow();
  });
});

describe('Umstellung Datenbank Version 2 → 3 (Handy mit Version 1.1)', () => {
  it('ergänzt Fokus-Vorschläge und lässt alles andere unverändert', async () => {
    const name = `v2-${Math.random()}`;
    const v2 = new Dexie(name);
    v2.version(2).stores({ sessions: 'id, date, posture, anchor, location', options: 'id, kind, [kind+order]', meta: 'key' });
    await v2.open();
    await v2.table('options').add({ id: 'o1', kind: 'anchor', name: 'Person', order: 0, archived: false });
    await v2.table('sessions').bulkAdd([
      { ...makeSession({ id: 's1', observation: 'Ruhig und klar.', anchor: 'Person', location: 'Reise' }), anchorOriginal: 'person alt' },
      makeSession({ id: 's2', observation: 'Müde und abgelenkt.\n\nHintergrund: Regen' }),
    ]);
    v2.close();

    const v3 = new ProtocolDB(name);
    await v3.open();
    const s1 = await v3.sessions.get('s1');
    const s2 = await v3.sessions.get('s2');
    expect(s1).toMatchObject({ focusSuggestion: 6, anchor: 'Person', location: 'Reise', anchorOriginal: 'person alt', observation: 'Ruhig und klar.' });
    expect(s1?.focus).toBeUndefined();
    expect(s2?.focusSuggestion).toBe(2);
    expect(await v3.options.count()).toBe(1);
    v3.close();
    await Dexie.delete(name);
  });
});
