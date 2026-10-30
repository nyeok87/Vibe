"use client";
import { weekShortLabel } from "@/lib/dates";
import { weekOptions, type Meta } from "./client";

export default function WeekSelect({ meta, week, onChange }: { meta: Meta; week: string; onChange: (w: string) => void }) {
  return (
    <label className="field">
      대상 주차
      <select value={week} onChange={(e) => onChange(e.target.value)}>
        {weekOptions(meta, [week]).map((w) => (
          <option key={w} value={w}>
            {weekShortLabel(w)}
            {w === meta.thisWeek ? " (이번 주)" : w === meta.nextWeek ? " (다음 주)" : ""}
            {meta.publishedWeeks.includes(w) ? " · 배포됨" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
