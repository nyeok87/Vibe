import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { handler } from "@/lib/api";
import { listReports } from "@/lib/repo";

export const GET = handler(async (_req: NextRequest) => {
  await requireApi("admin");
  return NextResponse.json(await listReports());
});
