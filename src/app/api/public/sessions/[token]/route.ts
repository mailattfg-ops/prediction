import { NextResponse } from "next/server";
import { ApiError, getIp, route } from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import { getPublicSession } from "@/lib/sessions";

/** Returns serverTime/startTime/expiryTime/status so the browser can render a countdown it never controls. */
export const GET = route<{ token: string }>(async (req, { params }) => {
  assertRateLimit(`public-get:${getIp(req)}`, 300, 60_000);
  const session = await getPublicSession((await params).token);
  if (!session) throw new ApiError(404, "NOT_FOUND", "This QR code is not valid.");
  return NextResponse.json({ session }, { headers: { "Cache-Control": "no-store" } });
});
