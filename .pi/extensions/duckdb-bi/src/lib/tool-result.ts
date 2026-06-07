import type { ToolErrorPayload } from "../types";

export function toolResponse(details: unknown, text?: string) {
  const rendered = text ?? JSON.stringify(details, null, 2);
  return {
    content: [{ type: "text" as const, text: rendered }],
    details,
  };
}

export function toolError(payload: {
  code: string;
  message: string;
  details?: unknown;
  elapsed_ms?: number;
  query_id?: string;
}) {
  const details = {
    ok: false,
    elapsed_ms: payload.elapsed_ms ?? 0,
    query_id: payload.query_id,
    error: {
      code: payload.code,
      message: payload.message,
      details: payload.details,
    } satisfies ToolErrorPayload,
  };
  return toolResponse(details);
}
