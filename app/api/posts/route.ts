import { jsonResponse, errorResponse } from "@/lib/utils";
import { initDb, pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { verifySameOriginForWrite } from "@/lib/security";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function randomId(length = 12) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

export async function GET(request: Request) {
  await initDb();
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "public";
  const query = (searchParams.get("q") || "").trim();
  const limit = Number(searchParams.get("limit") || 0);
  const isAdmin = Boolean(await requireAdmin());

  const conditions: string[] = [];
  const values: string[] = [];

  if (!(isAdmin && view === "admin")) {
    conditions.push("status = 'published'", "visibility = 'public'", "(publish_at IS NULL OR publish_at <= NOW())");
  }

  if (query) {
    values.push(`%${query}%`);
    const idx = values.length;
    conditions.push(`(title ILIKE $${idx} OR summary ILIKE $${idx} OR content ILIKE $${idx})`);
  }

  let sql = "SELECT * FROM posts";
  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY COALESCE(publish_at, created_at) DESC";
  if (limit && Number.isFinite(limit)) {
    sql += ` LIMIT ${Math.min(Math.max(limit, 1), 50)}`;
  }

  const { rows } = await pool.query(sql, values);
  return jsonResponse({ items: rows });
}

export async function POST(request: Request) {
  const originIssue = verifySameOriginForWrite(request);
  if (originIssue) return errorResponse(403, "Forbidden");
  await initDb();
  const admin = await requireAdmin();
  if (!admin) return errorResponse(401, "Unauthorized");

  const body = await request.json().catch(() => ({}));
  const {
    id: rawId,
    slug: rawSlug,
    title,
    summary,
    content,
    tags,
    status = "draft",
    visibility = "public",
    publishAt
  } = body || {};

  if (!title) return errorResponse(400, "Missing title");

  const id = rawId || `p_${randomId(12)}`;
  const slug = rawSlug || `post-${randomId(10)}`;
  const publishDate = publishAt ? new Date(publishAt) : null;

  const tagList = Array.isArray(tags) ? tags : [];

  await pool.query(
    `INSERT INTO posts (id, slug, title, summary, content, tags, status, visibility, publish_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, slug, title, summary || "", content || "", JSON.stringify(tagList), status, visibility, publishDate]
  );
  const { rows } = await pool.query("SELECT * FROM posts WHERE id = $1", [id]);
  return jsonResponse({ post: rows[0] }, { status: 201 });
}
