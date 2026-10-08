import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma, dbNow } from "./db";
import { ApiError } from "./http";
import { audit } from "./audit";
import { computeExpiry, effectiveStatus } from "./window";
import { fmtDateTime } from "./format";
import type { SessionInput } from "./validation";

/** 128 random bits, URL-safe. Never derived from a database id. */
export const generateToken = () => randomBytes(16).toString("base64url");

export const sessionInclude = {
  match: { include: { result: true } },
  fields: { orderBy: { sortOrder: "asc" as const } },
  _count: { select: { predictions: true, lateEntries: true } },
} satisfies Prisma.PredictionSessionInclude;

export type SessionRow = Prisma.PredictionSessionGetPayload<{ include: typeof sessionInclude }>;
export type SessionWithStatus = SessionRow & { effectiveStatus: ReturnType<typeof effectiveStatus> };

const withStatus = (s: SessionRow, now: Date): SessionWithStatus => ({ ...s, effectiveStatus: effectiveStatus(s, now) });

const summary = (s: SessionRow) => ({
  matchId: s.matchId,
  startTime: s.startTime,
  expiryTime: s.expiryTime,
  durationMinutes: s.durationMinutes,
  status: s.status,
  allowDraw: s.allowDraw,
  enableScorePrediction: s.enableScorePrediction,
  collectLateEntries: s.collectLateEntries,
  campaignName: s.campaignName,
  eventName: s.eventName,
  fields: s.fields.map((f) => ({ key: f.key, type: f.type, required: f.required })),
});

export async function listSessions(): Promise<SessionWithStatus[]> {
  const now = new Date();
  const rows = await prisma.predictionSession.findMany({
    where: { archivedAt: null },
    include: sessionInclude,
    orderBy: { startTime: "desc" },
  });
  return rows.map((r) => withStatus(r, now));
}

export async function getSession(id: string): Promise<SessionWithStatus> {
  const s = await prisma.predictionSession.findFirst({ where: { id, archivedAt: null }, include: sessionInclude });
  if (!s) throw new ApiError(404, "NOT_FOUND", "Session not found.");
  return withStatus(s, new Date());
}

function toData(input: SessionInput) {
  return {
    matchId: input.matchId,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    expiryTime: computeExpiry(input.startTime, input.durationMinutes),
    status: input.status,
    allowDraw: input.allowDraw,
    showResultsToParticipants: input.showResultsToParticipants,
    requireConsent: input.requireConsent,
    enableScorePrediction: input.enableScorePrediction,
    collectLateEntries: input.collectLateEntries,
    campaignName: input.campaignName ?? null,
    eventName: input.eventName ?? null,
    fields: { create: input.fields.map((f, i) => ({ ...f, sortOrder: i })) },
  };
}

async function assertMatchExists(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true } });
  if (!match) throw new ApiError(422, "VALIDATION", "Please check the highlighted fields.", { matchId: "Match not found" });
}

export async function createSession(input: SessionInput, actorId: string) {
  await assertMatchExists(input.matchId);
  return prisma.$transaction(async (tx) => {
    const s = await tx.predictionSession.create({
      data: { ...toData(input), secureToken: generateToken(), createdById: actorId },
      include: sessionInclude,
    });
    await audit(tx, { actorId, action: "SESSION_CREATED", entityType: "PredictionSession", entityId: s.id, after: summary(s) });
    return withStatus(s, new Date());
  });
}

export async function updateSession(id: string, input: SessionInput, actorId: string) {
  const before = await getSession(id);
  if (before.status === "CANCELLED" || before.status === "COMPLETED") {
    throw new ApiError(409, "LOCKED", "Cancelled or completed sessions cannot be edited.");
  }
  if (before.enableScorePrediction !== input.enableScorePrediction && before._count.predictions > 0) {
    throw new ApiError(409, "LOCKED", "The prediction mode cannot be changed after predictions have been submitted.");
  }
  await assertMatchExists(input.matchId);
  return prisma.$transaction(async (tx) => {
    await tx.formField.deleteMany({ where: { sessionId: id } });
    const s = await tx.predictionSession.update({ where: { id }, data: toData(input), include: sessionInclude });
    await audit(tx, {
      actorId, action: "SESSION_UPDATED", entityType: "PredictionSession", entityId: id,
      before: summary(before), after: summary(s),
    });
    return withStatus(s, new Date());
  });
}

export async function cancelSession(id: string, actorId: string) {
  const before = await getSession(id);
  if (before.status === "COMPLETED") throw new ApiError(409, "LOCKED", "Completed sessions cannot be cancelled.");
  return prisma.$transaction(async (tx) => {
    const s = await tx.predictionSession.update({ where: { id }, data: { status: "CANCELLED" }, include: sessionInclude });
    await audit(tx, {
      actorId, action: "SESSION_CANCELLED", entityType: "PredictionSession", entityId: id,
      before: { status: before.status }, after: { status: "CANCELLED" },
    });
    return withStatus(s, new Date());
  });
}

/** Soft delete: the QR stops working and the session leaves every list, but participant data is kept for audit. */
export async function archiveSession(id: string, actorId: string) {
  await getSession(id);
  return prisma.$transaction(async (tx) => {
    const s = await tx.predictionSession.update({ where: { id }, data: { archivedAt: new Date() } });
    await audit(tx, { actorId, action: "SESSION_ARCHIVED", entityType: "PredictionSession", entityId: id });
    return s;
  });
}

export type PublicSession = NonNullable<Awaited<ReturnType<typeof getPublicSession>>>;

/** Everything the participant page needs and nothing it must not see. All times are the server's. */
export async function getPublicSession(token: string) {
  const s = await prisma.predictionSession.findUnique({
    where: { secureToken: token },
    include: { match: { include: { result: true } }, fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!s || s.archivedAt || s.status === "DRAFT") return null;
  const now = await dbNow();
  const final = s.match.result?.resultStatus === "FINAL" ? s.match.result : null;
  const results = s.showResultsToParticipants ? await outcomeSplit(s.id) : null;
  return {
    token,
    status: effectiveStatus(s, now),
    serverTime: now.toISOString(),
    startTime: s.startTime.toISOString(),
    expiryTime: s.expiryTime.toISOString(),
    durationMinutes: s.durationMinutes,
    allowDraw: s.allowDraw,
    requireConsent: s.requireConsent,
    enableScorePrediction: s.enableScorePrediction,
    collectLateEntries: s.collectLateEntries,
    campaignName: s.campaignName,
    eventName: s.eventName,
    match: {
      homeTeam: s.match.homeTeam,
      awayTeam: s.match.awayTeam,
      homeTeamLogo: s.match.homeTeamLogo,
      awayTeamLogo: s.match.awayTeamLogo,
      competition: s.match.competition,
      kickoffAt: s.match.kickoffAt.toISOString(),
      kickoffLabel: fmtDateTime(s.match.kickoffAt), // formatted on the server in the event timezone: no locale-dependent hydration
      venue: s.match.venue,
    },
    fields: s.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options, required: f.required })),
    results,
    finalScore: final ? { homeScore: final.homeScore, awayScore: final.awayScore, winningOutcome: final.winningOutcome } : null,
  };
}

/** Details captured after the window closed (no prediction). */
export function listLateEntries(sessionId: string) {
  return prisma.lateEntry.findMany({ where: { sessionId }, include: { participant: true }, orderBy: { submittedAt: "asc" } });
}

export async function outcomeSplit(sessionId: string) {
  const rows = await prisma.prediction.groupBy({ by: ["selectedOutcome"], where: { sessionId }, _count: { _all: true } });
  const n = (o: string) => rows.find((r) => r.selectedOutcome === o)?._count._all ?? 0;
  const home = n("HOME");
  const away = n("AWAY");
  const draw = n("DRAW");
  return { total: home + away + draw, home, away, draw };
}

export async function sessionStats(sessionId: string) {
  const session = await getSession(sessionId);
  const [split, byResult, times, scoreCorrect, scoreWinner] = await Promise.all([
    outcomeSplit(sessionId),
    prisma.prediction.groupBy({ by: ["resultStatus"], where: { sessionId }, _count: { _all: true } }),
    prisma.prediction.findMany({ where: { sessionId }, select: { submittedAt: true } }),
    prisma.prediction.count({ where: { sessionId, scoreCorrect: true } }),
    prisma.prediction.findFirst({ where: { sessionId, scoreWinner: true }, include: { participant: { select: { fullName: true, mobile: true } } } }),
  ]);
  const n = (r: string) => byResult.find((x) => x.resultStatus === r)?._count._all ?? 0;
  const timeline = Array.from({ length: session.durationMinutes }, () => 0);
  for (const t of times) {
    const i = Math.floor((t.submittedAt.getTime() - session.startTime.getTime()) / 60_000);
    if (i >= 0 && i < timeline.length) timeline[i]++;
  }
  return { session, ...split, winners: n("WINNER"), losers: n("LOST"), pending: n("PENDING"), timeline, scoreCorrect, scoreWinner };
}

export async function dashboardStats() {
  const now = new Date();
  const [sessions, participants, predictions, notifications, perDay] = await Promise.all([
    prisma.predictionSession.findMany({ where: { archivedAt: null }, select: { status: true, startTime: true, expiryTime: true } }),
    prisma.participant.count(),
    prisma.prediction.count(),
    prisma.notification.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "submittedAt") AS day, count(*) AS count
      FROM "Prediction" WHERE "submittedAt" > now() - interval '14 days'
      GROUP BY 1 ORDER BY 1`,
  ]);
  const byStatus: Record<string, number> = {};
  for (const s of sessions) {
    const k = effectiveStatus(s, now);
    byStatus[k] = (byStatus[k] ?? 0) + 1;
  }
  const notif = (st: string) => notifications.find((x) => x.status === st)?._count._all ?? 0;
  return {
    totalSessions: sessions.length,
    activeSessions: byStatus.ACTIVE ?? 0,
    expiredSessions: byStatus.EXPIRED ?? 0,
    scheduledSessions: byStatus.SCHEDULED ?? 0,
    completedSessions: byStatus.COMPLETED ?? 0,
    cancelledSessions: byStatus.CANCELLED ?? 0,
    totalParticipants: participants,
    totalPredictions: predictions,
    notifications: {
      total: notifications.reduce((a, x) => a + x._count._all, 0),
      sent: notif("SENT"),
      failed: notif("FAILED"),
      queued: notif("QUEUED") + notif("RETRYING"),
    },
    perDay: perDay.map((r) => ({ day: r.day.toISOString().slice(0, 10), count: Number(r.count) })),
  };
}
