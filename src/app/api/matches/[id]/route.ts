import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { matchSchema } from "@/lib/validation";
import { deleteMatch, getMatch, matchUsage, updateMatch } from "@/lib/matches";

export const GET = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = await params;
  const [match, usage] = await Promise.all([getMatch(id), matchUsage(id)]);
  return NextResponse.json({ match, usage });
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const input = await readJson(req, matchSchema);
  return NextResponse.json({ match: await updateMatch((await params).id, input, admin.sub) });
});

/** Permanent delete. Body: { "confirm": "Home vs Away" } must equal the match name exactly. */
export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
  const confirm = typeof body.confirm === "string" ? body.confirm : undefined;
  const deleted = await deleteMatch((await params).id, admin.sub, confirm);
  return NextResponse.json({ ok: true, deleted });
});
