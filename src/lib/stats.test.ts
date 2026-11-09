import { describe, expect, it } from 'vitest';
import { makeSession } from '../test/factory';
import { DEFAULT_FILTERS } from './filters';
import { byPosture, byTimeOfDay, computeKeyFigures, minutesSeries, todayAndWeek, topValues, weeklyAverage } from './stats';

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
    const p = byPosture(list, ['Sitzen', 'Liegen']);
    expect(p.map((b) => [b.name, b.count])).toEqual([
      ['Sitzen', 2],
      ['Liegen', 1],
      ['ohne Angabe', 1],
    ]);
  });

  it('Top-Listen gruppieren case-insensitiv', () => {
    const top = topValues(['Wohnzimmer', 'wohnzimmer', 'Wohnzimmer ', 'Balkon', undefined, '', 'balkon', 'Park']);
    expect(top).toEqual([
      { label: 'Wohnzimmer', count: 3 },
      { label: 'Balkon', count: 2 },
      { label: 'Park', count: 1 },
    ]);
  });

  it('heute / diese Woche', () => {
    const r = todayAndWeek([...list, makeSession({ date: '2026-11-08', durationMinutes: 99 })], TODAY);
    expect(r.today).toEqual({ count: 2, minutes: 30 });
    expect(r.week).toEqual({ count: 2, minutes: 30 }); // Woche beginnt Montag 09.11.
  });
});
