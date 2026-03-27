import { NextResponse } from "next/server";
import { getInitiativeDrafts, saveInitiativeDraft } from "@/lib/initiative-inputs";

function parseInteger(value: string | null, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer.`);
  }
  return parsed;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInteger(searchParams.get("year"), "year");
    const monthIdx = parseInteger(searchParams.get("monthIdx"), "monthIdx");
    const drafts = await getInitiativeDrafts(year, monthIdx);

    return NextResponse.json({ drafts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load initiative inputs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      year?: number;
      monthIdx?: number;
      no?: number;
      impact?: string;
      comment?: string;
    };

    if (!Number.isInteger(body.year) || !Number.isInteger(body.monthIdx) || !Number.isInteger(body.no)) {
      return NextResponse.json({ error: "year, monthIdx, and no are required." }, { status: 400 });
    }

    const year = Number(body.year);
    const monthIdx = Number(body.monthIdx);
    const no = Number(body.no);

    await saveInitiativeDraft({
      year,
      monthIdx,
      no,
      impact: body.impact ?? "",
      comment: body.comment ?? ""
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save initiative input.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
