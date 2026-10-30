import { NextRequest } from "next/server";
import { requireApi } from "@/lib/auth";
import { fileResponse, handler, weekParam } from "@/lib/api";
import { mmdd } from "@/lib/dates";
import { buildFinalHwpx } from "@/lib/hwpx/templates";
import { draftView } from "@/lib/repo";

/** 현재 미리보기 내용으로 최종본 HWPX 생성 */
export const GET = handler(async (req: NextRequest) => {
  await requireApi("admin");
  const week = weekParam(req.nextUrl.searchParams.get("week"));
  const { model } = await draftView(week);
  return fileResponse(await buildFinalHwpx(model), `${model.title}_${mmdd(week).replace(".", "")}주.hwpx`);
});
