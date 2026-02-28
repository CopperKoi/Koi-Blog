import { jsonResponse, errorResponse } from "@/lib/utils";
import { initDb, pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { verifySameOriginForWrite } from "@/lib/security";

export const dynamic = "force-dynamic";

type TravelItem = {
  adcode: number;
  name: string;
};

function normalizeItems(input: unknown): TravelItem[] | null {
  if (!Array.isArray(input)) return null;
  const dedup = new Map<number, TravelItem>();

  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const entry = raw as { adcode?: unknown; name?: unknown };
    const adcode = Number(entry.adcode);
    if (!Number.isInteger(adcode) || adcode <= 0 || adcode > 999999) return null;

    const name = String(entry.name || "").trim();
    if (!name || name.length > 64) return null;

    dedup.set(adcode, { adcode, name });
  }

  return Array.from(dedup.values()).sort((a, b) => a.adcode - b.adcode);
}

export async function GET() {
  await initDb();
  const { rows } = await pool.query(
    "SELECT adcode, name, updated_at FROM travel_marks ORDER BY adcode ASC"
  );
  return jsonResponse({ items: rows });
}

export async function PATCH(request: Request) {
  const originIssue = verifySameOriginForWrite(request);
  if (originIssue) return errorResponse(403, "Forbidden");

  await initDb();
  const admin = await requireAdmin();
  if (!admin) return errorResponse(401, "Unauthorized");

  const body = await request.json().catch(() => ({}));
  const items = normalizeItems(body?.items);
  if (!items) return errorResponse(400, "Invalid items");

  await pool.query("BEGIN");
  try {
    await pool.query("DELETE FROM travel_marks");
    for (const item of items) {
      await pool.query(
        "INSERT INTO travel_marks (adcode, name, updated_at) VALUES ($1, $2, NOW())",
        [item.adcode, item.name]
      );
    }
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  return jsonResponse({ ok: true, items });
}
