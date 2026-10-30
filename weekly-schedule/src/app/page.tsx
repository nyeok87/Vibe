import { redirect } from "next/navigation";
import { currentRole } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

/** S0 접속 */
export default async function Home() {
  if (await currentRole()) redirect("/dept");
  return (
    <div className="center-box">
      <div className="panel">
        <h1>주간 일정 종합·배포</h1>
        <p className="muted small" style={{ marginTop: 0 }}>
          시제품 · 가상 데이터만 입력하십시오
        </p>
        <LoginForm kind="code" />
        <p style={{ marginTop: 20, textAlign: "center" }}>
          <Link href="/admin/login" className="small">
            관리자 로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
