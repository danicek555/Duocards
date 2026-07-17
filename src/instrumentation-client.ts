// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  redactSentryBreadcrumb,
  redactSentryEvent,
} from "@/lib/sentryPrivacy";

// Only initialize Sentry on the client when DSN is present
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Replay is intentionally disabled. Its underlying rrweb metadata records
    // window.location before React can remove a one-time reset capability from
    // the URL, and beforeAddRecordingEvent cannot rewrite those base events.
    tracesSampleRate: 1,
    enableLogs: process.env.NODE_ENV !== "production",
    sendDefaultPii: false,
    beforeSend: redactSentryEvent,
    beforeSendTransaction: redactSentryEvent,
    beforeBreadcrumb: redactSentryBreadcrumb,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
