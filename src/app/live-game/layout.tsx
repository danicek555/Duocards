import { headers } from "next/headers";
import { LiveGameJoinOnlyProvider } from "@/contexts/LiveGameJoinOnlyContext";

export default async function LiveGameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const joinOnly = h.get("x-duocards-live-join-only") === "1";

  return (
    <LiveGameJoinOnlyProvider joinOnly={joinOnly}>
      {children}
    </LiveGameJoinOnlyProvider>
  );
}
