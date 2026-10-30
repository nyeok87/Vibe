import { NextRequest, NextResponse } from "next/server";
import { HttpError, requireApi } from "@/lib/auth";
import { handler, readUpload, weekParam } from "@/lib/api";
import { normalizeDate } from "@/lib/dates";
import { parseCommonHwpx } from "@/lib/hwpx/parse";
import { listSubmissions, saveSubmission } from "@/lib/repo";
import type { ParsedRow } from "@/lib/types";

/** 현재 공통일정 */
export const GET = handler(async (req: NextRequest) => {
  await requireApi("admin");
  const week = weekParam(req.nextUrl.searchParams.get("week"));
  const s = (await listSubmissions(week)).find((x) => x.kind === "common");
  return NextResponse.json(s ? { rows: s.parsed_data.common, file_name: s.file_name, id: s.id, uploaded_at: s.uploaded_at, parsed_at: s.parsed_at } : null);
});

/** 상부 공통일정 HWPX 업로드 → 자동 해석 후 저장 */
export const POST = handler(async (req: NextRequest) => {
  await requireApi("admin");
  const form = await req.formData();
  const week = weekParam(String(form.get("week")));
  const { name, bytes } = await readUpload(form);
  let parsed;
  try {
    parsed = await parseCommonHwpx(bytes, week);
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "파일을 읽지 못했습니다.");
  }
  await saveSubmission({
    weekId: week,
    kind: "common",
    departmentId: null,
    fileName: name,
    file: bytes,
    parsed: { department: [], personal: [], common: parsed.common },
  });
  return NextResponse.json({ rows: parsed.common, method: parsed.method, notices: parsed.notices });
});

/** 해석 결과를 사람이 고친 뒤 저장(파일 없이 직접 입력도 가능) */
export const PUT = handler(async (req: NextRequest) => {
  await requireApi("admin");
  const body = await req.json();
  const week = weekParam(body.week);
  const rows: ParsedRow[] = (Array.isArray(body.rows) ? body.rows : [])
    .map((r: Record<string, string>) => {
      const str = (k: string) => String(r?.[k] ?? "").trim();
      const d = normalizeDate(str("date_text"), "", week);
      const warnings = [...d.warnings];
      if (!str("content")) warnings.push("내용 누락");
      return { person: "", ...d, content: str("content"), place: str("place"), headcount: str("headcount"), note: str("note"), warnings };
    })
    .filter((r: ParsedRow) => r.content || r.date_text);
  await saveSubmission({ weekId: week, kind: "common", departmentId: null, fileName: null, file: null, parsed: { department: [], personal: [], common: rows } });
  return NextResponse.json({ rows });
});
