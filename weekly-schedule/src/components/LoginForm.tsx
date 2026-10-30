"use client";
import { useState } from "react";
import { api } from "./client";

export default function LoginForm({ kind }: { kind: "code" | "admin" }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (kind === "code") {
        await api("/api/auth/code", { method: "POST", json: { code: value } });
        window.location.href = "/dept";
      } else {
        await api("/api/auth/admin", { method: "POST", json: { password: value } });
        window.location.href = "/admin";
      }
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
      <label className="field">
        {kind === "code" ? "공용 접속코드" : "관리자 비밀번호"}
        <input type="password" value={value} onChange={(e) => setValue(e.target.value)} autoFocus autoComplete="off" />
      </label>
      {error && <div className="notice error">{error}</div>}
      <button className="btn primary big" disabled={busy || !value}>
        {kind === "code" ? "들어가기" : "관리자 로그인"}
      </button>
    </form>
  );
}
