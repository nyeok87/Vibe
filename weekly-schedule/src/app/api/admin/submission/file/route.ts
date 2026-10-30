import { NextRequest } from "next/server";
import { HttpError, requireApi } from "@/lib/auth";
import { fileResponse, handler } from "@/lib/api";
import { db } from "@/lib/db";
import { getSubmission } from "@/lib/repo";

/** 제출 원본 HWPX 내려받기 */
export const GET = handler(async (req: NextRequest) => {
  await requireApi("admin");
  const s = await getSubmission(req.nextUrl.searchParams.get("id") ?? "");
  if (!s?.file_path) throw new HttpError(404, "원본 파일이 없습니다.");
  const data = await db().getFile(s.file_path);
  if (!data) throw new HttpError(404, "원본 파일을 찾지 못했습니다.");
  return fileResponse(data, s.file_name ?? "제출본.hwpx");
});
