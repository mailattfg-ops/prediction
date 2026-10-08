import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/jwt";

/** Gate for the admin UI and admin APIs. Handlers re-verify the cookie and check roles themselves. */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // AUTH_DISABLED=true: no login at all; the login page just forwards to the dashboard.
  if (process.env.AUTH_DISABLED === "true") {
    return pathname === "/admin/login" ? NextResponse.redirect(new URL("/admin", req.url)) : NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const admin = token ? await verifySessionToken(token) : null;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return admin ? NextResponse.redirect(new URL("/admin", req.url)) : NextResponse.next();
    if (!admin) {
      const url = new URL("/admin/login", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  if (!admin) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401 });
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/sessions/:path*", "/api/matches/:path*", "/api/stats"],
};
