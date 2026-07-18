import { NextResponse, NextRequest } from "next/server";
import {
  hostnameFromRequestHeaders,
  isGuestLiveHostname,
  isJoinOnlyLiveMode,
} from "@/lib/liveGameHost";
import { getPublicAppUrl } from "@/lib/publicUrls";

/**
 * Leaving guest host for /dashboard etc.: on live.localhost stay on this machine (localhost:port),
 * not NEXT_PUBLIC_APP_URL (often https://…vercel.app).
 */
function mainOriginWhenLeavingGuestHost(
  req: NextRequest,
  guestHostname: string,
): string {
  const h = guestHostname.toLowerCase();
  if (h === "live.localhost" || h === "live.127.0.0.1") {
    const hostHeader = req.headers.get("host") ?? "";
    const hostParts = hostHeader.split(":");
    const port =
      hostParts.length > 1 ? hostParts[hostParts.length - 1]! : "";
    let proto = req.headers.get("x-forwarded-proto") ?? "";
    if (!proto) {
      proto = req.nextUrl.protocol.replace(":", "") || "http";
    }
    const base = port ? `${proto}://localhost:${port}` : `${proto}://localhost`;
    return base.replace(/\/$/, "");
  }
  return getPublicAppUrl();
}

function requestHostname(req: NextRequest): string {
  const fromHeaders = hostnameFromRequestHeaders(req.headers);
  if (fromHeaders) return fromHeaders;
  return req.nextUrl.hostname.toLowerCase();
}

async function verify(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [data, sig] = parts;
    if (!data || !sig) return false;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(
        process.env.AUTH_SECRET ||
          process.env.NEXTAUTH_SECRET ||
          "dev-insecure-secret-change-me",
      ),
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign", "verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      Buffer.from(sig, "base64url"),
      encoder.encode(data),
    );
    if (!valid) return false;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as {
      userId?: number;
      email?: string;
      credentialVersion?: string;
      exp?: number;
    };
    if (
      typeof payload.userId !== "number" ||
      !Number.isInteger(payload.userId) ||
      payload.userId <= 0 ||
      typeof payload.email !== "string" ||
      payload.email.length === 0 ||
      typeof payload.credentialVersion !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/u.test(payload.credentialVersion) ||
      typeof payload.exp !== "number" ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const hostname = requestHostname(req);
  const pathname = req.nextUrl.pathname;

  const requestHeaders = new Headers(req.headers);
  if (isJoinOnlyLiveMode(hostname)) {
    requestHeaders.set("x-duocards-live-join-only", "1");
  }

  if (isGuestLiveHostname(hostname)) {
    const blocked = ["/dashboard", "/verify", "/reset-password"];
    const exitOrigin = mainOriginWhenLeavingGuestHost(req, hostname);
    for (const p of blocked) {
      if (pathname === p || pathname.startsWith(`${p}/`)) {
        if (exitOrigin) {
          return NextResponse.redirect(
            new URL(`${p}${req.nextUrl.search}`, exitOrigin),
          );
        }
      }
    }

    /*
     * Guest host: never run app/page.tsx (login). Rewrite to /live so Next serves app/live/page.tsx.
     */
    if (pathname === "/" || pathname === "") {
      const url = req.nextUrl.clone();
      url.pathname = "/live";
      return NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      });
    }

    if (pathname === "/live-game" || pathname.startsWith("/live-game/")) {
      const url = req.nextUrl.clone();
      const suffix =
        pathname === "/live-game" ? "" : pathname.slice("/live-game".length);
      url.pathname = "/live" + suffix;
      if (url.pathname === "" || url.pathname === "/") {
        url.pathname = "/live";
      }
      return NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      });
    }
  }

  const allowInternalLivePath =
    isGuestLiveHostname(hostname) ||
    process.env.NEXT_PUBLIC_LIVE_JOIN_ONLY === "true";
  if (
    !allowInternalLivePath &&
    (pathname === "/live" || pathname.startsWith("/live/"))
  ) {
    const url = req.nextUrl.clone();
    url.pathname =
      pathname === "/live"
        ? "/live-game"
        : "/live-game" + pathname.slice("/live".length);
    return NextResponse.redirect(url, 307);
  }

  if (pathname === "/") {
    const token = req.cookies.get("auth")?.value;
    if (await verify(token)) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/dashboard")) {
    const token = req.cookies.get("auth")?.value;
    const ok = await verify(token);
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("unauthorized", "true");
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/",
    "/live",
    "/live/:path*",
    "/dashboard/:path*",
    "/((?!api|_next/static|_next/image|monitoring|.*\\..*).*)",
  ],
};
