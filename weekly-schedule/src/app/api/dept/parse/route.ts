import { NextRequest, NextResponse } from "next/server";
import { HttpError, requireApi } from "@/lib/auth";
import { handler, readUpload, weekParam } from "@/lib/api";
import { parseDepartmentHwpx } from "@/lib/hwpx/parse";
import { listDepartments } from "@/lib/repo";

/** 업로드 즉시 해석해 인식 결과를 돌려준다(저장하지 않음) */
export const POST = handler(async (req: NextRequest) => {
  await requireApi("dept");
  const form = await req.formData();
  const week = weekParam(String(form.get("week")));
  const dept = (await listDepartments()).find((d) => d.id === form.get("dept"));
  if (!dept) throw new HttpError(400, "부서를 선택해 주세요.");
  const { bytes } = await readUpload(form);
  try {
    return NextResponse.json(await parseDepartmentHwpx(bytes, week, dept.name));
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "파일을 읽지 못했습니다.");
  }
});
