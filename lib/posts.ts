import type { PostItem } from "@/components/PostCard";

export type RawPost = {
  id: string;
  slug?: string;
  title: string;
  summary?: string;
  content?: string;
  tags?: unknown;
  status?: string;
  visibility?: string;
  publish_at?: string;
  publishAt?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
};

export function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((tag) => String(tag));
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).map((tag) => String(tag));
      }
    } catch {
      return value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export function normalizePost(raw: RawPost): RawPost {
  return {
    ...raw,
    tags: parseTags(raw.tags),
    publishAt: raw.publish_at || raw.publishAt,
    createdAt: raw.created_at || raw.createdAt,
    updatedAt: raw.updated_at || raw.updatedAt
  };
}

export function toPostItem(raw: RawPost): PostItem {
  const normalized = normalizePost(raw);
  return {
    id: normalized.id,
    title: normalized.title,
    summary: normalized.summary || "",
    tags: (normalized.tags as string[]) || [],
    publishAt: normalized.publishAt,
    createdAt: normalized.createdAt
  };
}

export function formatDate(value?: string) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}

export function randomId(length = 12) {
  const bytes = new Uint8Array(length);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}
