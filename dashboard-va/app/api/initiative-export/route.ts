import { NextResponse } from "next/server";
import { buildInitiativeExportFile } from "@/lib/excel-dashboard";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthIdx = Number(searchParams.get("monthIdx") ?? "0");

    if (!Number.isInteger(monthIdx) || monthIdx < 0 || monthIdx > 12) {
      return NextResponse.json({ error: "monthIdx must be between 0 and 12." }, { status: 400 });
    }

    const buffer = await buildInitiativeExportFile(monthIdx);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="va-initiatives-${monthIdx}.xlsx"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export Excel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
