import { describe, expect, it } from 'vitest';
import { makeSession } from '../test/factory';
import { activeFilterChips, applyFilters, DEFAULT_FILTERS, NO_VALUE, type Filters } from './filters';

const TODAY = '2026-11-09';
const list = [
  makeSession({ id: '1', date: '2026-11-09', durationMinutes: 10, posture: 'Sitzen', startTime: '07:00', anchor: 'Atem an den Nasenlöchern' }),
  makeSession({ id: '2', date: '2026-11-03', durationMinutes: 25, posture: 'Liegen', startTime: '20:00', location: 'Balkon' }),
  makeSession({ id: '3', date: '2026-10-15', durationMinutes: 40, posture: 'Sitzen', startTime: '12:30', background: 'Regengeräusche' }),
  makeSession({ id: '4', date: '2026-02-01', durationMinutes: 5, startTime: undefined, observation: 'Unruhe im Körper' }),
  makeSession({ id: '5', date: '2025-12-31', durationMinutes: 30, posture: 'Sitzen', startTime: '23:00' }),
];
const ids = (f: Partial<Filters>) => applyFilters(list, { ...DEFAULT_FILTERS, ...f }, TODAY).map((s) => s.id);

describe('Filterlogik', () => {
  it('ohne Filter alles', () => {
    expect(ids({})).toEqual(['1', '2', '3', '4', '5']);
  });

  it('Zeiträume', () => {
    expect(ids({ range: '7' })).toEqual(['1', '2']);
    expect(ids({ range: '30' })).toEqual(['1', '2', '3']);
    expect(ids({ range: 'year' })).toEqual(['1', '2', '3', '4']);
    expect(ids({ range: 'custom', from: '2026-10-01', to: '2026-11-03' })).toEqual(['2', '3']);
    expect(ids({ range: 'custom', from: '', to: '2026-02-01' })).toEqual(['4', '5']);
  });

  it('Haltung und Tageszeit inkl. "ohne Angabe"', () => {
    expect(ids({ posture: 'Sitzen' })).toEqual(['1', '3', '5']);
    expect(ids({ posture: NO_VALUE })).toEqual(['4']);
    expect(ids({ timeOfDay: 'Abend' })).toEqual(['2']);
    expect(ids({ timeOfDay: 'Nacht' })).toEqual(['5']);
    expect(ids({ timeOfDay: NO_VALUE })).toEqual(['4']);
  });

  it('Dauer von–bis (inklusive)', () => {
    expect(ids({ minDuration: '25' })).toEqual(['2', '3', '5']);
    expect(ids({ maxDuration: '10' })).toEqual(['1', '4']);
    expect(ids({ minDuration: '10', maxDuration: '30' })).toEqual(['1', '2', '5']);
  });

  it('Freitextsuche über Anker, Beobachtung, Ort, Hintergrund (case-insensitiv)', () => {
    expect(ids({ text: 'nasen' })).toEqual(['1']);
    expect(ids({ text: 'BALKON' })).toEqual(['2']);
    expect(ids({ text: 'regen' })).toEqual(['3']);
    expect(ids({ text: 'unruhe körper' })).toEqual(['4']);
    expect(ids({ text: 'unruhe balkon' })).toEqual([]);
  });

  it('Kombination', () => {
    expect(ids({ range: 'year', posture: 'Sitzen', minDuration: '20' })).toEqual(['3']);
  });

  it('aktive Filter als Chips, einzeln entfernbar', () => {
    const f: Filters = { ...DEFAULT_FILTERS, range: '30', posture: 'Sitzen', text: 'atem' };
    const chips = activeFilterChips(f);
    expect(chips.map((c) => c.key)).toEqual(['range', 'posture', 'text']);
    const cleared = chips[1].clear(f);
    expect(cleared.posture).toBe('');
    expect(cleared.range).toBe('30');
    expect(activeFilterChips(DEFAULT_FILTERS)).toEqual([]);
  });
});
