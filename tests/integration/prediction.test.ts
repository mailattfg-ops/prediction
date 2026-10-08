/**
 * Integration tests against a real PostgreSQL (DATABASE_URL from .env). Skipped when it is missing.
 * They exercise the actual transaction: database clock, unique constraints, concurrency, finalization.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AdminUser, Match, SessionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { submitLateEntry, submitPrediction } from "@/lib/predictions";
import { finalizeResult, previewResult } from "@/lib/results";
import { processQueue } from "@/lib/notifications/worker";
import { generateToken, getPublicSession } from "@/lib/sessions";
import { deleteMatch } from "@/lib/matches";

const HAS_DB = !!process.env.DATABASE_URL;
const prefix = `+9177${Date.now().toString().slice(-7)}`;
let seq = 0;
const nextMobile = () => `${prefix}${String(++seq).padStart(2, "0")}`;
const body = (over: Record<string, unknown> = {}) => ({
  fullName: "Test User",
  mobile: nextMobile(),
  email: `${Math.random().toString(36).slice(2)}@test.local`,
  selectedOutcome: "HOME",
  ...over,
});

let admin: AdminUser;
let match: Match;

async function makeSession(opts: { startOffsetMin: number; durationMinutes?: number; status?: SessionStatus; allowDraw?: boolean; matchId?: string; enableScorePrediction?: boolean; collectLateEntries?: boolean }) {
  const d = opts.durationMinutes ?? 10;
  const startTime = new Date(Date.now() + opts.startOffsetMin * 60_000);
  return prisma.predictionSession.create({
    data: {
      secureToken: generateToken(),
      matchId: opts.matchId ?? match.id,
      startTime,
      durationMinutes: d,
      expiryTime: new Date(startTime.getTime() + d * 60_000),
      status: opts.status ?? "SCHEDULED",
      allowDraw: opts.allowDraw ?? false,
      enableScorePrediction: opts.enableScorePrediction ?? false,
      collectLateEntries: opts.collectLateEntries ?? true,
    },
  });
}

beforeAll(async () => {
  if (!HAS_DB) return;
  admin = await prisma.adminUser.create({ data: { name: "Test Admin", email: `admin-${prefix}@test.local`, passwordHash: "x", role: "SUPER_ADMIN" } });
  match = await prisma.match.create({ data: { homeTeam: "Manchester United", awayTeam: "Liverpool", kickoffAt: new Date() } });
});

afterAll(async () => {
  if (!HAS_DB) return;
  await prisma.predictionSession.deleteMany({ where: { matchId: match.id } });
  await prisma.match.delete({ where: { id: match.id } });
  await prisma.participant.deleteMany({ where: { mobile: { startsWith: prefix } } });
  await prisma.auditLog.deleteMany({ where: { actorId: admin.id } });
  await prisma.adminUser.delete({ where: { id: admin.id } });
  await prisma.$disconnect();
});

describe.skipIf(!HAS_DB)("prediction submission (database)", () => {
  it("accepts a prediction inside the window, stamps DB time, queues a WhatsApp confirmation", async () => {
    const s = await makeSession({ startOffsetMin: -1 });
    const before = Date.now();
    const { prediction, participant } = await submitPrediction(s.secureToken, body({ mobile: "98765 00001" }));
    expect(participant.mobile).toBe("+919876500001");
    expect(prediction.selectedOutcome).toBe("HOME");
    expect(Math.abs(prediction.submittedAt.getTime() - before)).toBeLessThan(10_000);
    const n = await prisma.notification.findMany({ where: { predictionId: prediction.id } });
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ type: "PREDICTION_SUBMITTED", status: "QUEUED", phoneNumber: "+919876500001" });
    await prisma.participant.delete({ where: { id: participant.id } });
  });

  it("Test 4: the same user cannot submit twice (session + mobile)", async () => {
    const s = await makeSession({ startOffsetMin: -1 });
    const b = body();
    await submitPrediction(s.secureToken, b);
    await expect(submitPrediction(s.secureToken, { ...b, selectedOutcome: "AWAY" })).rejects.toMatchObject({ httpStatus: 409, code: "DUPLICATE" });
    await expect(submitPrediction(s.secureToken, { ...b, mobile: nextMobile() })).rejects.toMatchObject({ httpStatus: 409, code: "DUPLICATE" }); // same email
    expect(await prisma.prediction.count({ where: { sessionId: s.id } })).toBe(1);
  });

  it("Test 5: invalid QR token -> 404", async () => {
    await expect(submitPrediction("definitely-not-a-token", body())).rejects.toMatchObject({ httpStatus: 404, code: "NOT_FOUND" });
  });

  it("Test 6: cancelled session -> 410 CANCELLED", async () => {
    const s = await makeSession({ startOffsetMin: -1, status: "CANCELLED" });
    await expect(submitPrediction(s.secureToken, body())).rejects.toMatchObject({ httpStatus: 410, code: "CANCELLED" });
  });

  it("Test 7: session not started -> 403 NOT_STARTED", async () => {
    const s = await makeSession({ startOffsetMin: 5 });
    await expect(submitPrediction(s.secureToken, body())).rejects.toMatchObject({ httpStatus: 403, code: "NOT_STARTED" });
  });

  it("Tests 3 & 10: expired window -> 410 EXPIRED, including a day later", async () => {
    const justExpired = await makeSession({ startOffsetMin: -10 });
    await expect(submitPrediction(justExpired.secureToken, body())).rejects.toMatchObject({ httpStatus: 410, code: "EXPIRED" });
    const yesterday = await makeSession({ startOffsetMin: -24 * 60 });
    await expect(submitPrediction(yesterday.secureToken, body())).rejects.toMatchObject({ httpStatus: 410, code: "EXPIRED" });
  });

  it("Test 9: client clock/timestamps in the payload cannot bypass expiry", async () => {
    const s = await makeSession({ startOffsetMin: -11 });
    const future = new Date(Date.now() - 5 * 60_000).toISOString();
    await expect(submitPrediction(s.secureToken, body({ submittedAt: future, clientTime: future, serverTime: future }))).rejects.toMatchObject({ httpStatus: 410 });
    expect(await prisma.prediction.count({ where: { sessionId: s.id } })).toBe(0);
  });

  it("Test 8: simultaneous submissions - two users both succeed, one user twice yields exactly one record", async () => {
    const s = await makeSession({ startOffsetMin: -1 });
    const a = body();
    const b = body({ selectedOutcome: "AWAY" });
    const two = await Promise.allSettled([submitPrediction(s.secureToken, a), submitPrediction(s.secureToken, b)]);
    expect(two.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);

    const c = body();
    const dup = await Promise.allSettled([submitPrediction(s.secureToken, c), submitPrediction(s.secureToken, c), submitPrediction(s.secureToken, c)]);
    expect(dup.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of dup) if (r.status === "rejected") expect(r.reason).toMatchObject({ httpStatus: 409, code: "DUPLICATE" });
    expect(await prisma.prediction.count({ where: { sessionId: s.id } })).toBe(3);
  });

  it("rejects DRAW when not allowed and invalid participant data", async () => {
    const s = await makeSession({ startOffsetMin: -1 });
    await expect(submitPrediction(s.secureToken, body({ selectedOutcome: "DRAW" }))).rejects.toThrow();
    await expect(submitPrediction(s.secureToken, body({ email: "nope" }))).rejects.toThrow();
    await expect(submitPrediction(s.secureToken, body({ mobile: "12" }))).rejects.toThrow();
    expect(await prisma.prediction.count({ where: { sessionId: s.id } })).toBe(0);
  });
});

describe.skipIf(!HAS_DB)("result finalization (database)", () => {
  it("previews, finalizes once, refuses a second finalization, records the audit trail, drains the queue", async () => {
    // Results are per match, so use a dedicated match: other tests above added predictions to the shared one.
    const m2 = await prisma.match.create({ data: { homeTeam: "Arsenal", awayTeam: "Chelsea", kickoffAt: new Date() } });
    const s = await makeSession({ startOffsetMin: -1, allowDraw: true, matchId: m2.id });
    await submitPrediction(s.secureToken, body({ selectedOutcome: "HOME" }));
    await submitPrediction(s.secureToken, body({ selectedOutcome: "HOME" }));
    await submitPrediction(s.secureToken, body({ selectedOutcome: "AWAY" }));
    await submitPrediction(s.secureToken, body({ selectedOutcome: "DRAW" }));

    const preview = await previewResult(s.id, { homeScore: 2, awayScore: 1 });
    expect(preview).toMatchObject({ winningOutcome: "HOME", total: 4, winners: 2, losers: 2, alreadyFinal: false });
    expect(await prisma.matchResult.findUnique({ where: { matchId: m2.id } })).toBeNull(); // preview writes nothing

    const fin = await finalizeResult(s.id, { homeScore: 2, awayScore: 1 }, admin.id);
    expect(fin).toMatchObject({ winners: 2, losers: 2, notificationsQueued: 4 });
    expect(fin.result).toMatchObject({ resultStatus: "FINAL", winningOutcome: "HOME", version: 1 });
    const byResult = await prisma.prediction.groupBy({ by: ["resultStatus"], where: { sessionId: s.id }, _count: { _all: true } });
    expect(Object.fromEntries(byResult.map((r) => [r.resultStatus, r._count._all]))).toEqual({ WINNER: 2, LOST: 2 });
    expect((await prisma.predictionSession.findUnique({ where: { id: s.id } }))?.status).toBe("COMPLETED");
    expect(await prisma.notification.count({ where: { sessionId: s.id, type: "PREDICTION_WINNER" } })).toBe(2);
    expect(await prisma.notification.count({ where: { sessionId: s.id, type: "PREDICTION_LOST" } })).toBe(2);

    // Idempotency: no double finalization, no duplicate messages.
    await expect(finalizeResult(s.id, { homeScore: 2, awayScore: 1 }, admin.id)).rejects.toMatchObject({ httpStatus: 409, code: "ALREADY_FINAL" });
    expect(await prisma.notification.count({ where: { sessionId: s.id } })).toBe(8);

    // Finalization is permanent: the audit trail holds exactly one finalization entry.
    const actions = (await prisma.auditLog.findMany({ where: { entityType: "MatchResult", entityId: fin.result.id }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["ADMIN_RESULT_FINALIZED"]);

    // Worker (dry-run) drains the queue. Another worker (for example `npm run worker` on this machine) may be
    // draining concurrently and legitimately claim some rows, so wait until this session's rows settle.
    for (let i = 0; i < 1000; i++) {
      const r = await processQueue(200);
      if (!r.processed) break;
    }
    let sentCount = 0;
    for (let i = 0; i < 40; i++) {
      sentCount = await prisma.notification.count({ where: { sessionId: s.id, status: "SENT" } });
      if (sentCount === 8) break;
      await new Promise((r) => setTimeout(r, 250));
      await processQueue(200);
    }
    if (sentCount !== 8) {
      const rows = await prisma.notification.findMany({ where: { sessionId: s.id }, select: { type: true, status: true, attempts: true, errorMessage: true, nextAttemptAt: true } });
      console.log("DIAG drain failure:", JSON.stringify(rows));
    }
    expect(sentCount).toBe(8);
    expect(await prisma.notification.count({ where: { sessionId: s.id, status: { not: "SENT" } } })).toBe(0);
    await prisma.predictionSession.deleteMany({ where: { matchId: m2.id } });
    await prisma.match.delete({ where: { id: m2.id } });
  });
});

describe.skipIf(!HAS_DB)("exact score prediction (database)", () => {
  it("marks exact scores, draws one score winner at random among them, records the draw, notifies once, publishes the winner", async () => {
    const m3 = await prisma.match.create({ data: { homeTeam: "Barcelona", awayTeam: "Real Madrid", kickoffAt: new Date() } });
    const s = await makeSession({ startOffsetMin: -1, matchId: m3.id, enableScorePrediction: true });
    await expect(submitPrediction(s.secureToken, body())).rejects.toThrow(); // score is required when enabled
    const first = await submitPrediction(s.secureToken, body({ predictedHomeScore: "2", predictedAwayScore: "1" }));
    const second = await submitPrediction(s.secureToken, body({ predictedHomeScore: 2, predictedAwayScore: 1 }));
    await submitPrediction(s.secureToken, body({ selectedOutcome: "AWAY", predictedHomeScore: "0", predictedAwayScore: "1" }));
    await submitPrediction(s.secureToken, body({ predictedHomeScore: "3", predictedAwayScore: "1" })); // right team, wrong score -> LOST
    expect(first.prediction).toMatchObject({ predictedHomeScore: 2, predictedAwayScore: 1, scoreCorrect: null, scoreWinner: false });

    const preview = await previewResult(s.id, { homeScore: 2, awayScore: 1 });
    expect(preview).toMatchObject({ scoreEnabled: true, exactScoreCount: 2, total: 4, winners: 2, losers: 2 });
    expect(await prisma.auditLog.count({ where: { action: "SCORE_WINNER_DRAWN", entityId: s.id } })).toBe(0); // preview never draws

    const fin = await finalizeResult(s.id, { homeScore: 2, awayScore: 1 }, admin.id);
    expect(fin).toMatchObject({ winners: 2, losers: 2, scoreWinners: 1, notificationsQueued: 5 });
    const rows = await prisma.prediction.findMany({ where: { sessionId: s.id }, orderBy: { submittedAt: "asc" } });
    expect(rows.map((r) => r.scoreCorrect)).toEqual([true, true, false, false]);
    expect(rows.map((r) => r.resultStatus)).toEqual(["WINNER", "WINNER", "LOST", "LOST"]); // right team + wrong score is LOST
    // Exactly one score winner, drawn among the two exact scores; the wrong score can never win.
    const winners = rows.filter((r) => r.scoreWinner);
    expect(winners).toHaveLength(1);
    expect([first.prediction.id, second.prediction.id]).toContain(winners[0].id);
    expect(rows[2].scoreWinner || rows[3].scoreWinner).toBe(false);
    const notif = await prisma.notification.findMany({ where: { sessionId: s.id, type: "SCORE_WINNER" } });
    expect(notif).toHaveLength(1);
    expect(notif[0].predictionId).toBe(winners[0].id);
    expect(notif[0].templateName).toBe("score_winner");
    // The draw is recorded: pool of 2, a full order, the winner first.
    const drawLog = await prisma.auditLog.findFirst({ where: { action: "SCORE_WINNER_DRAWN", entityId: s.id }, orderBy: { createdAt: "desc" } });
    const draw = drawLog?.after as { poolSize: number; pool: string[]; order: string[]; winnerPredictionId: string; method: string };
    expect(draw.poolSize).toBe(2);
    expect([...draw.pool].sort()).toEqual([first.prediction.id, second.prediction.id].sort());
    expect(draw.order[0]).toBe(winners[0].id);
    expect(draw.winnerPredictionId).toBe(winners[0].id);
    expect(draw.method).toContain("Fisher-Yates");

    // Participants reopening the QR page see the final score and the winner (names only, masked number).
    const pub = await getPublicSession(s.secureToken);
    expect(pub?.finalScore).toMatchObject({ homeScore: 2, awayScore: 1, winningOutcome: "HOME" });
    expect(pub?.winners).toMatchObject({ count: 2 });
    expect(pub?.winners?.names).toHaveLength(2);
    expect(pub?.winners?.scoreWinner).toMatchObject({ name: "Test User", predictedScore: "2 - 1" });
    expect(pub?.winners?.scoreWinner?.maskedMobile).toMatch(/^\+91•+\d{2}$/);
    expect(JSON.stringify(pub?.winners)).not.toContain("@test.local"); // never emails
    await prisma.predictionSession.update({ where: { id: s.id }, data: { showWinnersToParticipants: false } });
    expect((await getPublicSession(s.secureToken))?.winners).toBeNull();
    await prisma.predictionSession.update({ where: { id: s.id }, data: { showWinnersToParticipants: true } });

    await prisma.predictionSession.deleteMany({ where: { matchId: m3.id } });
    await prisma.match.delete({ where: { id: m3.id } });
  });
});

describe.skipIf(!HAS_DB)("timed-out registrations (database)", () => {
  it("keeps details without any prediction after expiry, refuses while open, dedupes, honours the session toggle", async () => {
    const expired = await makeSession({ startOffsetMin: -11 });
    const b = body();
    await expect(submitPrediction(expired.secureToken, b)).rejects.toMatchObject({ httpStatus: 410, code: "EXPIRED" });

    // Prediction/score fields sent by a client are dropped: only the details are stored.
    const { entry, participant } = await submitLateEntry(expired.secureToken, { ...b, selectedOutcome: "HOME", predictedHomeScore: "9", predictedAwayScore: "0" });
    expect(entry).toMatchObject({ sessionId: expired.id, participantId: participant.id });
    expect(participant.mobile).toBe(b.mobile);
    expect(await prisma.prediction.count({ where: { sessionId: expired.id } })).toBe(0);
    expect(await prisma.lateEntry.count({ where: { sessionId: expired.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { participantId: participant.id } })).toBe(0);

    // Same person again -> duplicate.
    await expect(submitLateEntry(expired.secureToken, b)).rejects.toMatchObject({ httpStatus: 409, code: "DUPLICATE" });

    // While the window is open the details-only path is refused.
    const open = await makeSession({ startOffsetMin: -1 });
    await expect(submitLateEntry(open.secureToken, body())).rejects.toMatchObject({ httpStatus: 409, code: "WINDOW_OPEN" });

    // Someone who predicted in time cannot also register late once the window has closed.
    const c = body();
    await submitPrediction(open.secureToken, c);
    await prisma.predictionSession.update({
      where: { id: open.id },
      data: { startTime: new Date(Date.now() - 20 * 60_000), expiryTime: new Date(Date.now() - 10 * 60_000) },
    });
    await expect(submitLateEntry(open.secureToken, c)).rejects.toMatchObject({ httpStatus: 409, code: "DUPLICATE" });

    // Sessions that opted out, cancelled sessions and unknown tokens.
    const off = await makeSession({ startOffsetMin: -11, collectLateEntries: false });
    await expect(submitLateEntry(off.secureToken, body())).rejects.toMatchObject({ httpStatus: 410, code: "EXPIRED" });
    const cancelled = await makeSession({ startOffsetMin: -11, status: "CANCELLED" });
    await expect(submitLateEntry(cancelled.secureToken, body())).rejects.toMatchObject({ httpStatus: 410, code: "CANCELLED" });
    await expect(submitLateEntry("not-a-token", body())).rejects.toMatchObject({ httpStatus: 404 });
  });
});

describe.skipIf(!HAS_DB)("match deletion (database)", () => {
  it("requires the exact match name, then removes sessions, predictions, late entries, notifications and result", async () => {
    const m = await prisma.match.create({ data: { homeTeam: "Ajax", awayTeam: "PSV", kickoffAt: new Date() } });
    const open = await makeSession({ startOffsetMin: -1, matchId: m.id });
    const expired = await makeSession({ startOffsetMin: -11, matchId: m.id });
    const { participant } = await submitPrediction(open.secureToken, body());
    await submitLateEntry(expired.secureToken, body());
    await finalizeResult(open.id, { homeScore: 1, awayScore: 0 }, admin.id);
    expect(await prisma.notification.count({ where: { sessionId: open.id } })).toBe(2);

    await expect(deleteMatch(m.id, admin.id, undefined)).rejects.toMatchObject({ httpStatus: 400, code: "CONFIRMATION_REQUIRED" });
    await expect(deleteMatch(m.id, admin.id, "Ajax v PSV")).rejects.toMatchObject({ httpStatus: 400, code: "CONFIRMATION_REQUIRED" });
    await expect(deleteMatch(m.id, admin.id, "ajax vs psv")).rejects.toMatchObject({ httpStatus: 400 }); // exact, case-sensitive
    expect(await prisma.match.findUnique({ where: { id: m.id } })).not.toBeNull(); // nothing happened yet

    expect(await deleteMatch(m.id, admin.id, "  Ajax vs PSV ")).toEqual({ sessions: 2, predictions: 1, lateEntries: 1 });
    expect(await prisma.match.findUnique({ where: { id: m.id } })).toBeNull();
    expect(await prisma.matchResult.findUnique({ where: { matchId: m.id } })).toBeNull();
    expect(await prisma.predictionSession.count({ where: { matchId: m.id } })).toBe(0);
    expect(await prisma.prediction.count({ where: { sessionId: { in: [open.id, expired.id] } } })).toBe(0);
    expect(await prisma.lateEntry.count({ where: { sessionId: { in: [open.id, expired.id] } } })).toBe(0);
    expect(await prisma.notification.count({ where: { sessionId: { in: [open.id, expired.id] } } })).toBe(0);
    expect(await prisma.participant.findUnique({ where: { id: participant.id } })).not.toBeNull(); // identity kept
    expect(await prisma.auditLog.count({ where: { action: "MATCH_DELETED", entityId: m.id } })).toBe(1);
    await expect(deleteMatch(m.id, admin.id, "Ajax vs PSV")).rejects.toMatchObject({ httpStatus: 404 });
  });
});
