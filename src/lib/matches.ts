import { prisma } from "./db";
import { ApiError } from "./http";
import { audit } from "./audit";
import type { MatchInput } from "./validation";

export const matchLabel = (m: { homeTeam: string; awayTeam: string }) => `${m.homeTeam} vs ${m.awayTeam}`;

export const listMatches = () =>
  prisma.match.findMany({ include: { result: true, _count: { select: { sessions: true } } }, orderBy: { kickoffAt: "desc" } });

export async function getMatch(id: string) {
  const m = await prisma.match.findUnique({ where: { id }, include: { result: true, _count: { select: { sessions: true } } } });
  if (!m) throw new ApiError(404, "NOT_FOUND", "Match not found.");
  return m;
}

/** Everything a delete would take with it. */
export async function matchUsage(id: string) {
  const [sessions, predictions, lateEntries] = await Promise.all([
    prisma.predictionSession.count({ where: { matchId: id } }),
    prisma.prediction.count({ where: { session: { matchId: id } } }),
    prisma.lateEntry.count({ where: { session: { matchId: id } } }),
  ]);
  return { sessions, predictions, lateEntries };
}

export function createMatch(input: MatchInput, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const m = await tx.match.create({ data: input });
    await audit(tx, { actorId, action: "MATCH_CREATED", entityType: "Match", entityId: m.id, after: m });
    return m;
  });
}

export async function updateMatch(id: string, input: MatchInput, actorId: string) {
  const before = await getMatch(id);
  return prisma.$transaction(async (tx) => {
    const m = await tx.match.update({ where: { id }, data: input });
    await audit(tx, { actorId, action: "MATCH_UPDATED", entityType: "Match", entityId: id, before, after: m });
    return m;
  });
}

/**
 * Permanent delete with GitHub-style confirmation: the caller must send the exact match name
 * ("Home vs Away"). Removes the match, its result, every session with its fields, predictions,
 * timed-out registrations and notification logs. Participant identities are kept because the same
 * person may belong to other sessions.
 */
export async function deleteMatch(id: string, actorId: string, confirmName: string | undefined) {
  const before = await getMatch(id);
  const expected = matchLabel(before);
  if ((confirmName ?? "").trim() !== expected) {
    throw new ApiError(400, "CONFIRMATION_REQUIRED", `Type the match name exactly ("${expected}") to confirm deletion.`);
  }
  const usage = await matchUsage(id);
  return prisma.$transaction(async (tx) => {
    const sessionIds = (await tx.predictionSession.findMany({ where: { matchId: id }, select: { id: true } })).map((s) => s.id);
    if (sessionIds.length) {
      await tx.notification.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.predictionSession.deleteMany({ where: { id: { in: sessionIds } } }); // cascades fields, predictions, late entries
    }
    await tx.match.delete({ where: { id } }); // cascades the match result
    await audit(tx, { actorId, action: "MATCH_DELETED", entityType: "Match", entityId: id, before: { ...before, deleted: usage } });
    return usage;
  });
}
