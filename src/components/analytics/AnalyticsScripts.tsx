"use client";

import Script from "next/script";
import { useConsent } from "./ConsentProvider";

/**
 * Loads the third-party analytics scripts, but only after the user has granted
 * consent. IDs come from public env vars (they are not secrets) and fall back
 * to the DuoCards production IDs so the app works without extra configuration.
 */
const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "G-SP0X67CV3L";
const HOTJAR_ID = process.env.NEXT_PUBLIC_HOTJAR_ID?.trim() || "6752996";

export default function AnalyticsScripts() {
  const { consent } = useConsent();

  // Nothing is injected until the user explicitly opts in.
  if (consent !== "granted") return null;

  return (
    <>
      {GA_MEASUREMENT_ID ? (
        <>
          <Script
            id="ga-src"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');`}
          </Script>
        </>
      ) : null}

      {HOTJAR_ID ? (
        <Script id="hotjar" strategy="afterInteractive">
          {`(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${HOTJAR_ID},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`}
        </Script>
      ) : null}
    </>
  );
}
