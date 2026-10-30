// 업무 로직: 설정·부서·주차·제출·종합·변경 비교·배포
import { randomUUID } from "crypto";
import { db } from "./db";
import { hashSecret } from "./auth";
import { addDays, dateWithDay, deadlineOf, mmdd, normalizeDate, todayKst } from "./dates";
import { buildDocModel, sortItems } from "./docmodel";
import { buildFinalHwpx } from "./hwpx/templates";
import type {
  AppSettings,
  Change,
  Department,
  ParsedData,
  ParsedRow,
  Report,
  ScheduleItem,
  Section,
  Snapshot,
  Submission,
  Week,
} from "./types";

const now = () => new Date().toISOString();

// ---------------- 설정 ----------------
const SAMPLE_DEPTS = ["기획과", "작전과", "정보과", "인사과", "군수과", "정비과", "통신과", "보안과", "교육과", "재정과"];

const DEFAULT_SETTINGS: AppSettings = {
  doc_title: "주간 업무계획",
  org_name: "기획과",
  deadline_enabled: false,
  deadline_day: 4, // 금
  deadline_time: "18:00",
};

let seeded: Promise<void> | null = null;

/** 첫 실행 시 가상 부서 10개와 접속코드·비밀번호 초기값을 넣는다 */
export function ensureSeed(): Promise<void> {
  seeded ??= (async () => {
    const s = db();
    const settings = await s.select<{ key: string; value: unknown }>("settings");
    const keys = new Set(settings.map((r) => r.key));
    const add: { key: string; value: unknown }[] = [];
    if (!keys.has("access_code_hash")) add.push({ key: "access_code_hash", value: hashSecret(process.env.ACCESS_CODE || "1234") });
    if (!keys.has("admin_password_hash"))
      add.push({ key: "admin_password_hash", value: hashSecret(process.env.ADMIN_PASSWORD || "admin1234") });
    if (!keys.has("app")) add.push({ key: "app", value: DEFAULT_SETTINGS });
    await s.insert("settings", add);
    if (!(await s.select("departments")).length) {
      await s.insert(
        "departments",
        SAMPLE_DEPTS.map((name, i) => ({ id: randomUUID(), name, sort_order: i, is_active: true })),
      );
    }
  })().catch((e) => {
    seeded = null;
    throw e;
  });
  return seeded;
}

export async function getSetting<T>(key: string): Promise<T | null> {
  await ensureSeed();
  const rows = await db().select<{ key: string; value: T }>("settings", { key });
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: unknown) {
  const exists = (await db().select("settings", { key })).length > 0;
  if (exists) await db().update("settings", { key }, { value });
  else await db().insert("settings", [{ key, value }]);
}

export async function getAppSettings(): Promise<AppSettings> {
  return { ...DEFAULT_SETTINGS, ...((await getSetting<AppSettings>("app")) ?? {}) };
}

// ---------------- 부서 ----------------
export async function listDepartments(includeInactive = false): Promise<Department[]> {
  await ensureSeed();
  const all = await db().select<Department>("departments");
  return all.filter((d) => includeInactive || d.is_active).sort((a, b) => a.sort_order - b.sort_order);
}

/** 설정 화면의 부서 목록 저장(추가·이름변경·순서). 목록에서 빠진 부서는 비활성 처리(기존 기록 보존) */
export async function saveDepartments(list: { id?: string; name: string }[]) {
  const all = await listDepartments(true);
  const keep = new Set<string>();
  for (const [i, d] of list.entries()) {
    const name = d.name.trim();
    if (!name) continue;
    if (d.id && all.some((x) => x.id === d.id)) {
      keep.add(d.id);
      await db().update("departments", { id: d.id }, { name, sort_order: i, is_active: true });
    } else {
      const id = randomUUID();
      keep.add(id);
      await db().insert("departments", [{ id, name, sort_order: i, is_active: true }]);
    }
  }
  for (const d of all) if (!keep.has(d.id) && d.is_active) await db().update("departments", { id: d.id }, { is_active: false });
}

// ---------------- 주차 ----------------
export async function getWeek(weekId: string): Promise<Week | null> {
  return (await db().select<Week>("weeks", { id: weekId }))[0] ?? null;
}

export async function ensureWeek(weekId: string): Promise<Week> {
  const w = await getWeek(weekId);
  if (w) return w;
  const week: Week = {
    id: weekId,
    start_date: weekId,
    end_date: addDays(weekId, 6),
    status: "draft",
    published_at: null,
    published_snapshot: null,
    last_composed_at: null,
  };
  await db().insert("weeks", [week as unknown as Record<string, unknown>]);
  return week;
}

// ---------------- 제출 ----------------
export async function listSubmissions(weekId: string): Promise<Submission[]> {
  return db().select<Submission>("submissions", { week_id: weekId });
}

export async function getSubmission(id: string): Promise<Submission | null> {
  return (await db().select<Submission>("submissions", { id }))[0] ?? null;
}

/** 같은 주차·부서(또는 공통)는 최신본 1건만 유지. 다시 내면 revision_no 증가 */
export async function saveSubmission(opts: {
  weekId: string;
  kind: "department" | "common";
  departmentId: string | null;
  fileName: string | null;
  file: Uint8Array | null;
  parsed: ParsedData;
}): Promise<Submission> {
  await ensureWeek(opts.weekId);
  const match = { week_id: opts.weekId, kind: opts.kind, department_id: opts.departmentId };
  const prev = (await db().select<Submission>("submissions", match))[0];
  const t = now();
  let filePath = prev?.file_path ?? null;
  if (opts.file) {
    filePath = `submissions/${opts.weekId}/${opts.kind === "common" ? "common" : opts.departmentId}.hwpx`;
    await db().putFile(filePath, opts.file);
  }
  const fields = {
    file_path: filePath,
    file_name: opts.file ? opts.fileName : prev?.file_name ?? opts.fileName,
    parsed_data: opts.parsed,
    parsed_at: t,
  };
  if (prev) {
    const patch = opts.file ? { ...fields, revision_no: prev.revision_no + 1, uploaded_at: t } : fields;
    await db().update("submissions", { id: prev.id }, patch);
    return { ...prev, ...patch };
  }
  const sub: Submission = {
    id: randomUUID(),
    week_id: opts.weekId,
    kind: opts.kind,
    department_id: opts.departmentId,
    revision_no: 1,
    uploaded_at: t,
    last_composed_at: null,
    ...fields,
  };
  await db().insert("submissions", [sub as unknown as Record<string, unknown>]);
  return sub;
}

export type DeptStatus = "미제출" | "제출" | "수정됨";

export async function statusBoard(weekId: string) {
  const [depts, subs, settings, week, items] = await Promise.all([
    listDepartments(),
    listSubmissions(weekId),
    getAppSettings(),
    getWeek(weekId),
    listItems(weekId),
  ]);
  const deadline = settings.deadline_enabled ? deadlineOf(weekId, settings.deadline_day, settings.deadline_time) : null;
  const overdue = !!deadline && Date.now() > deadline.getTime();
  const needsCompose = (s: Submission) => !s.last_composed_at || Date.parse(s.parsed_at) > Date.parse(s.last_composed_at);
  const rows = depts.map((d) => {
    const s = subs.find((x) => x.kind === "department" && x.department_id === d.id);
    const status: DeptStatus = !s ? "미제출" : s.revision_no > 1 ? "수정됨" : "제출";
    return {
      department: d,
      status,
      submission: s
        ? {
            id: s.id,
            uploaded_at: s.uploaded_at,
            revision_no: s.revision_no,
            file_name: s.file_name,
            dept_count: s.parsed_data.department.length,
            personal_count: s.parsed_data.personal.length,
            warning_count: [...s.parsed_data.department, ...s.parsed_data.personal].filter((r) => r.warnings.length).length,
            pending: needsCompose(s),
          }
        : null,
      overdue: !s && overdue,
    };
  });
  const common = subs.find((x) => x.kind === "common") ?? null;
  return {
    weekId,
    deadline: deadline?.toISOString() ?? null,
    rows,
    common,
    commonPending: !!common && needsCompose(common),
    week: week
      ? { status: week.status, published_at: week.published_at, last_composed_at: week.last_composed_at }
      : { status: "draft" as const, published_at: null, last_composed_at: null },
    itemCount: items.length,
  };
}

// ---------------- 종합 항목 ----------------
export async function listItems(weekId: string): Promise<ScheduleItem[]> {
  return db().select<ScheduleItem>("schedule_items", { week_id: weekId });
}

const EDITABLE = ["person", "date_text", "content", "place", "headcount", "note"] as const;

export async function updateItem(id: string, patch: Partial<Record<(typeof EDITABLE)[number], string>>) {
  const item = (await db().select<ScheduleItem>("schedule_items", { id }))[0];
  if (!item) throw new Error("항목이 없습니다.");
  const next: Record<string, unknown> = { is_manual_edit: true };
  for (const k of EDITABLE) if (typeof patch[k] === "string") next[k] = patch[k]!.trim();
  if (typeof patch.date_text === "string") {
    const d = normalizeDate(patch.date_text, "", item.week_id);
    Object.assign(next, { date_text: d.date_text, date_start: d.date_start, date_end: d.date_end, weekday: d.weekday });
  }
  await db().update("schedule_items", { id }, next);
  return { ...item, ...next } as ScheduleItem;
}

export async function addItem(weekId: string, section: Section, departmentId: string | null) {
  const item: ScheduleItem = {
    id: randomUUID(),
    week_id: weekId,
    section,
    department_id: section === "common" ? null : departmentId,
    person: "",
    date_text: "",
    date_start: null,
    date_end: null,
    weekday: "",
    content: "",
    place: "",
    headcount: "",
    note: "",
    sort_order: Date.now() % 1e9,
    source_submission_id: null,
    is_manual_edit: true,
    change_flag: null,
  };
  await ensureWeek(weekId);
  await db().insert("schedule_items", [item as unknown as Record<string, unknown>]);
  return item;
}

export async function deleteItem(id: string) {
  await db().remove("schedule_items", { id });
}

// ---------------- 종합 만들기(부분 갱신) ----------------
function bigrams(s: string): string[] {
  const t = s.replace(/\s+/g, "");
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out.length ? out : [t];
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  const pool = [...B];
  let hit = 0;
  for (const x of A) {
    const i = pool.indexOf(x);
    if (i >= 0) {
      hit++;
      pool.splice(i, 1);
    }
  }
  return (2 * hit) / (A.length + B.length);
}

/** 새로 해석한 행을 이전 항목과 (구역, 사람, 날짜, 내용 유사도)로 짝지어 ID를 이어받는다 */
function inheritIds(old: ScheduleItem[], fresh: ScheduleItem[]) {
  const pairs: { o: number; f: number; score: number }[] = [];
  old.forEach((o, oi) =>
    fresh.forEach((f, fi) => {
      if (o.section !== f.section || o.person.replace(/\s/g, "") !== f.person.replace(/\s/g, "")) return;
      const sameDate = o.date_start === f.date_start && o.date_end === f.date_end;
      const score = similarity(o.content, f.content) * 0.7 + (sameDate ? 0.3 : 0);
      if (score >= 0.5) pairs.push({ o: oi, f: fi, score });
    }),
  );
  pairs.sort((a, b) => b.score - a.score);
  const usedO = new Set<number>();
  const usedF = new Set<number>();
  for (const p of pairs) {
    if (usedO.has(p.o) || usedF.has(p.f)) continue;
    usedO.add(p.o);
    usedF.add(p.f);
    fresh[p.f].id = old[p.o].id;
  }
}

function itemsFromRows(weekId: string, section: Section, deptId: string | null, subId: string, rows: ParsedRow[]): ScheduleItem[] {
  return rows.map((r, i) => ({
    id: randomUUID(),
    week_id: weekId,
    section,
    department_id: deptId,
    person: r.person,
    date_text: r.date_text,
    date_start: r.date_start,
    date_end: r.date_end,
    weekday: r.weekday,
    content: r.content,
    place: r.place,
    headcount: r.headcount,
    note: r.note,
    sort_order: i,
    source_submission_id: subId,
    is_manual_edit: false,
    change_flag: null,
  }));
}

interface Region {
  key: string;
  label: string;
  submission: Submission;
  oldItems: ScheduleItem[];
  manualEdits: number;
}

async function changedRegions(weekId: string): Promise<Region[]> {
  const [subs, items, depts] = await Promise.all([listSubmissions(weekId), listItems(weekId), listDepartments(true)]);
  const regions: Region[] = [];
  for (const s of subs) {
    if (s.last_composed_at && Date.parse(s.parsed_at) <= Date.parse(s.last_composed_at)) continue;
    const oldItems =
      s.kind === "common"
        ? items.filter((i) => i.section === "common")
        : items.filter((i) => i.section !== "common" && i.department_id === s.department_id);
    const dept = depts.find((d) => d.id === s.department_id);
    if (s.kind === "department" && !dept?.is_active) continue;
    regions.push({
      key: s.kind === "common" ? "common" : s.department_id!,
      label: s.kind === "common" ? "상부 공통일정" : dept!.name,
      submission: s,
      oldItems,
      manualEdits: oldItems.filter((i) => i.is_manual_edit).length,
    });
  }
  return regions;
}

export async function composePlan(weekId: string) {
  const regions = await changedRegions(weekId);
  return regions.map((r) => ({ key: r.key, label: r.label, manualEdits: r.manualEdits }));
}

export async function compose(weekId: string, force: boolean) {
  await ensureWeek(weekId);
  const regions = await changedRegions(weekId);
  const conflicts = regions.filter((r) => r.manualEdits > 0);
  if (conflicts.length && !force) {
    return { ok: false as const, conflicts: conflicts.map((r) => ({ label: r.label, manualEdits: r.manualEdits })) };
  }
  const t = now();
  for (const r of regions) {
    const s = r.submission;
    const fresh =
      s.kind === "common"
        ? itemsFromRows(weekId, "common", null, s.id, s.parsed_data.common)
        : [
            ...itemsFromRows(weekId, "department", s.department_id, s.id, s.parsed_data.department),
            ...itemsFromRows(weekId, "personal", s.department_id, s.id, s.parsed_data.personal),
          ];
    inheritIds(r.oldItems, fresh);
    for (const o of r.oldItems) await db().remove("schedule_items", { id: o.id });
    await db().insert("schedule_items", fresh as unknown as Record<string, unknown>[]);
    await db().update("submissions", { id: s.id }, { last_composed_at: t });
  }
  await db().update("weeks", { id: weekId }, { last_composed_at: t });
  return { ok: true as const, updated: regions.map((r) => r.label) };
}

// ---------------- 변경 비교(직전 배포본 대비) ----------------
const FIELD_LABEL: [keyof ScheduleItem, string][] = [
  ["person", "계급/성명"],
  ["date_text", "일자"],
  ["content", "내용"],
  ["place", "장소"],
  ["headcount", "인원"],
  ["note", "비고"],
];

export function diffItems(prev: ScheduleItem[], cur: ScheduleItem[], depts: { id: string }[], today = todayKst()): Change[] {
  const label = mmdd(today);
  const before = new Map(prev.map((i) => [i.id, i]));
  const after = new Map(cur.map((i) => [i.id, i]));
  const what = (i: ScheduleItem) => `${dateWithDay(i.date_start, i.date_end, i.date_text)} ${i.person ? i.person + " " : ""}${i.content}`.trim();
  const out: Change[] = [];
  for (const i of cur) {
    const p = before.get(i.id);
    if (!p) {
      out.push({ kind: "add", item_id: i.id, section: i.section, department_id: i.department_id, text: `[${label} 추가] ${what(i)}` });
      continue;
    }
    const diffs = FIELD_LABEL.filter(([k]) => (p[k] ?? "") !== (i[k] ?? "")).map(
      ([k, name]) => `${name} 변경: ${p[k] || "(없음)"} → ${i[k] || "(없음)"}`,
    );
    if (diffs.length)
      out.push({ kind: "mod", item_id: i.id, section: i.section, department_id: i.department_id, text: `[${label} 수정] ${i.content} - ${diffs.join(", ")}` });
  }
  for (const p of prev) {
    if (!after.has(p.id))
      out.push({ kind: "del", item_id: p.id, section: p.section, department_id: p.department_id, text: `[${label} 삭제] ${what(p)}` });
  }
  // 표 순서(부서 순서 → 날짜)에 맞춰 정렬
  const order = new Map(depts.map((d, i) => [d.id, i]));
  const pos = new Map(sortItems([...cur, ...prev.filter((p) => !after.has(p.id))], order).map((it, i) => [it.id, i]));
  return out.sort((a, b) => (pos.get(a.item_id) ?? 0) - (pos.get(b.item_id) ?? 0));
}

/** 현재 초안 + (배포 이력이 있으면) 직전 배포본 대비 변경 */
export async function draftView(weekId: string) {
  const [week, items, depts, settings] = await Promise.all([getWeek(weekId), listItems(weekId), listDepartments(true), getAppSettings()]);
  const snap = week?.published_snapshot ?? null;
  const changes = snap ? diffItems(snap.items, items, depts) : [];
  const model = buildDocModel({
    weekId,
    title: settings.doc_title,
    orgName: settings.org_name,
    departments: depts,
    items,
    changes,
  });
  return { week, items, changes, model, departments: depts.filter((d) => d.is_active) };
}

// ---------------- 배포 ----------------
export async function publish(weekId: string) {
  const week = await ensureWeek(weekId);
  const { items, changes, model } = await draftView(weekId);
  const depts = await listDepartments(true);
  const settings = await getAppSettings();
  const t = now();
  const snapshot: Snapshot = {
    published_at: t,
    title: settings.doc_title,
    org_name: settings.org_name,
    departments: depts.map((d) => ({ id: d.id, name: d.name })),
    items,
    changes, // 첫 배포는 비어 있음
  };
  const bytes = await buildFinalHwpx(model);
  const hwpxPath = `reports/${weekId}/final.hwpx`;
  await db().putFile(hwpxPath, bytes);
  await db().update("weeks", { id: weekId }, { status: "published", published_at: t, published_snapshot: snapshot });
  const report: Report = { id: weekId, week_id: weekId, hwpx_path: hwpxPath, item_count: items.length, published_at: t };
  if ((await db().select("reports", { id: weekId })).length) {
    await db().update("reports", { id: weekId }, report as unknown as Record<string, unknown>);
  } else {
    await db().insert("reports", [report as unknown as Record<string, unknown>]);
  }
  return { first: !week.published_snapshot, changes: changes.length, items: items.length };
}

/** 배포본(스냅샷)으로 문서 모델 만들기 — 부서 화면과 이력이 사용 */
export async function publishedView(weekId: string) {
  const week = await getWeek(weekId);
  if (!week || week.status !== "published" || !week.published_snapshot) return null;
  const s = week.published_snapshot;
  const model = buildDocModel({
    weekId,
    title: s.title,
    orgName: s.org_name,
    departments: s.departments,
    items: s.items,
    changes: s.changes,
    createdDate: s.published_at ? new Date(new Date(s.published_at).getTime() + 9 * 3600e3).toISOString().slice(0, 10) : undefined,
  });
  return { model, published_at: s.published_at };
}

export async function listReports(): Promise<Report[]> {
  const r = await db().select<Report>("reports");
  return r.sort((a, b) => b.week_id.localeCompare(a.week_id));
}
