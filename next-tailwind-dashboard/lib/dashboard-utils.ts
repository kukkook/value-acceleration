import { ACTUAL_END_MONTH_IDX, DASHBOARD_META, type DashboardData, type GroupMetrics, type TabKey } from "@/lib/dashboard-data";

export function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatNumber(value: number | null | undefined, decimals: string) {
  if (!isNumber(value)) return "—";

  const digits =
    decimals === "auto"
      ? Math.abs(value) >= 1000
        ? 0
        : Math.abs(value) >= 10
          ? 1
          : 2
      : Number(decimals);

  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export function buildActualSeries(raw: readonly (number | null)[]) {
  return raw.map((value, index) => (index >= 1 && index <= ACTUAL_END_MONTH_IDX ? value : null));
}

export function buildEstimatedSeries(raw: readonly (number | null)[]) {
  return raw.map((value, index) => (index === 0 || index > ACTUAL_END_MONTH_IDX ? value : null));
}

export function actualValueAt(raw: readonly (number | null)[], monthIdx: number) {
  return monthIdx >= 1 && monthIdx <= ACTUAL_END_MONTH_IDX ? raw[monthIdx] : null;
}

export function estimatedValueAt(raw: readonly (number | null)[], monthIdx: number) {
  if (monthIdx === 0) return raw[0];
  return monthIdx > ACTUAL_END_MONTH_IDX ? raw[monthIdx] : null;
}

export function currentValueAt(raw: readonly (number | null)[], monthIdx: number) {
  return actualValueAt(raw, monthIdx) ?? estimatedValueAt(raw, monthIdx);
}

export function currentType(monthIdx: number) {
  return monthIdx >= 1 && monthIdx <= ACTUAL_END_MONTH_IDX ? "Actual" : "Est";
}

export function selectedMonthLabel(monthIdx: number) {
  return monthIdx === 0 ? "Est Full (Full-year estimate)" : `${DASHBOARD_META.months[monthIdx]} (${currentType(monthIdx)})`;
}

export function varianceValue(plan: number | null | undefined, current: number | null | undefined, isCostTab: boolean) {
  if (!isNumber(plan) || !isNumber(current)) return null;
  return isCostTab ? plan - current : current - plan;
}

export function variancePct(plan: number | null | undefined, variance: number | null | undefined) {
  if (!isNumber(plan) || !isNumber(variance) || plan === 0) return null;
  return (variance / Math.abs(plan)) * 100;
}

export function shortName(label: string) {
  return label
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/Transportation cost /g, "Trans ")
    .replace(/sales volume/g, "Vol")
    .replace(/Ex-Price /g, "Ex ")
    .replace(/Cost /g, "");
}

export function getGroupByTab(data: DashboardData, tab: TabKey): GroupMetrics | null {
  if (tab === "Volume") return data.volume;
  if (tab === "Price") return data.price;
  if (tab === "Cost") return data.cost;
  return null;
}
