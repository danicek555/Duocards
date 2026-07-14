"use client";

import AuthPageHeader from "@/components/AuthPageHeader";

interface AuthHeaderProps {
  isLogin: boolean;
}

export default function AuthHeader({ isLogin }: AuthHeaderProps) {
  return (
    <AuthPageHeader
      badge={isLogin ? "PŘIHLÁŠENÍ" : "REGISTRACE"}
      subtitle={
        isLogin
          ? "Kartičky, které znají rytmus tvého mozku."
          : "Za minutu šviháš. Zdarma, bez kreditky."
      }
    />
  );
}
