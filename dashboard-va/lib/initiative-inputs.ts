import "server-only";
import { getPostgres } from "@/lib/postgres";
import type { Initiative } from "@/lib/dashboard-data";

type InitiativeDraft = {
  impact: string;
  comment: string;
};

function toDraftValue(value: number | null | string | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

export async function getInitiativesFromDb(year: number): Promise<Initiative[]> {
  const postgres = getPostgres();
  const result = await postgres.query<{
    initiative_no: number;
    name: string;
    pic: string | null;
    target_mb: string | null;
    note: string | null;
  }>(
    `select initiative_no, name, pic, target_mb, note
     from initiatives
     where year = $1
     order by initiative_no`,
    [year]
  );

  return result.rows.map((row) => ({
    no: row.initiative_no,
    name: row.name,
    pic: row.pic ?? "",
    targetMB: row.target_mb === null ? null : Number(row.target_mb),
    note: row.note ?? ""
  }));
}

async function getInitiativeIdByNo(year: number) {
  const postgres = getPostgres();
  const result = await postgres.query<{
    id: number;
    initiative_no: number;
  }>(
    `select id, initiative_no
     from initiatives
     where year = $1`,
    [year]
  );

  const idByNo = new Map<number, number>();
  for (const row of result.rows) {
    idByNo.set(row.initiative_no, row.id);
  }

  return idByNo;
}

export async function getInitiativeDrafts(year: number, monthIdx: number) {
  const postgres = getPostgres();
  const idByNo = await getInitiativeIdByNo(year);
  const initiativeIds = Array.from(idByNo.values());

  if (!initiativeIds.length) return {};

  const result = await postgres.query<{
    initiative_id: number;
    impact_mb: string | null;
    comment: string | null;
  }>(
    `select initiative_id, impact_mb, comment
     from initiative_inputs
     where year = $1 and month_idx = $2 and initiative_id = any($3::bigint[])`,
    [year, monthIdx, initiativeIds]
  );

  const noById = new Map<number, number>();
  for (const [no, id] of idByNo.entries()) {
    noById.set(id, no);
  }

  const drafts: Record<number, InitiativeDraft> = {};
  for (const row of result.rows) {
    const initiativeNo = noById.get(row.initiative_id);
    if (!initiativeNo) continue;

    drafts[initiativeNo] = {
      impact: toDraftValue(row.impact_mb),
      comment: row.comment ?? ""
    };
  }

  return drafts;
}

export async function saveInitiativeDraft(params: {
  year: number;
  monthIdx: number;
  no: number;
  impact: string;
  comment: string;
}) {
  const postgres = getPostgres();
  const { year, monthIdx, no, impact, comment } = params;
  const idByNo = await getInitiativeIdByNo(year);
  const initiativeId = idByNo.get(no);

  if (!initiativeId) {
    throw new Error(`Initiative ${no} was not found in the master data.`);
  }

  const impactValue = impact.trim() === "" ? null : Number(impact);
  if (impactValue !== null && !Number.isFinite(impactValue)) {
    throw new Error("Impact must be a valid number.");
  }

  await postgres.query(
    `insert into initiative_inputs (initiative_id, year, month_idx, impact_mb, comment)
     values ($1, $2, $3, $4, $5)
     on conflict (initiative_id, year, month_idx)
     do update set
       impact_mb = excluded.impact_mb,
       comment = excluded.comment,
       updated_at = now()`,
    [initiativeId, year, monthIdx, impactValue, comment]
  );
}
