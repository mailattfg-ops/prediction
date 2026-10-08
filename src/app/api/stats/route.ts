import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { dashboardStats } from "@/lib/sessions";

export const GET = route(async (req) => {
  await requireAdmin(req);
  return NextResponse.json(await dashboardStats());
});
