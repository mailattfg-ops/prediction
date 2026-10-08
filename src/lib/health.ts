import "server-only";
import { prisma } from "./db";
import { authDisabled } from "./auth";
import { appUrl } from "./qr";

/**
 * Deployment self-check (never returns secret values): missing variables, database reachability,
 * migrations and admin accounts, plus plain-language hints. Used by /api/health and the admin console.
 */
export async function checkHealth() {
  const loginRequired = !authDisabled();
  const hasDb = !!process.env.DATABASE_URL?.trim();
  const missingEnv: string[] = [];
  if (!hasDb) missingEnv.push("DATABASE_URL");
  if (loginRequired && (process.env.AUTH_SECRET?.length ?? 0) < 32) missingEnv.push("AUTH_SECRET (32+ characters)");
  if (appUrl().includes("localhost")) missingEnv.push("APP_URL");

  let database: "ok" | "unreachable" = "unreachable";
  let migrations: "ok" | "missing" | "unknown" = "unknown";
  let adminAccounts: number | null = null;
  if (hasDb) {
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
  }

  const hints: string[] = [];
  if (!hasDb) {
    hints.push(
      "No database is connected. On Vercel open Storage → Create Database → Neon (free), connect it to this project, then redeploy. Elsewhere set DATABASE_URL to a hosted PostgreSQL.",
    );
  }
  const otherMissing = missingEnv.filter((k) => k !== "DATABASE_URL");
  if (otherMissing.length) hints.push(`Set ${otherMissing.join(", ")} in the hosting environment and redeploy.`);
  if (hasDb && database === "unreachable") {
    hints.push("DATABASE_URL does not reach a PostgreSQL server. A localhost or docker address only works on your own computer.");
  }
  if (migrations === "missing") hints.push("The database has no tables yet: redeploy (the Vercel build applies migrations) or run `npm run db:deploy` against it.");
  if (loginRequired && migrations === "ok" && !adminAccounts) {
    hints.push('No admin account: run `npm run admin:set -- <email> <password> "<name>"` against this database, or set SEED_ADMIN_* and redeploy.');
  }

  const ok = !missingEnv.length && database === "ok" && migrations === "ok" && (!loginRequired || (adminAccounts ?? 0) > 0);
  return { ok, database, migrations, adminAccounts, missingEnv, hints, loginRequired, time: new Date().toISOString() };
}
