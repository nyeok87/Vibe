"use client";
import { useEffect, useState } from "react";
import { api, weekOptions, type Meta } from "@/components/client";
import DocView from "@/components/DocView";
import type { DocModel } from "@/lib/docmodel";
import { formatKst, weekShortLabel } from "@/lib/dates";

/** S2 배포본 열람(읽기 전용, 인쇄) */
export default function PublishedView() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [week, setWeek] = useState("");
  const [data, setData] = useState<{ model: DocModel; published_at: string } | null | undefined>(undefined);

  useEffect(() => {
    api<Meta>("/api/meta").then((m) => {
      setMeta(m);
      // 기본: 다음 주가 배포됐으면 다음 주, 아니면 이번 주
      setWeek(m.publishedWeeks.includes(m.nextWeek) ? m.nextWeek : m.thisWeek);
    });
  }, []);

  useEffect(() => {
    if (!week) return;
    setData(undefined);
    api<{ model: DocModel; published_at: string } | null>(`/api/published?week=${week}`).then(setData);
  }, [week]);

  if (!meta) return <p className="muted">불러오는 중…</p>;

  return (
    <>
      <div className="panel no-print">
        <div className="row">
          <label className="field">
            주차
            <select value={week} onChange={(e) => setWeek(e.target.value)}>
              {weekOptions(meta).map((w) => (
                <option key={w} value={w}>
                  {weekShortLabel(w)}
                  {w === meta.thisWeek ? " (이번 주)" : w === meta.nextWeek ? " (다음 주)" : ""}
                  {meta.publishedWeeks.includes(w) ? " · 배포됨" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="spacer" />
          {data && (
            <>
              <span className="muted small">배포 {formatKst(data.published_at, true)}</span>
              <button className="btn primary" onClick={() => window.print()}>
                🖨 인쇄
              </button>
            </>
          )}
        </div>
      </div>
      {data === undefined && <p className="muted">불러오는 중…</p>}
      {data === null && <div className="panel muted">아직 배포되지 않았습니다.</div>}
      {data && <DocView model={data.model} />}
    </>
  );
}
