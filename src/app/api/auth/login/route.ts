import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, getIp, readJson, route } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { sessionCookieOptions, signSession, verifyPassword } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/jwt";
import { assertRateLimit } from "@/lib/rate-limit";

export const POST = route(async (req) => {
  assertRateLimit(`login:${getIp(req)}`, 10, 15 * 60_000);
  const { email, password } = await readJson(req, loginSchema);
  const user = await prisma.adminUser.findUnique({ where: { email } });
  const ok = user && (await verifyPassword(password, user.passwordHash));
  if (!ok) throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  const token = await signSession({ sub: user.id, email: user.email, name: user.name, role: user.role });
  const res = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
});
