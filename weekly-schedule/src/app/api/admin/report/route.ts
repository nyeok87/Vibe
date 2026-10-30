import { NextRequest } from "next/server";
import { HttpError, requireApi } from "@/lib/auth";
import { fileResponse, handler, weekParam } from "@/lib/api";
import { mmdd } from "@/lib/dates";
import { db } from "@/lib/db";
import { getAppSettings, listReports } from "@/lib/repo";

/** 이력: 배포본 HWPX 내려받기 */
export const GET = handler(async (req: NextRequest) => {
  await requireApi("admin");
  const week = weekParam(req.nextUrl.searchParams.get("week"));
  const r = (await listReports()).find((x) => x.week_id === week);
  const data = r && (await db().getFile(r.hwpx_path));
  if (!data) throw new HttpError(404, "배포본이 없습니다.");
  const { doc_title } = await getAppSettings();
  return fileResponse(data, `${doc_title}_${mmdd(week).replace(".", "")}주_배포본.hwpx`);
});
