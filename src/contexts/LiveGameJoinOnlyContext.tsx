"use client";

import { createContext, useContext } from "react";

const LiveGameJoinOnlyContext = createContext(false);

export function LiveGameJoinOnlyProvider({
  joinOnly,
  children,
}: {
  joinOnly: boolean;
  children: React.ReactNode;
}) {
  return (
    <LiveGameJoinOnlyContext.Provider value={joinOnly}>
      {children}
    </LiveGameJoinOnlyContext.Provider>
  );
}

export function useLiveGameJoinOnly(): boolean {
  return useContext(LiveGameJoinOnlyContext);
}
