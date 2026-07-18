export const SESSION_AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24;
export const REMEMBERED_AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

export const OAUTH_REMEMBER_COOKIE_NAME = "oauth_remember_me";

export function authTokenTtlSeconds(rememberMe: boolean): number {
  return rememberMe
    ? REMEMBERED_AUTH_TOKEN_TTL_SECONDS
    : SESSION_AUTH_TOKEN_TTL_SECONDS;
}

export function authCookieOptions(rememberMe: boolean) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(rememberMe
      ? { maxAge: REMEMBERED_AUTH_TOKEN_TTL_SECONDS }
      : {}),
  };
}
