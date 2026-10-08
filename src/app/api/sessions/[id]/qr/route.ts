import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { getSession } from "@/lib/sessions";
import { predictionUrl, qrPng, qrSvg } from "@/lib/qr";

export const GET = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const session = await getSession((await params).id);
  const format = new URL(req.url).searchParams.get("format") === "svg" ? "svg" : "png";
  const url = predictionUrl(session.secureToken);
  const name = `qr-${session.match.homeTeam}-vs-${session.match.awayTeam}`.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const body = format === "svg" ? await qrSvg(url) : new Uint8Array(await qrPng(url));
  return new Response(body, {
    headers: {
      "Content-Type": format === "svg" ? "image/svg+xml" : "image/png",
      "Content-Disposition": `attachment; filename="${name}.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
