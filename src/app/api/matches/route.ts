import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { matchSchema } from "@/lib/validation";
import { createMatch, listMatches } from "@/lib/matches";

export const GET = route(async (req) => {
  await requireAdmin(req);
  return NextResponse.json({ matches: await listMatches() });
});

export const POST = route(async (req) => {
  const admin = await requireAdmin(req);
  const input = await readJson(req, matchSchema);
  return NextResponse.json({ match: await createMatch(input, admin.sub) }, { status: 201 });
});
