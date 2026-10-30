// 접근 제어: 공용 접속코드(dept) / 관리자 비밀번호(admin). 서명된 httpOnly 쿠키로 세션 유지.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "./types";

export const COOKIE = "ws_session";
const MAX_AGE = 60 * 60 * 12; // 12시간

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.VERCEL) throw new Error("SESSION_SECRET 환경변수를 설정해 주세요.");
  return "local-dev-secret-change-me";
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function makeToken(role: Role): string {
  const payload = b64(JSON.stringify({ role, exp: Date.now() + MAX_AGE * 1000 }));
  return `${payload}.${sign(payload)}`;
}

export function readToken(token: string | undefined): Role | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expect = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (expect.length !== got.length || !timingSafeEqual(expect, got)) return null;
  try {
    const { role, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (exp < Date.now()) return null;
    return role === "admin" || role === "dept" ? role : null;
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};

export async function currentRole(): Promise<Role | null> {
  return readToken((await cookies()).get(COOKIE)?.value);
}

/** 화면용: 권한이 없으면 접속 화면(또는 관리자 로그인)으로 보낸다 */
export async function requirePage(role: Role): Promise<Role> {
  const r = await currentRole();
  if (!r) redirect("/");
  if (role === "admin" && r !== "admin") redirect("/admin/login");
  return r;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** API용: 권한이 없으면 401/403 */
export async function requireApi(role: Role): Promise<Role> {
  const r = await currentRole();
  if (!r) throw new HttpError(401, "접속코드를 먼저 입력해 주세요.");
  if (role === "admin" && r !== "admin") throw new HttpError(403, "관리자만 사용할 수 있습니다.");
  return r;
}

export function hashSecret(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(plain, salt, 32).toString("hex")}`;
}

export function verifySecret(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = scryptSync(plain, salt, 32);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
