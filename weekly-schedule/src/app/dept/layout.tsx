import { requirePage } from "@/lib/auth";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function DeptLayout({ children }: { children: React.ReactNode }) {
  const role = await requirePage("dept");
  return (
    <>
      <TopBar area="dept" role={role} />
      <main className="container">{children}</main>
    </>
  );
}
