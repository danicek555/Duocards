"use client";

import { I18nProvider } from "@/i18n/I18nProvider";
import { ConsentProvider } from "@/components/analytics/ConsentProvider";

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <I18nProvider>
      <ConsentProvider>{children}</ConsentProvider>
    </I18nProvider>
  );
}
