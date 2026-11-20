import { TIMES_OF_DAY, type Session } from '../types';
import { rangeBounds, type Filters } from './filters';
import { addDays, daysBetweenInclusive, formatDayMonth, startOfWeek, todayISO, weekdayShort } from './time';

export interface KeyFigures {
  count: number;
  totalMinutes: number;
  avgMinutes: number;
  longestMinutes: number;
  daysWithSession: number;
  periodDays: number;
  /** 0..1 */
  dayRatio: number;
  /** Ø Fokus über bestätigte Werte (undefined, wenn keiner bestätigt) */
  avgFocus?: number;
  /** Anzahl Einträge mit bestätigtem Fokus */
  focusCount: number;
  periodFrom?: string;
  periodTo?: string;
}

/** Tatsächlich betrachteter Zeitraum (für Anteil Tage und Diagramme). */
export function effectivePeriod(
  sessions: Session[],
  f: Filters,
  today: string = todayISO(),
): { from: string; to: string } | undefined {
  const b = rangeBounds(f, today);
  const dates = sessions.map((s) => s.date).sort();
  const from = b.from ?? dates[0];
  let to = b.to ?? today;
  if (!b.to && dates.length && dates[dates.length - 1] > to) to = dates[dates.length - 1];
  if (!from || from > to) return undefined;
  return { from, to };
}

export function computeKeyFigures(sessions: Session[], f: Filters, today: string = todayISO()): KeyFigures {
  const count = sessions.length;
  const totalMinutes = sessions.reduce((a, s) => a + s.durationMinutes, 0);
  const longestMinutes = sessions.reduce((a, s) => Math.max(a, s.durationMinutes), 0);
  const daysWithSession = new Set(sessions.map((s) => s.date)).size;
  const period = effectivePeriod(sessions, f, today);
  const periodDays = period ? daysBetweenInclusive(period.from, period.to) : 0;
  const focused = sessions.filter((s) => typeof s.focus === 'number');
  const focusSum = focused.reduce((a, s) => a + (s.focus ?? 0), 0);
  return {
    count,
    totalMinutes,
    avgMinutes: count ? Math.round((totalMinutes / count) * 10) / 10 : 0,
    longestMinutes,
    daysWithSession,
    periodDays,
    dayRatio: periodDays ? Math.min(1, daysWithSession / periodDays) : 0,
    avgFocus: focused.length ? Math.round((focusSum / focused.length) * 10) / 10 : undefined,
    focusCount: focused.length,
    periodFrom: period?.from,
    periodTo: period?.to,
  };
}

/** Durchschnitt mit einer Nachkommastelle; null, wenn keine Werte */
const avg1 = (sum: number, n: number): number | null => (n ? Math.round((sum / n) * 10) / 10 : null);

/** Sammelt Minuten und bestätigten Fokus je Schlüssel. */
class Acc {
  minutes = 0;
  count = 0;
  focusSum = 0;
  focusN = 0;
  add(s: Session) {
    this.minutes += s.durationMinutes;
    this.count += 1;
    if (typeof s.focus === 'number') {
      this.focusSum += s.focus;
      this.focusN += 1;
    }
  }
}

export interface MinutesPoint {
  key: string;
  label: string;
  minutes: number;
  /** Ø bestätigter Fokus in diesem Zeitraum, null = keiner */
  focus: number | null;
}

export interface MinutesSeries {
  unit: 'day' | 'week';
  points: MinutesPoint[];
}

/**
 * Minuten und Ø Fokus pro Tag (bis 31 Tage) bzw. pro Woche bei längeren Zeiträumen.
 * Ohne Zeitraum: letzte 30 Tage.
 */
export function minutesSeries(sessions: Session[], f: Filters, today: string = todayISO()): MinutesSeries {
  const period = effectivePeriod(sessions, f, today) ?? { from: addDays(today, -29), to: today };
  const days = daysBetweenInclusive(period.from, period.to);
  const unit: 'day' | 'week' = days <= 31 ? 'day' : 'week';
  const keyOf = (date: string) => (unit === 'day' ? date : startOfWeek(date));
  const acc = new Map<string, Acc>();
  for (const s of sessions) {
    const k = keyOf(s.date);
    const a = acc.get(k) ?? new Acc();
    a.add(s);
    acc.set(k, a);
  }
  const points: MinutesPoint[] = [];
  const step = unit === 'day' ? 1 : 7;
  for (let k = keyOf(period.from); k <= period.to; k = addDays(k, step)) {
    const a = acc.get(k);
    points.push({
      key: k,
      label: unit === 'day' && days <= 7 ? `${weekdayShort(k)} ${formatDayMonth(k)}` : formatDayMonth(k),
      minutes: a?.minutes ?? 0,
      focus: a ? avg1(a.focusSum, a.focusN) : null,
    });
  }
  return { unit, points };
}

export interface AvgPoint {
  key: string;
  label: string;
  avg: number | null;
}

export interface WeekPoint {
  key: string;
  label: string;
  /** Ø Dauer in Minuten, null = keine Sitzung */
  avgMinutes: number | null;
  /** Ø bestätigter Fokus, null = keiner */
  focus: number | null;
}

/** Ø Dauer und Ø Fokus je Woche (Wochen ohne Wert = null, damit Linien Lücken überbrücken). */
export function weeklySeries(sessions: Session[], f: Filters, today: string = todayISO()): WeekPoint[] {
  const period = effectivePeriod(sessions, f, today);
  if (!period) return [];
  const acc = new Map<string, Acc>();
  for (const s of sessions) {
    const w = startOfWeek(s.date);
    const a = acc.get(w) ?? new Acc();
    a.add(s);
    acc.set(w, a);
  }
  const out: WeekPoint[] = [];
  for (let w = startOfWeek(period.from); w <= period.to; w = addDays(w, 7)) {
    const a = acc.get(w);
    out.push({
      key: w,
      label: formatDayMonth(w),
      avgMinutes: a ? avg1(a.minutes, a.count) : null,
      focus: a ? avg1(a.focusSum, a.focusN) : null,
    });
  }
  return out;
}

/** Ein Wert pro Woche (für einfache Verläufe). */
export function weeklyAverage(
  sessions: Session[],
  f: Filters,
  today: string = todayISO(),
  value: 'duration' | 'focus' = 'duration',
): AvgPoint[] {
  return weeklySeries(sessions, f, today).map((p) => ({
    key: p.key,
    label: p.label,
    avg: value === 'focus' ? p.focus : p.avgMinutes,
  }));
}

export interface Bucket {
  name: string;
  count: number;
  minutes: number;
  /** Ø bestätigter Fokus, null = keiner */
  avgFocus: number | null;
  /** Anzahl Sitzungen mit bestätigtem Fokus */
  focusCount: number;
}

function toBucket(name: string, a: Acc): Bucket {
  return { name, count: a.count, minutes: a.minutes, avgFocus: avg1(a.focusSum, a.focusN), focusCount: a.focusN };
}

export function byTimeOfDay(sessions: Session[]): Bucket[] {
  const acc = new Map<string, Acc>(TIMES_OF_DAY.map((n) => [n, new Acc()]));
  const none = new Acc();
  for (const s of sessions) (s.timeOfDay ? acc.get(s.timeOfDay)! : none).add(s);
  const out = TIMES_OF_DAY.map((n) => toBucket(n, acc.get(n)!));
  return none.count ? [...out, toBucket('ohne Angabe', none)] : out;
}

/** Verteilung nach einer Auswahlliste (Haltung, Anker, Ort) in der Reihenfolge der Liste. */
export function byField(sessions: Session[], field: 'posture' | 'anchor' | 'location', order: string[] = []): Bucket[] {
  const map = new Map<string, Acc>();
  for (const s of sessions) {
    const name = s[field] || 'ohne Angabe';
    const a = map.get(name) ?? new Acc();
    a.add(s);
    map.set(name, a);
  }
  const rank = (n: string) => {
    if (n === 'ohne Angabe') return Number.MAX_SAFE_INTEGER;
    const i = order.indexOf(n);
    return i < 0 ? order.length : i;
  };
  return [...map.entries()]
    .map(([name, a]) => toBucket(name, a))
    .sort((a, b) => rank(a.name) - rank(b.name) || b.count - a.count);
}

/** Wie oft wurde welcher Fokus-Wert (1–10) vergeben? Nur bestätigte Werte. */
export function focusDistribution(sessions: Session[]): { value: number; count: number }[] {
  const out = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, count: 0 }));
  for (const s of sessions) {
    if (typeof s.focus === 'number' && s.focus >= 1 && s.focus <= 10) out[s.focus - 1].count += 1;
  }
  return out;
}

/** Heute / diese Woche (Mo–So) für den Startbildschirm. */
export function todayAndWeek(sessions: Session[], today: string = todayISO()) {
  const weekStart = startOfWeek(today);
  const t = sessions.filter((s) => s.date === today);
  const w = sessions.filter((s) => s.date >= weekStart && s.date <= addDays(weekStart, 6));
  const sum = (l: Session[]) => l.reduce((a, s) => a + s.durationMinutes, 0);
  return {
    today: { count: t.length, minutes: sum(t) },
    week: { count: w.length, minutes: sum(w) },
  };
}
