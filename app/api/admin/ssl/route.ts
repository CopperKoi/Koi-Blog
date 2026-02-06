import { jsonResponse, errorResponse } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth";
import { verifySameOriginForWrite } from "@/lib/security";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const originIssue = verifySameOriginForWrite(request);
  if (originIssue) return errorResponse(403, "Forbidden");
  const admin = await requireAdmin();
  if (!admin) return errorResponse(401, "Unauthorized");
  const body = await request.json().catch(() => ({}));
  const { cert, key } = body || {};
  if (!cert || !key) return errorResponse(400, "Missing cert or key");

  const certPath = process.env.SSL_CERT_PATH;
  const keyPath = process.env.SSL_KEY_PATH;
  if (!certPath || !keyPath) return errorResponse(500, "SSL paths not configured");

  try {
    fs.writeFileSync(certPath, cert, "utf8");
    fs.writeFileSync(keyPath, key, "utf8");
    return jsonResponse({ ok: true });
  } catch {
    return errorResponse(500, "Failed to update certificate");
  }
}
