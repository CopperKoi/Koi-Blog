import { jsonResponse, errorResponse } from "@/lib/utils";
import { initDb, pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { normalizeSafeHttpUrl, verifySameOriginForWrite } from "@/lib/security";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  await initDb();
  const { rows } = await pool.query(
    "SELECT * FROM friend_links ORDER BY sort_order DESC, created_at DESC"
  );
  return jsonResponse({ items: rows });
}

export async function POST(request: Request) {
  const originIssue = verifySameOriginForWrite(request);
  if (originIssue) return errorResponse(403, "Forbidden");
  await initDb();
  const admin = await requireAdmin();
  if (!admin) return errorResponse(401, "Unauthorized");
  const body = await request.json().catch(() => ({}));
  const { title, url, note } = body || {};
  if (!title || !url) return errorResponse(400, "Missing title or url");
  const safeUrl = normalizeSafeHttpUrl(String(url));
  if (!safeUrl) return errorResponse(400, "Invalid url");

  const { rows: maxRows } = await pool.query(
    "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM friend_links"
  );
  const nextOrder = Number(maxRows[0]?.max_order || 0) + 1;
  const id = `f_${crypto.randomBytes(6).toString("hex")}`;

  const { rows } = await pool.query(
    "INSERT INTO friend_links (id, title, url, note, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [id, title, safeUrl, note || "", nextOrder]
  );
  return jsonResponse({ friend: rows[0] }, { status: 201 });
}

export async function PATCH(request: Request) {
  const originIssue = verifySameOriginForWrite(request);
  if (originIssue) return errorResponse(403, "Forbidden");
  await initDb();
  const admin = await requireAdmin();
  if (!admin) return errorResponse(401, "Unauthorized");

  const body = await request.json().catch(() => ({}));
  const orderIds = Array.isArray(body?.orderIds) ? body.orderIds : null;
  if (!orderIds || !orderIds.length) {
    return errorResponse(400, "Missing orderIds");
  }
  if (orderIds.some((item: unknown) => typeof item !== "string" || !item)) {
    return errorResponse(400, "Invalid orderIds");
  }

  const normalized = Array.from(new Set(orderIds));
  if (normalized.length !== orderIds.length) {
    return errorResponse(400, "Duplicate ids");
  }

  const { rows: existing } = await pool.query("SELECT id FROM friend_links");
  const existingIds = new Set(existing.map((row) => row.id));
  if (existingIds.size !== normalized.length) {
    return errorResponse(400, "orderIds count mismatch");
  }
  if (normalized.some((id) => !existingIds.has(id))) {
    return errorResponse(400, "Unknown id in orderIds");
  }

  await pool.query("BEGIN");
  try {
    for (let index = 0; index < normalized.length; index += 1) {
      const id = normalized[index];
      const sortOrder = normalized.length - index;
      await pool.query("UPDATE friend_links SET sort_order = $1 WHERE id = $2", [sortOrder, id]);
    }
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  return jsonResponse({ ok: true });
}
