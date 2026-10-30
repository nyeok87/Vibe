import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePage } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

/** S3 관리자 로그인 (공용 접속코드 통과 후) */
export default async function AdminLogin() {
  if ((await requirePage("dept")) === "admin") redirect("/admin");
  return (
    <div className="center-box">
      <div className="panel">
        <h1>관리자 로그인</h1>
        <p className="muted small" style={{ marginTop: 0 }}>
          최종 담당자 전용
        </p>
        <LoginForm kind="admin" />
        <p style={{ marginTop: 20, textAlign: "center" }}>
          <Link href="/dept" className="small">
            부서 화면으로
          </Link>
        </p>
      </div>
    </div>
  );
}
