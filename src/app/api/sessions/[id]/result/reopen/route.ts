import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { reopenResult } from "@/lib/results";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req, "SUPER_ADMIN");
  return NextResponse.json({ result: await reopenResult((await params).id, admin.sub) });
});
