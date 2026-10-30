"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/client";
import ParsedTables from "@/components/ParsedTables";
import { useAdminWeek } from "@/components/useAdminWeek";
import WeekSelect from "@/components/WeekSelect";
import { formatKst, periodLabel, normalizeDate } from "@/lib/dates";
import type { ParsedRow, Submission } from "@/lib/types";

interface Board {
  deadline: string | null;
  rows: {
    department: { id: string; name: string };
    status: "미제출" | "제출" | "수정됨";
    overdue: boolean;
    submission: null | {
      id: string;
      uploaded_at: string;
      revision_no: number;
      file_name: string;
      dept_count: number;
      personal_count: number;
      warning_count: number;
      pending: boolean;
    };
  }[];
  common: Submission | null;
  commonPending: boolean;
  week: { status: "draft" | "published"; published_at: string | null; last_composed_at: string | null };
  itemCount: number;
}

type EditRow = { date_text: string; content: string; place: string; headcount: string; note: string; warnings?: string[] };

const toEdit = (r: ParsedRow): EditRow => ({
  date_text: r.date_text,
  content: r.content,
  place: r.place,
  headcount: r.headcount,
  note: r.note,
  warnings: r.warnings,
});

/** S4 제출 현황·종합 */
export default function AdminMain() {
  const { meta, week, setWeek } = useAdminWeek();
  const [board, setBoard] = useState<Board | null>(null);
  const [detail, setDetail] = useState<Submission | null>(null);
  const [commonRows, setCommonRows] = useState<EditRow[]>([]);
  const [commonDirty, setCommonDirty] = useState(false);
  const [commonMsg, setCommonMsg] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!week) return;
    const b = await api<Board>(`/api/admin/status?week=${week}`);
    setBoard(b);
    setCommonRows((b.common?.parsed_data.common ?? []).map(toEdit));
    setCommonDirty(false);
  }, [week]);

  useEffect(() => {
    setMsg(null);
    setCommonMsg([]);
    load();
  }, [load]);

  async function openDetail(id: string) {
    setDetail(await api<Submission>(`/api/admin/submission?id=${id}`));
  }

  async function uploadCommon(f: File | null) {
    if (!f) return;
    setBusy(true);
    setCommonMsg([]);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("week", week);
      const r = await api<{ rows: ParsedRow[]; notices: string[] }>("/api/admin/common", { method: "POST", body: fd });
      setCommonMsg(r.notices);
      await load();
    } catch (e) {
      setCommonMsg([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  }

  async function saveCommon() {
    setBusy(true);
    try {
      await api("/api/admin/common", { method: "PUT", json: { week, rows: commonRows } });
      setCommonMsg(["공통일정을 저장했습니다. [종합 만들기]를 누르면 반영됩니다."]);
      await load();
    } catch (e) {
      setCommonMsg([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  }

  function editCommon(i: number, k: keyof EditRow, v: string) {
    setCommonRows((rows) => rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
    setCommonDirty(true);
  }

  async function composeNow(force = false) {
    if (commonDirty && !confirm("공통일정 표에 저장하지 않은 수정이 있습니다. 저장하지 않고 종합할까요?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ ok: boolean; updated?: string[]; conflicts?: { label: string; manualEdits: number }[] }>("/api/admin/compose", {
        method: "POST",
        json: { week, force },
      });
      if (!r.ok && r.conflicts) {
        const list = r.conflicts.map((c) => `· ${c.label}: 직접 수정한 행 ${c.manualEdits}건`).join("\n");
        setBusy(false);
        if (confirm(`다음 구역은 새 제출본으로 교체되며, 미리보기에서 직접 수정한 내용이 사라집니다.\n\n${list}\n\n계속할까요?`)) return composeNow(true);
        return;
      }
      setMsg({
        kind: "ok",
        text: r.updated?.length ? `종합 완료 — 갱신된 구역: ${r.updated.join(", ")}` : "바뀐 제출본이 없어 기존 종합 내용을 그대로 유지했습니다.",
      });
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!meta || !board) return <p className="muted">불러오는 중…</p>;
  const counts = { 미제출: 0, 제출: 0, 수정됨: 0 };
  board.rows.forEach((r) => counts[r.status]++);
  const pending = board.rows.filter((r) => r.submission?.pending).map((r) => r.department.name);
  if (board.commonPending) pending.unshift("공통일정");

  return (
    <>
      <div className="panel">
        <div className="row">
          <WeekSelect meta={meta} week={week} onChange={setWeek} />
          <div>
            <div className="muted small">대상 기간</div>
            <div>{periodLabel(week)}</div>
          </div>
          <div className="spacer" />
          <div style={{ textAlign: "right" }}>
            <div className="muted small">최종본 상태</div>
            {board.week.status === "published" ? (
              <span className="badge pub">배포됨 {formatKst(board.week.published_at)}</span>
            ) : (
              <span className="badge none">초안</span>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>부서별 제출 현황</h2>
          <div className="spacer" />
          <div className="summary">
            <span>
              제출 <b>{counts.제출 + counts.수정됨}</b>/{board.rows.length}
            </span>
            <span>
              수정됨 <b>{counts.수정됨}</b>
            </span>
            <span style={{ color: counts.미제출 ? "var(--danger)" : undefined }}>
              미제출 <b>{counts.미제출}</b>
            </span>
          </div>
        </div>
        {board.deadline && <p className="muted small">제출 마감: {formatKst(board.deadline)} (마감이 지난 미제출 부서는 빨간색)</p>}
        <div className="cards">
          {board.rows.map((r) => (
            <button
              key={r.department.id}
              className={`card ${r.overdue ? "late" : ""}`}
              onClick={() => r.submission && openDetail(r.submission.id)}
              style={{ cursor: r.submission ? "pointer" : "default" }}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="name">{r.department.name}</span>
                <span className={`badge ${r.overdue ? "late" : r.status === "미제출" ? "none" : r.status === "수정됨" ? "rev" : "done"}`}>
                  {r.overdue ? "미제출·마감초과" : r.status}
                </span>
              </div>
              {r.submission ? (
                <div className="meta">
                  {formatKst(r.submission.uploaded_at)} 제출{r.submission.revision_no > 1 && ` (${r.submission.revision_no}회차)`}
                  <br />
                  부서 {r.submission.dept_count}건 · 개인 {r.submission.personal_count}건
                  {r.submission.warning_count > 0 && <span className="warn-text"> · 경고 {r.submission.warning_count}</span>}
                  {r.submission.pending && (
                    <>
                      <br />
                      <span style={{ color: "var(--primary)" }}>● 종합에 아직 반영 안 됨</span>
                    </>
                  )}
                </div>
              ) : (
                <div className="meta">제출 기록 없음</div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="row">
          <h2 style={{ margin: 0 }}>상부 공통일정</h2>
          <div className="spacer" />
          {board.common?.file_path && (
            <a className="btn sm" href={`/api/admin/submission/file?id=${board.common.id}`}>
              원본 받기
            </a>
          )}
          <label className="btn">
            ⬆ 공통일정 HWPX 올리기
            <input type="file" accept=".hwpx" hidden onChange={(e) => (uploadCommon(e.target.files?.[0] ?? null), (e.target.value = ""))} />
          </label>
        </div>
        <p className="muted small">
          {board.common
            ? `${board.common.file_name ?? "직접 입력"} · 최종 수정 ${formatKst(board.common.parsed_at)}`
            : "아직 올리지 않았습니다. 파일을 올리면 표를 자동으로 해석합니다. 파일 없이 아래 표에 직접 입력해도 됩니다."}
        </p>
        {commonMsg.map((m) => (
          <div key={m} className="notice info">
            {m}
          </div>
        ))}
        <table className="grid">
          <thead>
            <tr>
              <th style={{ width: 190 }}>일자</th>
              <th>내용</th>
              <th style={{ width: 140 }}>장소</th>
              <th style={{ width: 120 }}>인원</th>
              <th style={{ width: 120 }}>비고</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {commonRows.map((r, i) => {
              const d = normalizeDate(r.date_text, "", week);
              const warn = [...d.warnings, ...(!r.content ? ["내용 누락"] : [])];
              return (
                <tr key={i} className={warn.length ? "warn" : ""} title={warn.join(", ")}>
                  <td>
                    <input value={r.date_text} onChange={(e) => editCommon(i, "date_text", e.target.value)} placeholder="11.03.(화)" />
                  </td>
                  <td>
                    <input value={r.content} onChange={(e) => editCommon(i, "content", e.target.value)} />
                  </td>
                  <td>
                    <input value={r.place} onChange={(e) => editCommon(i, "place", e.target.value)} />
                  </td>
                  <td>
                    <input value={r.headcount} onChange={(e) => editCommon(i, "headcount", e.target.value)} />
                  </td>
                  <td>
                    <input value={r.note} onChange={(e) => editCommon(i, "note", e.target.value)} />
                  </td>
                  <td className="c">
                    <button
                      className="btn sm danger"
                      onClick={() => (setCommonRows(commonRows.filter((_, j) => j !== i)), setCommonDirty(true))}
                      title="행 삭제"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 10 }}>
          <button
            className="btn sm"
            onClick={() => (setCommonRows([...commonRows, { date_text: "", content: "", place: "", headcount: "", note: "" }]), setCommonDirty(true))}
          >
            + 행 추가
          </button>
          <div className="spacer" />
          {commonDirty && <span className="warn-text">저장하지 않은 수정이 있습니다</span>}
          <button className="btn primary" onClick={saveCommon} disabled={busy || !commonDirty}>
            공통일정 저장
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="row">
          <div>
            <h2 style={{ margin: 0 }}>종합</h2>
            <p className="muted small" style={{ margin: "4px 0 0" }}>
              {board.week.last_composed_at ? `마지막 종합 ${formatKst(board.week.last_composed_at)} · 현재 ${board.itemCount}건` : "아직 종합하지 않았습니다."}
              {pending.length > 0 && <> · 반영 대기: {pending.join(", ")}</>}
            </p>
          </div>
          <div className="spacer" />
          <button className="btn primary big" onClick={() => composeNow()} disabled={busy}>
            ⚙ 종합 만들기
          </button>
          <Link className="btn big" href={`/admin/preview?week=${week}`}>
            미리보기·편집 →
          </Link>
        </div>
        {msg && <div className={`notice ${msg.kind}`}>{msg.text}</div>}
        <p className="muted small" style={{ marginBottom: 0 }}>
          순서: 상부 공통일정 → 부서별 일정(부서 순서, 날짜순) → 개인별 특이일정. 다시 누르면 파일이 바뀐 구역만 새로 교체되고, 나머지 구역에서 직접
          고친 내용은 유지됩니다.
        </p>
      </div>

      {detail && (
        <div className="modal-back" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row">
              <h2 style={{ margin: 0 }}>{board.rows.find((r) => r.department.id === detail.department_id)?.department.name} 제출 내용</h2>
              <div className="spacer" />
              <a className="btn" href={`/api/admin/submission/file?id=${detail.id}`}>
                ⬇ 원본 HWPX
              </a>
              <button className="btn" onClick={() => setDetail(null)}>
                닫기
              </button>
            </div>
            <p className="muted small">
              {detail.file_name} · {formatKst(detail.uploaded_at)} 제출 · {detail.revision_no}회차
            </p>
            <ParsedTables department={detail.parsed_data.department} personal={detail.parsed_data.personal} />
          </div>
        </div>
      )}
    </>
  );
}
