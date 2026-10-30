// 시연용 가상 HWPX 파일 생성: npm run samples [주차 월요일, 기본 2026-11-02]
// 실제 부대 일정·인원이 아닌 가상 데이터다.
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { buildCommonSample, buildFinalHwpx, buildSubmissionForm, type FormRows } from "../src/lib/hwpx/templates";
import { parseCommonHwpx, parseDepartmentHwpx } from "../src/lib/hwpx/parse";
import { buildDocModel } from "../src/lib/docmodel";
import { normalizeDate } from "../src/lib/dates";
import type { Change, ParsedRow, ScheduleItem, Section } from "../src/lib/types";

const week = process.argv[2] || "2026-11-02";
const out = path.join(process.cwd(), "samples", week);
mkdirSync(out, { recursive: true });

type R = [string, string, string, string, string, string]; // 날짜 요일 내용 장소 인원 비고
type P = [string, string, string, string, string, string]; // 계급/성명 날짜 요일 내용 장소 비고

const data: Record<string, { dept: R[]; personal: P[] }> = {
  기획과: {
    dept: [
      ["11.03", "화", "주간 업무계획 회의", "대회의실", "과장 이상", ""],
      ["11.05", "목", "분기 예산 집행 점검", "기획과 사무실", "5명", ""],
    ],
    personal: [["대위 김가상", "11.06", "금", "연가", "", ""]],
  },
  작전과: {
    dept: [
      ["11.03~11.05", "", "분기 정비 점검", "격납고 A", "12명", ""],
      ["11.04", "수", "작전 회의", "소회의실", "8명", ""],
      ["11.07", "토", "주말 당직 근무", "작전실", "2명", "교대 근무"],
    ],
    personal: [
      ["소령 이시제", "11.04~11.06", "", "외부 교육 입교", "교육사령부", "출장"],
      ["중사 박예시", "11.05", "목", "건강검진", "의무대", ""],
    ],
  },
  정보과: {
    dept: [["11.06", "금", "보안 교육", "강당", "전 인원", ""]],
    personal: [],
  },
  인사과: {
    dept: [
      ["11.03", "월", "신규 전입자 면담", "인사과", "3명", "요일 일부러 틀림"],
      ["11.07", "토", "인사 서류 정리", "인사과", "4명", ""],
    ],
    personal: [["상사 최테스트", "11.03~11.04", "", "포상 휴가", "", ""]],
  },
  군수과: {
    dept: [
      ["11.04", "수", "물자 재고 조사", "보급창고", "6명", ""],
      ["11.06", "금", "차량 정비 점검", "정비고", "4명", ""],
    ],
    personal: [],
  },
  정비과: {
    dept: [["11.03~11.07", "", "부품 교체 작업", "정비고 2동", "10명", "소음 발생, 인근 부서 협조 요청"]],
    personal: [["중위 정샘플", "11.05", "목", "자격 평가", "정비교육대", ""]],
  },
  통신과: {
    dept: [["11.05", "목", "통신망 점검", "통신실", "3명", "야간 작업(22:00~02:00), 통신 일시 중단 예정"]],
    personal: [],
  },
  보안과: {
    dept: [
      ["11.03", "화", "보안 점검", "전 사무실", "2명", ""],
      ["11.06", "금", "보안 감사 준비", "보안과", "3명", ""],
    ],
    personal: [],
  },
  교육과: {
    dept: [["11.04", "수", "직무 교육", "교육관", "20명", ""]],
    personal: [["대위 한모의", "11.05~11.06", "", "강사 파견", "타 부대", ""]],
  },
  // 재정과는 미제출 상태를 보여 주려고 만들지 않는다
};

// 날짜·요일을 일자 한 칸(11.03.(화))으로 합친다. 적은 요일은 그대로 둔다(인사과의 틀린 요일 경고 시연용)
function day(date: string, wd: string): string {
  return wd ? `${date}.(${wd})` : normalizeDate(date, "", week).date_text;
}

function rows(dept: string, d: { dept: R[]; personal: P[] }): FormRows {
  return {
    department: d.dept.map(([date, wd, ...rest]) => [dept, day(date, wd), ...rest]),
    personal: d.personal.map(([person, date, wd, ...rest]) => [dept, person, day(date, wd), ...rest]),
    writer: "가상 담당자",
  };
}

async function main() {
  for (const [dept, d] of Object.entries(data)) {
    writeFileSync(path.join(out, `${dept}.hwpx`), await buildSubmissionForm(week, dept, rows(dept, d)));
  }
  // 작전과 수정본: 회의 장소 변경, 당직 삭제, 일정 추가
  const rev = structuredClone(data.작전과);
  rev.dept[1][3] = "대회의실";
  rev.dept.splice(2, 1);
  rev.dept.push(["11.06", "금", "비상 대응 훈련", "활주로", "30명", ""]);
  writeFileSync(path.join(out, `작전과_수정본.hwpx`), await buildSubmissionForm(week, "작전과", rows("작전과", rev)));

  writeFileSync(
    path.join(out, `상부_공통일정.hwpx`),
    await buildCommonSample(week, [
      ["11.03.(화)", "주간 지휘관 회의", "본부 대회의실", "부서장"],
      ["11.04.(수)", "정기 소방 훈련", "전 구역", "전 인원"],
      ["11.06.(금)", "보안 점검의 날", "각 부서", "보안담당"],
      ["11.07.(토)", "체육 활동", "연병장", "가용 인원"],
    ]),
  );
  // 빈 제출양식도 함께
  writeFileSync(path.join(out, `_빈_제출양식.hwpx`), await buildSubmissionForm(week, ""));

  // 한글 확인용 최종본 예시: 위 파일들을 앱과 같은 방식으로 해석해 종합(작전과는 수정본), 변경사항 문단 포함
  const items: ScheduleItem[] = [];
  const add = (section: Section, dept: string | null, rows: ParsedRow[]) =>
    rows.forEach((r, i) =>
      items.push({
        id: `${section}-${dept}-${i}`,
        week_id: week,
        section,
        department_id: dept,
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
        source_submission_id: null,
        is_manual_edit: false,
        change_flag: null,
      }),
    );
  add("common", null, (await parseCommonHwpx(readFileSync(path.join(out, "상부_공통일정.hwpx")), week)).common);
  const depts = Object.keys(data);
  for (const dept of depts) {
    const file = dept === "작전과" ? "작전과_수정본.hwpx" : `${dept}.hwpx`;
    const p = await parseDepartmentHwpx(readFileSync(path.join(out, file)), week, dept);
    add("department", dept, p.department);
    add("personal", dept, p.personal);
  }
  const find = (content: string) => items.find((i) => i.content === content)!;
  const changes: Change[] = [
    { kind: "mod", item_id: find("작전 회의").id, section: "department", department_id: "작전과", text: "[11.04 수정] 작전 회의 - 장소 변경: 소회의실 → 대회의실" },
    { kind: "add", item_id: find("비상 대응 훈련").id, section: "department", department_id: "작전과", text: "[11.04 추가] 11.06.(금) 비상 대응 훈련" },
    { kind: "del", item_id: "deleted", section: "department", department_id: "작전과", text: "[11.04 삭제] 11.07.(토) 주말 당직 근무" },
  ];
  const model = buildDocModel({
    weekId: week,
    title: "주간 업무계획",
    orgName: "기획과",
    departments: [...depts, "재정과"].map((d) => ({ id: d, name: d })),
    items,
    changes,
  });
  writeFileSync(path.join(out, `_최종본_예시.hwpx`), await buildFinalHwpx(model));
  console.log(`가상 HWPX 파일을 만들었습니다: ${out}`);
}

main();
