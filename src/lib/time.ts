import type { TimeOfDay } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Sekunden → ganze Minuten, immer abgerundet. */
export function floorMinutes(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.floor(seconds / 60);
}

/** Gemessene Millisekunden → ganze Sekunden (abgerundet). */
export function msToSeconds(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.floor(ms / 1000);
}

/** Tageszeit aus HH:MM ableiten. */
export function deriveTimeOfDay(startTime?: string): TimeOfDay | undefined {
  if (!startTime) return undefined;
  const m = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim());
  if (!m) return undefined;
  const h = Number(m[1]);
  if (h < 0 || h > 23) return undefined;
  if (h >= 5 && h < 11) return 'Morgen';
  if (h >= 11 && h < 14) return 'Mittag';
  if (h >= 14 && h < 18) return 'Nachmittag';
  if (h >= 18 && h < 22) return 'Abend';
  return 'Nacht';
}

/** Date → YYYY-MM-DD (lokale Zeit) */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date → HH:MM (lokale Zeit) */
export function toHHMM(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** YYYY-MM-DD → lokales Date (Mitternacht) */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** YYYY-MM-DD → TT.MM.JJJJ */
export function formatDateDE(s: string): string {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
}

/** YYYY-MM-DD → TT.MM. */
export function formatDayMonth(s: string): string {
  const [, m, d] = s.split('-');
  return `${d}.${m}.`;
}

export function weekdayShort(s: string): string {
  return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][parseISODate(s).getDay()];
}

export function addDays(s: string, days: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Anzahl Kalendertage von a bis b inklusive (a <= b). */
export function daysBetweenInclusive(a: string, b: string): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Montag der Woche, in der das Datum liegt. */
export function startOfWeek(s: string): string {
  const d = parseISODate(s);
  const diff = (d.getDay() + 6) % 7; // Mo=0
  d.setDate(d.getDate() - diff);
  return toISODate(d);
}

/** Stoppuhr-Anzeige mm:ss bzw. h:mm:ss */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Minuten lesbar: "45 Min." oder "1 Std. 05 Min." */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} Std.` : `${h} Std. ${pad(m)} Min.`;
}

export function formatTimestampDE(iso: string): string {
  const d = new Date(iso);
  return `${formatDateDE(toISODate(d))}, ${toHHMM(d)} Uhr`;
}
