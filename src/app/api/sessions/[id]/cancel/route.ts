import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { cancelSession } from "@/lib/sessions";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  return NextResponse.json({ session: await cancelSession((await params).id, admin.sub) });
});
