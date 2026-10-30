"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/client";
import DocView from "@/components/DocView";
import { formatKst, periodLabel } from "@/lib/dates";
import type { DocModel } from "@/lib/docmodel";
import type { Report } from "@/lib/types";

/** S6 이력: 주차별 최종 배포본 */
export default function HistoryPage() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [open, setOpen] = useState<{ week: string; model: DocModel } | null>(null);

  useEffect(() => {
    api<Report[]>("/api/admin/reports").then(setReports);
  }, []);

  async function view(week: string) {
    const r = await api<{ model: DocModel } | null>(`/api/published?week=${week}`);
    if (r) setOpen({ week, model: r.model });
  }

  if (!reports) return <p className="muted">불러오는 중…</p>;

  if (open)
    return (
      <>
        <div className="panel no-print row">
          <button className="btn" onClick={() => setOpen(null)}>
            ← 목록
          </button>
          <b>{periodLabel(open.week)} 배포본</b>
          <div className="spacer" />
          <button className="btn" onClick={() => window.print()}>
            🖨 인쇄
          </button>
          <a className="btn primary" href={`/api/admin/report?week=${open.week}`}>
            ⬇ HWPX
          </a>
        </div>
        <DocView model={open.model} />
      </>
    );

  return (
    <div className="panel">
      <h2>배포 이력</h2>
      {!reports.length ? (
        <p className="muted">아직 배포한 최종본이 없습니다.</p>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>주차</th>
              <th>배포 일시</th>
              <th>건수</th>
              <th style={{ width: 200 }}></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{periodLabel(r.week_id)}</td>
                <td>{formatKst(r.published_at, true)}</td>
                <td className="c">{r.item_count}</td>
                <td className="c">
                  <button className="btn sm" onClick={() => view(r.week_id)}>
                    열람
                  </button>{" "}
                  <a className="btn sm" href={`/api/admin/report?week=${r.week_id}`}>
                    HWPX 받기
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted small">주차별 마지막 배포본만 보관합니다. 다시 배포하면 해당 주차 배포본을 덮어씁니다.</p>
    </div>
  );
}
