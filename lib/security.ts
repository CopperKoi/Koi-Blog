const IS_PROD = process.env.NODE_ENV === "production";

function toOrigin(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    return new URL(input).origin;
  } catch {
    return null;
  }
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function verifySameOriginForWrite(request: Request): string | null {
  if (!IS_PROD) return null;

  // Prefer configured public origin when behind reverse proxy.
  const configuredOrigin = toOrigin(process.env.APP_ORIGIN);
  const requestOrigin = toOrigin(request.url);
  const expectedOrigin = configuredOrigin || requestOrigin;
  if (!expectedOrigin) return "Missing expected origin";

  const origin = toOrigin(request.headers.get("origin"));
  const refererOrigin = toOrigin(request.headers.get("referer"));

  if (origin) {
    return origin === expectedOrigin ? null : "Origin mismatch";
  }

  if (refererOrigin) {
    return refererOrigin === expectedOrigin ? null : "Referer mismatch";
  }

  return "Missing origin";
}

export function normalizeSafeHttpUrl(value: string): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
