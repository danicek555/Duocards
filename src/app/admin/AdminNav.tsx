"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Přehled" },
  { href: "/admin/users", label: "Uživatelé" },
  { href: "/admin/system", label: "Systém" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-cyan-300">DuoCards</p>
        <h1 className="mt-1 text-3xl font-black sm:text-4xl">Administrace</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {ITEMS.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                active
                  ? "bg-blue-500 text-white"
                  : "border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <Link href="/dashboard" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10">
          Zpět do aplikace
        </Link>
      </div>
    </nav>
  );
}
