import { LiveGameJoinOnlyProvider } from "@/contexts/LiveGameJoinOnlyContext";

/** Guest-only tree: always join-only UI (no dependency on middleware headers). */
export const dynamic = "force-dynamic";

export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LiveGameJoinOnlyProvider joinOnly={true}>{children}</LiveGameJoinOnlyProvider>
  );
}
