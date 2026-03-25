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

export const DASHBOARD_META = {
  year: 2026,
  months: ["Est Full", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  source: "template.xlsx"
} as const;

export const TAB_META: { key: TabKey; label: string; icon: string }[] = [
  { key: "Executive", label: "Executive", icon: "📊" },
  { key: "Volume", label: "Volume", icon: "📦" },
  { key: "Price", label: "Price", icon: "💵" },
  { key: "Cost", label: "Cost", icon: "🚚" },
  { key: "Initiatives", label: "Initiatives", icon: "🎯" }
];

export const ACTUAL_END_MONTH_IDX = 2;
