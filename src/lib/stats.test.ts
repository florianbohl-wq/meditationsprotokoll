import { describe, expect, it } from 'vitest';
import { makeSession } from '../test/factory';
import { DEFAULT_FILTERS } from './filters';
import { byField, byTimeOfDay, computeKeyFigures, focusDistribution, minutesSeries, todayAndWeek, weeklyAverage, weeklySeries } from './stats';

const TODAY = '2026-11-09'; // Montag

describe('Statistik', () => {
  const list = [
    makeSession({ date: '2026-11-09', durationMinutes: 10, startTime: '07:00', posture: 'Sitzen' }),
    makeSession({ date: '2026-11-09', durationMinutes: 20, startTime: '20:00', posture: 'Liegen' }),
    makeSession({ date: '2026-11-05', durationMinutes: 30, startTime: '07:30', posture: 'Sitzen' }),
    makeSession({ date: '2026-11-04', durationMinutes: 45, startTime: undefined }),
  ];

  it('Kennzahlen im 7-Tage-Zeitraum', () => {
    const k = computeKeyFigures(list, { ...DEFAULT_FILTERS, range: '7' }, TODAY);
    expect(k).toMatchObject({
      count: 4,
      totalMinutes: 105,
      avgMinutes: 26.3,
      longestMinutes: 45,
      daysWithSession: 3,
      periodDays: 7,
      periodFrom: '2026-11-03',
      periodTo: '2026-11-09',
    });
    expect(k.dayRatio).toBeCloseTo(3 / 7);
  });

  it('Zeitraum "alles" beginnt beim ersten Eintrag', () => {
    const k = computeKeyFigures(list, DEFAULT_FILTERS, TODAY);
    expect(k.periodDays).toBe(6); // 04.11. bis 09.11.
    expect(k.dayRatio).toBeCloseTo(3 / 6);
  });

  it('Ø Fokus nur über bestätigte Werte, Wochenverlauf', () => {
    const l = [
      makeSession({ date: '2026-11-09', focus: 6 }),
      makeSession({ date: '2026-11-08', focus: 3 }),
      makeSession({ date: '2026-11-08', focusSuggestion: 1 }),
    ];
    const k = computeKeyFigures(l, DEFAULT_FILTERS, TODAY);
    expect(k).toMatchObject({ avgFocus: 4.5, focusCount: 2, count: 3 });
    expect(weeklyAverage(l, DEFAULT_FILTERS, TODAY, 'focus').map((p) => p.avg)).toEqual([3, 6]);
    expect(computeKeyFigures([makeSession({ focusSuggestion: 4 })], DEFAULT_FILTERS, TODAY).avgFocus).toBeUndefined();
  });

  it('Fokus je Tag, je Woche, je Kategorie und Verteilung', () => {
    const l = [
      makeSession({ date: '2026-11-09', durationMinutes: 10, focus: 6, posture: 'Liegen', startTime: '07:00' }),
      makeSession({ date: '2026-11-09', durationMinutes: 20, focus: 4, posture: 'Liegen', startTime: '20:00' }),
      makeSession({ date: '2026-11-08', durationMinutes: 30, focusSuggestion: 2, posture: 'Liegen', startTime: '07:30' }),
      makeSession({ date: '2026-11-03', durationMinutes: 40, focus: 9, startTime: '07:15' }),
    ];
    const f = { ...DEFAULT_FILTERS, range: '7' as const };
    const day = minutesSeries(l, f, TODAY).points;
    expect(day.find((p) => p.key === '2026-11-09')).toMatchObject({ minutes: 30, focus: 5 });
    expect(day.find((p) => p.key === '2026-11-08')).toMatchObject({ minutes: 30, focus: null }); // nur Vorschlag
    expect(day.find((p) => p.key === '2026-11-05')).toMatchObject({ minutes: 0, focus: null });

    const weeks = weeklySeries(l, DEFAULT_FILTERS, TODAY);
    expect(weeks.map((w) => [w.key, w.avgMinutes, w.focus])).toEqual([
      ['2026-11-02', 35, 9],
      ['2026-11-09', 15, 5],
    ]);

    const liegen = byField(l, 'posture', ['Liegen']).find((b) => b.name === 'Liegen');
    expect(liegen).toMatchObject({ count: 3, avgFocus: 5, focusCount: 2 });
    expect(byTimeOfDay(l).find((b) => b.name === 'Morgen')).toMatchObject({ count: 3, avgFocus: 7.5, focusCount: 2 });
    expect(byTimeOfDay(l).find((b) => b.name === 'Mittag')).toMatchObject({ count: 0, avgFocus: null });

    expect(focusDistribution(l).filter((x) => x.count).map((x) => [x.value, x.count])).toEqual([[4, 1], [6, 1], [9, 1]]);
  });

  it('leere Liste ergibt Nullen', () => {
    const k = computeKeyFigures([], DEFAULT_FILTERS, TODAY);
    expect(k).toMatchObject({ count: 0, totalMinutes: 0, avgMinutes: 0, periodDays: 0, dayRatio: 0 });
  });

  it('Minuten pro Tag bei kurzen Zeiträumen', () => {
    const s = minutesSeries(list, { ...DEFAULT_FILTERS, range: '7' }, TODAY);
    expect(s.unit).toBe('day');
    expect(s.points).toHaveLength(7);
    expect(s.points.at(-1)).toMatchObject({ key: '2026-11-09', minutes: 30 });
    expect(s.points.find((p) => p.key === '2026-11-04')?.minutes).toBe(45);
    expect(s.points.find((p) => p.key === '2026-11-06')?.minutes).toBe(0);
  });

  it('Minuten pro Woche bei langen Zeiträumen', () => {
    const s = minutesSeries([...list, makeSession({ date: '2026-08-03', durationMinutes: 15 })], DEFAULT_FILTERS, TODAY);
    expect(s.unit).toBe('week');
    expect(s.points[0].key).toBe('2026-08-03');
    expect(s.points.at(-1)).toMatchObject({ key: '2026-11-09', minutes: 30 });
    expect(s.points.find((p) => p.key === '2026-11-02')?.minutes).toBe(75);
  });

  it('Ø Dauer je Woche mit Lücken', () => {
    const w = weeklyAverage(
      [makeSession({ date: '2026-10-19', durationMinutes: 10 }), makeSession({ date: '2026-11-03', durationMinutes: 20 }), makeSession({ date: '2026-11-04', durationMinutes: 25 })],
      DEFAULT_FILTERS,
      TODAY,
    );
    expect(w.map((p) => p.avg)).toEqual([10, null, 22.5, null]);
  });

  it('Verteilung nach Tageszeit und Haltung', () => {
    const t = byTimeOfDay(list);
    expect(t.find((b) => b.name === 'Morgen')).toMatchObject({ count: 2, minutes: 40 });
    expect(t.find((b) => b.name === 'ohne Angabe')).toMatchObject({ count: 1 });
    const p = byField(list, 'posture', ['Sitzen', 'Liegen']);
    expect(p.map((b) => [b.name, b.count])).toEqual([
      ['Sitzen', 2],
      ['Liegen', 1],
      ['ohne Angabe', 1],
    ]);
  });

  it('Verteilung nach Anker in Listenreihenfolge', () => {
    const a = byField(
      [makeSession({ anchor: 'Person' }), makeSession({ anchor: 'Keiner/Atem' }), makeSession({ anchor: 'Person' })],
      'anchor',
      ['Podcast/Youtube', 'Spirio/App', 'Keiner/Atem', 'Person'],
    );
    expect(a.map((b) => [b.name, b.count])).toEqual([
      ['Keiner/Atem', 1],
      ['Person', 2],
    ]);
  });

  it('heute / diese Woche', () => {
    const r = todayAndWeek([...list, makeSession({ date: '2026-11-08', durationMinutes: 99 })], TODAY);
    expect(r.today).toEqual({ count: 2, minutes: 30 });
    expect(r.week).toEqual({ count: 2, minutes: 30 }); // Woche beginnt Montag 09.11.
  });
});
