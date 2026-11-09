import { describe, expect, it } from 'vitest';
import { deriveTimeOfDay, floorMinutes, formatClock, formatDateDE, startOfWeek } from './time';
import { resolveDuration, sessionFromDraft, emptyDraft, validateDraft } from './sessions';
import { elapsedMs, finishTimer, pauseTimer, resumeTimer, startTimer } from './timer';

describe('Dauerberechnung und Abrunden', () => {
  it('rundet immer ab, nie auf', () => {
    expect(floorMinutes(0)).toBe(0);
    expect(floorMinutes(59)).toBe(0);
    expect(floorMinutes(60)).toBe(1);
    expect(floorMinutes(599)).toBe(9);
    expect(floorMinutes(1199.9)).toBe(19);
    expect(floorMinutes(-5)).toBe(0);
  });

  it('behält gemessene Sekunden, wenn die Minuten passen', () => {
    expect(resolveDuration('19', 1199)).toEqual({ durationMinutes: 19, durationSeconds: 1199 });
  });

  it('nimmt manuell geänderte Minuten als neue Dauer', () => {
    expect(resolveDuration('25', 1199)).toEqual({ durationMinutes: 25, durationSeconds: 1500 });
    expect(resolveDuration('10')).toEqual({ durationMinutes: 10, durationSeconds: 600 });
  });

  it('Stoppuhr rechnet über Zeitstempel inkl. Pause', () => {
    const t0 = 1_000_000;
    let t = startTimer(t0);
    expect(elapsedMs(t, t0 + 65_000)).toBe(65_000);
    t = pauseTimer(t, t0 + 65_000);
    expect(elapsedMs(t, t0 + 500_000)).toBe(65_000);
    t = resumeTimer(t, t0 + 500_000);
    expect(elapsedMs(t, t0 + 510_000)).toBe(75_000);
    t = finishTimer(t, t0 + 520_000);
    expect(t.status).toBe('finished');
    expect(elapsedMs(t, t0 + 9_999_999)).toBe(85_000);
  });

  it('formatiert die Stoppuhr', () => {
    expect(formatClock(5)).toBe('00:05');
    expect(formatClock(754)).toBe('12:34');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});

describe('Tageszeit-Ableitung', () => {
  it.each([
    ['04:59', 'Nacht'],
    ['05:00', 'Morgen'],
    ['10:59', 'Morgen'],
    ['11:00', 'Mittag'],
    ['13:59', 'Mittag'],
    ['14:00', 'Nachmittag'],
    ['17:59', 'Nachmittag'],
    ['18:00', 'Abend'],
    ['21:59', 'Abend'],
    ['22:00', 'Nacht'],
    ['00:30', 'Nacht'],
    ['7:15', 'Morgen'],
  ])('%s → %s', (t, expected) => {
    expect(deriveTimeOfDay(t)).toBe(expected);
  });

  it('liefert nichts ohne gültige Startzeit', () => {
    expect(deriveTimeOfDay(undefined)).toBeUndefined();
    expect(deriveTimeOfDay('')).toBeUndefined();
    expect(deriveTimeOfDay('25:00')).toBeUndefined();
  });

  it('wird beim Speichern aus der Startzeit berechnet', () => {
    const s = sessionFromDraft({
      ...emptyDraft(new Date(2026, 10, 9)),
      startTime: '19:45',
      durationMinutes: '20',
      anchor: 'Atem',
      observation: 'x',
    });
    expect(s.timeOfDay).toBe('Abend');
    expect(s.date).toBe('2026-11-09');
  });
});

describe('Validierung', () => {
  it('meldet alle vier Pflichtfelder', () => {
    const e = validateDraft({ ...emptyDraft(), date: '' });
    expect(Object.keys(e).sort()).toEqual(['anchor', 'date', 'durationMinutes', 'observation']);
  });
  it('lehnt 0 Minuten und Kommazahlen ab', () => {
    const base = { ...emptyDraft(), anchor: 'a', observation: 'b' };
    expect(validateDraft({ ...base, durationMinutes: '0' }).durationMinutes).toBeTruthy();
    expect(validateDraft({ ...base, durationMinutes: '2.5' }).durationMinutes).toBeTruthy();
    expect(validateDraft({ ...base, durationMinutes: '15' })).toEqual({});
  });
});

describe('Datumshilfen', () => {
  it('formatiert deutsch und findet den Wochenanfang (Montag)', () => {
    expect(formatDateDE('2026-11-09')).toBe('09.11.2026');
    expect(startOfWeek('2026-11-09')).toBe('2026-11-09'); // Montag
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09'); // Sonntag
  });
});
