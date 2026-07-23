import { redirect } from "next/navigation";
import { getAdminIdentity } from "@/lib/adminAuth";

// Server-side gate: only users with role ADMIN ever see /admin content.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminIdentity();
  if (!admin) redirect("/dashboard");
  return <>{children}</>;
}
