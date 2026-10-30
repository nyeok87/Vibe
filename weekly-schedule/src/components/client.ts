"use client";
// 브라우저 쪽 공용 도우미
import { addDays } from "@/lib/dates";

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = "/";
    throw new Error(data.error ?? "다시 접속해 주세요.");
  }
  if (!res.ok) throw new Error(data.error ?? `요청 실패(${res.status})`);
  return data as T;
}

export interface Meta {
  role: "dept" | "admin";
  departments: { id: string; name: string }[];
  thisWeek: string;
  nextWeek: string;
  publishedWeeks: string[];
}

/** 주차 선택지: 지난 2주 ~ 다음다음 주 + 배포된 주차 */
export function weekOptions(meta: Pick<Meta, "thisWeek" | "publishedWeeks">, extra: string[] = []): string[] {
  const base = [-14, -7, 0, 7, 14].map((d) => addDays(meta.thisWeek, d));
  return [...new Set([...base, ...meta.publishedWeeks, ...extra])].sort().reverse();
}

export function storeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 저장소를 쓸 수 없어도 동작에는 지장 없음 */
  }
}
