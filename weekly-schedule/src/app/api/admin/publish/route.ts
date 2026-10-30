import { NextRequest, NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { handler, weekParam } from "@/lib/api";
import { publish } from "@/lib/repo";

/** [배포] — 스냅샷 저장, 최종본 HWPX 보관(재배포 시 덮어씀) */
export const POST = handler(async (req: NextRequest) => {
  await requireApi("admin");
  const { week } = await req.json();
  return NextResponse.json(await publish(weekParam(week)));
});
