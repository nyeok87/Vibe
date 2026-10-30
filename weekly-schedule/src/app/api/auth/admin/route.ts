import { NextRequest, NextResponse } from "next/server";
import { COOKIE, cookieOptions, HttpError, makeToken, requireApi, verifySecret } from "@/lib/auth";
import { handler } from "@/lib/api";
import { getSetting } from "@/lib/repo";

export const POST = handler(async (req: NextRequest) => {
  await requireApi("dept"); // 공용 접속코드 통과가 먼저
  const { password } = await req.json();
  const hash = await getSetting<string>("admin_password_hash");
  if (!hash || typeof password !== "string" || !verifySecret(password, hash)) throw new HttpError(401, "관리자 비밀번호가 올바르지 않습니다.");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, makeToken("admin"), cookieOptions);
  return res;
});
