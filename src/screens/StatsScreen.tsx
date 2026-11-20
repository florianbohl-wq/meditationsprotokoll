import { useMemo, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Option, OptionKind, Session } from '../types';
import type { Filters } from '../lib/filters';
import { byField, byTimeOfDay, computeKeyFigures, minutesSeries, weeklyAverage, type AvgPoint } from '../lib/stats';
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

export function StatsScreen(p: Props) {
  const k = useMemo(() => computeKeyFigures(p.filtered, p.filters), [p.filtered, p.filters]);
  const series = useMemo(() => minutesSeries(p.filtered, p.filters), [p.filtered, p.filters]);
  const avg = useMemo(() => weeklyAverage(p.filtered, p.filters), [p.filtered, p.filters]);
  const avgFocus = useMemo(() => weeklyAverage(p.filtered, p.filters, undefined, 'focus'), [p.filtered, p.filters]);
  const tod = useMemo(() => byTimeOfDay(p.filtered), [p.filtered]);
  const order = (kind: OptionKind) =>
    p.options.filter((o) => o.kind === kind).sort((a, b) => a.order - b.order).map((o) => o.name);
  const pos = useMemo(() => byField(p.filtered, 'posture', order('posture')), [p.filtered, p.options]);
  const anc = useMemo(() => byField(p.filtered, 'anchor', order('anchor')), [p.filtered, p.options]);
  const loc = useMemo(() => byField(p.filtered, 'location', order('location')), [p.filtered, p.options]);

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

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Kpi label="Sitzungen" value={String(k.count)} />
            <Kpi label="Gesamt" value={formatMinutes(k.totalMinutes)} />
            <Kpi label="Ø Dauer" value={`${k.avgMinutes.toLocaleString('de-DE')} Min.`} />
            <Kpi
              label="Ø Fokus"
              value={k.avgFocus !== undefined ? `${k.avgFocus.toLocaleString('de-DE')} / 10` : '–'}
              sub={k.focusCount < k.count ? `${k.focusCount} von ${k.count} bestätigt` : undefined}
            />
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
                  <AvgLineChart data={avg} unit="Min." label="Ø Dauer" />
                </ChartCard>

                <ChartCard title="Ø Fokus pro Woche">
                  {k.focusCount === 0 ? (
                    <p className="py-16 text-center text-sm text-stone-500 dark:text-stone-400">Noch keine bestätigten Fokus-Werte</p>
                  ) : (
                    <AvgLineChart data={avgFocus} unit="" label="Ø Fokus" domain={[1, 10]} />
                  )}
                </ChartCard>

                <ChartCard title="Nach Tageszeit (Sitzungen)">
                  <BucketChart data={tod} />
                </ChartCard>

                <ChartCard title="Nach Anker (Sitzungen)">
                  <BucketChart data={anc} />
                </ChartCard>

                <ChartCard title="Nach Haltung (Sitzungen)">
                  <BucketChart data={pos} />
                </ChartCard>

                <ChartCard title="Nach Ort (Sitzungen)">
                  <BucketChart data={loc} />
                </ChartCard>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function AvgLineChart({ data, unit, label, domain }: { data: AvgPoint[]; unit: string; label: string; domain?: [number, number] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={44} domain={domain ?? [0, 'auto']} />
        <Tooltip
          {...tooltipStyle}
          cursor={{ stroke: 'var(--chart-grid)', strokeWidth: 1 }}
          labelFormatter={(l) => `Woche ab ${l}`}
          formatter={(v: number) => [`${v.toLocaleString('de-DE')}${unit ? ` ${unit}` : ''}`, label]}
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
        <YAxis type="category" dataKey="name" tick={axisTick} tickLine={false} axisLine={false} width={118} />
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
