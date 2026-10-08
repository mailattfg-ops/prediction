import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { ApiError } from "./http";
import { SESSION_COOKIE, SESSION_TTL_SEC, verifySessionToken, type AdminSession } from "./jwt";

export { signSession } from "./jwt";

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SEC,
};

export async function getAdmin(): Promise<AdminSession | null> {
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
