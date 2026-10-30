// 날짜·주차 유틸. 주차는 월요일 날짜(YYYY-MM-DD)로 식별한다. 모든 "오늘"은 한국 시간 기준.

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const pad = (n: number) => String(n).padStart(2, "0");

export function toIso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso: string, n: number): string {
  const d = fromIso(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

/** 한국 시간 기준 오늘 날짜 */
export function todayKst(): string {
  return toIso(new Date(Date.now() + 9 * 3600 * 1000));
}

export function mondayOf(iso: string): string {
  const day = fromIso(iso).getUTCDay(); // 0=일
  return addDays(iso, day === 0 ? -6 : 1 - day);
}

export const thisWeek = () => mondayOf(todayKst());
export const nextWeek = () => addDays(thisWeek(), 7);

export function isValidWeekId(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && mondayOf(s) === s;
}

export function weekdayOf(iso: string): string {
  return WEEKDAYS[fromIso(iso).getUTCDay()];
}

export function mmdd(iso: string): string {
  return iso.slice(5, 7) + "." + iso.slice(8, 10);
}

/** 2026.11.02.(월) ~ 11.08.(일) */
export function periodLabel(weekId: string): string {
  const end = addDays(weekId, 6);
  return `${weekId.replace(/-/g, ".")}.(${weekdayOf(weekId)}) ~ ${mmdd(end)}.(${weekdayOf(end)})`;
}

/** 주차 선택 목록용 짧은 표기: 11.02(월)~11.08(일) */
export function weekShortLabel(weekId: string): string {
  return `${mmdd(weekId)}~${mmdd(addDays(weekId, 6))}`;
}

export function weekdayLabel(start: string | null, end: string | null): string {
  if (!start) return "";
  if (!end || end === start) return weekdayOf(start);
  return `${weekdayOf(start)}~${weekdayOf(end)}`;
}

/** 일자 표기(요일 포함): 11.03.(화) / 11.03.(화) ~ 11.05.(목) */
export function dateTextOf(start: string | null, end: string | null, fallback = ""): string {
  if (!start) return fallback;
  const one = (iso: string) => `${mmdd(iso)}.(${weekdayOf(iso)})`;
  if (!end || end === start) return one(start);
  return `${one(start)} ~ ${one(end)}`;
}

/** 표 안의 물결표는 앞뒤 공백 1칸으로 통일: "09:00~12:00" → "09:00 ~ 12:00" */
export function spaceTilde(s: string): string {
  return s.replace(/[ \t]*[~∼～][ \t]*/g, " ~ ");
}

export const dateWithDay = dateTextOf;

/** 대상 주에 가장 가까운 연도를 골라 월·일을 ISO로 만든다(연말·연초 대비). */
function resolveYear(month: number, day: number, weekId: string, year?: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const base = fromIso(weekId).getUTCFullYear();
  const candidates = year ? [year] : [base - 1, base, base + 1];
  let best: string | null = null;
  let bestDist = Infinity;
  for (const y of candidates) {
    const d = new Date(Date.UTC(y, month - 1, day));
    if (d.getUTCMonth() !== month - 1) continue; // 2.30 같은 없는 날짜
    const dist = Math.abs(d.getTime() - fromIso(weekId).getTime());
    if (dist < bestDist) {
      bestDist = dist;
      best = toIso(d);
    }
  }
  return best;
}

const ONE_DATE =
  /(?:(\d{4})\s*[.\-\/년]\s*)?(\d{1,2})\s*(?:[.\-\/]|월)\s*(\d{1,2})\s*(?:일|\.)?/;

export interface DateParse {
  start: string | null;
  end: string | null;
  inputWeekday: string; // 날짜 칸에 함께 적힌 요일 (예: 11.03(화))
  ok: boolean;
}

/** "11.03", "11.3.", "11월 3일", "2026.11.03", "11.03~11.05", "11.03~05", "11.03(화)" 등을 해석 */
export function parseDateText(raw: string, weekId: string): DateParse {
  const text = (raw || "").replace(/\s+/g, " ").trim();
  if (!text) return { start: null, end: null, inputWeekday: "", ok: false };
  // "11월"의 '월'을 요일로 읽지 않도록 괄호 안이나 맨 끝의 요일만 인정
  const wd = text.match(/\(\s*([월화수목금토일])\s*\)/) ?? text.match(/(?:^|\s)([월화수목금토일])(?:요일)?$/);
  const inputWeekday = wd ? wd[1] : "";
  const [left, right] = text.split(/\s*[~∼～]\s*|\s+-\s+/);
  const m1 = left.match(ONE_DATE);
  if (!m1) return { start: null, end: null, inputWeekday, ok: false };
  const year = m1[1] ? Number(m1[1]) : undefined;
  const start = resolveYear(Number(m1[2]), Number(m1[3]), weekId, year);
  if (!start) return { start: null, end: null, inputWeekday, ok: false };
  let end: string | null = start;
  if (right) {
    const m2 = right.match(ONE_DATE);
    if (m2) {
      end = resolveYear(Number(m2[2]), Number(m2[3]), weekId, m2[1] ? Number(m2[1]) : undefined);
    } else {
      const dayOnly = right.match(/^(\d{1,2})\s*일?/);
      end = dayOnly ? resolveYear(Number(m1[2]), Number(dayOnly[1]), weekId, year) : null;
    }
    if (!end) return { start, end: null, inputWeekday, ok: false };
    if (end < start) return { start, end, inputWeekday, ok: false };
  }
  return { start, end, inputWeekday, ok: true };
}

/** 날짜 해석 + 주차 범위·요일 검증. 경고 목록을 함께 돌려준다. */
export function normalizeDate(raw: string, weekdayInput: string, weekId: string) {
  const warnings: string[] = [];
  const p = parseDateText(raw, weekId);
  if (!raw.trim()) {
    warnings.push("날짜 누락");
  } else if (!p.ok) {
    warnings.push(`날짜 형식 오류(${raw.trim()})`);
  }
  const start = p.ok ? p.start : null;
  const end = p.ok ? p.end : null;
  if (start && end) {
    const weekEnd = addDays(weekId, 6);
    if (end < weekId || start > weekEnd) warnings.push("주차 범위 밖 날짜");
  }
  const weekday = weekdayLabel(start, end);
  const given = (weekdayInput || p.inputWeekday || "").replace(/[()\s요일]/g, "");
  if (start && given && given[0] !== weekday[0]) {
    warnings.push(`요일 불일치(적힌 요일 ${given}, 실제 ${weekday})`);
  }
  return {
    date_text: start ? dateTextOf(start, end) : raw.trim(),
    date_start: start,
    date_end: end,
    weekday,
    warnings,
  };
}

/** 한국 시간 표시: 10.30 14:20 */
export function formatKst(iso: string | null | undefined, withYear = false): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const s = `${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return withYear ? `${d.getUTCFullYear()}.${s}` : s;
}

/** 마감 시각(대상 주차 직전 주의 지정 요일·시각, 한국 시간) */
export function deadlineOf(weekId: string, day: number, time: string): Date {
  const date = addDays(weekId, -7 + day);
  return new Date(`${date}T${/^\d{2}:\d{2}$/.test(time) ? time : "18:00"}:00+09:00`);
}
