import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { makeSession } from '../test/factory';
import { DEFAULT_FILTERS } from './filters';
import { computeKeyFigures } from './stats';
import { buildProtocolRows, buildWorkbook, excelFileName, PROTOCOL_COLUMNS } from './excel';

describe('Excel-Export', () => {
  const list = [
    makeSession({ id: 'b', date: '2026-11-09', startTime: '07:15', durationMinutes: 21, durationSeconds: 1265, anchor: 'Atem', observation: 'Ruhig', posture: 'Sitzen', location: 'Balkon' }),
    makeSession({ id: 'a', date: '2026-01-31', startTime: undefined, durationMinutes: 5 }),
  ];

  it('hat deutsche Spaltenüberschriften in fester Reihenfolge', () => {
    expect(PROTOCOL_COLUMNS.map((c) => c.header)).toEqual([
      'Datum',
      'Startzeit',
      'Tageszeit',
      'Dauer (Min.)',
      'Dauer (Sek.)',
      'Anker',
      'Beobachtung',
      'Haltung',
      'Ort',
      'Hintergrund',
      'Erstellt',
      'Geändert',
      'ID',
    ]);
    expect(PROTOCOL_COLUMNS.every((c) => c.width > 0)).toBe(true);
  });

  it('baut Zeilen chronologisch mit echtem Datum', () => {
    const rows = buildProtocolRows(list);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(rows[1].date).toBeInstanceOf(Date);
    expect(rows[1].date.toISOString()).toBe('2026-11-09T00:00:00.000Z');
    expect(rows[1]).toMatchObject({ startTime: '07:15', timeOfDay: 'Morgen', durationMinutes: 21, durationSeconds: 1265, posture: 'Sitzen', location: 'Balkon', background: '' });
    expect(rows[0]).toMatchObject({ startTime: '', timeOfDay: '', posture: '' });
  });

  it('erzeugt eine Arbeitsmappe mit beiden Blättern, Autofilter und fixierter Kopfzeile', async () => {
    const wb = await buildWorkbook(list, computeKeyFigures(list, DEFAULT_FILTERS, '2026-11-09'), 'Alle Einträge');
    const buf = await wb.xlsx.writeBuffer();
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(buf as ArrayBuffer);
    const ws = back.getWorksheet('Protokoll')!;
    expect(ws.getRow(1).getCell(1).value).toBe('Datum');
    expect(ws.rowCount).toBe(3);
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(ws.autoFilter).toBeTruthy();
    const dateCell = ws.getRow(3).getCell(1);
    expect(dateCell.value).toBeInstanceOf(Date);
    expect(dateCell.numFmt).toBe('dd.mm.yyyy');
    const st = back.getWorksheet('Statistik')!;
    expect(st.getRow(4).values).toEqual([undefined, 'Anzahl Sitzungen', 2]);
  });

  it('Dateiname mit Datum', () => {
    expect(excelFileName(new Date(2026, 10, 9))).toBe('meditationsprotokoll_2026-11-09.xlsx');
  });
});
