import { NextResponse } from "next/server";
import { HttpError } from "./auth";
import { isValidWeekId } from "./dates";

/** 라우트 처리기 감싸기: 오류를 JSON 응답으로 바꾼다 */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      return NextResponse.json({ error: e instanceof Error ? e.message : "오류가 발생했습니다." }, { status });
    }
  };
}

export function weekParam(value: string | null | undefined): string {
  if (!isValidWeekId(value)) throw new HttpError(400, "주차(월요일 날짜)가 올바르지 않습니다.");
  return value;
}

export function fileResponse(data: Uint8Array, fileName: string) {
  return new Response(Buffer.from(data), {
    headers: {
      "Content-Type": "application/hwp+zip",
      "Content-Disposition": `attachment; filename="file.hwpx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}

export async function readUpload(form: FormData, field = "file"): Promise<{ name: string; bytes: Uint8Array }> {
  const f = form.get(field);
  if (!f || typeof f === "string") throw new HttpError(400, "파일을 선택해 주세요.");
  if (!/\.hwpx$/i.test(f.name)) throw new HttpError(400, "HWPX 파일만 올릴 수 있습니다. (구형 .hwp는 한글에서 HWPX로 저장 후 올려 주세요)");
  if (f.size > 10 * 1024 * 1024) throw new HttpError(400, "파일이 너무 큽니다(10MB 이하).");
  return { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) };
}
