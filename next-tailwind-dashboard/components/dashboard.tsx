"use client";

import { useEffect, useMemo, useState } from "react";
import { ACTUAL_END_MONTH_IDX, DASHBOARD_META, TAB_META, type DashboardData, type GroupMetrics, type TabKey } from "@/lib/dashboard-data";
import {
  actualValueAt,
  buildActualSeries,
  buildEstimatedSeries,
  currentType,
  currentValueAt,
  estimatedValueAt,
  formatNumber,
  getGroupByTab,
  isNumber,
  selectedMonthLabel,
  shortName,
  variancePct,
  varianceValue
} from "@/lib/dashboard-utils";

type DecimalMode = "auto" | "0" | "1" | "2";
type InitiativeDrafts = Record<number, { impact: string; comment: string }>;

const chartColors = {
  plan: "#2563eb",
  actual: "#16a34a",
  est: "#f59e0b"
};

function storageAvailable() {
  try {
    const key = "__va_dash_test__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function initiativeKey(monthIdx: number, no: number, field: "impact" | "comment") {
  return `vaDash.init.${DASHBOARD_META.year}.${monthIdx}.${no}.${field === "comment" ? "cmt" : "impact"}`;
}

function metricMemoryKey(tab: TabKey) {
  return `vaDash.metricSel.${tab}`;
}

type LineChartProps = {
  title: string;
  decimals: DecimalMode;
  series: { name: string; data: (number | null)[]; color: string; dashed?: boolean }[];
};

function LineChart({ title, decimals, series, months }: LineChartProps & { months: string[] }) {
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const width = 640;
  const height = 260;
  const pad = { top: 24, right: 20, bottom: 40, left: 58 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const values = series.flatMap((item) => item.data.slice(1).filter(isNumber));
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 1;
  const span = maxValue - minValue || 1;
  const low = minValue - span * 0.08;
  const high = maxValue + span * 0.08;

  const xOf = (monthIdx: number) => pad.left + ((monthIdx - 1) / 11) * plotWidth;
  const yOf = (value: number) => pad.top + ((high - value) / (high - low || 1)) * plotHeight;
  const yTicks = Array.from({ length: 6 }, (_, index) => {
    const ratio = index / 5;
    return {
      y: pad.top + plotHeight * ratio,
      value: high - (high - low) * ratio
    };
  });

  const actualSeries = series.find((item) => item.name === "Actual");
  const estimatedSeries = series.find((item) => item.name === "Est");
  const bridgeActual = actualSeries?.data[ACTUAL_END_MONTH_IDX];
  const bridgeEstimated = estimatedSeries?.data[ACTUAL_END_MONTH_IDX + 1];
  const tooltipMonth = hoverMonth;
  const tooltipX = tooltipMonth ? xOf(tooltipMonth) : null;
  const tooltipData = tooltipMonth
    ? series
        .filter((item) => !selectedSeries || item.name === selectedSeries)
        .map((item) => ({
        name: item.name,
        color: item.color,
        value: item.data[tooltipMonth] ?? null
        }))
    : [];

  function updateHoverMonth(clientX: number, clientY: number, bounds: DOMRect) {
    const relativeX = clientX - bounds.left;
    const plotStart = (pad.left / width) * bounds.width;
    const plotWidthPx = (plotWidth / width) * bounds.width;
    const rawIndex = ((relativeX - plotStart) / plotWidthPx) * 11 + 1;
    const month = Math.max(1, Math.min(12, Math.round(rawIndex)));
    setHoverMonth(month);
    setTooltipPosition({
      x: clientX - bounds.left,
      y: clientY - bounds.top
    });
  }

  return (
    <div className="relative rounded-panel border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <p className="text-sm font-black text-brand-800">{title}</p>
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          {series.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setSelectedSeries((current) => (current === item.name ? null : item.name))}
              className={`inline-flex items-center gap-2 rounded-full px-2 py-1 font-bold transition ${
                selectedSeries === item.name ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full overflow-visible">
        <rect width={width} height={height} rx="14" fill="white" />
        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line x1={pad.left} x2={width - pad.right} y1={tick.y} y2={tick.y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.left - 10} y={tick.y + 4} textAnchor="end" fontSize="11" fill="#64748b">
              {formatNumber(tick.value, decimals)}
            </text>
          </g>
        ))}
        {months.slice(1).map((month, index) => {
          const monthIdx = index + 1;
          return (
            <text key={month} x={xOf(monthIdx)} y={height - 10} textAnchor="middle" fontSize="11" fill="#64748b">
              {month}
            </text>
          );
        })}
        {series.map((item) => {
          const isDimmed = Boolean(selectedSeries && selectedSeries !== item.name);
          const points = item.data
            .map((value, monthIdx) => ({ value, monthIdx }))
            .filter((point): point is { value: number; monthIdx: number } => point.monthIdx >= 1 && isNumber(point.value))
            .map(({ value, monthIdx }) => `${xOf(monthIdx)},${yOf(value)}`)
            .join(" ");

          return (
            <g key={item.name}>
              <polyline
                fill="none"
                stroke={item.color}
                strokeWidth={selectedSeries === item.name ? "4" : "3"}
                strokeDasharray={item.dashed ? "8 6" : undefined}
                points={points}
                opacity={isDimmed ? 0.2 : 1}
                className="cursor-pointer"
                onClick={() => setSelectedSeries((current) => (current === item.name ? null : item.name))}
              />
              {!item.dashed &&
                item.data.map((value, monthIdx) =>
                  monthIdx >= 1 && isNumber(value) ? (
                    <circle
                      key={`${item.name}-${monthIdx}`}
                      cx={xOf(monthIdx)}
                      cy={yOf(value)}
                      r={selectedSeries === item.name ? "4.5" : "3.5"}
                      fill={item.color}
                      opacity={isDimmed ? 0.2 : 1}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedSeries((current) => (current === item.name ? null : item.name));
                        setHoverMonth(monthIdx);
                      }}
                    />
                  ) : null
                )}
            </g>
          );
        })}
        {isNumber(bridgeActual) && isNumber(bridgeEstimated) ? (
          <line
            x1={xOf(ACTUAL_END_MONTH_IDX)}
            y1={yOf(bridgeActual)}
            x2={xOf(ACTUAL_END_MONTH_IDX + 1)}
            y2={yOf(bridgeEstimated)}
            stroke={chartColors.est}
            strokeWidth="2.5"
            strokeDasharray="8 6"
          />
        ) : null}
        {tooltipMonth && tooltipX ? (
          <>
            <line x1={tooltipX} x2={tooltipX} y1={pad.top} y2={pad.top + plotHeight} stroke="#cbd5e1" strokeDasharray="4 6" />
            {tooltipData.map((item) =>
              isNumber(item.value) ? (
                <g key={`hover-${item.name}`}>
                  <circle cx={tooltipX} cy={yOf(item.value)} r="9" fill="white" opacity="0.95" />
                  <circle cx={tooltipX} cy={yOf(item.value)} r="5.5" fill={item.color} stroke="white" strokeWidth="2.5" />
                </g>
              ) : null
            )}
          </>
        ) : null}
        <rect
          x={pad.left}
          y={pad.top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          onMouseMove={(event) => updateHoverMonth(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => {
            setHoverMonth(null);
            setTooltipPosition(null);
          }}
          onClick={() => setSelectedSeries(null)}
        />
      </svg>
      {tooltipMonth && tooltipPosition ? (
        <div
          className="pointer-events-none absolute z-10 min-w-36 rounded-2xl bg-white/95 px-4 py-3 shadow-[0_14px_32px_rgba(15,23,42,0.14)] ring-1 ring-slate-200 backdrop-blur-sm"
          style={{
            left: Math.min(tooltipPosition.x + 16, width - 170),
            top: Math.max(70, tooltipPosition.y - 24)
          }}
        >
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{months[tooltipMonth]}</div>
          <div className="space-y-1.5">
            {tooltipData.map((item) => (
              <div key={`html-tooltip-${item.name}`} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-medium">{item.name}:</span>
                <span className="font-black text-slate-900">{formatNumber(item.value, decimals)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type BarChartProps = {
  title: string;
  items: { name: string; value: number | null }[];
  decimals: DecimalMode;
};

function BarChart({ title, items, decimals }: BarChartProps) {
  const width = 640;
  const height = 260;
  const pad = { top: 24, right: 20, bottom: 64, left: 58 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const numericValues = items.map((item) => item.value).filter(isNumber);
  const maxAbs = Math.max(1, ...numericValues.map((value) => Math.abs(value)));
  const halfHeight = plotHeight / 2;
  const zeroY = pad.top + halfHeight;
  const barWidth = Math.min(52, (plotWidth - (items.length - 1) * 10) / Math.max(items.length, 1));
  const totalWidth = items.length * barWidth + (items.length - 1) * 10;
  const startX = pad.left + (plotWidth - totalWidth) / 2;
  const ticks = [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs];

  return (
    <div className="rounded-panel border border-slate-200 bg-white p-4 shadow-soft">
      <p className="mb-3 text-sm font-black text-brand-800">{title}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full overflow-visible">
        <rect width={width} height={height} rx="14" fill="white" />
        {ticks.map((value) => {
          const y = zeroY - (value / maxAbs) * halfHeight;
          return (
            <g key={value}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={pad.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                {formatNumber(value, decimals)}
              </text>
            </g>
          );
        })}
        {items.map((item, index) => {
          const x = startX + index * (barWidth + 10);
          const value = item.value;
          const heightRatio = isNumber(value) ? Math.abs(value) / maxAbs : 0;
          const barHeight = halfHeight * heightRatio;
          const y = isNumber(value) && value >= 0 ? zeroY - barHeight : zeroY;
          const fill = !isNumber(value) ? "#cbd5e1" : value >= 0 ? "#16a34a" : "#dc2626";
          const label = item.name.length > 11 ? `${item.name.slice(0, 11)}…` : item.name;

          return (
            <g key={item.name}>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx="8" fill={fill} opacity="0.82" />
              <text x={x + barWidth / 2} y={height - 34} textAnchor="middle" fontSize="11" fill="#64748b">
                {label}
              </text>
              <text
                x={x + barWidth / 2}
                y={isNumber(value) && value >= 0 ? y - 8 : y + barHeight + 14}
                textAnchor="middle"
                fontSize="11"
                fill="#0f172a"
              >
                {formatNumber(value, decimals)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StatusPill({
  label,
  value,
  tone = "default",
  decimals
}: {
  label: string;
  value: number | null;
  tone?: "default" | "good" | "warn" | "bad";
  decimals: DecimalMode;
}) {
  const toneClass =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : tone === "bad"
          ? "bg-rose-50 text-rose-700 ring-rose-200"
          : "bg-blue-50 text-brand-800 ring-blue-200";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ring-1 ${toneClass}`}>
      <span className="h-2 w-2 rounded-full bg-current opacity-80" />
      {label}: {formatNumber(value, decimals)}
    </span>
  );
}

function KpiCard({
  icon,
  title,
  unit,
  plan,
  rawSeries,
  monthIdx,
  decimals,
  isCostTab,
  showPct = true
}: {
  icon: string;
  title: string;
  unit: string;
  plan: number | null;
  rawSeries: readonly (number | null)[];
  monthIdx: number;
  decimals: DecimalMode;
  isCostTab: boolean;
  showPct?: boolean;
}) {
  const actual = actualValueAt(rawSeries, monthIdx);
  const estimated = estimatedValueAt(rawSeries, monthIdx);
  const current = currentValueAt(rawSeries, monthIdx);
  const variance = varianceValue(plan, current, isCostTab);
  const variancePercent = variancePct(plan, variance);

  const tone = !isNumber(variance) ? "warn" : variance > 0 ? "good" : variance < 0 ? "bad" : "default";

  return (
    <div className="rounded-panel border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2 text-xs font-black text-slate-500">
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <span className="text-3xl font-black tracking-tight text-slate-900">{formatNumber(current, decimals)}</span>
        <span className="pb-1 text-xs font-black uppercase tracking-wide text-slate-500">{unit}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusPill label="Plan" value={plan} decimals={decimals} />
        <StatusPill label="Actual" value={actual} tone="good" decimals={decimals} />
        <StatusPill label="Est" value={estimated} tone="warn" decimals={decimals} />
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ring-1 ${
            tone === "good"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : tone === "bad"
                ? "bg-rose-50 text-rose-700 ring-rose-200"
                : "bg-amber-50 text-amber-700 ring-amber-200"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-current opacity-80" />
          Var (A-P): {formatNumber(variance, decimals)}
          {showPct && isNumber(variancePercent) ? <span className="text-slate-500">({formatNumber(variancePercent, "1")}%)</span> : null}
        </span>
      </div>
    </div>
  );
}

function DataTable({
  rows,
  monthIdx,
  decimals,
  costMode
}: {
  rows: {
    metric: string;
    unit: string;
    plan: number | null;
    actual: number | null;
    est: number | null;
    current: number | null;
  }[];
  monthIdx: number;
  decimals: DecimalMode;
  costMode: boolean;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-black text-brand-800">Summary (Selected month)</h3>
        <p className="text-xs font-medium text-slate-500">{selectedMonthLabel(monthIdx)}</p>
      </div>
      <div className="scrollbar-thin overflow-x-auto rounded-panel border border-slate-200 bg-white shadow-soft">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-brand-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-black">Metric</th>
              <th className="px-4 py-3 text-left text-xs font-black">Unit</th>
              <th className="px-4 py-3 text-right text-xs font-black">Plan</th>
              <th className="px-4 py-3 text-right text-xs font-black">Actual</th>
              <th className="px-4 py-3 text-right text-xs font-black">Est</th>
              <th className="px-4 py-3 text-right text-xs font-black">Var (A-P)</th>
              <th className="px-4 py-3 text-right text-xs font-black">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const variance = varianceValue(row.plan, row.current, costMode);
              const variancePercent = variancePct(row.plan, variance);
              const tone = !isNumber(variance) ? "text-slate-500" : variance >= 0 ? "text-emerald-600" : "text-rose-600";

              return (
                <tr key={row.metric} className="border-t border-slate-100 hover:bg-blue-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.metric}</td>
                  <td className="px-4 py-3 text-slate-500">{row.unit}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(row.plan, decimals)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(row.actual, decimals)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(row.est, decimals)}</td>
                  <td className={`px-4 py-3 text-right font-black ${tone}`}>{formatNumber(variance, decimals)}</td>
                  <td className={`px-4 py-3 text-right ${tone}`}>{isNumber(variancePercent) ? `${formatNumber(variancePercent, "1")}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupSection({
  data,
  tab,
  monthIdx,
  decimals,
  metricKey,
  onMetricChange
}: {
  data: DashboardData;
  tab: Exclude<TabKey, "Executive" | "Initiatives">;
  monthIdx: number;
  decimals: DecimalMode;
  metricKey: string;
  onMetricChange: (value: string) => void;
}) {
  const group = getGroupByTab(data, tab) as GroupMetrics;
  const keys = Object.keys(group);
  const selectedKey = keys.includes(metricKey) ? metricKey : keys[0];
  const selectedMetric = group[selectedKey];
  const isCostTab = tab === "Cost";
  const title =
    tab === "Volume"
      ? "Commercial - Sales Volume"
      : tab === "Price"
        ? "Commercial - Ex-Price / Margin"
        : "Cost / Supply Chain";
  const icon = tab === "Volume" ? "📦" : tab === "Price" ? "💵" : "🚚";

  const rows = keys.map((key) => {
    const metric = group[key];
    return {
      metric: metric.label,
      unit: metric.unit,
      plan: metric.plan[monthIdx],
      actual: actualValueAt(metric.actual, monthIdx),
      est: estimatedValueAt(metric.actual, monthIdx),
      current: currentValueAt(metric.actual, monthIdx)
    };
  });

  const barItems = keys.slice(0, 8).map((key) => {
    const metric = group[key];
    return {
      name: shortName(metric.label),
      value: varianceValue(metric.plan[monthIdx], currentValueAt(metric.actual, monthIdx), isCostTab)
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-black text-brand-800">{title}</h3>
        <p className="text-sm text-slate-500">{selectedMonthLabel(monthIdx)}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {keys.slice(0, 3).map((key) => {
          const metric = group[key];
          return (
            <KpiCard
              key={key}
              icon={icon}
              title={metric.label}
              unit={metric.unit}
              plan={metric.plan[monthIdx]}
              rawSeries={metric.actual}
              monthIdx={monthIdx}
              decimals={decimals}
              isCostTab={isCostTab}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedKey}
          onChange={(event) => onMetricChange(event.target.value)}
          className="min-w-[320px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-400"
        >
          {keys.map((key) => (
            <option key={key} value={key}>
              {group[key].label}
            </option>
          ))}
        </select>
        <p className="text-sm text-slate-500">
          {isCostTab
            ? "Cost keeps the Var (A-P) header, but the value uses Plan - Current so overspend shows in red."
            : "Trend uses Plan plus Actual for Jan-Feb and dashed Est for Mar-Dec."}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <LineChart
          title={`${selectedMetric.label} - Trend`}
          decimals={decimals}
          months={data.meta.months}
          series={[
            { name: "Plan", data: [...selectedMetric.plan], color: chartColors.plan },
            { name: "Actual", data: buildActualSeries(selectedMetric.actual), color: chartColors.actual },
            { name: "Est", data: buildEstimatedSeries(selectedMetric.actual), color: chartColors.est, dashed: true }
          ]}
        />
        <BarChart title="Var (A-P) by KPI - Selected" decimals={decimals} items={barItems} />
      </div>

      <DataTable rows={rows} monthIdx={monthIdx} decimals={decimals} costMode={isCostTab} />
    </div>
  );
}

function ExecutiveSection({ data, monthIdx, decimals }: { data: DashboardData; monthIdx: number; decimals: DecimalMode }) {
  const { coi, profit, vr } = data.executive;
  const rows = [coi, profit, vr].map((metric) => ({
    metric: metric.label,
    unit: metric.unit,
    plan: metric.plan[monthIdx],
    actual: actualValueAt(metric.actual, monthIdx),
    est: estimatedValueAt(metric.actual, monthIdx),
    current: currentValueAt(metric.actual, monthIdx)
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          icon="📈"
          title={coi.label}
          unit={coi.unit}
          plan={coi.plan[monthIdx]}
          rawSeries={coi.actual}
          monthIdx={monthIdx}
          decimals={decimals}
          isCostTab={false}
        />
        <KpiCard
          icon="💰"
          title={profit.label}
          unit={profit.unit}
          plan={profit.plan[monthIdx]}
          rawSeries={profit.actual}
          monthIdx={monthIdx}
          decimals={decimals}
          isCostTab={false}
        />
        <KpiCard
          icon="🎯"
          title={vr.label}
          unit={vr.unit}
          plan={vr.plan[monthIdx]}
          rawSeries={vr.actual}
          monthIdx={monthIdx}
          decimals={decimals}
          isCostTab={false}
          showPct={false}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <LineChart
          title="Overall COI - Trend"
          decimals={decimals}
          months={data.meta.months}
          series={[
            { name: "Plan", data: [...coi.plan], color: chartColors.plan },
            { name: "Actual", data: buildActualSeries(coi.actual), color: chartColors.actual },
            { name: "Est", data: buildEstimatedSeries(coi.actual), color: chartColors.est, dashed: true }
          ]}
        />
        <LineChart
          title="Profit - Trend"
          decimals={decimals}
          months={data.meta.months}
          series={[
            { name: "Plan", data: [...profit.plan], color: chartColors.plan },
            { name: "Actual", data: buildActualSeries(profit.actual), color: chartColors.actual },
            { name: "Est", data: buildEstimatedSeries(profit.actual), color: chartColors.est, dashed: true }
          ]}
        />
      </div>

      <DataTable rows={rows} monthIdx={monthIdx} decimals={decimals} costMode={false} />
    </div>
  );
}

function InitiativesSection({
  data,
  monthIdx,
  decimals,
  drafts,
  onDraftChange
}: {
  data: DashboardData;
  monthIdx: number;
  decimals: DecimalMode;
  drafts: InitiativeDrafts;
  onDraftChange: (no: number, field: "impact" | "comment", value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-black text-brand-800">VA Initiatives</h3>
        <p className="text-sm text-slate-500">{selectedMonthLabel(monthIdx)}</p>
      </div>

      <div className="rounded-panel border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-soft">
        Capture monthly progress, actual impact, and quick comments for each initiative. Values are stored in localStorage so they stay on this browser.
      </div>

      <div className="scrollbar-thin overflow-x-auto rounded-panel border border-slate-200 bg-white shadow-soft">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-brand-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-black">#</th>
              <th className="px-4 py-3 text-left text-xs font-black">Initiative</th>
              <th className="px-4 py-3 text-left text-xs font-black">PIC</th>
              <th className="px-4 py-3 text-right text-xs font-black">Target (MB)</th>
              <th className="px-4 py-3 text-left text-xs font-black">Actual MB ({selectedMonthLabel(monthIdx)})</th>
              <th className="px-4 py-3 text-left text-xs font-black">Comment ({selectedMonthLabel(monthIdx)})</th>
            </tr>
          </thead>
          <tbody>
            {data.initiatives.map((initiative) => (
              <tr key={initiative.no} className="border-t border-slate-100 align-top">
                <td className="px-4 py-4 font-semibold">{initiative.no}</td>
                <td className="px-4 py-4">
                  <div className="font-black text-brand-800">{initiative.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{initiative.note}</div>
                </td>
                <td className="px-4 py-4 text-slate-600">{initiative.pic}</td>
                <td className="px-4 py-4 text-right font-semibold">{formatNumber(initiative.targetMB, decimals)}</td>
                <td className="px-4 py-4">
                  <input
                    value={drafts[initiative.no]?.impact ?? ""}
                    onChange={(event) => onDraftChange(initiative.no, "impact", event.target.value)}
                    placeholder="e.g. 5.0"
                    className="w-full min-w-40 rounded-xl border border-slate-200 px-3 py-2 outline-none transition focus:border-blue-400"
                  />
                </td>
                <td className="px-4 py-4">
                  <input
                    value={drafts[initiative.no]?.comment ?? ""}
                    onChange={(event) => onDraftChange(initiative.no, "comment", event.target.value)}
                    placeholder="Summary, risk, next step"
                    className="w-full min-w-80 rounded-xl border border-slate-200 px-3 py-2 outline-none transition focus:border-blue-400"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Dashboard({ data }: { data: DashboardData }) {
  const [tab, setTab] = useState<TabKey>("Executive");
  const [monthIdx, setMonthIdx] = useState(0);
  const [decimals, setDecimals] = useState<DecimalMode>("auto");
  const [view, setView] = useState("monthly");
  const [initiativeDrafts, setInitiativeDrafts] = useState<InitiativeDrafts>({});
  const [metricSelections, setMetricSelections] = useState<Record<string, string>>({});
  const [hasStorage, setHasStorage] = useState(false);

  useEffect(() => {
    const available = storageAvailable();
    setHasStorage(available);
    if (!available) return;

    const nextSelections: Record<string, string> = {};
    for (const item of TAB_META) {
      const key = window.localStorage.getItem(metricMemoryKey(item.key));
      if (key) nextSelections[item.key] = key;
    }
    setMetricSelections(nextSelections);
  }, []);

  useEffect(() => {
    if (!hasStorage) return;

    const nextDrafts: InitiativeDrafts = {};
    for (const item of data.initiatives) {
      nextDrafts[item.no] = {
        impact: window.localStorage.getItem(initiativeKey(monthIdx, item.no, "impact")) ?? "",
        comment: window.localStorage.getItem(initiativeKey(monthIdx, item.no, "comment")) ?? ""
      };
    }
    setInitiativeDrafts(nextDrafts);
  }, [data.initiatives, hasStorage, monthIdx]);

  const selectedMetric = useMemo(() => metricSelections[tab] ?? "", [metricSelections, tab]);

  function updateMetricSelection(nextTab: TabKey, value: string) {
    setMetricSelections((current) => ({ ...current, [nextTab]: value }));
    if (hasStorage) {
      window.localStorage.setItem(metricMemoryKey(nextTab), value);
    }
  }

  function handleInitiativeDraftChange(no: number, field: "impact" | "comment", value: string) {
    setInitiativeDrafts((current) => ({
      ...current,
      [no]: {
        impact: current[no]?.impact ?? "",
        comment: current[no]?.comment ?? "",
        [field]: value
      }
    }));

    if (hasStorage) {
      window.localStorage.setItem(initiativeKey(monthIdx, no, field), value);
    }
  }

  const monthBadge = monthIdx === 0 ? "Est Full (Full-year estimate)" : `${data.meta.months[monthIdx]} (${currentType(monthIdx)})`;

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-gradient-to-b from-brand-700 to-brand-800 shadow-[0_12px_28px_rgba(2,8,23,0.22)] backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-4 py-4 lg:px-6">
          <div className="min-w-[320px] flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-black tracking-tight text-white">TMMA Value Acceleration (VA) KPI Dashboard 2026</h1>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black text-white shadow-lg">
                <span>Default:</span>
                <span className="rounded-full border border-amber-300/30 bg-amber-400/20 px-2 py-0.5 text-[11px] uppercase text-amber-50">Est Full</span>
                <span>{monthIdx === 0 ? "Landing state" : `Now: ${monthBadge}`}</span>
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-white/75">
              Source: {data.meta.source} with Actual values for Jan-Feb and estimated values for Mar-Dec. Cost uses
              Plan - Current so overspend stays negative and clearly visible.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white shadow-lg">
              Month
              <select
                value={monthIdx}
                onChange={(event) => setMonthIdx(Number(event.target.value))}
                className="rounded-lg border border-white/20 bg-white px-3 py-1.5 text-slate-900 outline-none"
              >
                {data.meta.months.map((month, index) => (
                  <option key={month} value={index}>
                    {index === 0 ? "Est Full (Full-year estimate)" : month}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white shadow-lg">
              View
              <select
                value={view}
                onChange={(event) => setView(event.target.value)}
                className="rounded-lg border border-white/20 bg-white px-3 py-1.5 text-slate-900 outline-none"
              >
                <option value="monthly">Monthly</option>
                <option value="series">Series (table)</option>
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white shadow-lg">
              Decimals
              <select
                value={decimals}
                onChange={(event) => setDecimals(event.target.value as DecimalMode)}
                className="rounded-lg border border-white/20 bg-white px-3 py-1.5 text-slate-900 outline-none"
              >
                <option value="auto">Auto</option>
                <option value="1">1 decimal</option>
                <option value="2">2 decimals</option>
                <option value="0">Whole numbers</option>
              </select>
            </label>

          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-4 lg:px-6 lg:py-6">
        <section className="overflow-hidden rounded-panel border border-blue-100 bg-white shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-4 py-3">
            <h2 className="text-sm font-black text-brand-800">Dashboard</h2>
            <div className="flex flex-wrap gap-2">
              {TAB_META.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`rounded-full px-4 py-2 text-xs font-black transition ${
                    tab === item.key
                      ? "bg-blue-600 text-white shadow-lg"
                      : "border border-blue-200 bg-blue-50 text-brand-800 hover:bg-blue-100"
                  }`}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {tab === "Executive" ? <ExecutiveSection data={data} monthIdx={monthIdx} decimals={decimals} /> : null}
            {tab === "Volume" || tab === "Price" || tab === "Cost" ? (
              <GroupSection
                data={data}
                tab={tab as Exclude<TabKey, "Executive" | "Initiatives">}
                monthIdx={monthIdx}
                decimals={decimals}
                metricKey={selectedMetric}
                onMetricChange={(value) => updateMetricSelection(tab, value)}
              />
            ) : null}
            {tab === "Initiatives" ? (
              <InitiativesSection
                data={data}
                monthIdx={monthIdx}
                decimals={decimals}
                drafts={initiativeDrafts}
                onDraftChange={handleInitiativeDraftChange}
              />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
