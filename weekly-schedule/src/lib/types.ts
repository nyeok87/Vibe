export type Section = "common" | "department" | "personal";

export interface Department {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

/** HWPX 표 한 행을 해석한 결과 */
export interface ParsedRow {
  person: string; // 계급/성명 (개인 표만)
  date_text: string; // 정규화된 표시용 날짜: 11.03 / 11.03~11.05
  date_start: string | null; // YYYY-MM-DD
  date_end: string | null;
  weekday: string; // 날짜에서 계산한 요일
  content: string;
  place: string;
  headcount: string;
  note: string;
  warnings: string[];
}

export interface ParsedData {
  department: ParsedRow[];
  personal: ParsedRow[];
  common: ParsedRow[];
}

export interface ParseResult extends ParsedData {
  /** 표 해석 방식: table(표), text(본문 문단), none(실패) */
  method: "table" | "text" | "none";
  errors: string[]; // 제출을 막는 오류
  notices: string[]; // 참고 안내
}

export interface Week {
  id: string; // 월요일 날짜(YYYY-MM-DD)
  start_date: string;
  end_date: string;
  status: "draft" | "published";
  published_at: string | null;
  published_snapshot: Snapshot | null;
  last_composed_at: string | null;
}

export interface Submission {
  id: string;
  week_id: string;
  kind: "department" | "common";
  department_id: string | null;
  file_path: string | null;
  file_name: string | null;
  revision_no: number;
  uploaded_at: string;
  parsed_at: string; // 내용이 마지막으로 바뀐 시각(업로드·공통일정 직접 수정)
  parsed_data: ParsedData;
  last_composed_at: string | null;
}

export interface ScheduleItem {
  id: string;
  week_id: string;
  section: Section;
  department_id: string | null;
  person: string;
  date_text: string;
  date_start: string | null;
  date_end: string | null;
  weekday: string;
  content: string;
  place: string;
  headcount: string;
  note: string;
  sort_order: number;
  source_submission_id: string | null;
  is_manual_edit: boolean;
  change_flag: string | null;
}

export interface Change {
  kind: "add" | "mod" | "del";
  item_id: string;
  section: Section;
  department_id: string | null;
  text: string;
}

export interface Snapshot {
  published_at: string;
  title: string;
  org_name: string;
  departments: { id: string; name: string }[];
  items: ScheduleItem[];
  changes: Change[];
}

export interface Report {
  id: string; // = week_id
  week_id: string;
  hwpx_path: string;
  item_count: number;
  published_at: string;
}

export interface AppSettings {
  doc_title: string;
  org_name: string;
  deadline_enabled: boolean;
  deadline_day: number; // 0=월 … 6=일 (대상 주차 바로 전 주)
  deadline_time: string; // HH:MM
}

export type Role = "dept" | "admin";
