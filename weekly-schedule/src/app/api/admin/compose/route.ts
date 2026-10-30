import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { handler, weekParam } from "@/lib/api";
import { compose, composePlan } from "@/lib/repo";

/** 다시 종합할 구역(파일이 바뀐 부서·공통) 미리 보기 */
export const GET = handler(async (req: NextRequest) => {
  await requireApi("admin");
  const week = weekParam(req.nextUrl.searchParams.get("week"));
  return NextResponse.json(await composePlan(week));
});

/** [종합 만들기] — 바뀐 구역만 교체. 교체 구역에 직접 수정이 있으면 force 없이는 확인 요청 */
export const POST = handler(async (req: NextRequest) => {
  await requireApi("admin");
  const { week, force } = await req.json();
  return NextResponse.json(await compose(weekParam(week), !!force));
});
