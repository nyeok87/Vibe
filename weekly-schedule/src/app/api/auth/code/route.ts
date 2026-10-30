import { NextRequest, NextResponse } from "next/server";
import { COOKIE, cookieOptions, currentRole, HttpError, makeToken, verifySecret } from "@/lib/auth";
import { handler } from "@/lib/api";
import { getSetting } from "@/lib/repo";

export const POST = handler(async (req: NextRequest) => {
  const { code } = await req.json();
  const hash = await getSetting<string>("access_code_hash");
  if (!hash || typeof code !== "string" || !verifySecret(code, hash)) throw new HttpError(401, "접속코드가 올바르지 않습니다.");
  const res = NextResponse.json({ ok: true });
  // 이미 관리자로 로그인했다면 유지
  if ((await currentRole()) !== "admin") res.cookies.set(COOKIE, makeToken("dept"), cookieOptions);
  return res;
});
