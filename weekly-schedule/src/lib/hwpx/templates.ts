// 표준 양식 2종: 부서 제출양식, 최종본. 표 안 글자는 모두 가운데 정렬.
import { buildHwpx, type Block, type Cell } from "./build";
import { periodLabel } from "../dates";
import {
  COMMON_HEADER,
  DEPT_HEADER,
  PERSONAL_HEADER,
  SECTION_TITLES,
  W_COMMON,
  W_DEPT,
  W_PERSONAL,
  type DocModel,
  type DocRow,
} from "../docmodel";
import type { Section } from "../types";

const c = (text: string): Cell => ({ text });
// 비고는 칸보다 길면 한 줄에 들어가도록 글자를 줄인다
const note = (text: string): Cell => ({ text, fit: true });
const mark = (r: DocRow) => (r.changed ? "※ " : "") + r.item.content;

function emptyRow(cols: number): Cell[] {
  return [{ text: "해당 없음", colSpan: cols }];
}

function changeParas(model: DocModel, section: Section): Block[] {
  const list = model.changes[section];
  if (!list.length) return [];
  return [
    { type: "para", text: "※ 변경사항", style: "note" },
    ...list.map((ch): Block => ({ type: "para", text: "  " + ch.text, style: "note" })),
  ];
}

export function finalBlocks(model: DocModel): Block[] {
  const blocks: Block[] = [
    { type: "para", text: model.title, style: "title" },
    { type: "para", text: "", style: "body" },
    { type: "para", text: `대상 기간: ${model.period}`, style: "info" },
    { type: "para", text: `작성부서: ${model.orgName}    작성일: ${model.createdDate}`, style: "info" },
    { type: "para", text: "", style: "body" },
    { type: "para", text: SECTION_TITLES.common, style: "heading" },
  ];

  blocks.push({
    type: "table",
    widths: W_COMMON,
    header: COMMON_HEADER,
    rows: model.common.length
      ? model.common.map((r) => [c(r.item.date_text), c(mark(r)), c(r.item.place), c(r.item.headcount), note(r.item.note)])
      : [emptyRow(COMMON_HEADER.length)],
  });
  blocks.push(...changeParas(model, "common"));

  blocks.push({ type: "para", text: "", style: "body" }, { type: "para", text: SECTION_TITLES.department, style: "heading" });
  const deptRows: Cell[][] = [];
  for (const g of model.department) {
    g.rows.forEach((r, i) => {
      const cells: Cell[] = [];
      if (i === 0) cells.push({ text: g.deptName, rowSpan: g.rows.length, bold: true });
      cells.push(c(r.item.date_text), c(mark(r)), c(r.item.place), c(r.item.headcount), note(r.item.note));
      deptRows.push(cells);
    });
  }
  blocks.push({ type: "table", widths: W_DEPT, header: DEPT_HEADER, rows: deptRows.length ? deptRows : [emptyRow(DEPT_HEADER.length)] });
  blocks.push(...changeParas(model, "department"));

  blocks.push({ type: "para", text: "", style: "body" }, { type: "para", text: SECTION_TITLES.personal, style: "heading" });
  const perRows: Cell[][] = [];
  for (const g of model.personal) {
    g.rows.forEach((r, i) => {
      const cells: Cell[] = [];
      if (i === 0) cells.push({ text: g.deptName, rowSpan: g.rows.length, bold: true });
      cells.push(c(r.item.person), c(r.item.date_text), c(mark(r)), c(r.item.place), note(r.item.note));
      perRows.push(cells);
    });
  }
  blocks.push({
    type: "table",
    widths: W_PERSONAL,
    header: PERSONAL_HEADER,
    rows: perRows.length ? perRows : [emptyRow(PERSONAL_HEADER.length)],
  });
  blocks.push(...changeParas(model, "personal"));
  return blocks;
}

export function buildFinalHwpx(model: DocModel) {
  return buildHwpx(finalBlocks(model), { title: model.title, creator: model.orgName });
}

export interface FormRows {
  department: string[][]; // 각 행: DEPT_HEADER 순서
  personal: string[][]; // 각 행: PERSONAL_HEADER 순서
  writer?: string;
}

/** 부서 제출양식. rows를 주면 내용이 채워진 파일(시연용 샘플)을 만든다 */
export function buildSubmissionForm(weekId: string, deptName: string, rows?: FormRows) {
  const blank = (cols: number, n: number, dept: string) => Array.from({ length: n }, () => [dept, ...Array(cols - 1).fill("")]);
  const deptRows = rows?.department ?? blank(DEPT_HEADER.length, 8, deptName);
  const perRows = rows?.personal ?? blank(PERSONAL_HEADER.length, 5, deptName);
  const label = (text: string): Cell => ({ text, fill: true, bold: true });
  const info: Block = {
    type: "table",
    widths: [6000, 13260, 6000, 17260],
    header: null,
    rows: [
      [label("부서"), c(deptName), label("대상 주차"), c(periodLabel(weekId))],
      [label("작성자"), c(rows?.writer ?? ""), label("작성일"), c("")],
    ],
  };
  const blocks: Block[] = [
    { type: "para", text: "부서 주간 일정 제출", style: "title" },
    { type: "para", text: "", style: "body" },
    info,
    { type: "para", text: "", style: "body" },
    { type: "para", text: "표 1. 부서 일정", style: "heading" },
    { type: "table", widths: W_DEPT, header: DEPT_HEADER, rows: deptRows.map((r) => r.map((v, i) => (i === r.length - 1 ? note(v) : c(v)))) },
    { type: "para", text: "", style: "body" },
    { type: "para", text: "표 2. 개인 특이일정", style: "heading" },
    { type: "table", widths: W_PERSONAL, header: PERSONAL_HEADER, rows: perRows.map((r) => r.map((v, i) => (i === r.length - 1 ? note(v) : c(v)))) },
    { type: "para", text: "", style: "body" },
    { type: "para", text: "【작성 요령】", style: "note" },
    { type: "para", text: "1. 표의 열을 추가·삭제하거나 순서를 바꾸지 마십시오. (행은 자유롭게 추가·삭제할 수 있습니다)", style: "note" },
    { type: "para", text: "2. 일자는 11.03.(화) 형식으로, 기간은 11.03.(화)~11.05.(목) 와 같이 적습니다.", style: "note" },
    { type: "para", text: "3. 요일을 빼고 11.03 만 적어도 요일은 자동으로 붙습니다. 적은 요일이 틀리면 경고로 알려 드립니다.", style: "note" },
    { type: "para", text: "4. 쓰지 않는 빈 행은 그대로 두어도 됩니다. 한글에서 HWPX 형식으로 저장해 올려 주십시오.", style: "note" },
  ];
  return buildHwpx(blocks, { title: `부서 주간 일정 제출 - ${deptName}`, creator: deptName });
}

/** 시연용 상부 공통일정(상부 양식 흉내: 열 이름·구성이 제출양식과 다름) */
export function buildCommonSample(weekId: string, rows: string[][]) {
  const blocks: Block[] = [
    { type: "para", text: "주간 공통 일정 하달", style: "title" },
    { type: "para", text: `기간: ${periodLabel(weekId)}`, style: "info" },
    { type: "para", text: "", style: "body" },
    {
      type: "table",
      widths: [9000, 17520, 8000, 8000],
      header: ["일자", "주요 일정", "장소", "참석 대상"],
      rows: rows.map((r) => r.map(c)),
    },
    { type: "para", text: "", style: "body" },
    { type: "para", text: "※ 각 부서는 공통 일정을 부서 계획에 반영하기 바람.", style: "note" },
  ];
  return buildHwpx(blocks, { title: "주간 공통 일정 하달" });
}
