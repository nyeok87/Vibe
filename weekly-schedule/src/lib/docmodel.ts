// 최종본 구성(공통 → 부서별 → 개인). HTML 화면과 HWPX 생성이 같은 모델을 쓴다.
import { periodLabel, todayKst } from "./dates";
import type { Change, ScheduleItem, Section } from "./types";

export interface DocRow {
  item: ScheduleItem;
  deptName: string;
  changed: boolean; // ※ 표시
}

export interface DocGroup {
  deptId: string;
  deptName: string;
  rows: DocRow[];
}

export interface DocModel {
  title: string;
  orgName: string;
  period: string;
  createdDate: string; // 2026.10.30.
  common: DocRow[];
  department: DocGroup[];
  personal: DocGroup[];
  changes: Record<Section, Change[]>;
  itemCount: number;
}

// 일자 열은 요일을 포함한다: 11.03.(화)
export const DEPT_HEADER = ["부서", "일자", "내용", "장소", "인원", "비고"];
export const PERSONAL_HEADER = ["부서", "계급/성명", "일자", "내용", "장소", "비고"];
export const COMMON_HEADER = ["일자", "내용", "장소", "인원", "비고"];

// 열 너비(HWPUNIT, 합 42520). 화면 표도 같은 비율을 쓴다
export const W_COMMON = [10000, 14020, 6500, 4500, 7500]; // 일자 내용 장소 인원 비고
export const W_DEPT = [4000, 10000, 10520, 6000, 4500, 7500]; // 부서 일자 내용 장소 인원 비고
export const W_PERSONAL = [4000, 6500, 10000, 8520, 6000, 7500]; // 부서 계급/성명 일자 내용 장소 비고

export const SECTION_TITLES: Record<Section, string> = {
  common: "1. 상부 공통일정",
  department: "2. 부서별 일정",
  personal: "3. 개인별 특이일정",
};

export function sortItems(items: ScheduleItem[], deptOrder: Map<string, number>): ScheduleItem[] {
  const so = { common: 0, department: 1, personal: 2 } as const;
  return [...items].sort(
    (a, b) =>
      so[a.section] - so[b.section] ||
      (deptOrder.get(a.department_id ?? "") ?? 999) - (deptOrder.get(b.department_id ?? "") ?? 999) ||
      (a.date_start ?? "9999").localeCompare(b.date_start ?? "9999") ||
      a.sort_order - b.sort_order,
  );
}

export function buildDocModel(opts: {
  weekId: string;
  title: string;
  orgName: string;
  departments: { id: string; name: string }[];
  items: ScheduleItem[];
  changes: Change[];
  createdDate?: string;
}): DocModel {
  const deptOrder = new Map(opts.departments.map((d, i) => [d.id, i]));
  const deptName = new Map(opts.departments.map((d) => [d.id, d.name]));
  const changedIds = new Set(opts.changes.filter((c) => c.kind !== "del").map((c) => c.item_id));
  const sorted = sortItems(opts.items, deptOrder);
  const row = (item: ScheduleItem): DocRow => ({
    item,
    deptName: item.department_id ? deptName.get(item.department_id) ?? "(삭제된 부서)" : "공통",
    changed: changedIds.has(item.id),
  });
  const group = (section: Section) => {
    const groups: DocGroup[] = [];
    for (const it of sorted.filter((i) => i.section === section)) {
      const id = it.department_id ?? "";
      let g = groups[groups.length - 1];
      if (!g || g.deptId !== id) {
        g = { deptId: id, deptName: row(it).deptName, rows: [] };
        groups.push(g);
      }
      g.rows.push(row(it));
    }
    return groups;
  };
  const created = opts.createdDate ?? todayKst();
  return {
    title: opts.title,
    orgName: opts.orgName,
    period: periodLabel(opts.weekId),
    createdDate: created.replace(/-/g, ".") + ".",
    common: sorted.filter((i) => i.section === "common").map(row),
    department: group("department"),
    personal: group("personal"),
    changes: {
      common: opts.changes.filter((c) => c.section === "common"),
      department: opts.changes.filter((c) => c.section === "department"),
      personal: opts.changes.filter((c) => c.section === "personal"),
    },
    itemCount: opts.items.length,
  };
}
