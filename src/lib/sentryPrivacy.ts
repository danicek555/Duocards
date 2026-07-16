import type { Breadcrumb, Event } from "@sentry/nextjs";

function decodeParameterName(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function isTokenParameter(part: string): boolean {
  const separatorIndex = part.indexOf("=");
  const rawName = separatorIndex === -1 ? part : part.slice(0, separatorIndex);
  return decodeParameterName(rawName).toLowerCase() === "token";
}

function redactParameterList(value: string): string {
  return value
    .split("&")
    .filter((part) => part.length > 0 && !isTokenParameter(part))
    .join("&");
}

function looksLikeParameterList(value: string): boolean {
  if (!value || /[\s/?#]/.test(value)) return false;
  const parts = value.split("&").filter(Boolean);
  return parts.length > 0 && parts.every((part) => part.includes("="));
}

/** Removes reset tokens from URL query strings and hash parameters. */
export function redactSensitiveUrl(value: string): string {
  const hashIndex = value.indexOf("#");
  const beforeHash = hashIndex === -1 ? value : value.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? null : value.slice(hashIndex + 1);

  const queryIndex = beforeHash.indexOf("?");
  let redactedBeforeHash: string;
  if (queryIndex !== -1) {
    const path = beforeHash.slice(0, queryIndex);
    const query = redactParameterList(beforeHash.slice(queryIndex + 1));
    redactedBeforeHash = query ? `${path}?${query}` : path;
  } else if (looksLikeParameterList(beforeHash)) {
    // Sentry's request.query_string can be a bare parameter list.
    redactedBeforeHash = redactParameterList(beforeHash);
  } else {
    redactedBeforeHash = beforeHash;
  }

  if (fragment === null) return redactedBeforeHash;

  let redactedFragment = fragment;
  if (fragment.includes("?") || fragment.includes("#")) {
    redactedFragment = redactSensitiveUrl(fragment);
  } else if (looksLikeParameterList(fragment)) {
    redactedFragment = redactParameterList(fragment);
  }

  return redactedFragment
    ? `${redactedBeforeHash}#${redactedFragment}`
    : redactedBeforeHash;
}

function redactUrlStringsDeep(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === "string") return redactSensitiveUrl(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = redactUrlStringsDeep(value[index], seen);
    }
    return value;
  }

  const record = value as Record<string, unknown>;
  for (const [key, nestedValue] of Object.entries(record)) {
    record[key] = redactUrlStringsDeep(nestedValue, seen);
  }
  return value;
}

function redactRequestQuery(event: Event): void {
  const query = event.request?.query_string;
  if (typeof query === "string") {
    event.request!.query_string = redactParameterList(query.replace(/^\?/, ""));
    return;
  }

  if (Array.isArray(query)) {
    event.request!.query_string = query.filter(
      ([name]) => decodeParameterName(name).toLowerCase() !== "token",
    );
    return;
  }

  if (query && typeof query === "object") {
    for (const name of Object.keys(query)) {
      if (decodeParameterName(name).toLowerCase() === "token") {
        delete query[name];
      }
    }
  }
}

export function redactSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return redactUrlStringsDeep(breadcrumb) as Breadcrumb;
}

export function redactSentryEvent<T extends Event>(event: T): T {
  redactRequestQuery(event);
  return redactUrlStringsDeep(event) as T;
}
