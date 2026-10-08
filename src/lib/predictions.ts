import { Prisma } from "@prisma/client";
import { prisma, dbNow } from "./db";
import { ApiError } from "./http";
import { decideSubmission } from "./window";
import { buildLateEntrySchema, buildSubmissionSchema } from "./validation";
import { enqueueNotifications } from "./notifications/queue";

export const DUPLICATE_MESSAGE = "You have already submitted your prediction for this match.";
export const LATE_DUPLICATE_MESSAGE = "You have already registered for this match.";

export type SubmitMeta = { ip?: string; userAgent?: string };

/**
 * The prediction transaction (spec section 26). Nothing from the client is trusted for timing:
 * the window is checked against the database clock inside the transaction, and duplicates are
 * enforced by the UNIQUE(sessionId, participantId) constraint, not only by the lookup.
 */
export async function submitPrediction(token: string, rawBody: unknown, meta: SubmitMeta = {}) {
  const session = await prisma.predictionSession.findUnique({
    where: { secureToken: token },
    include: { match: true, fields: { orderBy: { sortOrder: "asc" } } },
  });
  // Fast fail with the server clock before validating the body. The authoritative check is below.
  const pre = decideSubmission(session, new Date());
  if (!pre.ok || !session) throw new ApiError(pre.ok ? 404 : pre.httpStatus, pre.ok ? "NOT_FOUND" : pre.code, pre.ok ? "" : pre.message);

  const data = buildSubmissionSchema(session.fields, session.allowDraw, session.requireConsent, session.enableScorePrediction).parse(rawBody);

  try {
    return await prisma.$transaction(async (tx) => {
      const fresh = await tx.predictionSession.findUnique({
        where: { id: session.id },
        select: { status: true, startTime: true, expiryTime: true, archivedAt: true },
      });
      const now = await dbNow(tx);
      const decision = decideSubmission(fresh, now);
      if (!decision.ok) throw new ApiError(decision.httpStatus, decision.code, decision.message);

      const participant = await tx.participant.upsert({
        where: { mobile: data.mobile },
        create: { mobile: data.mobile, fullName: data.fullName, email: data.email },
        update: { fullName: data.fullName, email: data.email },
      });

      // Secondary identity check: one prediction per session + email as well as session + mobile.
      const byEmail = await tx.prediction.findFirst({
        where: { sessionId: session.id, participant: { email: data.email } },
        select: { id: true },
      });
      if (byEmail) throw new ApiError(409, "DUPLICATE", DUPLICATE_MESSAGE);

      const prediction = await tx.prediction.create({
        data: {
          sessionId: session.id,
          participantId: participant.id,
          selectedOutcome: data.selectedOutcome,
          predictedHomeScore: data.predictedHomeScore ?? null,
          predictedAwayScore: data.predictedAwayScore ?? null,
          customData: data.customData as Prisma.InputJsonValue,
          consentGiven: data.consent === true,
          submittedAt: now,
          ipAddress: meta.ip?.slice(0, 64),
          userAgent: meta.userAgent?.slice(0, 300),
        },
      });

      await enqueueNotifications(tx, [{ type: "PREDICTION_SUBMITTED", participant, prediction, session, match: session.match }]);
      return { prediction, participant, session };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "DUPLICATE", DUPLICATE_MESSAGE);
    }
    throw e;
  }
}

/**
 * Timed-out registration: after the window has closed, store the participant's details only.
 * No outcome, no score, never evaluated, never notified as a prediction. Accepted only once the
 * database clock is past expiryTime, and only for sessions that opted in (collectLateEntries).
 */
export async function submitLateEntry(token: string, rawBody: unknown, meta: SubmitMeta = {}) {
  const session = await prisma.predictionSession.findUnique({
    where: { secureToken: token },
    include: { match: true, fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!session || session.archivedAt || session.status === "DRAFT") throw new ApiError(404, "NOT_FOUND", "This QR code is not valid.");
  if (session.status === "CANCELLED") throw new ApiError(410, "CANCELLED", "This prediction session has been cancelled.");
  if (!session.collectLateEntries) throw new ApiError(410, "EXPIRED", "Prediction window has expired.");

  const data = buildLateEntrySchema(session.fields, session.requireConsent).parse(rawBody);

  try {
    return await prisma.$transaction(async (tx) => {
      const now = await dbNow(tx);
      if (now.getTime() < session.expiryTime.getTime()) {
        throw new ApiError(409, "WINDOW_OPEN", "Predictions are still open for this match. Please submit your prediction instead.");
      }
      const participant = await tx.participant.upsert({
        where: { mobile: data.mobile },
        create: { mobile: data.mobile, fullName: data.fullName, email: data.email },
        update: { fullName: data.fullName, email: data.email },
      });
      const predicted = await tx.prediction.findUnique({
        where: { sessionId_participantId: { sessionId: session.id, participantId: participant.id } },
        select: { id: true },
      });
      if (predicted) throw new ApiError(409, "DUPLICATE", DUPLICATE_MESSAGE);
      const entry = await tx.lateEntry.create({
        data: {
          sessionId: session.id,
          participantId: participant.id,
          customData: data.customData as Prisma.InputJsonValue,
          consentGiven: data.consent === true,
          submittedAt: now,
          ipAddress: meta.ip?.slice(0, 64),
          userAgent: meta.userAgent?.slice(0, 300),
        },
      });
      return { entry, participant, session };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "DUPLICATE", LATE_DUPLICATE_MESSAGE);
    }
    throw e;
  }
}

export function listPredictions(sessionId: string, opts: { winnersOnly?: boolean } = {}) {
  return prisma.prediction.findMany({
    where: { sessionId, ...(opts.winnersOnly ? { resultStatus: "WINNER" as const } : {}) },
    include: { participant: true },
    orderBy: { submittedAt: "asc" },
  });
}
