"use client";
import type { ParsedRow } from "@/lib/types";

function Table({ rows, personal }: { rows: ParsedRow[]; personal?: boolean }) {
  if (!rows.length) return <p className="muted small">인식된 일정이 없습니다.</p>;
  return (
    <table className="grid">
      <thead>
        <tr>
          <th style={{ width: 36 }}>#</th>
          {personal && <th>계급/성명</th>}
          <th>일자</th>
          <th>내용</th>
          <th>장소</th>
          {!personal && <th>인원</th>}
          <th>비고</th>
          <th>확인</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={r.warnings.length ? "warn" : ""}>
            <td className="c">{i + 1}</td>
            {personal && <td>{r.person}</td>}
            <td className="c">{r.date_text}</td>
            <td>{r.content}</td>
            <td>{r.place}</td>
            {!personal && <td>{r.headcount}</td>}
            <td>{r.note}</td>
            <td>{r.warnings.length ? <span className="warn-text">⚠ {r.warnings.join(", ")}</span> : <span className="small muted">정상</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ParsedTables({ department, personal }: { department: ParsedRow[]; personal: ParsedRow[] }) {
  const warn = [...department, ...personal].filter((r) => r.warnings.length).length;
  return (
    <div>
      {warn > 0 && (
        <div className="notice">
          경고가 있는 행 {warn}건이 노란색으로 표시되었습니다. 내용이 틀리면 파일을 고쳐 다시 올려 주세요. (경고가 있어도 제출은 가능합니다)
        </div>
      )}
      <h3>표 1. 부서 일정 ({department.length}건)</h3>
      <Table rows={department} />
      <h3>표 2. 개인 특이일정 ({personal.length}건)</h3>
      <Table rows={personal} personal />
    </div>
  );
}
