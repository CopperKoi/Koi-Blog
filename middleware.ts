import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const IS_PROD = process.env.NODE_ENV === "production";
const ADMIN_PATH_PREFIXES = ["/studio", "/editor", "/ssl"];
const COOKIE_NAME = process.env.COOKIE_NAME || (IS_PROD ? "__Host-blog_session" : "blog_session");

function stripFrameworkHeaders(response: NextResponse) {
  response.headers.delete("x-powered-by");
  response.headers.delete("X-Powered-By");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (IS_PROD) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    response.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: https://www.google.com",
        "connect-src 'self' https:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'"
      ].join("; ")
    );
  }
  return response;
}

export function middleware(request: NextRequest) {
  if (IS_PROD && process.env.FORCE_HTTPS !== "true") {
    return stripFrameworkHeaders(new NextResponse("Server misconfigured", { status: 500 }));
  }

  const forceHttps = process.env.FORCE_HTTPS === "true";
  const proto = request.headers.get("x-forwarded-proto");
  const currentProto = proto || request.nextUrl.protocol.replace(":", "");
  if (forceHttps && currentProto !== "https") {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return stripFrameworkHeaders(NextResponse.redirect(url));
  }

  const { pathname } = request.nextUrl;
  const hasAdminCookie = Boolean(request.cookies.get(COOKIE_NAME)?.value);

  if (IS_PROD && ADMIN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && !hasAdminCookie) {
    return stripFrameworkHeaders(new NextResponse("Not Found", { status: 404 }));
  }

  return stripFrameworkHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.ico).*)"]
};
