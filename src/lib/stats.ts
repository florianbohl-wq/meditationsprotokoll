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
  return {
    count,
    totalMinutes,
    avgMinutes: count ? Math.round((totalMinutes / count) * 10) / 10 : 0,
    longestMinutes,
    daysWithSession,
    periodDays,
    dayRatio: periodDays ? Math.min(1, daysWithSession / periodDays) : 0,
    periodFrom: period?.from,
    periodTo: period?.to,
  };
}

export interface MinutesPoint {
  key: string;
  label: string;
  minutes: number;
}

export interface MinutesSeries {
  unit: 'day' | 'week';
  points: MinutesPoint[];
}

/** Minuten pro Tag (bis 31 Tage) bzw. pro Woche bei längeren Zeiträumen. Ohne Zeitraum: letzte 30 Tage. */
export function minutesSeries(sessions: Session[], f: Filters, today: string = todayISO()): MinutesSeries {
  const period = effectivePeriod(sessions, f, today) ?? { from: addDays(today, -29), to: today };
  const days = daysBetweenInclusive(period.from, period.to);
  if (days <= 31) {
    const byDay = new Map<string, number>();
    for (const s of sessions) byDay.set(s.date, (byDay.get(s.date) ?? 0) + s.durationMinutes);
    const points: MinutesPoint[] = [];
    for (let d = period.from; d <= period.to; d = addDays(d, 1)) {
      points.push({
        key: d,
        label: days <= 7 ? `${weekdayShort(d)} ${formatDayMonth(d)}` : formatDayMonth(d),
        minutes: byDay.get(d) ?? 0,
      });
    }
    return { unit: 'day', points };
  }
  const byWeek = new Map<string, number>();
  for (const s of sessions) {
    const w = startOfWeek(s.date);
    byWeek.set(w, (byWeek.get(w) ?? 0) + s.durationMinutes);
  }
  const points: MinutesPoint[] = [];
  for (let w = startOfWeek(period.from); w <= period.to; w = addDays(w, 7)) {
    points.push({ key: w, label: formatDayMonth(w), minutes: byWeek.get(w) ?? 0 });
  }
  return { unit: 'week', points };
}

export interface AvgPoint {
  key: string;
  label: string;
  avg: number | null;
}

/** Ø Dauer pro Woche (Wochen ohne Sitzung = null, damit die Linie Lücken überbrückt). */
export function weeklyAverage(sessions: Session[], f: Filters, today: string = todayISO()): AvgPoint[] {
  const period = effectivePeriod(sessions, f, today);
  if (!period) return [];
  const acc = new Map<string, { sum: number; n: number }>();
  for (const s of sessions) {
    const w = startOfWeek(s.date);
    const a = acc.get(w) ?? { sum: 0, n: 0 };
    a.sum += s.durationMinutes;
    a.n += 1;
    acc.set(w, a);
  }
  const out: AvgPoint[] = [];
  for (let w = startOfWeek(period.from); w <= period.to; w = addDays(w, 7)) {
    const a = acc.get(w);
    out.push({ key: w, label: formatDayMonth(w), avg: a ? Math.round((a.sum / a.n) * 10) / 10 : null });
  }
  return out;
}

export interface Bucket {
  name: string;
  count: number;
  minutes: number;
}

export function byTimeOfDay(sessions: Session[]): Bucket[] {
  const out: Bucket[] = TIMES_OF_DAY.map((name) => ({ name, count: 0, minutes: 0 }));
  const none: Bucket = { name: 'ohne Angabe', count: 0, minutes: 0 };
  for (const s of sessions) {
    const b = s.timeOfDay ? out.find((x) => x.name === s.timeOfDay)! : none;
    b.count += 1;
    b.minutes += s.durationMinutes;
  }
  return none.count ? [...out, none] : out;
}

export function byPosture(sessions: Session[], order: string[] = []): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const s of sessions) {
    const name = s.posture || 'ohne Angabe';
    const b = map.get(name) ?? { name, count: 0, minutes: 0 };
    b.count += 1;
    b.minutes += s.durationMinutes;
    map.set(name, b);
  }
  const rank = (n: string) => {
    if (n === 'ohne Angabe') return Number.MAX_SAFE_INTEGER;
    const i = order.indexOf(n);
    return i < 0 ? order.length : i;
  };
  return [...map.values()].sort((a, b) => rank(a.name) - rank(b.name) || b.count - a.count);
}

export interface TopItem {
  label: string;
  count: number;
}

/** Häufigste Werte, case-insensitiv gruppiert; angezeigt wird die häufigste Schreibweise. */
export function topValues(values: (string | undefined)[], limit = 5): TopItem[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>();
  for (const raw of values) {
    const v = raw?.trim();
    if (!v) continue;
    const k = v.toLocaleLowerCase('de');
    const g = groups.get(k) ?? { count: 0, spellings: new Map() };
    g.count += 1;
    g.spellings.set(v, (g.spellings.get(v) ?? 0) + 1);
    groups.set(k, g);
  }
  return [...groups.values()]
    .map((g) => ({
      label: [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      count: g.count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'de'))
    .slice(0, limit);
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
