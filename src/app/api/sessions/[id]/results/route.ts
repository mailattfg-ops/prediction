import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { sessionStats } from "@/lib/sessions";
import { pct } from "@/lib/format";

export const GET = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const s = await sessionStats((await params).id);
  return NextResponse.json({
    total: s.total, home: s.home, away: s.away, draw: s.draw,
    homePct: pct(s.home, s.total), awayPct: pct(s.away, s.total), drawPct: pct(s.draw, s.total),
    winners: s.winners, losers: s.losers, pending: s.pending, winnerPct: pct(s.winners, s.total),
    timeline: s.timeline, result: s.session.match.result,
    scoreEnabled: s.session.enableScorePrediction, scoreCorrect: s.scoreCorrect,
    scoreWinner: s.scoreWinner ? { predictionId: s.scoreWinner.id, name: s.scoreWinner.participant.fullName, submittedAt: s.scoreWinner.submittedAt } : null,
  });
});
