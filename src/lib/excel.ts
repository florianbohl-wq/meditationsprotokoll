import type { Workbook } from 'exceljs';
import type { Session } from '../types';
import type { KeyFigures } from './stats';
import { formatDateDE } from './time';

export interface ExcelColumn {
  header: string;
  key: keyof ExcelRow;
  width: number;
}

export interface ExcelRow {
  date: Date;
  startTime: string;
  timeOfDay: string;
  durationMinutes: number;
  durationSeconds: number;
  anchor: string;
  observation: string;
  posture: string;
  location: string;
  background: string;
  createdAt: Date;
  updatedAt: Date;
  id: string;
}

export const PROTOCOL_COLUMNS: ExcelColumn[] = [
  { header: 'Datum', key: 'date', width: 12 },
  { header: 'Startzeit', key: 'startTime', width: 10 },
  { header: 'Tageszeit', key: 'timeOfDay', width: 12 },
  { header: 'Dauer (Min.)', key: 'durationMinutes', width: 12 },
  { header: 'Dauer (Sek.)', key: 'durationSeconds', width: 12 },
  { header: 'Anker', key: 'anchor', width: 30 },
  { header: 'Beobachtung', key: 'observation', width: 60 },
  { header: 'Haltung', key: 'posture', width: 14 },
  { header: 'Ort', key: 'location', width: 18 },
  { header: 'Hintergrund', key: 'background', width: 20 },
  { header: 'Erstellt', key: 'createdAt', width: 17 },
  { header: 'Geändert', key: 'updatedAt', width: 17 },
  { header: 'ID', key: 'id', width: 38 },
];

/** Kalenderdatum als echtes Excel-Datum (UTC-Mitternacht, damit keine Zeitzonen-Verschiebung entsteht). */
export function excelDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Zeitstempel in lokaler Wandzeit als Excel-Datum. */
function excelDateTime(iso: string): Date {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
}

export function toExcelRow(s: Session): ExcelRow {
  return {
    date: excelDate(s.date),
    startTime: s.startTime ?? '',
    timeOfDay: s.timeOfDay ?? '',
    durationMinutes: s.durationMinutes,
    durationSeconds: s.durationSeconds,
    anchor: s.anchor,
    observation: s.observation,
    posture: s.posture ?? '',
    location: s.location ?? '',
    background: s.background ?? '',
    createdAt: excelDateTime(s.createdAt),
    updatedAt: excelDateTime(s.updatedAt),
    id: s.id,
  };
}

/** Älteste zuerst – so liest sich das Protokoll in Excel chronologisch. */
export function buildProtocolRows(sessions: Session[]): ExcelRow[] {
  return [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
    .map(toExcelRow);
}

export function statisticRows(k: KeyFigures, scopeLabel: string): [string, string | number][] {
  return [
    ['Umfang', scopeLabel],
    ['Zeitraum', k.periodFrom && k.periodTo ? `${formatDateDE(k.periodFrom)} – ${formatDateDE(k.periodTo)}` : '–'],
    ['Anzahl Sitzungen', k.count],
    ['Gesamtminuten', k.totalMinutes],
    ['Ø Dauer (Min.)', k.avgMinutes],
    ['Längste Sitzung (Min.)', k.longestMinutes],
    ['Tage mit Sitzung', k.daysWithSession],
    ['Tage im Zeitraum', k.periodDays],
    ['Anteil Tage mit Sitzung', k.dayRatio],
  ];
}

export async function buildWorkbook(sessions: Session[], k: KeyFigures, scopeLabel: string): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Meditationsprotokoll';
  wb.created = new Date();

  const ws = wb.addWorksheet('Protokoll', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = PROTOCOL_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  for (const row of buildProtocolRows(sessions)) ws.addRow(row);

  ws.getColumn('date').numFmt = 'dd.mm.yyyy';
  ws.getColumn('createdAt').numFmt = 'dd.mm.yyyy hh:mm';
  ws.getColumn('updatedAt').numFmt = 'dd.mm.yyyy hh:mm';
  for (const key of ['anchor', 'observation', 'location', 'background'] as const) {
    ws.getColumn(key).alignment = { wrapText: true, vertical: 'top' };
  }
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3D2B' } };
  header.alignment = { vertical: 'middle' };
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, ws.rowCount), column: PROTOCOL_COLUMNS.length },
  };

  const st = wb.addWorksheet('Statistik');
  st.columns = [
    { header: 'Kennzahl', key: 'label', width: 28 },
    { header: 'Wert', key: 'value', width: 28 },
  ];
  st.getRow(1).font = { bold: true };
  for (const [label, value] of statisticRows(k, scopeLabel)) {
    const r = st.addRow({ label, value });
    if (label === 'Anteil Tage mit Sitzung') r.getCell('value').numFmt = '0%';
    r.getCell('value').alignment = { horizontal: 'left' };
  }
  return wb;
}

export function excelFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `meditationsprotokoll_${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.xlsx`;
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
