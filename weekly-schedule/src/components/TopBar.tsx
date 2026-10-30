"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const DEPT_LINKS = [
  { href: "/dept", label: "일정 제출" },
  { href: "/dept/view", label: "배포본 열람" },
];
const ADMIN_LINKS = [
  { href: "/admin", label: "제출 현황·종합" },
  { href: "/admin/preview", label: "미리보기·편집" },
  { href: "/admin/history", label: "이력" },
  { href: "/admin/settings", label: "설정" },
];

export default function TopBar({ area, role }: { area: "dept" | "admin"; role: "dept" | "admin" }) {
  const path = usePathname();
  const links = area === "admin" ? ADMIN_LINKS : DEPT_LINKS;
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }
  return (
    <header className="topbar no-print">
      <div className="topbar-inner">
        <span className="brand">주간 일정 종합·배포</span>
        <nav>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="role">{area === "admin" ? "최종 담당자" : "부서 담당자"}</span>
        {area === "dept" && (
          <Link href={role === "admin" ? "/admin" : "/admin/login"} style={{ color: "#dbe6f5", fontSize: 13 }}>
            관리자
          </Link>
        )}
        {area === "admin" && (
          <Link href="/dept" style={{ color: "#dbe6f5", fontSize: 13 }}>
            부서 화면
          </Link>
        )}
        <button className="link" onClick={logout}>
          나가기
        </button>
      </div>
    </header>
  );
}
