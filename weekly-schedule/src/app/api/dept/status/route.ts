import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { handler, weekParam } from "@/lib/api";
import { listSubmissions } from "@/lib/repo";

/** 부서 화면: 선택한 주차의 본인 부서 제출 상태 */
export const GET = handler(async (req: NextRequest) => {
  await requireApi("dept");
  const week = weekParam(req.nextUrl.searchParams.get("week"));
  const dept = req.nextUrl.searchParams.get("dept");
  const s = (await listSubmissions(week)).find((x) => x.kind === "department" && x.department_id === dept);
  return NextResponse.json(
    s
      ? {
          status: s.revision_no > 1 ? "수정됨" : "제출",
          uploaded_at: s.uploaded_at,
          revision_no: s.revision_no,
          file_name: s.file_name,
          dept_count: s.parsed_data.department.length,
          personal_count: s.parsed_data.personal.length,
        }
      : { status: "미제출" },
  );
});
