import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { handler, weekParam } from "@/lib/api";
import { statusBoard } from "@/lib/repo";

export const GET = handler(async (req: NextRequest) => {
  await requireApi("admin");
  const week = weekParam(req.nextUrl.searchParams.get("week"));
  return NextResponse.json(await statusBoard(week));
});
