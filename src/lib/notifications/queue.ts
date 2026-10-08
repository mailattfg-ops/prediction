import type { Match, MatchResult, NotificationType, Participant, Prediction, PredictionSession } from "@prisma/client";
import { prisma, type Tx } from "../db";
import { audit } from "../audit";
import { fmtDate, fmtDateTime, outcomeLabel } from "../format";
import { renderParams, renderText, templateFor, type TemplateVars } from "./templates";

export type EnqueueItem = {
  type: NotificationType;
  participant: Participant;
  prediction: Prediction;
  session: PredictionSession;
  match: Match;
  result?: MatchResult | null;
};

export function buildVars({ participant, prediction, match, result }: EnqueueItem): TemplateVars {
  return {
    name: participant.fullName,
    home_team: match.homeTeam,
    away_team: match.awayTeam,
    predicted_team: outcomeLabel(prediction.selectedOutcome, match),
    home_score: result ? String(result.homeScore) : "",
    away_score: result ? String(result.awayScore) : "",
    match_date: fmtDate(match.kickoffAt),
    submission_time: fmtDateTime(prediction.submittedAt),
    result: result ? (result.winningOutcome === "DRAW" ? "Draw" : `${outcomeLabel(result.winningOutcome, match)} won`) : "",
    predicted_score: prediction.predictedHomeScore != null ? `${prediction.predictedHomeScore}-${prediction.predictedAwayScore}` : "",
  };
}

/** Writes notification jobs inside the caller's transaction. Sending happens later, in the worker. */
export async function enqueueNotifications(tx: Tx, items: EnqueueItem[]): Promise<number> {
  if (!items.length) return 0;
  const data = items.map((item) => {
    const vars = buildVars(item);
    const t = templateFor(item.type, vars);
    return {
      participantId: item.participant.id,
      predictionId: item.prediction.id,
      sessionId: item.session.id,
      type: item.type,
      templateName: t.name,
      phoneNumber: item.participant.mobile,
      payload: { language: t.language, params: renderParams(t, vars), text: renderText(t, vars) },
    };
  });
  const r = await tx.notification.createMany({ data });
  return r.count;
}

const TYPES: NotificationType[] = ["PREDICTION_SUBMITTED", "PREDICTION_WINNER", "PREDICTION_LOST", "SCORE_WINNER", "RESULT_ANNOUNCEMENT"];
const ALWAYS_SHOWN = new Set<NotificationType>(["PREDICTION_SUBMITTED", "PREDICTION_WINNER", "PREDICTION_LOST"]);

export async function notificationStats(sessionId: string) {
  const rows = await prisma.notification.groupBy({ by: ["type", "status"], where: { sessionId }, _count: { _all: true } });
  const sum = (type: NotificationType, status?: string) =>
    rows.filter((r) => r.type === type && (!status || r.status === status)).reduce((a, r) => a + r._count._all, 0);
  return TYPES.map((type) => ({
    type,
    total: sum(type),
    sent: sum(type, "SENT"),
    failed: sum(type, "FAILED"),
    queued: sum(type, "QUEUED") + sum(type, "RETRYING"),
  })).filter((r) => r.total > 0 || ALWAYS_SHOWN.has(r.type));
}

export async function retryFailed(sessionId: string, actorId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.notification.updateMany({
      where: { sessionId, status: "FAILED" },
      data: { status: "QUEUED", attempts: 0, nextAttemptAt: new Date(), errorMessage: null },
    });
    if (r.count) {
      await audit(tx, { actorId, action: "NOTIFICATIONS_RETRIED", entityType: "Notification", entityId: sessionId, after: { count: r.count } });
    }
    return r.count;
  });
}

export function listNotifications(sessionId: string, status?: string) {
  return prisma.notification.findMany({
    where: { sessionId, ...(status ? { status: status as never } : {}) },
    include: { participant: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}
