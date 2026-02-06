export function jsonResponse(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
}

export function errorResponse(status: number, message: string) {
  return jsonResponse({ error: message }, { status });
}
