import { NextResponse } from "next/server";
import { processQueue } from "@/lib/notifications/worker";

/**
 * Serverless alternative to `npm run worker`: call this from a cron (every minute) with
 * `Authorization: Bearer $CRON_SECRET`. Drains the queue for up to ~50 seconds.
 */
async function drain(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid cron secret." } }, { status: 401 });
  }
  const deadline = Date.now() + 50_000;
  const totals = { processed: 0, sent: 0, failed: 0 };
  do {
    const r = await processQueue();
    totals.processed += r.processed;
    totals.sent += r.sent;
    totals.failed += r.failed;
    if (r.processed === 0) break;
  } while (Date.now() < deadline);
  return NextResponse.json(totals);
}

export const POST = drain;
export const GET = drain;
