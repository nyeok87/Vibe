import { NextRequest } from "next/server";
import { requireApi } from "@/lib/auth";
import { fileResponse, handler, weekParam } from "@/lib/api";
import { mmdd } from "@/lib/dates";
import { buildSubmissionForm } from "@/lib/hwpx/templates";
import { listDepartments } from "@/lib/repo";

/** 부서 제출양식 HWPX 내려받기(부서명·주차를 채워 준다) */
export const GET = handler(async (req: NextRequest) => {
  await requireApi("dept");
  const week = weekParam(req.nextUrl.searchParams.get("week"));
  const deptId = req.nextUrl.searchParams.get("dept");
  const dept = (await listDepartments()).find((d) => d.id === deptId);
  const name = dept?.name ?? "";
  const bytes = await buildSubmissionForm(week, name);
  return fileResponse(bytes, `주간일정_제출양식_${name || "부서"}_${mmdd(week).replace(".", "")}주.hwpx`);
});
