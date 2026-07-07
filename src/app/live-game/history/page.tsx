"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Live game history now lives inside the dashboard (right content area) so
// the dashboard sidebar stays visible. This route only redirects there.
export default function LiveGameHistoryRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard?view=live-history");
  }, [router]);

  return null;
}
