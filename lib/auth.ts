import jwt from "jsonwebtoken";
import { compareSync } from "bcryptjs";
import { cookies } from "next/headers";

const IS_PROD = process.env.NODE_ENV === "production";
const DEFAULT_COOKIE_NAME = IS_PROD ? "__Host-blog_session" : "blog_session";

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

function stripControlChars(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "");
}

function env(name: string) {
  return process.env[name] || "";
}

function normalizeAdminPasswordHash(raw: string) {
  const unwrapped = stripControlChars(unwrapEnvValue(raw));
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

function normalizeAdminUser(raw: string) {
  const unwrapped = stripControlChars(unwrapEnvValue(raw));
  return unwrapped.trim().toLowerCase();
}

function getAuthConfig() {
  const cookieName = env("COOKIE_NAME") || DEFAULT_COOKIE_NAME;
  const jwtSecret = env("JWT_SECRET") || "unsafe-secret";
  const rawAdminUser = env("ADMIN_USER") || env("ADMIN_USERNAME") || "copperkoi";
  const adminUser = normalizeAdminUser(rawAdminUser) || "copperkoi";
  const adminPasswordHash = normalizeAdminPasswordHash(env("ADMIN_PASSWORD_HASH"));
  const cookieSecure = IS_PROD ? true : env("COOKIE_SECURE") !== "false";
  return {
    cookieName,
    jwtSecret,
    adminUser,
    adminPasswordHash,
    cookieSecure
  };
}

function assertProdSecurityConfig(config: ReturnType<typeof getAuthConfig>) {
  if (!IS_PROD) return;
  if (env("COOKIE_SECURE") !== "true") {
    throw new Error("Security misconfiguration: COOKIE_SECURE must be true in production");
  }
  if (config.jwtSecret === "unsafe-secret") {
    throw new Error("Security misconfiguration: JWT_SECRET must be set in production");
  }
  if (!config.adminPasswordHash) {
    throw new Error("Security misconfiguration: ADMIN_PASSWORD_HASH must be set in production");
  }
  if (!config.adminPasswordHash.startsWith("$2")) {
    throw new Error("Security misconfiguration: ADMIN_PASSWORD_HASH must be a bcrypt hash in production");
  }
  if (!config.cookieName.startsWith("__Host-")) {
    throw new Error("Security misconfiguration: production session cookie must use __Host- prefix");
  }
}

export function verifyPassword(password: string) {
  const config = getAuthConfig();
  if (!config.adminPasswordHash) return false;
  if (!config.adminPasswordHash.startsWith("$2")) return false;
  try {
    return compareSync(password, config.adminPasswordHash);
  } catch {
    return false;
  }
}

export function verifyUsername(username: string) {
  const config = getAuthConfig();
  return username.trim().toLowerCase() === config.adminUser;
}

export function issueToken() {
  const config = getAuthConfig();
  assertProdSecurityConfig(config);
  return jwt.sign({ sub: config.adminUser }, config.jwtSecret, {
    expiresIn: "12h",
    issuer: "copperkoi-blog",
    audience: "copperkoi-admin"
  });
}

export async function readToken() {
  const config = getAuthConfig();
  const cookieStore = await cookies();
  return cookieStore.get(config.cookieName)?.value;
}

export async function requireAdmin() {
  const config = getAuthConfig();
  assertProdSecurityConfig(config);
  const token = await readToken();
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      issuer: "copperkoi-blog",
      audience: "copperkoi-admin"
    }) as { sub?: string };
    if (payload.sub !== config.adminUser) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const config = getAuthConfig();
  assertProdSecurityConfig(config);
  const cookieStore = await cookies();
  cookieStore.set(config.cookieName, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.cookieSecure,
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function clearSessionCookie() {
  const config = getAuthConfig();
  assertProdSecurityConfig(config);
  const cookieStore = await cookies();
  cookieStore.set(config.cookieName, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: config.cookieSecure,
    path: "/",
    expires: new Date(0)
  });
}

export function getSessionCookieName() {
  return getAuthConfig().cookieName;
}
