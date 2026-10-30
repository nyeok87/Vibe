import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { handler, weekParam } from "@/lib/api";
import { publishedView } from "@/lib/repo";

/** 배포본(스냅샷)만 돌려준다. 초안은 여기서 절대 나가지 않는다 */
export const GET = handler(async (req: NextRequest) => {
  await requireApi("dept");
  const week = weekParam(req.nextUrl.searchParams.get("week"));
  return NextResponse.json(await publishedView(week));
});
