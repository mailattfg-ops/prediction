import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { listPredictions } from "@/lib/predictions";
import { getSession } from "@/lib/sessions";

export const GET = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = await params;
  await getSession(id);
  const winnersOnly = new URL(req.url).searchParams.get("winners") === "1";
  return NextResponse.json({ predictions: await listPredictions(id, { winnersOnly }) });
});
