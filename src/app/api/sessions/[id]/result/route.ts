import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { resultSchema } from "@/lib/validation";
import { finalizeResult } from "@/lib/results";

/** Step 2: finalize. Idempotency: a FINAL result is refused with 409; finalized results are permanent. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const input = await readJson(req, resultSchema);
  return NextResponse.json(await finalizeResult((await params).id, input, admin.sub));
});
