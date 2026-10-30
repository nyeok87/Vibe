import { NextRequest, NextResponse } from "next/server";
import { HttpError, requireApi } from "@/lib/auth";
import { handler, readUpload, weekParam } from "@/lib/api";
import { parseDepartmentHwpx } from "@/lib/hwpx/parse";
import { listDepartments, saveSubmission } from "@/lib/repo";

/** 인식 결과를 확인한 뒤 [제출] — 같은 주차·부서는 최신본으로 교체 */
export const POST = handler(async (req: NextRequest) => {
  await requireApi("dept");
  const form = await req.formData();
  const week = weekParam(String(form.get("week")));
  const dept = (await listDepartments()).find((d) => d.id === form.get("dept"));
  if (!dept) throw new HttpError(400, "부서를 선택해 주세요.");
  const { name, bytes } = await readUpload(form);
  let parsed;
  try {
    parsed = await parseDepartmentHwpx(bytes, week, dept.name);
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "파일을 읽지 못했습니다.");
  }
  if (parsed.errors.length) throw new HttpError(400, parsed.errors.join(" "));
  const sub = await saveSubmission({
    weekId: week,
    kind: "department",
    departmentId: dept.id,
    fileName: name,
    file: bytes,
    parsed: { department: parsed.department, personal: parsed.personal, common: [] },
  });
  return NextResponse.json({ ok: true, revision_no: sub.revision_no, uploaded_at: sub.uploaded_at });
});
