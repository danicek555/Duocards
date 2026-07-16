import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const productionSharedBackendUrl =
  "https://duocards-backend-731652720086.europe-west1.run.app";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/reset-password",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
  async rewrites() {
    const configuredSharedBackendUrl = process.env.SHARED_BACKEND_URL?.trim();
    const sharedBackendUrl = (
      configuredSharedBackendUrl ||
      (process.env.NODE_ENV === "production"
        ? productionSharedBackendUrl
        : "")
    ).replace(/\/+$/, "");

    if (!sharedBackendUrl) {
      return [];
    }

    return [
      {
        source: "/shared-api/:path*",
        destination: `${sharedBackendUrl}/api/v1/:path*`,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude pg and adapter from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        pg: false,
        "@prisma/adapter-pg": false,
        net: false,
        tls: false,
        fs: false,
        dns: false,
      };
    }
    return config;
  },
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "danielmitka",

  project: "javascript-nextjs-duocards",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  // Disabled in local builds to speed up compilation
  widenClientFileUpload: process.env.CI === "true",

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Automatically tree-shake Sentry logger statements to reduce bundle size
    treeshake: {
      removeDebugLogging: true,
    },
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
  },
});
