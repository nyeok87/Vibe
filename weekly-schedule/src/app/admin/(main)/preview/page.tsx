"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/client";
import DocView from "@/components/DocView";
import { useAdminWeek } from "@/components/useAdminWeek";
import WeekSelect from "@/components/WeekSelect";
import { formatKst, periodLabel } from "@/lib/dates";
import { SECTION_TITLES, type DocModel, type DocRow } from "@/lib/docmodel";
import type { Change, ScheduleItem, Section } from "@/lib/types";

interface View {
  status: "draft" | "published";
  published_at: string | null;
  last_composed_at: string | null;
  items: ScheduleItem[];
  changes: Change[];
  model: DocModel;
  departments: { id: string; name: string }[];
}

type Field = "person" | "date_text" | "content" | "place" | "headcount" | "note";

function EditRow({
  row,
  section,
  change,
  showDept,
  deptSpan,
  onSave,
  onDelete,
}: {
  row: DocRow;
  section: Section;
  change?: Change;
  showDept: boolean;
  deptSpan: number;
  onSave: (id: string, f: Field, v: string) => void;
  onDelete: (id: string) => void;
}) {
  const it = row.item;
  const [vals, setVals] = useState<Record<Field, string>>({
    person: it.person,
    date_text: it.date_text,
    content: it.content,
    place: it.place,
    headcount: it.headcount,
    note: it.note,
  });
  useEffect(() => {
    setVals({ person: it.person, date_text: it.date_text, content: it.content, place: it.place, headcount: it.headcount, note: it.note });
  }, [it.person, it.date_text, it.content, it.place, it.headcount, it.note]);

  const input = (f: Field, placeholder = "") => (
    <input
      value={vals[f]}
      placeholder={placeholder}
      onChange={(e) => setVals({ ...vals, [f]: e.target.value })}
      onBlur={() => vals[f] !== it[f] && onSave(it.id, f, vals[f])}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );

  return (
    <tr className={change ? "changed" : ""} title={change?.text}>
      {section !== "common" && showDept && (
        <td rowSpan={deptSpan} className="c" style={{ fontWeight: 700, background: "#fafbfc" }}>
          {row.deptName}
        </td>
      )}
      {section === "personal" && <td style={{ width: 110 }}>{input("person", "계급 성명")}</td>}
      <td style={{ width: 190 }} title={it.date_text && !it.date_start ? "일자 형식 오류" : undefined} className={it.date_text && !it.date_start ? "warn-cell" : undefined}>{input("date_text", "11.03.(화)")}</td>
      <td className="content-cell">
        <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
          {change && <span title={change.text} style={{ color: "var(--warn)", fontWeight: 700 }}>※</span>}
          {input("content")}
        </div>
      </td>
      <td style={{ width: 120 }}>{input("place")}</td>
      {section !== "personal" && <td style={{ width: 100 }}>{input("headcount")}</td>}
      <td style={{ width: 110 }}>{input("note")}</td>
      <td className="c" style={{ width: 70 }}>
        {it.is_manual_edit && <span className="small muted" title="직접 수정한 행">✎ </span>}
        <button className="btn sm danger" onClick={() => onDelete(it.id)} title="행 삭제">
          ✕
        </button>
      </td>
    </tr>
  );
}

/** S5 미리보기·편집 */
export default function PreviewPage() {
  const { meta, week, setWeek } = useAdminWeek();
  const [view, setView] = useState<View | null>(null);
  const [mode, setMode] = useState<"edit" | "doc">("edit");
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [addDept, setAddDept] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (week) setView(await api<View>(`/api/admin/items?week=${week}`));
  }, [week]);
  useEffect(() => {
    setMsg(null);
    load();
  }, [load]);

  async function save(id: string, f: Field, v: string) {
    try {
      await api("/api/admin/items", { method: "PATCH", json: { id, patch: { [f]: v } } });
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }
  async function del(id: string) {
    if (!confirm("이 행을 삭제할까요?")) return;
    await api(`/api/admin/items?id=${id}`, { method: "DELETE" });
    await load();
  }
  async function add(section: Section, department_id: string | null) {
    await api("/api/admin/items", { method: "POST", json: { week, section, department_id } });
    await load();
  }
  async function publishNow() {
    if (!view) return;
    const again = view.status === "published";
    const text = again
      ? `배포본을 덮어씁니다. 직전 배포본 대비 변경 ${view.changes.length}건이 각 표 아래 "※ 변경사항"으로 기록됩니다. 배포할까요?`
      : "최종본을 배포합니다. 부서 화면에서 읽기 전용으로 열람·인쇄할 수 있게 됩니다. 배포할까요?";
    if (!confirm(text)) return;
    setBusy(true);
    try {
      const r = await api<{ items: number; changes: number }>("/api/admin/publish", { method: "POST", json: { week } });
      setMsg({ kind: "ok", text: `배포 완료 — ${r.items}건${again ? `, 변경 ${r.changes}건 기록` : ""}. 이력에도 저장되었습니다.` });
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!meta || !view) return <p className="muted">불러오는 중…</p>;
  const changeOf = new Map(view.changes.filter((c) => c.kind !== "del").map((c) => [c.item_id, c]));
  const deleted = (s: Section) => view.changes.filter((c) => c.kind === "del" && c.section === s);
  const m = view.model;

  const header = (s: Section) => (
    <thead>
      <tr>
        {s !== "common" && <th style={{ width: 80 }}>부서</th>}
        {s === "personal" && <th>계급/성명</th>}
        <th>일자</th>
        <th>내용</th>
        <th>장소</th>
        {s !== "personal" && <th>인원</th>}
        <th>비고</th>
        <th></th>
      </tr>
    </thead>
  );

  const groupBody = (s: "department" | "personal") => {
    const groups = s === "department" ? m.department : m.personal;
    return (
      <tbody>
        {groups.flatMap((g) =>
          g.rows.map((r, i) => (
            <EditRow
              key={r.item.id}
              row={r}
              section={s}
              change={changeOf.get(r.item.id)}
              showDept={i === 0}
              deptSpan={g.rows.length}
              onSave={save}
              onDelete={del}
            />
          )),
        )}
        {!groups.length && (
          <tr>
            <td colSpan={9} className="c muted">
              항목 없음
            </td>
          </tr>
        )}
      </tbody>
    );
  };

  const deletedList = (s: Section) =>
    deleted(s).length > 0 && (
      <div className="notice" style={{ fontSize: 12 }}>
        삭제된 항목(직전 배포본 대비): {deleted(s).map((c) => c.text).join(" / ")}
      </div>
    );

  const addControl = (s: "department" | "personal") => (
    <div className="row" style={{ marginTop: 8 }}>
      <select value={addDept[s] ?? ""} onChange={(e) => setAddDept({ ...addDept, [s]: e.target.value })}>
        <option value="">— 부서 —</option>
        {view.departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <button className="btn sm" disabled={!addDept[s]} onClick={() => add(s, addDept[s])}>
        + 행 추가
      </button>
    </div>
  );

  return (
    <>
      <div className="panel no-print">
        <div className="row">
          <WeekSelect meta={meta} week={week} onChange={setWeek} />
          <div>
            <div className="muted small">{periodLabel(week)}</div>
            <div>
              {view.status === "published" ? (
                <span className="badge pub">배포됨 {formatKst(view.published_at)}</span>
              ) : (
                <span className="badge none">초안</span>
              )}{" "}
              <span className="small muted">
                {view.items.length}건 · 마지막 종합 {formatKst(view.last_composed_at) || "없음"}
                {view.status === "published" && ` · 배포 후 변경 ${view.changes.length}건`}
              </span>
            </div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => setMode(mode === "edit" ? "doc" : "edit")}>
            {mode === "edit" ? "📄 문서 모양으로 보기" : "✎ 편집 화면으로"}
          </button>
          {mode === "doc" && (
            <button className="btn" onClick={() => window.print()}>
              🖨 인쇄
            </button>
          )}
          <a className="btn" href={`/api/admin/hwpx?week=${week}`}>
            ⬇ HWPX 다운로드
          </a>
          <button className="btn primary big" onClick={publishNow} disabled={busy || !view.items.length}>
            {view.status === "published" ? "다시 배포" : "배포"}
          </button>
        </div>
        {msg && <div className={`notice ${msg.kind}`}>{msg.text}</div>}
        {!view.items.length && <div className="notice info">종합된 항목이 없습니다. [제출 현황·종합] 화면에서 [종합 만들기]를 먼저 눌러 주세요.</div>}
        {view.status === "published" && view.changes.length > 0 && mode === "edit" && (
          <div className="notice info" style={{ fontSize: 13 }}>
            노란 행(※)은 직전 배포본과 달라진 항목입니다. 다시 배포하면 각 표 아래 &quot;※ 변경사항&quot;으로 기록됩니다.
          </div>
        )}
      </div>

      {mode === "doc" ? (
        <DocView model={m} />
      ) : (
        <>
          <div className="panel">
            <h2>{SECTION_TITLES.common}</h2>
            <div className="table-wrap"><table className="grid">
              {header("common")}
              <tbody>
                {m.common.map((r) => (
                  <EditRow key={r.item.id} row={r} section="common" change={changeOf.get(r.item.id)} showDept={false} deptSpan={1} onSave={save} onDelete={del} />
                ))}
                {!m.common.length && (
                  <tr>
                    <td colSpan={7} className="c muted">
                      항목 없음
                    </td>
                  </tr>
                )}
              </tbody>
            </table></div>
            {deletedList("common")}
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => add("common", null)}>
              + 행 추가
            </button>
          </div>

          <div className="panel">
            <h2>{SECTION_TITLES.department}</h2>
            <div className="table-wrap"><table className="grid">
              {header("department")}
              {groupBody("department")}
            </table></div>
            {deletedList("department")}
            {addControl("department")}
          </div>

          <div className="panel">
            <h2>{SECTION_TITLES.personal}</h2>
            <div className="table-wrap"><table className="grid">
              {header("personal")}
              {groupBody("personal")}
            </table></div>
            {deletedList("personal")}
            {addControl("personal")}
          </div>
          <p className="muted small">셀을 고친 뒤 다른 칸을 누르거나 Enter를 치면 자동 저장됩니다. 일자는 11.03 처럼 적어도 11.03.(화) 형식으로 자동 정리됩니다.</p>
        </>
      )}
    </>
  );
}
