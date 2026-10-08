import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { matchSchema } from "@/lib/validation";
import { deleteMatch, getMatch, updateMatch } from "@/lib/matches";

export const GET = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  return NextResponse.json({ match: await getMatch((await params).id) });
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const input = await readJson(req, matchSchema);
  return NextResponse.json({ match: await updateMatch((await params).id, input, admin.sub) });
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  await deleteMatch((await params).id, admin.sub);
  return NextResponse.json({ ok: true });
});
