import type { Outcome, PredictionResult } from "@prisma/client";
import { prisma, dbNow } from "./db";
import { ApiError } from "./http";
import { audit } from "./audit";
import { getSession } from "./sessions";
import { enqueueNotifications } from "./notifications/queue";
import { DRAW_METHOD, drawWinner } from "./draw";
import type { ResultInput } from "./validation";

/** Deterministic. The football score is the only input. */
export function determineOutcome(homeScore: number, awayScore: number): Outcome {
  if (homeScore > awayScore) return "HOME";
  if (awayScore > homeScore) return "AWAY";
  return "DRAW";
}

export function evaluatePrediction(selected: Outcome, winning: Outcome): PredictionResult {
  return selected === winning ? "WINNER" : "LOST";
}

export const resolveOutcome = (input: ResultInput) => input.winningOutcome ?? determineOutcome(input.homeScore, input.awayScore);

/** Step 1 of finalization: compute what would happen. Writes nothing. */
export async function previewResult(sessionId: string, input: ResultInput) {
  const session = await getSession(sessionId);
  const autoOutcome = determineOutcome(input.homeScore, input.awayScore);
  const winningOutcome = resolveOutcome(input);
  // Counts are for THIS session (what the admin is looking at). The result itself belongs to the match,
  // so finalizing also evaluates every other session of the same match; those are listed separately.
  const [rows, otherSessions] = await Promise.all([
    prisma.prediction.groupBy({ by: ["selectedOutcome"], where: { sessionId }, _count: { _all: true } }),
    prisma.predictionSession.findMany({
      where: { matchId: session.matchId, id: { not: sessionId }, archivedAt: null, status: { not: "CANCELLED" } },
      select: { id: true, eventName: true, campaignName: true, startTime: true, _count: { select: { predictions: true } } },
    }),
  ]);
  const total = rows.reduce((a, r) => a + r._count._all, 0);
  const winners = rows.find((r) => r.selectedOutcome === winningOutcome)?._count._all ?? 0;
  // The score winner is drawn at random inside finalizeResult, never pre-selected here.
  const exactScoreCount = session.enableScorePrediction
    ? await prisma.prediction.count({ where: { sessionId, predictedHomeScore: input.homeScore, predictedAwayScore: input.awayScore } })
    : 0;
  return {
    otherSessions: otherSessions.map((s) => ({
      id: s.id,
      label: s.eventName || s.campaignName || `Session starting ${s.startTime.toISOString()}`,
      predictions: s._count.predictions,
    })),
    scoreEnabled: session.enableScorePrediction,
    exactScoreCount,
    match: { homeTeam: session.match.homeTeam, awayTeam: session.match.awayTeam },
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    autoOutcome,
    winningOutcome,
    overridden: winningOutcome !== autoOutcome,
    total,
    winners,
    losers: total - winners,
    alreadyFinal: session.match.result?.resultStatus === "FINAL",
  };
}

/**
 * Step 2: one transaction that stores the result, evaluates every prediction for the match,
 * marks sessions COMPLETED and queues result notifications. Refuses if already FINAL.
 */
export async function finalizeResult(sessionId: string, input: ResultInput, actorId: string) {
  const session = await getSession(sessionId);
  if (session.status === "CANCELLED") throw new ApiError(409, "LOCKED", "Cancelled sessions have no result.");
  const winningOutcome = resolveOutcome(input);
  const matchId = session.matchId;

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Match" WHERE id = ${matchId} FOR UPDATE`; // serialize concurrent finalizations
    const existing = await tx.matchResult.findUnique({ where: { matchId } });
    if (existing?.resultStatus === "FINAL") {
      throw new ApiError(409, "ALREADY_FINAL", "This result is already finalized. Reopen it before changing it.");
    }
    const now = await dbNow(tx);
    const result = await tx.matchResult.upsert({
      where: { matchId },
      create: { matchId, homeScore: input.homeScore, awayScore: input.awayScore, winningOutcome, resultStatus: "FINAL", version: 1, finalizedAt: now, finalizedById: actorId },
      update: { homeScore: input.homeScore, awayScore: input.awayScore, winningOutcome, resultStatus: "FINAL", version: { increment: 1 }, finalizedAt: now, finalizedById: actorId },
    });

    const where = { session: { matchId } };
    const winners = await tx.prediction.updateMany({ where: { ...where, selectedOutcome: winningOutcome }, data: { resultStatus: "WINNER" } });
    const losers = await tx.prediction.updateMany({ where: { ...where, selectedOutcome: { not: winningOutcome } }, data: { resultStatus: "LOST" } });
    await tx.predictionSession.updateMany({ where: { matchId, status: "SCHEDULED" }, data: { status: "COMPLETED" } });

    // Exact-score evaluation. Whether a score is correct is a plain comparison; who wins the score prize
    // among the correct ones is a raffle: a cryptographically secure random draw, recorded in the audit log.
    await tx.prediction.updateMany({ where: { ...where, predictedHomeScore: { not: null } }, data: { scoreCorrect: false, scoreWinner: false } });
    await tx.prediction.updateMany({
      where: { ...where, predictedHomeScore: input.homeScore, predictedAwayScore: input.awayScore },
      data: { scoreCorrect: true },
    });
    const scoreSessions = await tx.predictionSession.findMany({ where: { matchId, enableScorePrediction: true }, select: { id: true } });
    let scoreWinners = 0;
    for (const ss of scoreSessions) {
      const pool = await tx.prediction.findMany({ where: { sessionId: ss.id, scoreCorrect: true }, select: { id: true }, orderBy: { id: "asc" } });
      if (!pool.length) continue;
      const { winner, order } = drawWinner(pool.map((p) => p.id));
      if (!winner) continue;
      await tx.prediction.update({ where: { id: winner }, data: { scoreWinner: true } });
      await audit(tx, {
        actorId,
        action: "SCORE_WINNER_DRAWN",
        entityType: "PredictionSession",
        entityId: ss.id,
        after: { method: DRAW_METHOD, poolSize: pool.length, pool: pool.map((p) => p.id), order, winnerPredictionId: winner, drawnAt: now },
      });
      scoreWinners++;
    }

    const preds = await tx.prediction.findMany({ where, include: { participant: true, session: { include: { match: true } } } });
    const base = (p: (typeof preds)[number]) => ({ participant: p.participant, prediction: p, session: p.session, match: p.session.match, result });
    await enqueueNotifications(tx, [
      ...preds.map((p) => ({ type: p.resultStatus === "WINNER" ? ("PREDICTION_WINNER" as const) : ("PREDICTION_LOST" as const), ...base(p) })),
      ...preds.filter((p) => p.scoreWinner).map((p) => ({ type: "SCORE_WINNER" as const, ...base(p) })),
    ]);

    await audit(tx, {
      actorId,
      action: existing ? "ADMIN_RESULT_CORRECTED" : "ADMIN_RESULT_FINALIZED",
      entityType: "MatchResult",
      entityId: result.id,
      before: existing ?? undefined,
      after: result,
    });
    return { result, winners: winners.count, losers: losers.count, scoreWinners, notificationsQueued: preds.length + scoreWinners };
  });
}

/** The most recent recorded score draw for a session: method, pool size and the full draw order with names. */
export async function getScoreDraw(sessionId: string) {
  const log = await prisma.auditLog.findFirst({
    where: { action: "SCORE_WINNER_DRAWN", entityType: "PredictionSession", entityId: sessionId },
    orderBy: { createdAt: "desc" },
  });
  if (!log) return null;
  const data = log.after as { method: string; poolSize: number; order: string[]; winnerPredictionId: string };
  const preds = await prisma.prediction.findMany({ where: { id: { in: data.order } }, include: { participant: { select: { fullName: true } } } });
  const byId = new Map(preds.map((p) => [p.id, p]));
  return {
    drawnAt: log.createdAt,
    method: data.method,
    poolSize: data.poolSize,
    winnerPredictionId: data.winnerPredictionId,
    order: data.order.flatMap((id) => {
      const p = byId.get(id);
      return p ? [{ id: p.id, name: p.participant.fullName, submittedAt: p.submittedAt, isWinner: p.id === data.winnerPredictionId }] : [];
    }),
  };
}

/** SUPER_ADMIN only (enforced by the route). Unlocks the result and resets every evaluation to PENDING. */
export async function reopenResult(sessionId: string, actorId: string) {
  const session = await getSession(sessionId);
  const matchId = session.matchId;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Match" WHERE id = ${matchId} FOR UPDATE`;
    const existing = await tx.matchResult.findUnique({ where: { matchId } });
    if (!existing || existing.resultStatus !== "FINAL") throw new ApiError(409, "NOT_FINAL", "There is no finalized result to reopen.");
    const result = await tx.matchResult.update({ where: { matchId }, data: { resultStatus: "PENDING", finalizedAt: null } });
    await tx.prediction.updateMany({ where: { session: { matchId } }, data: { resultStatus: "PENDING", scoreCorrect: null, scoreWinner: false } });
    await tx.predictionSession.updateMany({ where: { matchId, status: "COMPLETED" }, data: { status: "SCHEDULED" } });
    await audit(tx, { actorId, action: "ADMIN_RESULT_REOPENED", entityType: "MatchResult", entityId: result.id, before: existing, after: result });
    return result;
  });
}
