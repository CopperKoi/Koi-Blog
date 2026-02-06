import jwt from "jsonwebtoken";
import { compareSync } from "bcryptjs";
import { cookies } from "next/headers";

const IS_PROD = process.env.NODE_ENV === "production";
const DEFAULT_COOKIE_NAME = IS_PROD ? "__Host-blog_session" : "blog_session";
const COOKIE_NAME = process.env.COOKIE_NAME || DEFAULT_COOKIE_NAME;
const JWT_SECRET = process.env.JWT_SECRET || "unsafe-secret";
const ADMIN_USER = process.env.ADMIN_USER || "";
const RAW_ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";
const COOKIE_SECURE = IS_PROD ? true : process.env.COOKIE_SECURE !== "false";

function unwrapEnvValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeAdminPasswordHash(raw: string) {
  const unwrapped = unwrapEnvValue(raw);
  if (!unwrapped) return "";

  // Dotenv/systemd variants may preserve escaped dollars.
  const unescaped = unwrapped.replace(/\\\$/g, "$");
  if (unescaped.startsWith("$2")) return unescaped;

  // If dotenv-expand swallowed "$2b$12$", rebuild from the 53-char body.
  if (/^[./A-Za-z0-9]{53}$/.test(unescaped)) {
    return `$2b$12$${unescaped}`;
  }

  return unescaped;
}

const ADMIN_PASSWORD_HASH = normalizeAdminPasswordHash(RAW_ADMIN_PASSWORD_HASH);

function assertProdSecurityConfig() {
  if (!IS_PROD) return;
  if (process.env.COOKIE_SECURE !== "true") {
    throw new Error("Security misconfiguration: COOKIE_SECURE must be true in production");
  }
  if (JWT_SECRET === "unsafe-secret") {
    throw new Error("Security misconfiguration: JWT_SECRET must be set in production");
  }
  if (!ADMIN_PASSWORD_HASH) {
    throw new Error("Security misconfiguration: ADMIN_PASSWORD_HASH must be set in production");
  }
  if (!ADMIN_PASSWORD_HASH.startsWith("$2")) {
    throw new Error("Security misconfiguration: ADMIN_PASSWORD_HASH must be a bcrypt hash in production");
  }
  if (!COOKIE_NAME.startsWith("__Host-")) {
    throw new Error("Security misconfiguration: production session cookie must use __Host- prefix");
  }
}

export function verifyPassword(password: string) {
  if (!ADMIN_PASSWORD_HASH) return false;
  if (!ADMIN_PASSWORD_HASH.startsWith("$2")) return false;
  try {
    return compareSync(password, ADMIN_PASSWORD_HASH);
  } catch {
    return false;
  }
}

export function issueToken() {
  assertProdSecurityConfig();
  return jwt.sign({ sub: ADMIN_USER }, JWT_SECRET, {
    expiresIn: "12h",
    issuer: "copperkoi-blog",
    audience: "copperkoi-admin"
  });
}

export async function readToken() {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

export async function requireAdmin() {
  assertProdSecurityConfig();
  const token = await readToken();
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: "copperkoi-blog",
      audience: "copperkoi-admin"
    }) as { sub?: string };
    if (payload.sub !== ADMIN_USER) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  assertProdSecurityConfig();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function clearSessionCookie() {
  assertProdSecurityConfig();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: COOKIE_SECURE,
    path: "/",
    expires: new Date(0)
  });
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}
