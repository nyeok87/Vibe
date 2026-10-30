"use client";
import { useEffect, useState } from "react";
import { api, storeGet, storeSet, type Meta } from "./client";

/** 관리자 화면 공통: 선택한 주차를 화면 사이에서 기억(기본값: 다음 주) */
export function useAdminWeek() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [week, setWeekState] = useState("");
  useEffect(() => {
    api<Meta>("/api/meta").then((m) => {
      setMeta(m);
      const fromUrl = new URLSearchParams(window.location.search).get("week");
      setWeekState(fromUrl || storeGet("adminWeek") || m.nextWeek);
    });
  }, []);
  const setWeek = (w: string) => {
    setWeekState(w);
    storeSet("adminWeek", w);
  };
  return { meta, week, setWeek };
}
