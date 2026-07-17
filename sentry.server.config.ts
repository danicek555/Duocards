// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  redactSentryBreadcrumb,
  redactSentryEvent,
} from "./src/lib/sentryPrivacy";

Sentry.init({
  dsn: "https://3d324d3ebbc1267a272493b6054883d0@o4510268886220800.ingest.de.sentry.io/4510274874900560",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  sendDefaultPii: false,
  beforeSend: redactSentryEvent,
  beforeSendTransaction: redactSentryEvent,
  beforeBreadcrumb: redactSentryBreadcrumb,
});
