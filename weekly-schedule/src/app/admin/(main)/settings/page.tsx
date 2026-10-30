"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/client";
import type { AppSettings } from "@/lib/types";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

/** S7 설정 */
export default function SettingsPage() {
  const [app, setApp] = useState<AppSettings | null>(null);
  const [depts, setDepts] = useState<{ id?: string; name: string }[]>([]);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);

  useEffect(() => {
    api<{ app: AppSettings; departments: { id: string; name: string }[] }>("/api/admin/settings").then((r) => {
      setApp(r.app);
      setDepts(r.departments);
    });
  }, []);

  async function save(body: Record<string, unknown>, done: string) {
    setMsg(null);
    try {
      await api("/api/admin/settings", { method: "PUT", json: body });
      setMsg({ kind: "ok", text: done });
      const r = await api<{ departments: { id: string; name: string }[] }>("/api/admin/settings");
      setDepts(r.departments);
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= depts.length) return;
    const next = [...depts];
    [next[i], next[j]] = [next[j], next[i]];
    setDepts(next);
  }

  if (!app) return <p className="muted">불러오는 중…</p>;

  return (
    <>
      {msg && <div className={`notice ${msg.kind}`}>{msg.text}</div>}
      <div className="panel">
        <h2>부서 목록</h2>
        <p className="muted small">순서는 최종본의 부서 순서가 됩니다. 삭제한 부서의 지난 제출 기록은 보존됩니다.</p>
        <table className="grid" style={{ maxWidth: 520 }}>
          <tbody>
            {depts.map((d, i) => (
              <tr key={d.id ?? `new-${i}`}>
                <td className="c" style={{ width: 40 }}>
                  {i + 1}
                </td>
                <td>
                  <input value={d.name} onChange={(e) => setDepts(depts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                </td>
                <td className="c" style={{ width: 150 }}>
                  <button className="btn sm" onClick={() => move(i, -1)} disabled={i === 0}>
                    ▲
                  </button>{" "}
                  <button className="btn sm" onClick={() => move(i, 1)} disabled={i === depts.length - 1}>
                    ▼
                  </button>{" "}
                  <button className="btn sm danger" onClick={() => setDepts(depts.filter((_, j) => j !== i))}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn sm" onClick={() => setDepts([...depts, { name: "" }])}>
            + 부서 추가
          </button>
          <button className="btn primary" onClick={() => save({ departments: depts }, "부서 목록을 저장했습니다.")}>
            부서 목록 저장
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>문서·마감</h2>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="field">
            문서 제목
            <input type="text" value={app.doc_title} onChange={(e) => setApp({ ...app, doc_title: e.target.value })} />
          </label>
          <label className="field">
            작성부서명
            <input type="text" value={app.org_name} onChange={(e) => setApp({ ...app, org_name: e.target.value })} />
          </label>
        </div>
        <div className="row" style={{ marginTop: 14, alignItems: "flex-end" }}>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={app.deadline_enabled} onChange={(e) => setApp({ ...app, deadline_enabled: e.target.checked })} />
            제출 마감 사용
          </label>
          <label className="field">
            마감 요일(대상 주 바로 전 주)
            <select value={app.deadline_day} onChange={(e) => setApp({ ...app, deadline_day: Number(e.target.value) })} disabled={!app.deadline_enabled}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}요일
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            마감 시각
            <input type="time" value={app.deadline_time} onChange={(e) => setApp({ ...app, deadline_time: e.target.value })} disabled={!app.deadline_enabled} />
          </label>
        </div>
        <button className="btn primary" style={{ marginTop: 14 }} onClick={() => save({ app }, "문서·마감 설정을 저장했습니다.")}>
          저장
        </button>
      </div>

      <div className="panel">
        <h2>접속 보안</h2>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="field">
            새 공용 접속코드 (4자 이상)
            <input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="new-password" />
          </label>
          <button className="btn" disabled={!code} onClick={() => save({ access_code: code }, "공용 접속코드를 변경했습니다.").then(() => setCode(""))}>
            접속코드 변경
          </button>
        </div>
        <div className="row" style={{ alignItems: "flex-end", marginTop: 14 }}>
          <label className="field">
            새 관리자 비밀번호 (6자 이상)
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </label>
          <button className="btn" disabled={!pw} onClick={() => save({ admin_password: pw }, "관리자 비밀번호를 변경했습니다.").then(() => setPw(""))}>
            비밀번호 변경
          </button>
        </div>
      </div>
    </>
  );
}
