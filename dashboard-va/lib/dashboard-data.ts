export type SeriesMetric = {
  label: string;
  unit: string;
  plan: (number | null)[];
  actual: (number | null)[];
};

export type GroupMetrics = Record<string, SeriesMetric>;

export type Initiative = {
  no: number;
  name: string;
  pic: string;
  targetMB: number | null;
  note: string;
};

export type DashboardData = {
  meta: {
    year: number;
    months: string[];
    source: string;
    actualEndMonthIdx: number;
  };
  initiatives: Initiative[];
  executive: {
    coi: SeriesMetric;
    profit: SeriesMetric;
    vr: SeriesMetric;
  };
  volume: GroupMetrics;
  price: GroupMetrics;
  cost: GroupMetrics;
};

export type TabKey = "Executive" | "Volume" | "Price" | "Cost" | "Initiatives";
export type TabIconKey = "presentation" | "cube" | "currency" | "truck" | "target";

export const DASHBOARD_META = {
  year: 2026,
  months: ["Est Full", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  source: "template.xlsx"
} as const;

export const TAB_META: { key: TabKey; label: string; icon: TabIconKey }[] = [
  { key: "Executive", label: "Executive", icon: "presentation" },
  { key: "Volume", label: "Volume", icon: "cube" },
  { key: "Price", label: "Price", icon: "currency" },
  { key: "Cost", label: "Cost", icon: "truck" },
  { key: "Initiatives", label: "Initiatives", icon: "target" }
];

export const DEFAULT_ACTUAL_END_MONTH_IDX = 2;
