import { NextResponse } from "next/server";
import { drainQueue } from "@/lib/notifications/worker";

/**
 * Serverless alternative to `npm run worker`, called by the Vercel cron (daily on Hobby) or any external
 * scheduler with `Authorization: Bearer $CRON_SECRET`. Submissions and results also drain the queue via after().
 */
async function drain(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid cron secret." } }, { status: 401 });
  }
  return NextResponse.json(await drainQueue());
}

export const POST = drain;
export const GET = drain;
