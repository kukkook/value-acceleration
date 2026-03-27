import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { DASHBOARD_META, DEFAULT_ACTUAL_END_MONTH_IDX, type DashboardData, type SeriesMetric } from "@/lib/dashboard-data";
import { getInitiativeDrafts, getInitiativesFromDb } from "@/lib/initiative-inputs";

const workbookPath = path.join(process.cwd(), "src", "template.xlsx");
const monthColumns = ["I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"] as const;

async function readWorkbook() {
  const file = await readFile(workbookPath);
  return XLSX.read(file, { type: "buffer", cellDates: false });
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const text = cleanText(value);
  if (!text || text === "-" || text === "Actual" || text === "Plan") return null;

  const negative = text.startsWith("(") && text.endsWith(")");
  const normalized = text.replace(/[(),\s]/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function cellNumber(sheet: XLSX.WorkSheet, address: string) {
  return toNumber(sheet[address]?.v ?? sheet[address]?.w ?? null);
}

function buildSeries(sheet: XLSX.WorkSheet, planRow: number, actualRow: number, label: string, unit: string): SeriesMetric {
  return {
    label,
    unit,
    plan: [cellNumber(sheet, `F${planRow}`), ...monthColumns.map((column) => cellNumber(sheet, `${column}${planRow}`))],
    actual: [cellNumber(sheet, `F${actualRow}`), ...monthColumns.map((column) => cellNumber(sheet, `${column}${actualRow}`))]
  };
}

function detectActualEndMonthIdx(sheet: XLSX.WorkSheet) {
  const merges = sheet["!merges"] ?? [];
  const actualMerge = merges.find((merge) => merge.s.r === 0 && merge.s.c === 8);

  if (!actualMerge) return DEFAULT_ACTUAL_END_MONTH_IDX;

  const monthCount = actualMerge.e.c - actualMerge.s.c + 1;
  return Math.max(1, Math.min(12, monthCount));
}

export async function getDashboardDataFromExcel(): Promise<DashboardData> {
  const workbook = await readWorkbook();
  const kpiSheet = workbook.Sheets.Sheet2;

  if (!kpiSheet) {
    throw new Error("Required KPI workbook sheet was not found.");
  }

  const actualEndMonthIdx = detectActualEndMonthIdx(kpiSheet);
  const initiatives = await getInitiativesFromDb(DASHBOARD_META.year);

  return {
    meta: {
      year: DASHBOARD_META.year,
      months: [...DASHBOARD_META.months],
      source: DASHBOARD_META.source,
      actualEndMonthIdx
    },
    initiatives,
    executive: {
      coi: buildSeries(kpiSheet, 3, 4, "Overall COI", "MB"),
      profit: buildSeries(kpiSheet, 5, 6, "Profit", "MB"),
      vr: buildSeries(kpiSheet, 7, 8, "VR from VA", "MB")
    },
    volume: {
      mma: buildSeries(kpiSheet, 10, 11, "MMA sales volume", "Ton"),
      bma: buildSeries(kpiSheet, 12, 13, "BMA sales volume", "Ton"),
      maa: buildSeries(kpiSheet, 14, 15, "MAA sales volume", "Ton"),
      sheet: buildSeries(kpiSheet, 16, 17, "Sheet sales volume", "Ton")
    },
    price: {
      mma_ex: buildSeries(kpiSheet, 19, 20, "MMA Ex-Price (XF)", "USD/T"),
      ibma_ex: buildSeries(kpiSheet, 21, 22, "IBMA Ex-Price (XF)", "USD/T"),
      nbma_ex: buildSeries(kpiSheet, 23, 24, "NBMA Ex-Price (XF)", "USD/T"),
      maa_ex: buildSeries(kpiSheet, 25, 26, "MAA Ex-Price (XF)", "USD/T"),
      sheet_ex: buildSeries(kpiSheet, 27, 28, "Sheet Ex-Price (XF)", "USD/T")
    },
    cost: {
      pgc_mma: buildSeries(kpiSheet, 30, 31, "PGC MMA (USD/T)", "USD/T"),
      mtn_mma: buildSeries(kpiSheet, 36, 37, "MTN AVG Cost MMA", "USD/T"),
      catchem: buildSeries(kpiSheet, 38, 39, "Cat & Chem Cost", "USD/T"),
      transport_mma: buildSeries(kpiSheet, 41, 42, "Transportation cost MMA", "USD/T"),
      transport_maa: buildSeries(kpiSheet, 43, 44, "Transportation cost MAA", "USD/T"),
      transport_bma: buildSeries(kpiSheet, 45, 46, "Transportation cost BMA", "USD/T")
    }
  };
}

export async function buildInitiativeExportFile(monthIdx: number) {
  const file = await readFile(workbookPath);
  const zip = await JSZip.loadAsync(file);
  const sheetPath = "xl/worksheets/sheet2.xml";
  const sheetFile = zip.file(sheetPath);

  if (!sheetFile) {
    throw new Error("Required KPI workbook sheet was not found.");
  }

  let sheetXml = await sheetFile.async("string");
  const initiatives = await getInitiativesFromDb(DASHBOARD_META.year);
  const drafts = await getInitiativeDrafts(DASHBOARD_META.year, monthIdx);

  initiatives.forEach((initiative, index) => {
    const row = 63 + index;
    const draft = drafts[initiative.no];
    const impactText = draft?.impact?.trim() ?? "";
    const impact = impactText === "" ? null : Number(impactText);
    const cellRef = `H${row}`;
    const numericValue = Number.isFinite(impact) ? String(impact) : "";
    const cellPattern = new RegExp(`<c r="${cellRef}"([^/>]*)\\/>|<c r="${cellRef}"([^>]*)>([\\s\\S]*?)<\\/c>`);

    sheetXml = sheetXml.replace(cellPattern, (_match, selfClosingAttrs, openAttrs, _inner) => {
      const attrs = selfClosingAttrs ?? openAttrs ?? "";
      return numericValue ? `<c r="${cellRef}"${attrs}><v>${numericValue}</v></c>` : `<c r="${cellRef}"${attrs}/>`;
    });
  });

  zip.file(sheetPath, sheetXml);
  return await zip.generateAsync({ type: "nodebuffer" });
}
