import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export class ApiError extends Error {
  constructor(public httpStatus: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export function jsonError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function handleError(err: unknown): Response {
  if (err instanceof ApiError) return jsonError(err.httpStatus, err.code, err.message, err.details);
  if (err instanceof ZodError) {
    return jsonError(422, "VALIDATION", "Please check the highlighted fields.", flattenZod(err));
  }
  console.error(err);
  return jsonError(500, "SERVER_ERROR", "Something went wrong. Please try again.");
}

function flattenZod(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function getIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "BAD_JSON", "Request body must be valid JSON.");
  }
  return schema.parse(body);
}

export type RouteCtx<P extends Record<string, string> = Record<string, string>> = { params: Promise<P> };

/** Wraps a handler so every thrown error becomes a consistent JSON error response. */
export function route<P extends Record<string, string> = Record<string, string>>(
  handler: (req: Request, ctx: RouteCtx<P>) => Promise<Response>,
) {
  return async (req: Request, ctx: RouteCtx<P>) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      return handleError(e);
    }
  };
}
