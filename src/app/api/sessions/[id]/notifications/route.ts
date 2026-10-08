import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { listNotifications, notificationStats } from "@/lib/notifications/queue";
import { getSession } from "@/lib/sessions";

export const GET = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = await params;
  await getSession(id);
  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  const [stats, notifications] = await Promise.all([notificationStats(id), listNotifications(id, status)]);
  return NextResponse.json({ stats, notifications });
});
