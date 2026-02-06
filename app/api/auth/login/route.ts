import { jsonResponse, errorResponse } from "@/lib/utils";
import { issueToken, setSessionCookie, verifyPassword, verifyUsername } from "@/lib/auth";
import { getClientIp, verifySameOriginForWrite } from "@/lib/security";

export const dynamic = "force-dynamic";

type LoginRateState = {
  count: number;
  resetAt: number;
  blockedUntil: number;
};

const loginRateMap = new Map<string, LoginRateState>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const BLOCK_MS = 15 * 60 * 1000;

function pruneRateMap(now: number) {
  if (loginRateMap.size < 2000) return;
  for (const [key, value] of loginRateMap.entries()) {
    if (value.resetAt <= now && value.blockedUntil <= now) {
      loginRateMap.delete(key);
    }
  }
}

function checkLoginRateLimit(key: string) {
  const now = Date.now();
  pruneRateMap(now);

  const state = loginRateMap.get(key);
  if (!state) return null;
  if (state.blockedUntil > now) return state;
  if (state.resetAt <= now) {
    loginRateMap.delete(key);
    return null;
  }
  return state;
}

function markLoginFailure(key: string) {
  const now = Date.now();
  const state = loginRateMap.get(key);
  if (!state || state.resetAt <= now) {
    loginRateMap.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
      blockedUntil: 0
    });
    return;
  }

  state.count += 1;
  if (state.count >= MAX_ATTEMPTS) {
    state.blockedUntil = now + BLOCK_MS;
  }
}

function clearLoginRate(key: string) {
  loginRateMap.delete(key);
}

export async function POST(request: Request) {
  const originIssue = verifySameOriginForWrite(request);
  if (originIssue) return errorResponse(403, "Forbidden");

  const body = await request.json().catch(() => ({}));
  const { username, password } = body || {};
  if (!username || !password) {
    return errorResponse(400, "Missing credentials");
  }

  const ip = getClientIp(request);
  const rateKey = `${ip}:${String(username).toLowerCase()}`;
  const limited = checkLoginRateLimit(rateKey);
  if (limited?.blockedUntil && limited.blockedUntil > Date.now()) {
    return errorResponse(429, "Too many login attempts");
  }

  if (!verifyPassword(String(password))) {
    markLoginFailure(rateKey);
    return errorResponse(401, "Invalid credentials");
  }
  if (!verifyUsername(String(username))) {
    markLoginFailure(rateKey);
    return errorResponse(401, "Invalid credentials");
  }

  clearLoginRate(rateKey);
  const token = issueToken();
  await setSessionCookie(token);
  return jsonResponse({ ok: true, user: username });
}
