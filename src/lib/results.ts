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
  // The score winner is drawn at random inside finalizeResult, never pre-selected here.
  const exactScoreCount = session.enableScorePrediction
    ? await prisma.prediction.count({ where: { sessionId, predictedHomeScore: input.homeScore, predictedAwayScore: input.awayScore } })
    : 0;
  // Score sessions: only the exact score is a win. Winner-pick sessions: the outcome decides.
  const winners = session.enableScorePrediction ? exactScoreCount : (rows.find((r) => r.selectedOutcome === winningOutcome)?._count._all ?? 0);
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
      throw new ApiError(409, "ALREADY_FINAL", "This result is already finalized and cannot be changed.");
    }
    const now = await dbNow(tx);
    const result = await tx.matchResult.upsert({
      where: { matchId },
      create: { matchId, homeScore: input.homeScore, awayScore: input.awayScore, winningOutcome, resultStatus: "FINAL", version: 1, finalizedAt: now, finalizedById: actorId },
      update: { homeScore: input.homeScore, awayScore: input.awayScore, winningOutcome, resultStatus: "FINAL", version: { increment: 1 }, finalizedAt: now, finalizedById: actorId },
    });

    const where = { session: { matchId } };
    // Winner-pick sessions: the outcome decides WINNER / LOST.
    const pickWhere = { session: { matchId, enableScorePrediction: false } };
    const pickWinners = await tx.prediction.updateMany({ where: { ...pickWhere, selectedOutcome: winningOutcome }, data: { resultStatus: "WINNER" } });
    const pickLosers = await tx.prediction.updateMany({ where: { ...pickWhere, selectedOutcome: { not: winningOutcome } }, data: { resultStatus: "LOST" } });
    // Score sessions: only the exact score is a win; the right team with a wrong score is LOST.
    // Whether a score is correct is a plain comparison; who gets the score prize among the correct ones
    // is a raffle: a cryptographically secure random draw, recorded in the audit log.
    const scoreWhere = { session: { matchId, enableScorePrediction: true } };
    const scoreAll = await tx.prediction.updateMany({ where: scoreWhere, data: { resultStatus: "LOST", scoreCorrect: false, scoreWinner: false } });
    const scoreExact = await tx.prediction.updateMany({
      where: { ...scoreWhere, predictedHomeScore: input.homeScore, predictedAwayScore: input.awayScore },
      data: { resultStatus: "WINNER", scoreCorrect: true },
    });
    await tx.predictionSession.updateMany({ where: { matchId, status: "SCHEDULED" }, data: { status: "COMPLETED" } });

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

    await audit(tx, { actorId, action: "ADMIN_RESULT_FINALIZED", entityType: "MatchResult", entityId: result.id, after: result });
    return {
      result,
      winners: pickWinners.count + scoreExact.count,
      losers: pickLosers.count + (scoreAll.count - scoreExact.count),
      scoreWinners,
      notificationsQueued: preds.length + scoreWinners,
    };
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
