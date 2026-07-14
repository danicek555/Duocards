"use client";

import { useI18n } from "@/i18n/I18nProvider";
import AuthPageHeader from "@/components/AuthPageHeader";

interface AuthHeaderProps {
  isLogin: boolean;
}

export default function AuthHeader({ isLogin }: AuthHeaderProps) {
  const { t } = useI18n();

  return (
    <AuthPageHeader
      badge={isLogin ? t("auth.badgeLogin") : t("auth.badgeRegister")}
      subtitle={
        isLogin ? t("auth.subtitleLogin") : t("auth.subtitleRegister")
      }
    />
  );
}
