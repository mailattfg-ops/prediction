import { NextResponse } from "next/server";
import { ApiError, getIp, route } from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import { submitLateEntry } from "@/lib/predictions";

/** Details-only registration once the prediction window has closed. Never stores an outcome or score. */
export const POST = route<{ token: string }>(async (req, { params }) => {
  const ip = getIp(req);
  assertRateLimit(`predict:${ip}`, 120, 60_000);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "BAD_JSON", "Request body must be valid JSON.");
  }
  const { entry, session } = await submitLateEntry((await params).token, body, { ip, userAgent: req.headers.get("user-agent") ?? undefined });
  return NextResponse.json(
    {
      lateEntry: { id: entry.id, submittedAt: entry.submittedAt },
      match: { homeTeam: session.match.homeTeam, awayTeam: session.match.awayTeam },
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
});
