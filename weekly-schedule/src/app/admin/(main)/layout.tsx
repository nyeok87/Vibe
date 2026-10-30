import { requirePage } from "@/lib/auth";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = await requirePage("admin");
  return (
    <>
      <TopBar area="admin" role={role} />
      <main className="container">{children}</main>
    </>
  );
}
