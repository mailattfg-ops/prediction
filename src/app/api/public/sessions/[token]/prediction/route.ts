import { NextResponse, after } from "next/server";
import { drainQueue } from "@/lib/notifications/worker";
import { ApiError, getIp, route } from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import { submitPrediction } from "@/lib/predictions";
import { outcomeLabel } from "@/lib/format";

export const POST = route<{ token: string }>(async (req, { params }) => {
  const ip = getIp(req);
  // Generous enough for a venue crowd behind one NAT; the UNIQUE constraint does the real duplicate work.
  assertRateLimit(`predict:${ip}`, 120, 60_000);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "BAD_JSON", "Request body must be valid JSON.");
  }
  const { prediction, session } = await submitPrediction((await params).token, body, {
    ip,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  after(() => drainQueue()); // WhatsApp confirmation goes out right away, no worker needed on Vercel
  return NextResponse.json(
    {
      prediction: {
        id: prediction.id,
        selectedOutcome: prediction.selectedOutcome,
        predictedTeam: outcomeLabel(prediction.selectedOutcome, session.match),
        submittedAt: prediction.submittedAt,
      },
      match: { homeTeam: session.match.homeTeam, awayTeam: session.match.awayTeam },
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
});
