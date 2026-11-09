import { useMemo, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Posture, Session } from '../types';
import type { Filters } from '../lib/filters';
import { byPosture, byTimeOfDay, computeKeyFigures, minutesSeries, topValues, weeklyAverage, type TopItem } from '../lib/stats';
import { formatDateDE, formatMinutes } from '../lib/time';
import { FilterBar } from '../components/FilterPanel';
import { Card, EmptyState } from '../components/ui';

interface Props {
  total: number;
  sessions: Session[];
  filtered: Session[];
  filters: Filters;
  setFilters: (f: Filters) => void;
  postures: Posture[];
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

export function StatsScreen(p: Props) {
  const k = useMemo(() => computeKeyFigures(p.filtered, p.filters), [p.filtered, p.filters]);
  const series = useMemo(() => minutesSeries(p.filtered, p.filters), [p.filtered, p.filters]);
  const avg = useMemo(() => weeklyAverage(p.filtered, p.filters), [p.filtered, p.filters]);
  const tod = useMemo(() => byTimeOfDay(p.filtered), [p.filtered]);
  const pos = useMemo(() => byPosture(p.filtered, p.postures.map((x) => x.name)), [p.filtered, p.postures]);
  const tops = useMemo(
    () => ({
      anchors: topValues(p.filtered.map((s) => s.anchor)),
      locations: topValues(p.filtered.map((s) => s.location)),
      backgrounds: topValues(p.filtered.map((s) => s.background)),
    }),
    [p.filtered],
  );

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
          <FilterBar filters={p.filters} setFilters={p.setFilters} postures={p.postures} sessions={p.sessions} />

          {k.periodFrom && k.periodTo && (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Zeitraum {formatDateDE(k.periodFrom)} – {formatDateDE(k.periodTo)} ({k.periodDays} Tage)
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Kpi label="Sitzungen" value={String(k.count)} />
            <Kpi label="Gesamt" value={formatMinutes(k.totalMinutes)} />
            <Kpi label="Ø Dauer" value={`${k.avgMinutes.toLocaleString('de-DE')} Min.`} />
            <Kpi label="Längste Sitzung" value={`${k.longestMinutes} Min.`} />
            <Kpi label="Tage mit Sitzung" value={String(k.daysWithSession)} />
            <Kpi label="Anteil Tage" value={`${Math.round(k.dayRatio * 100)} %`} sub={`${k.daysWithSession} von ${k.periodDays}`} />
          </div>

          {p.filtered.length === 0 ? (
            <EmptyState title="Keine Einträge für diese Filter" />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <ChartCard title={series.unit === 'day' ? 'Minuten pro Tag' : 'Minuten pro Woche'}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={series.points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={2}>
                      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                      <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                      <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} Min.`, 'Minuten']} />
                      <Bar dataKey="minutes" fill="var(--chart-bar)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Ø Dauer pro Woche">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={avg} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                      <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                      <Tooltip
                        {...tooltipStyle}
                        cursor={{ stroke: 'var(--chart-grid)', strokeWidth: 1 }}
                        labelFormatter={(l) => `Woche ab ${l}`}
                        formatter={(v: number) => [`${v.toLocaleString('de-DE')} Min.`, 'Ø Dauer']}
                      />
                      <Line
                        type="monotone"
                        dataKey="avg"
                        stroke="var(--chart-line)"
                        strokeWidth={2}
                        connectNulls
                        dot={{ r: 4, fill: 'var(--chart-line)', strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: 'var(--chart-tooltip-bg)' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Nach Tageszeit (Sitzungen)">
                  <BucketChart data={tod} />
                </ChartCard>

                <ChartCard title="Nach Haltung (Sitzungen)">
                  <BucketChart data={pos} />
                </ChartCard>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <TopList title="Häufigste Anker" items={tops.anchors} />
                <TopList title="Häufigste Orte" items={tops.locations} />
                <TopList title="Häufigste Hintergründe" items={tops.backgrounds} />
              </div>
            </>
          )}
        </>
      )}
    </div>
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

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

function BucketChart({ data }: { data: { name: string; count: number; minutes: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 36 + 20)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={axisTick} tickLine={false} axisLine={false} width={96} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number, _n, item) => [`${v} Sitzungen · ${(item.payload as { minutes: number }).minutes} Min.`, '']}
          separator=""
        />
        <Bar dataKey="count" fill="var(--chart-bar)" radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function TopList({ title, items }: { title: string; items: TopItem[] }) {
  const max = items[0]?.count ?? 1;
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">Keine Angaben</p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {items.map((it) => (
            <li key={it.label} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="truncate">{it.label}</span>
                <span className="shrink-0 tabular text-stone-500 dark:text-stone-400">{it.count}×</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-stone-100 dark:bg-stone-800">
                <div className="h-1.5 rounded-full bg-[var(--chart-bar)]" style={{ width: `${(it.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
