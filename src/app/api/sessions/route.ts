import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { sessionSchema } from "@/lib/validation";
import { createSession, listSessions } from "@/lib/sessions";
import { predictionUrl } from "@/lib/qr";

export const GET = route(async (req) => {
  await requireAdmin(req);
  const sessions = (await listSessions()).map((s) => ({ ...s, predictionUrl: predictionUrl(s.secureToken) }));
  return NextResponse.json({ sessions });
});

export const POST = route(async (req) => {
  const admin = await requireAdmin(req);
  const input = await readJson(req, sessionSchema);
  const session = await createSession(input, admin.sub);
  return NextResponse.json({ session: { ...session, predictionUrl: predictionUrl(session.secureToken) } }, { status: 201 });
});
