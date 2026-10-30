import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { handler } from "@/lib/api";
import { nextWeek, thisWeek } from "@/lib/dates";
import { listDepartments, listReports } from "@/lib/repo";

/** 공통 화면 정보: 부서 목록, 이번 주·다음 주, 배포된 주차 목록 */
export const GET = handler(async (_req: NextRequest) => {
  const role = await requireApi("dept");
  const [departments, reports] = await Promise.all([listDepartments(), listReports()]);
  return NextResponse.json({
    role,
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    thisWeek: thisWeek(),
    nextWeek: nextWeek(),
    publishedWeeks: reports.map((r) => r.week_id),
  });
});
