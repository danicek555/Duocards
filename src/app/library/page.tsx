"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The public library now lives inside the dashboard (right content area) so
// the dashboard sidebar stays visible. This route only redirects there.
export default function PublicLibraryRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard?view=library");
  }, [router]);

  return null;
}
