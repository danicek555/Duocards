"use client";

import { I18nProvider } from "@/i18n/I18nProvider";

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return <I18nProvider>{children}</I18nProvider>;
}
