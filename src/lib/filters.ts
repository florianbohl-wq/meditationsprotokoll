import type { Session } from '../types';
import { addDays, formatDateDE, todayISO } from './time';

export type RangeKey = 'all' | '7' | '30' | 'year' | 'custom';

export interface Filters {
  range: RangeKey;
  from: string;
  to: string;
  posture: string;
  timeOfDay: string;
  minDuration: string;
  maxDuration: string;
  text: string;
}

export const DEFAULT_FILTERS: Filters = {
  range: 'all',
  from: '',
  to: '',
  posture: '',
  timeOfDay: '',
  minDuration: '',
  maxDuration: '',
  text: '',
};

export const RANGE_LABELS: Record<RangeKey, string> = {
  '7': '7 Tage',
  '30': '30 Tage',
  year: 'Dieses Jahr',
  all: 'Alles',
  custom: 'Benutzerdefiniert',
};

export const NO_VALUE = '__ohne__';

/** Datumsgrenzen des gewählten Zeitraums (undefined = offen). */
export function rangeBounds(f: Filters, today: string = todayISO()): { from?: string; to?: string } {
  switch (f.range) {
    case '7':
      return { from: addDays(today, -6), to: today };
    case '30':
      return { from: addDays(today, -29), to: today };
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case 'custom':
      return { from: f.from || undefined, to: f.to || undefined };
    default:
      return {};
  }
}

const num = (s: string): number | undefined => {
  if (s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

export function matchesFilters(s: Session, f: Filters, today: string = todayISO()): boolean {
  const { from, to } = rangeBounds(f, today);
  if (from && s.date < from) return false;
  if (to && s.date > to) return false;

  if (f.posture) {
    if (f.posture === NO_VALUE ? !!s.posture : s.posture !== f.posture) return false;
  }
  if (f.timeOfDay) {
    if (f.timeOfDay === NO_VALUE ? !!s.timeOfDay : s.timeOfDay !== f.timeOfDay) return false;
  }
  const min = num(f.minDuration);
  const max = num(f.maxDuration);
  if (min !== undefined && s.durationMinutes < min) return false;
  if (max !== undefined && s.durationMinutes > max) return false;

  const q = f.text.trim().toLocaleLowerCase('de');
  if (q) {
    const hay = [s.anchor, s.observation, s.location ?? '', s.background ?? '']
      .join('\n')
      .toLocaleLowerCase('de');
    // Alle Suchwörter müssen vorkommen
    if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

export function applyFilters(list: Session[], f: Filters, today: string = todayISO()): Session[] {
  return list.filter((s) => matchesFilters(s, f, today));
}

export interface FilterChip {
  key: string;
  label: string;
  clear: (f: Filters) => Filters;
}

export function activeFilterChips(f: Filters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.range !== 'all') {
    let label = RANGE_LABELS[f.range];
    if (f.range === 'custom') {
      label = `${f.from ? formatDateDE(f.from) : '…'} – ${f.to ? formatDateDE(f.to) : '…'}`;
    }
    chips.push({ key: 'range', label, clear: (x) => ({ ...x, range: 'all', from: '', to: '' }) });
  }
  if (f.posture) {
    chips.push({
      key: 'posture',
      label: `Haltung: ${f.posture === NO_VALUE ? 'ohne Angabe' : f.posture}`,
      clear: (x) => ({ ...x, posture: '' }),
    });
  }
  if (f.timeOfDay) {
    chips.push({
      key: 'timeOfDay',
      label: `Tageszeit: ${f.timeOfDay === NO_VALUE ? 'ohne Angabe' : f.timeOfDay}`,
      clear: (x) => ({ ...x, timeOfDay: '' }),
    });
  }
  if (f.minDuration.trim() || f.maxDuration.trim()) {
    const a = f.minDuration.trim();
    const b = f.maxDuration.trim();
    const label = a && b ? `${a}–${b} Min.` : a ? `ab ${a} Min.` : `bis ${b} Min.`;
    chips.push({ key: 'duration', label: `Dauer ${label}`, clear: (x) => ({ ...x, minDuration: '', maxDuration: '' }) });
  }
  if (f.text.trim()) {
    chips.push({ key: 'text', label: `„${f.text.trim()}“`, clear: (x) => ({ ...x, text: '' }) });
  }
  return chips;
}
