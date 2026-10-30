"use client";
import { useEffect, useRef, useState } from "react";
import { api, storeGet, storeSet, weekOptions, type Meta } from "@/components/client";
import ParsedTables from "@/components/ParsedTables";
import { formatKst, periodLabel, weekShortLabel } from "@/lib/dates";
import type { ParseResult } from "@/lib/types";

interface DeptStatus {
  status: "미제출" | "제출" | "수정됨";
  uploaded_at?: string;
  revision_no?: number;
  file_name?: string;
  dept_count?: number;
  personal_count?: number;
}

/** S1 부서 홈·업로드 */
export default function DeptHome() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [week, setWeek] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState<DeptStatus | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Meta>("/api/meta").then((m) => {
      setMeta(m);
      setWeek(m.nextWeek); // 기본값: 다음 주
      const saved = storeGet("dept");
      if (saved && m.departments.some((d) => d.id === saved)) setDept(saved);
    });
  }, []);

  useEffect(() => {
    if (!week || !dept) return setStatus(null);
    api<DeptStatus>(`/api/dept/status?week=${week}&dept=${dept}`).then(setStatus).catch(() => setStatus(null));
  }, [week, dept, done]);

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function onFile(f: File | null) {
    setResult(null);
    setError("");
    setDone("");
    setFile(f);
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("week", week);
      fd.append("dept", dept);
      setResult(await api<ParseResult>("/api/dept/parse", { method: "POST", body: fd }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("week", week);
      fd.append("dept", dept);
      const r = await api<{ revision_no: number }>("/api/dept/submit", { method: "POST", body: fd });
      const name = meta?.departments.find((d) => d.id === dept)?.name;
      setDone(`${name} ${weekShortLabel(week)} 일정이 ${r.revision_no > 1 ? `수정 제출(${r.revision_no}회차)` : "제출"}되었습니다.`);
      reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!meta) return <p className="muted">불러오는 중…</p>;
  const deptName = meta.departments.find((d) => d.id === dept)?.name;

  return (
    <>
      <div className="panel">
        <h2>주간 일정 제출</h2>
        <div className="row">
          <label className="field">
            대상 주차
            <select value={week} onChange={(e) => (setWeek(e.target.value), reset(), setDone(""))}>
              {weekOptions(meta).map((w) => (
                <option key={w} value={w}>
                  {weekShortLabel(w)}
                  {w === meta.thisWeek ? " (이번 주)" : w === meta.nextWeek ? " (다음 주)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            부서
            <select
              value={dept}
              onChange={(e) => {
                setDept(e.target.value);
                storeSet("dept", e.target.value);
                reset();
                setDone("");
              }}
            >
              <option value="">— 부서 선택 —</option>
              {meta.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <div className="spacer" />
          <a className={`btn ${dept ? "" : "disabled"}`} href={`/api/template?week=${week}&dept=${dept}`} download>
            ⬇ 제출양식 받기 (HWPX)
          </a>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          대상 기간: {periodLabel(week)}
        </p>
        {dept && status && (
          <div className={`notice ${status.status === "미제출" ? "info" : "ok"}`} style={{ marginBottom: 0 }}>
            {status.status === "미제출" ? (
              <>{deptName} — 이 주차는 아직 제출하지 않았습니다.</>
            ) : (
              <>
                {deptName} — <b>{status.status === "수정됨" ? `제출 완료(수정 ${status.revision_no}회차)` : "제출 완료"}</b> · 최종 제출{" "}
                {formatKst(status.uploaded_at)} · 부서 일정 {status.dept_count}건, 개인 특이일정 {status.personal_count}건. 다시 올리면 최신본으로
                교체됩니다.
              </>
            )}
          </div>
        )}
      </div>

      {done && <div className="notice ok">✔ {done}</div>}

      <div className="panel">
        <h2>파일 올리기</h2>
        {!dept ? (
          <p className="muted">먼저 부서를 선택해 주세요.</p>
        ) : (
          <>
            <input ref={fileInput} type="file" accept=".hwpx" onChange={(e) => onFile(e.target.files?.[0] ?? null)} disabled={busy} />
            <p className="muted small">한글에서 HWPX 형식으로 저장한 제출양식을 올리면 인식 결과를 먼저 보여 드립니다. 확인 후 [제출]을 눌러야 제출됩니다.</p>
            {busy && <p className="muted">처리 중…</p>}
            {error && <div className="notice error">{error}</div>}
            {result && (
              <>
                {result.notices.map((n) => (
                  <div className="notice info" key={n}>
                    {n}
                  </div>
                ))}
                {result.errors.map((n) => (
                  <div className="notice error" key={n}>
                    {n}
                  </div>
                ))}
                <ParsedTables department={result.department} personal={result.personal} />
                <div className="row" style={{ marginTop: 16 }}>
                  <div className="spacer" />
                  <button className="btn" onClick={reset} disabled={busy}>
                    다시 올리기
                  </button>
                  <button className="btn primary big" onClick={submit} disabled={busy || result.errors.length > 0}>
                    {deptName} 일정 제출
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
