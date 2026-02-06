import { jsonResponse, errorResponse } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAdmin();
  if (!user) return errorResponse(401, "Unauthorized");
  return jsonResponse({ user });
}
