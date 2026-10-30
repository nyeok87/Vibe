import { NextRequest, NextResponse } from "next/server";
import { HttpError, requireApi } from "@/lib/auth";
import { handler } from "@/lib/api";
import { getSubmission } from "@/lib/repo";

/** 부서 제출 내용 열람 */
export const GET = handler(async (req: NextRequest) => {
  await requireApi("admin");
  const s = await getSubmission(req.nextUrl.searchParams.get("id") ?? "");
  if (!s) throw new HttpError(404, "제출 내용이 없습니다.");
  return NextResponse.json(s);
});
