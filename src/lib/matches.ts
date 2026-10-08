import { prisma } from "./db";
import { ApiError } from "./http";
import { audit } from "./audit";
import type { MatchInput } from "./validation";

export const listMatches = () =>
  prisma.match.findMany({ include: { result: true, _count: { select: { sessions: true } } }, orderBy: { kickoffAt: "desc" } });

export async function getMatch(id: string) {
  const m = await prisma.match.findUnique({ where: { id }, include: { result: true } });
  if (!m) throw new ApiError(404, "NOT_FOUND", "Match not found.");
  return m;
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

export async function deleteMatch(id: string, actorId: string) {
  const before = await getMatch(id);
  const sessions = await prisma.predictionSession.count({ where: { matchId: id } });
  if (sessions) throw new ApiError(409, "IN_USE", "This match has prediction sessions. Archive those first.");
  return prisma.$transaction(async (tx) => {
    await tx.match.delete({ where: { id } });
    await audit(tx, { actorId, action: "MATCH_DELETED", entityType: "Match", entityId: id, before });
  });
}
