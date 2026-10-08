import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { resultSchema } from "@/lib/validation";
import { previewResult } from "@/lib/results";

/** Step 1 of the two-step finalization. Computes winners/losers, writes nothing. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const input = await readJson(req, resultSchema);
  return NextResponse.json(await previewResult((await params).id, input));
});
