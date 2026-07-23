import { getAdminIdentity, adminJson } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// GET /api/admin/me — jen { isAdmin } pro podmíněné zobrazení vstupu do
// administrace. Vrací pouze stav vlastního účtu, žádná další data; proto
// záměrně bez auditu (volá se při každém načtení dashboardu).
export async function GET() {
  const admin = await getAdminIdentity();
  return adminJson({ isAdmin: admin !== null });
}
