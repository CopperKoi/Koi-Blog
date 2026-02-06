import { notFound } from "next/navigation";
import { StatusPage } from "@/components/StatusPage";

const ALLOWED_CODES = new Set([400, 401, 403, 404, 429, 500, 502, 503, 504]);

export default function Status({ params }: { params: { code: string } }) {
  const code = Number(params.code);
  if (!ALLOWED_CODES.has(code)) {
    return notFound();
  }
  return <StatusPage code={code} />;
}
