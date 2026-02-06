import { jsonResponse, errorResponse } from "@/lib/utils";
import { clearSessionCookie } from "@/lib/auth";
import { verifySameOriginForWrite } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originIssue = verifySameOriginForWrite(request);
  if (originIssue) return errorResponse(403, "Forbidden");
  await clearSessionCookie();
  return jsonResponse({ ok: true });
}
