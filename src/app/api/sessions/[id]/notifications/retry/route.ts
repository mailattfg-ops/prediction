import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { retryFailed } from "@/lib/notifications/queue";
import { getSession } from "@/lib/sessions";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const { id } = await params;
  await getSession(id);
  return NextResponse.json({ requeued: await retryFailed(id, admin.sub) });
});
