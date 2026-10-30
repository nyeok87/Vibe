import { NextRequest, NextResponse } from "next/server";
import { HttpError, requireApi } from "@/lib/auth";
import { handler, weekParam } from "@/lib/api";
import { addItem, deleteItem, draftView, updateItem } from "@/lib/repo";
import type { Section } from "@/lib/types";

/** 미리보기·편집 데이터: 초안 항목 + 직전 배포본 대비 변경 */
export const GET = handler(async (req: NextRequest) => {
  await requireApi("admin");
  const week = weekParam(req.nextUrl.searchParams.get("week"));
  const v = await draftView(week);
  return NextResponse.json({
    status: v.week?.status ?? "draft",
    published_at: v.week?.published_at ?? null,
    last_composed_at: v.week?.last_composed_at ?? null,
    items: v.items,
    changes: v.changes,
    model: v.model,
    departments: v.departments.map((d) => ({ id: d.id, name: d.name })),
  });
});

export const POST = handler(async (req: NextRequest) => {
  await requireApi("admin");
  const { week, section, department_id } = await req.json();
  if (!["common", "department", "personal"].includes(section)) throw new HttpError(400, "구역이 올바르지 않습니다.");
  if (section !== "common" && !department_id) throw new HttpError(400, "부서를 선택해 주세요.");
  return NextResponse.json(await addItem(weekParam(week), section as Section, department_id ?? null));
});

export const PATCH = handler(async (req: NextRequest) => {
  await requireApi("admin");
  const { id, patch } = await req.json();
  return NextResponse.json(await updateItem(String(id), patch ?? {}));
});

export const DELETE = handler(async (req: NextRequest) => {
  await requireApi("admin");
  await deleteItem(req.nextUrl.searchParams.get("id") ?? "");
  return NextResponse.json({ ok: true });
});
