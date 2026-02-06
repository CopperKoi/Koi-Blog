import { jsonResponse, errorResponse } from "@/lib/utils";
import { initDb, pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { verifySameOriginForWrite } from "@/lib/security";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

async function getId(context: RouteContext) {
  const params = await context.params;
  return params.id;
}

export async function GET(_: Request, context: RouteContext) {
  await initDb();
  const id = await getId(context);
  const { rows } = await pool.query("SELECT * FROM posts WHERE id = $1", [id]);
  if (!rows.length) return errorResponse(404, "Not found");

  const post = rows[0];
  const isAdmin = Boolean(await requireAdmin());
  const isPublic = post.status === "published" && post.visibility === "public" && (!post.publish_at || new Date(post.publish_at) <= new Date());
  if (!isAdmin && !isPublic) return errorResponse(404, "Not found");

  return jsonResponse({ post });
}

export async function PATCH(request: Request, context: RouteContext) {
  const originIssue = verifySameOriginForWrite(request);
  if (originIssue) return errorResponse(403, "Forbidden");
  await initDb();
  const admin = await requireAdmin();
  if (!admin) return errorResponse(401, "Unauthorized");

  const body = await request.json().catch(() => ({}));
  const id = await getId(context);

  const updates: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, unknown> = {
    title: body.title,
    summary: body.summary,
    content: body.content,
    status: body.status,
    visibility: body.visibility
  };

  Object.entries(map).forEach(([key, value]) => {
    if (value !== undefined) {
      values.push(value);
      updates.push(`${key} = $${values.length}`);
    }
  });

  if (body.tags !== undefined) {
    values.push(JSON.stringify(Array.isArray(body.tags) ? body.tags : []));
    updates.push(`tags = $${values.length}`);
  }

  if (body.publishAt !== undefined) {
    values.push(body.publishAt ? new Date(body.publishAt) : null);
    updates.push(`publish_at = $${values.length}`);
  }

  updates.push("updated_at = NOW()");

  if (!updates.length) return errorResponse(400, "No changes");

  values.push(id);
  const sql = `UPDATE posts SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`;
  const { rows } = await pool.query(sql, values);
  if (!rows.length) return errorResponse(404, "Not found");
  return jsonResponse({ post: rows[0] });
}

export async function DELETE(request: Request, context: RouteContext) {
  const originIssue = verifySameOriginForWrite(request);
  if (originIssue) return errorResponse(403, "Forbidden");
  await initDb();
  const admin = await requireAdmin();
  if (!admin) return errorResponse(401, "Unauthorized");

  const id = await getId(context);
  await pool.query("DELETE FROM posts WHERE id = $1", [id]);
  return jsonResponse({ ok: true });
}
