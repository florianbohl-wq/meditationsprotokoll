import { useMemo, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Option, OptionKind, Session } from '../types';
import type { Filters } from '../lib/filters';
import {
  byField,
  byTimeOfDay,
  computeKeyFigures,
  focusDistribution,
  minutesSeries,
  weeklySeries,
  type Bucket,
} from '../lib/stats';
import { formatDateDE, formatMinutes } from '../lib/time';
import { FilterBar } from '../components/FilterPanel';
import { Card, EmptyState } from '../components/ui';

interface Props {
  total: number;
  sessions: Session[];
  filtered: Session[];
  filters: Filters;
  setFilters: (f: Filters) => void;
  options: Option[];
}

const axisTick = { fill: 'var(--chart-text)', fontSize: 12 };
const tooltipStyle = {
  contentStyle: {
    background: 'var(--chart-tooltip-bg)',
    border: '1px solid var(--chart-tooltip-border)',
    borderRadius: 10,
    fontSize: 13,
  },
  labelStyle: { color: 'var(--chart-text)' },
  itemStyle: { color: 'inherit' },
  cursor: { fill: 'var(--chart-cursor)' },
};
const lineCursor = { stroke: 'var(--chart-grid)', strokeWidth: 1 };
const de = (n: number) => n.toLocaleString('de-DE');
const FOCUS_TICKS = [1, 5, 10];

export function StatsScreen(p: Props) {
  const k = useMemo(() => computeKeyFigures(p.filtered, p.filters), [p.filtered, p.filters]);
  const series = useMemo(() => minutesSeries(p.filtered, p.filters), [p.filtered, p.filters]);
  const weeks = useMemo(() => weeklySeries(p.filtered, p.filters), [p.filtered, p.filters]);
  const dist = useMemo(() => focusDistribution(p.filtered), [p.filtered]);
  const tod = useMemo(() => byTimeOfDay(p.filtered), [p.filtered]);
  const order = (kind: OptionKind) =>
    p.options.filter((o) => o.kind === kind).sort((a, b) => a.order - b.order).map((o) => o.name);
  const pos = useMemo(() => byField(p.filtered, 'posture', order('posture')), [p.filtered, p.options]);
  const anc = useMemo(() => byField(p.filtered, 'anchor', order('anchor')), [p.filtered, p.options]);
  const loc = useMemo(() => byField(p.filtered, 'location', order('location')), [p.filtered, p.options]);
  const hasFocus = k.focusCount > 0;
  const per = series.unit === 'day' ? 'Tag' : 'Woche';

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold">Statistik</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">Verwendet dieselben Filter wie das Protokoll.</p>
      </header>

      {p.total === 0 ? (
        <EmptyState title="Noch keine Daten">
          <p className="text-stone-500 dark:text-stone-400">Sobald du Sitzungen eingetragen hast, erscheinen hier Kennzahlen und Diagramme.</p>
        </EmptyState>
      ) : (
        <>
          <FilterBar filters={p.filters} setFilters={p.setFilters} options={p.options} sessions={p.sessions} />

          {k.periodFrom && k.periodTo && (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Zeitraum {formatDateDE(k.periodFrom)} – {formatDateDE(k.periodTo)} ({k.periodDays} Tage)
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Sitzungen" value={String(k.count)} />
            <Kpi label="Gesamt" value={formatMinutes(k.totalMinutes)} />
            <Kpi label="Ø Dauer" value={`${de(k.avgMinutes)} Min.`} />
            <Kpi
              label="Ø Fokus"
              value={k.avgFocus !== undefined ? `${de(k.avgFocus)} / 10` : '–'}
              sub={k.focusCount < k.count ? `${k.focusCount} von ${k.count} bestätigt` : undefined}
            />
            <Kpi label="Längste Sitzung" value={`${k.longestMinutes} Min.`} />
            <Kpi label="Tage mit Sitzung" value={String(k.daysWithSession)} />
            <Kpi label="Anteil Tage" value={`${Math.round(k.dayRatio * 100)} %`} sub={`${k.daysWithSession} von ${k.periodDays}`} />
          </div>

          {p.filtered.length === 0 ? (
            <EmptyState title="Keine Einträge für diese Filter" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Minuten und Fokus im Zeitverlauf: zwei Teile mit gemeinsamer Zeitachse */}
              <ChartCard title={`Minuten und Fokus pro ${per}`} wide>
                <Panel label="Minuten" color="var(--chart-bar)" shape="bar">
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={series.points} syncId="zeit" margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barCategoryGap={2}>
                      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="label" hide />
                      <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                      <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} Min.`, 'Minuten']} />
                      <Bar dataKey="minutes" fill="var(--chart-bar)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>
                <Panel label="Ø Fokus (1–10)" color="var(--chart-focus)" shape="dot">
                  {hasFocus ? (
                    <ResponsiveContainer width="100%" height={130}>
                      <LineChart data={series.points} syncId="zeit" margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                        {/* scale="band": Punkte stehen mittig unter den Balken darüber */}
                        <XAxis dataKey="label" scale="band" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                        <YAxis tick={axisTick} tickLine={false} axisLine={false} domain={[1, 10]} ticks={FOCUS_TICKS} width={44} />
                        <Tooltip {...tooltipStyle} cursor={lineCursor} formatter={(v: number) => [de(v), 'Ø Fokus']} />
                        <Line
                          type="monotone"
                          dataKey="focus"
                          stroke="var(--chart-focus)"
                          strokeWidth={2}
                          connectNulls
                          dot={{ r: 4, fill: 'var(--chart-focus)', strokeWidth: 0 }}
                          activeDot={{ r: 6, strokeWidth: 2, stroke: 'var(--chart-tooltip-bg)' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <NoFocus />
                  )}
                </Panel>
              </ChartCard>

              <ChartCard title="Ø Dauer und Ø Fokus pro Woche">
                <Panel label="Ø Dauer (Min.)" color="var(--chart-line)" shape="dot">
                  <ResponsiveContainer width="100%" height={130}>
                    <LineChart data={weeks} syncId="woche" margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="label" hide />
                      <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={44} domain={[0, 'auto']} />
                      <Tooltip {...tooltipStyle} cursor={lineCursor} labelFormatter={(l) => `Woche ab ${l}`} formatter={(v: number) => [`${de(v)} Min.`, 'Ø Dauer']} />
                      <Line type="monotone" dataKey="avgMinutes" stroke="var(--chart-line)" strokeWidth={2} connectNulls dot={{ r: 4, fill: 'var(--chart-line)', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 2, stroke: 'var(--chart-tooltip-bg)' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Panel>
                <Panel label="Ø Fokus (1–10)" color="var(--chart-focus)" shape="dot">
                  {hasFocus ? (
                    <ResponsiveContainer width="100%" height={130}>
                      <LineChart data={weeks} syncId="woche" margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                        <YAxis tick={axisTick} tickLine={false} axisLine={false} domain={[1, 10]} ticks={FOCUS_TICKS} width={44} />
                        <Tooltip {...tooltipStyle} cursor={lineCursor} labelFormatter={(l) => `Woche ab ${l}`} formatter={(v: number) => [de(v), 'Ø Fokus']} />
                        <Line type="monotone" dataKey="focus" stroke="var(--chart-focus)" strokeWidth={2} connectNulls dot={{ r: 4, fill: 'var(--chart-focus)', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 2, stroke: 'var(--chart-tooltip-bg)' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <NoFocus />
                  )}
                </Panel>
              </ChartCard>

              <ChartCard title="Wie oft welcher Fokus?">
                {hasFocus ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={dist} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={3}>
                      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="value" tick={axisTick} tickLine={false} axisLine={false} interval={0} />
                      <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                      <Tooltip {...tooltipStyle} labelFormatter={(l) => `Fokus ${l}`} formatter={(v: number) => [`${v} ${v === 1 ? 'Sitzung' : 'Sitzungen'}`, '']} separator="" />
                      <Bar dataKey="count" fill="var(--chart-focus)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <NoFocus />
                )}
                <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">Fokus-Wert (1 = sehr abgelenkt, 10 = sehr fokussiert) und Anzahl Sitzungen</p>
              </ChartCard>

              <CategoryCard title="Sitzungen und Ø Fokus nach Tageszeit" data={tod} />
              <CategoryCard title="Sitzungen und Ø Fokus nach Anker" data={anc} />
              <CategoryCard title="Sitzungen und Ø Fokus nach Haltung" data={pos} />
              <CategoryCard title="Sitzungen und Ø Fokus nach Ort" data={loc} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NoFocus() {
  return <p className="py-10 text-center text-sm text-stone-500 dark:text-stone-400">Noch keine bestätigten Fokus-Werte</p>;
}

/** Teil eines Kombi-Diagramms mit eigener Beschriftung (Legende) */
function Panel({ label, color, shape, children }: { label: string; color: string; shape: 'bar' | 'dot'; children: ReactNode }) {
  return (
    <div className="mt-1 first:mt-0">
      <p className="mb-1 flex items-center gap-2 text-xs font-medium text-stone-600 dark:text-stone-300">
        <span
          aria-hidden="true"
          className={shape === 'bar' ? 'inline-block h-3 w-2.5 rounded-sm' : 'inline-block h-2.5 w-2.5 rounded-full'}
          style={{ background: color }}
        />
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * Anzahl Sitzungen (Balken) und Ø Fokus (Punkt auf Skala 1–10) je Kategorie.
 * Zwei Spalten mit gemeinsamer Zeile je Kategorie – jede mit eigener, klarer Skala.
 */
function CategoryCard({ title, data }: { title: string; data: Bucket[] }) {
  const rows = data.filter((b) => b.count > 0 || b.name !== 'ohne Angabe');
  const maxCount = Math.max(1, ...rows.map((b) => b.count));
  return (
    <ChartCard title={title}>
      <div className="mb-2 grid grid-cols-2 gap-4 pl-0 text-xs font-medium text-stone-600 sm:grid-cols-[8.5rem_1fr_1fr] dark:text-stone-300">
        <span className="hidden sm:block" />
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3 w-2.5 rounded-sm" style={{ background: 'var(--chart-bar)' }} />
          Sitzungen
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--chart-focus)' }} />
          Ø Fokus (1–10)
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((b) => (
          <li
            key={b.name}
            className="grid grid-cols-2 items-center gap-x-4 gap-y-1 sm:grid-cols-[8.5rem_1fr_1fr]"
            title={`${b.name}: ${b.count} ${b.count === 1 ? 'Sitzung' : 'Sitzungen'}, ${b.minutes} Min.${
              b.avgFocus !== null ? `, Ø Fokus ${de(b.avgFocus)} (${b.focusCount} bewertet)` : ', kein bestätigter Fokus'
            }`}
          >
            <span className="col-span-2 truncate text-sm sm:col-span-1">{b.name}</span>
            {/* Anzahl */}
            <span className="flex items-center gap-2">
              <span className="h-3 flex-1 rounded-r bg-stone-100 dark:bg-stone-800">
                <span
                  className="block h-3 rounded-r"
                  style={{ width: `${(b.count / maxCount) * 100}%`, background: 'var(--chart-bar)', minWidth: b.count ? 4 : 0 }}
                />
              </span>
              <span className="w-7 text-right text-sm tabular text-stone-700 dark:text-stone-300">{b.count}</span>
            </span>
            {/* Ø Fokus auf Skala 1–10 */}
            <span className="flex items-center gap-2">
              <span className="relative h-3 flex-1">
                <span className="absolute inset-x-0 top-1/2 h-px bg-stone-300 dark:bg-stone-700" />
                {[1, 5, 10].map((t) => (
                  <span key={t} className="absolute top-0.5 h-2 w-px bg-stone-300 dark:bg-stone-700" style={{ left: `${((t - 1) / 9) * 100}%` }} />
                ))}
                {b.avgFocus !== null && (
                  <span
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-stone-900"
                    style={{ left: `${((b.avgFocus - 1) / 9) * 100}%`, background: 'var(--chart-focus)' }}
                  />
                )}
              </span>
              <span className="w-7 text-right text-sm tabular text-stone-700 dark:text-stone-300">
                {b.avgFocus !== null ? de(b.avgFocus) : '–'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <p className="text-sm text-stone-500 dark:text-stone-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular md:text-2xl">{value}</p>
      {sub && <p className="text-xs text-stone-500 dark:text-stone-400">{sub}</p>}
    </Card>
  );
}

function ChartCard({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <Card className={wide ? 'md:col-span-2' : undefined}>
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </Card>
  );
}
