import { NextRequest, NextResponse } from "next/server";
import { hashSecret, HttpError, requireApi } from "@/lib/auth";
import { handler } from "@/lib/api";
import { getAppSettings, listDepartments, saveDepartments, setSetting } from "@/lib/repo";
import type { AppSettings } from "@/lib/types";

export const GET = handler(async (_req: NextRequest) => {
  await requireApi("admin");
  const [app, departments] = await Promise.all([getAppSettings(), listDepartments()]);
  return NextResponse.json({ app, departments: departments.map((d) => ({ id: d.id, name: d.name })) });
});

export const PUT = handler(async (req: NextRequest) => {
  await requireApi("admin");
  const body = await req.json();
  if (body.app) {
    const a = body.app as AppSettings;
    await setSetting("app", {
      doc_title: String(a.doc_title || "주간 업무계획").slice(0, 60),
      org_name: String(a.org_name || "").slice(0, 40),
      deadline_enabled: !!a.deadline_enabled,
      deadline_day: Math.min(6, Math.max(0, Number(a.deadline_day) || 0)),
      deadline_time: /^\d{2}:\d{2}$/.test(a.deadline_time) ? a.deadline_time : "18:00",
    });
  }
  if (Array.isArray(body.departments)) {
    const names = body.departments.map((d: { name: string }) => String(d.name ?? "").trim()).filter(Boolean);
    if (!names.length) throw new HttpError(400, "부서는 1개 이상 있어야 합니다.");
    if (new Set(names).size !== names.length) throw new HttpError(400, "부서 이름이 중복되었습니다.");
    await saveDepartments(body.departments);
  }
  if (body.access_code) {
    if (String(body.access_code).length < 4) throw new HttpError(400, "접속코드는 4자 이상으로 정해 주세요.");
    await setSetting("access_code_hash", hashSecret(String(body.access_code)));
  }
  if (body.admin_password) {
    if (String(body.admin_password).length < 6) throw new HttpError(400, "관리자 비밀번호는 6자 이상으로 정해 주세요.");
    await setSetting("admin_password_hash", hashSecret(String(body.admin_password)));
  }
  return NextResponse.json({ ok: true });
});
