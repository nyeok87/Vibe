import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "주간 일정 종합·배포 (시제품)",
  description: "부서 HWPX 일정 제출, 자동 종합, 최종본 배포",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
