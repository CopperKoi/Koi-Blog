import { jsonResponse, errorResponse } from "@/lib/utils";
import { initDb, pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { normalizeSafeHttpUrl, verifySameOriginForWrite } from "@/lib/security";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

async function getId(context: RouteContext) {
  const params = await context.params;
  return params.id;
}

export async function DELETE(request: Request, context: RouteContext) {
  const originIssue = verifySameOriginForWrite(request);
  if (originIssue) return errorResponse(403, "Forbidden");
  await initDb();
  const admin = await requireAdmin();
  if (!admin) return errorResponse(401, "Unauthorized");
  const id = await getId(context);
  await pool.query("DELETE FROM friend_links WHERE id = $1", [id]);
  return jsonResponse({ ok: true });
}

export async function PATCH(request: Request, context: RouteContext) {
  const originIssue = verifySameOriginForWrite(request);
  if (originIssue) return errorResponse(403, "Forbidden");
  await initDb();
  const admin = await requireAdmin();
  if (!admin) return errorResponse(401, "Unauthorized");
  const body = await request.json().catch(() => ({}));
  const { title, url, note, direction } = body || {};
  const id = await getId(context);

  if (title !== undefined || url !== undefined || note !== undefined) {
    const updates: string[] = [];
    const values: unknown[] = [];
    if (title !== undefined) {
      values.push(title);
      updates.push(`title = $${values.length}`);
    }
    if (url !== undefined) {
      const safeUrl = normalizeSafeHttpUrl(String(url));
      if (!safeUrl) return errorResponse(400, "Invalid url");
      values.push(safeUrl);
      updates.push(`url = $${values.length}`);
    }
    if (note !== undefined) {
      values.push(note);
      updates.push(`note = $${values.length}`);
    }
    values.push(id);
    await pool.query(
      `UPDATE friend_links SET ${updates.join(", ")} WHERE id = $${values.length}`,
      values
    );
  }

  if (direction === "up" || direction === "down") {
    const { rows } = await pool.query(
      "SELECT id, sort_order FROM friend_links WHERE id = $1",
      [id]
    );
    if (!rows.length) return errorResponse(404, "Not found");
    const current = rows[0];
    const comparator = direction === "up" ? ">" : "<";
    const orderBy = direction === "up" ? "ASC" : "DESC";
    const { rows: neighborRows } = await pool.query(
      `SELECT id, sort_order FROM friend_links WHERE sort_order ${comparator} $1 ORDER BY sort_order ${orderBy} LIMIT 1`,
      [current.sort_order]
    );
    if (neighborRows.length) {
      const neighbor = neighborRows[0];
      await pool.query("UPDATE friend_links SET sort_order = $1 WHERE id = $2", [neighbor.sort_order, current.id]);
      await pool.query("UPDATE friend_links SET sort_order = $1 WHERE id = $2", [current.sort_order, neighbor.id]);
    }
  }

  const { rows: updated } = await pool.query("SELECT * FROM friend_links WHERE id = $1", [id]);
  return jsonResponse({ friend: updated[0] });
}
