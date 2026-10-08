import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const REQUIRED = ["DATABASE_URL", "AUTH_SECRET", "APP_URL"];

/**
 * Deployment self-check (no secrets are returned): which required variables are missing, whether the
 * database answers, whether migrations were applied and whether an admin account exists.
 */
export async function GET() {
  const missingEnv = REQUIRED.filter((k) => !process.env[k]?.trim());
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) missingEnv.push("AUTH_SECRET (shorter than 32 characters)");

  let database: "ok" | "unreachable" = "unreachable";
  let migrations: "ok" | "missing" | "unknown" = "unknown";
  let adminAccounts: number | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "ok";
    try {
      adminAccounts = await prisma.adminUser.count();
      migrations = "ok";
    } catch {
      migrations = "missing";
    }
  } catch {
    database = "unreachable";
  }

  const ok = missingEnv.length === 0 && database === "ok" && migrations === "ok" && (adminAccounts ?? 0) > 0;
  const hints: string[] = [];
  if (missingEnv.length) hints.push(`Set ${missingEnv.join(", ")} in the hosting environment and redeploy.`);
  if (database === "unreachable") hints.push("DATABASE_URL does not reach a PostgreSQL server (a local docker URL does not work on a host).");
  if (migrations === "missing") hints.push("Run `npm run db:deploy` against this database (the Vercel build does this when DATABASE_URL is set).");
  if (database === "ok" && migrations === "ok" && !adminAccounts) hints.push("No admin account: run `npm run admin:set -- <email> <password> \"<name>\"` against this database, or set SEED_ADMIN_* and redeploy.");

  return NextResponse.json(
    { ok, database, migrations, adminAccounts, missingEnv, hints, loginRequired: process.env.AUTH_DISABLED !== "true", time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
