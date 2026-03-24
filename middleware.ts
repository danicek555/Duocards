import { NextResponse, NextRequest } from "next/server";
import {
  isJoinOnlyLiveMode,
  isLiveSubdomainHostname,
} from "@/lib/liveGameHost";

/**
 * The hostname the user actually requested.
 * Prefer `Host` — on Vercel with multiple domains on one project, `x-forwarded-host`
 * is often the primary domain first (e.g. duocards.xyz), which would break live.* routing.
 */
function requestHostname(req: NextRequest): string {
  const hostHeader = req.headers.get("host");
  if (hostHeader) {
    return hostHeader.split(":")[0]!.toLowerCase();
  }
  const forwarded = req.headers.get("x-forwarded-host");
  if (forwarded) {
    const candidates = forwarded.split(",").map((p) =>
      p.trim().split(":")[0]!.toLowerCase(),
    );
    const liveFirst = candidates.find(
      (h) => h.length > 0 && h.split(".")[0] === "live",
    );
    if (liveFirst) return liveFirst;
    const first = candidates[0];
    if (first) return first;
  }
  return req.nextUrl.hostname.toLowerCase();
}

async function verify(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const [data, sig] = token.split(".");
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
      exp?: number;
    };
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000))
      return false;
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

  const mainAppOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  if (isLiveSubdomainHostname(hostname)) {
    const blocked = ["/dashboard", "/verify", "/reset-password"];
    for (const p of blocked) {
      if (pathname === p || pathname.startsWith(`${p}/`)) {
        return NextResponse.redirect(
          new URL(`${p}${req.nextUrl.search}`, mainAppOrigin),
        );
      }
    }

    // Never serve the main app (login) on the guest host — always land on join UI.
    if (pathname === "/" || pathname === "") {
      const dest = new URL(req.url);
      dest.hostname = hostname;
      dest.pathname = "/live-game";
      dest.search = req.nextUrl.search;
      return NextResponse.redirect(dest, 307);
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
    /*
     * "/" must be listed explicitly — the catch-all below often does not run middleware
     * on the root path, so the live subdomain would incorrectly show the login page.
     */
    "/",
    "/dashboard/:path*",
    /*
     * All non-static routes: live subdomain, join-only header, dashboard auth.
     */
    "/((?!api|_next/static|_next/image|monitoring|.*\\..*).*)",
  ],
};
