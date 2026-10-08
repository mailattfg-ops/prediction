import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { sessionSchema } from "@/lib/validation";
import { archiveSession, getSession, updateSession } from "@/lib/sessions";
import { predictionUrl } from "@/lib/qr";

export const GET = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const session = await getSession((await params).id);
  return NextResponse.json({ session: { ...session, predictionUrl: predictionUrl(session.secureToken) } });
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const input = await readJson(req, sessionSchema);
  const session = await updateSession((await params).id, input, admin.sub);
  return NextResponse.json({ session: { ...session, predictionUrl: predictionUrl(session.secureToken) } });
});

/** Archive (soft delete): the QR stops working, data is retained. */
export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  await archiveSession((await params).id, admin.sub);
  return NextResponse.json({ ok: true });
});
