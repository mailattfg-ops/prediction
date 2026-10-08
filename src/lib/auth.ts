import "server-only";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { ApiError } from "./http";
import { SESSION_COOKIE, SESSION_TTL_SEC, authDisabled, verifySessionToken, type AdminSession } from "./jwt";

export { authDisabled, signSession } from "./jwt";

/** In open-access mode every visitor acts as the first admin account (created if none exists) so audit logs and foreign keys stay valid. */
async function openAccessAdmin(): Promise<AdminSession> {
  const user =
    (await prisma.adminUser.findFirst({ orderBy: { createdAt: "asc" } })) ??
    (await prisma.adminUser.create({
      data: { email: "open-access@local", name: "Open access", passwordHash: await hashPassword(randomBytes(24).toString("hex")), role: "SUPER_ADMIN" },
    }));
  return { sub: user.id, email: user.email, name: user.name, role: user.role };
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SEC,
};

export async function getAdmin(): Promise<AdminSession | null> {
  if (authDisabled()) return openAccessAdmin();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

/** Verifies the cookie, the role, and (for mutations) that the request came from our own origin. */
export async function requireAdmin(req: Request, role?: Role): Promise<AdminSession> {
  const admin = await getAdmin();
  if (!admin) throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
  if (role === "SUPER_ADMIN" && admin.role !== "SUPER_ADMIN") {
    throw new ApiError(403, "FORBIDDEN", "Super admin privileges are required for this action.");
  }
  if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);
  return admin;
}

function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser client; the httpOnly cookie is still required
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "FORBIDDEN", "Invalid origin.");
  }
  if (originHost !== host) throw new ApiError(403, "FORBIDDEN", "Cross-origin request blocked.");
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
