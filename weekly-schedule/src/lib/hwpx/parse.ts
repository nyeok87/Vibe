// HWPX 해석: ZIP을 풀어 Contents/section*.xml 의 표(hp:tbl/hp:tr/hp:tc/hp:t)와 본문 문단을 읽는다.
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { normalizeDate } from "../dates";
import type { ParseResult, ParsedRow } from "../types";

type El = Element;

const local = (n: Node) => (n as El).localName || (n.nodeName.split(":").pop() as string);

function children(el: El, name?: string): El[] {
  const out: El[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (!name || local(n) === name)) out.push(n as El);
  }
  return out;
}

/** 하위 트리에서 이름이 같은 요소를 찾되, stopAt 요소 안으로는 내려가지 않는다 */
function findAll(el: El, name: string, stopAt?: string): El[] {
  const out: El[] = [];
  const walk = (e: El) => {
    for (const c of children(e)) {
      const ln = local(c);
      if (ln === name) out.push(c);
      if (stopAt && ln === stopAt) continue;
      walk(c);
    }
  };
  walk(el);
  return out;
}

/** 문단 텍스트: hp:t 안의 글자, 탭·줄바꿈 요소 반영. 안쪽 표는 건너뛴다 */
function paraText(p: El): string {
  let s = "";
  const walk = (e: El) => {
    for (let n = e.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) {
        if (local(e) === "t") s += n.nodeValue ?? "";
        continue;
      }
      if (n.nodeType !== 1) continue;
      const ln = local(n);
      if (ln === "tbl" || ln === "secPr" || ln === "ctrl") continue;
      if (ln === "tab") s += " ";
      else if (ln === "lineBreak") s += "\n";
      else walk(n as El);
    }
  };
  walk(p);
  return s;
}

function cellText(tc: El): string {
  const sub = children(tc, "subList")[0] ?? tc;
  return children(sub, "p")
    .map(paraText)
    .join("\n")
    .replace(/[ \t ]+/g, " ")
    .trim();
}

/** 표를 2차원 격자로 만든다. 병합 칸은 왼쪽 위 값으로 채운다 */
function tableGrid(tbl: El): string[][] {
  const grid: string[][] = [];
  children(tbl, "tr").forEach((tr, ri) => {
    let col = 0;
    for (const tc of children(tr, "tc")) {
      const addr = children(tc, "cellAddr")[0];
      const span = children(tc, "cellSpan")[0];
      const r = addr ? Number(addr.getAttribute("rowAddr")) : ri;
      let c = addr ? Number(addr.getAttribute("colAddr")) : col;
      const cs = span ? Math.max(1, Number(span.getAttribute("colSpan")) || 1) : 1;
      const rs = span ? Math.max(1, Number(span.getAttribute("rowSpan")) || 1) : 1;
      if (!addr) while (grid[r]?.[c] !== undefined) c++;
      const text = cellText(tc);
      for (let i = 0; i < rs; i++) {
        for (let j = 0; j < cs; j++) {
          grid[r + i] ??= [];
          grid[r + i][c + j] = text;
        }
      }
      col = c + cs;
    }
  });
  return grid.map((row) => Array.from(row ?? [], (v) => v ?? ""));
}

const norm = (s: string) => s.replace(/\s+/g, "");

type Field = "dept" | "person" | "date" | "weekday" | "content" | "place" | "headcount" | "note";

function fieldOf(header: string): Field | null {
  const h = norm(header);
  if (!h) return null;
  if (/계급|성명|이름/.test(h)) return "person";
  if (/^요일$/.test(h)) return "weekday";
  if (/날짜|일자|일시|기간|^날$|월일/.test(h)) return "date";
  if (/내용|일정|행사|업무|과제|훈련명|제목/.test(h)) return "content";
  if (/장소|위치/.test(h)) return "place";
  if (/인원|참석|대상|참가/.test(h)) return "headcount";
  if (/비고|참고|특이/.test(h)) return "note";
  if (/부서|소속|과$/.test(h)) return "dept";
  return null;
}

interface FoundTable {
  kind: "department" | "personal" | "generic";
  map: Partial<Record<Field, number>>;
  rows: string[][];
}

function classify(grid: string[][]): FoundTable | null {
  // 위쪽 3행 안에서 머리글 행을 찾는다
  for (let r = 0; r < Math.min(3, grid.length); r++) {
    const map: Partial<Record<Field, number>> = {};
    grid[r].forEach((h, c) => {
      const f = fieldOf(h);
      if (f && map[f] === undefined) map[f] = c;
    });
    if (map.date === undefined || map.content === undefined) continue;
    const kind = map.person !== undefined ? "personal" : map.dept !== undefined ? "department" : "generic";
    return { kind, map, rows: grid.slice(r + 1) };
  }
  return null;
}

function toRows(t: FoundTable, weekId: string, deptName?: string): ParsedRow[] {
  const out: ParsedRow[] = [];
  const get = (row: string[], f: Field) => (t.map[f] !== undefined ? (row[t.map[f]!] ?? "").trim() : "");
  for (const row of t.rows) {
    if (row.every((v) => !v.trim())) continue;
    const content = get(row, "content").replace(/\n+/g, " ");
    const dateRaw = get(row, "date").replace(/\n+/g, " ");
    // 예시·안내 행(날짜와 내용이 모두 빈 행)은 건너뛴다
    if (!content && !dateRaw && t.kind !== "personal") continue;
    const d = normalizeDate(dateRaw, get(row, "weekday"), weekId);
    const warnings = [...d.warnings];
    if (!content) warnings.push("내용 누락");
    const person = get(row, "person").replace(/\n+/g, " ");
    if (t.kind === "personal" && !person) warnings.push("계급/성명 누락");
    const dept = get(row, "dept");
    if (deptName && dept && norm(dept) !== norm(deptName)) warnings.push(`부서명 불일치(${dept})`);
    out.push({
      person,
      date_text: d.date_text,
      date_start: d.date_start,
      date_end: d.date_end,
      weekday: d.weekday,
      content,
      place: get(row, "place").replace(/\n+/g, " "),
      headcount: get(row, "headcount").replace(/\n+/g, " "),
      note: get(row, "note").replace(/\n+/g, " "),
      warnings,
    });
  }
  return out;
}

interface Loaded {
  tables: string[][][];
  paragraphs: string[];
}

async function load(buf: ArrayBuffer | Uint8Array): Promise<Loaded> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new Error("HWPX 파일이 아닙니다. 한글에서 [다른 이름으로 저장] → HWPX 형식으로 저장해 올려 주세요.");
  }
  const names = Object.keys(zip.files)
    .filter((n) => /^Contents\/section\d+\.xml$/i.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  if (!names.length) throw new Error("HWPX 본문(Contents/section*.xml)을 찾지 못했습니다.");
  const tables: string[][][] = [];
  const paragraphs: string[] = [];
  for (const name of names) {
    const xml = await zip.files[name].async("string");
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const root = doc.documentElement as unknown as El;
    for (const tbl of findAll(root, "tbl")) tables.push(tableGrid(tbl));
    // 표 밖 본문 문단
    for (const p of findAll(root, "p", "tbl")) {
      const t = paraText(p).trim();
      if (t) paragraphs.push(...t.split("\n").map((s) => s.trim()).filter(Boolean));
    }
  }
  return { tables, paragraphs };
}

/** 부서 제출양식 해석 */
export async function parseDepartmentHwpx(buf: ArrayBuffer | Uint8Array, weekId: string, deptName?: string): Promise<ParseResult> {
  const res: ParseResult = { department: [], personal: [], common: [], method: "none", errors: [], notices: [] };
  const { tables } = await load(buf);
  let foundDept = false;
  let foundPersonal = false;
  for (const grid of tables) {
    const t = classify(grid);
    if (!t) continue;
    if (t.kind === "personal") {
      foundPersonal = true;
      res.personal.push(...toRows(t, weekId, deptName));
    } else {
      foundDept = true;
      res.department.push(...toRows(t, weekId, deptName));
    }
  }
  if (!foundDept && !foundPersonal) {
    res.errors.push("일정 표를 찾지 못했습니다. 제공된 제출양식의 표 구조(열 구성·순서)를 바꾸지 말고 작성해 주세요.");
  } else {
    res.method = "table";
    if (!foundDept) res.notices.push("부서 일정 표를 찾지 못했습니다.");
    if (!foundPersonal) res.notices.push("개인 특이일정 표를 찾지 못했습니다.");
    if (!res.department.length && !res.personal.length) res.errors.push("표에 입력된 일정이 없습니다.");
  }
  return res;
}

const LINE_DATE =
  /^[\s\-–·•○●□■▪◦*※]*((?:\d{4}\s*[.\-\/]\s*)?\d{1,2}\s*(?:[.\-\/]|월)\s*\d{1,2}\s*(?:일|\.)?(?:\s*\(\s*[월화수목금토일]\s*\))?(?:\s*[~∼～]\s*(?:\d{1,2}\s*(?:[.\-\/]|월)\s*)?\d{1,2}\s*(?:일|\.)?(?:\s*\(\s*[월화수목금토일]\s*\))?)?)\s*[,:：\-–]?\s*(.+)$/;

/** 상부 공통일정 해석(최선 노력): ① 표 → ② 본문 날짜 줄 → ③ 빈 표 */
export async function parseCommonHwpx(buf: ArrayBuffer | Uint8Array, weekId: string): Promise<ParseResult> {
  const res: ParseResult = { department: [], personal: [], common: [], method: "none", errors: [], notices: [] };
  const { tables, paragraphs } = await load(buf);
  for (const grid of tables) {
    const t = classify(grid);
    if (!t) continue;
    res.common.push(...toRows(t, weekId));
  }
  if (res.common.length) {
    res.method = "table";
    res.notices.push(`표에서 일정 ${res.common.length}건을 읽었습니다. 내용을 확인해 주세요.`);
    return res;
  }
  for (const line of paragraphs) {
    const m = line.match(LINE_DATE);
    if (!m) continue;
    const d = normalizeDate(m[1], "", weekId);
    if (!d.date_start) continue;
    let content = m[2].trim();
    let place = "";
    const pm = content.match(/^(.*?)\s*[(（]\s*(?:장소\s*[:：]?\s*)?([^()（）]+)\s*[)）]\s*$/);
    if (pm && pm[1]) {
      content = pm[1].trim();
      place = pm[2].trim();
    }
    res.common.push({ person: "", ...d, content, place, headcount: "", note: "", warnings: d.warnings });
  }
  if (res.common.length) {
    res.method = "text";
    res.notices.push(`표를 찾지 못해 본문 문장에서 일정 ${res.common.length}건을 추출했습니다. 반드시 확인·수정해 주세요.`);
  } else {
    res.notices.push("일정을 자동으로 찾지 못했습니다. 아래 표에 직접 입력해 주세요.");
  }
  return res;
}
