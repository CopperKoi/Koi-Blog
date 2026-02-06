export type ApiConfig = {
  apiBase?: string;
};

declare global {
  interface Window {
    __BLOG_CONFIG__?: ApiConfig;
  }
}

export function normalizeApiBase(value: string) {
  return value.replace(/\/$/, "");
}

export function getApiBase() {
  if (typeof window !== "undefined") {
    const configBase = window.__BLOG_CONFIG__?.apiBase;
    if (configBase && configBase.trim()) {
      return normalizeApiBase(configBase.trim());
    }
  }
  const envBase = process.env.NEXT_PUBLIC_API_BASE;
  if (envBase && envBase.trim()) {
    return normalizeApiBase(envBase.trim());
  }
  return "/api";
}

export function buildApiUrl(path: string) {
  if (path.startsWith("http")) return path;
  const base = getApiBase();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = buildApiUrl(path);
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}
