import { jsonResponse, errorResponse } from "@/lib/utils";
import { initDb, pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { verifySameOriginForWrite } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  await initDb();
  const { rows } = await pool.query("SELECT content, updated_at FROM about WHERE id = 1");
  if (!rows.length) return jsonResponse({ content: "", updatedAt: null });
  return jsonResponse({ content: rows[0].content, updatedAt: rows[0].updated_at });
}

export async function PUT(request: Request) {
  const originIssue = verifySameOriginForWrite(request);
  if (originIssue) return errorResponse(403, "Forbidden");
  await initDb();
  const admin = await requireAdmin();
  if (!admin) return errorResponse(401, "Unauthorized");
  const body = await request.json().catch(() => ({}));
  const content = String(body.content || "");
  await pool.query("UPDATE about SET content = $1, updated_at = NOW() WHERE id = 1", [content]);
  return jsonResponse({ ok: true });
}
