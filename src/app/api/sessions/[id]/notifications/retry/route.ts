import { NextResponse, after } from "next/server";
import { drainQueue } from "@/lib/notifications/worker";
import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { retryFailed } from "@/lib/notifications/queue";
import { getSession } from "@/lib/sessions";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  await getSession(id);
  const requeued = await retryFailed(id, admin.sub);
  after(() => drainQueue());
  return NextResponse.json({ requeued });
});
