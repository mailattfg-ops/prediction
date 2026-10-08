import { describe, expect, it } from "vitest";
import { computeExpiry, decideSubmission, effectiveStatus, type WindowSession } from "@/lib/window";

// Session starts 18:00:00 and runs for 10 minutes => closes at 18:10:00 (spec section 6).
const start = new Date("2026-10-08T18:00:00.000Z");
const session: WindowSession = { status: "SCHEDULED", startTime: start, expiryTime: computeExpiry(start, 10), archivedAt: null };
const at = (t: string) => new Date(`2026-10-08T${t}.000Z`);

describe("10-minute window (server clock only)", () => {
  it("Test 1: 09:59 into the window -> SUCCESS", () => {
    expect(decideSubmission(session, at("18:09:59"))).toEqual({ ok: true });
  });
  it("Test 2: exactly 10:00 -> REJECTED 410", () => {
    expect(decideSubmission(session, at("18:10:00"))).toMatchObject({ ok: false, httpStatus: 410, code: "EXPIRED" });
  });
  it("Test 3: 10:01 -> REJECTED 410", () => {
    expect(decideSubmission(session, at("18:10:01"))).toMatchObject({ ok: false, httpStatus: 410, code: "EXPIRED" });
  });
  it("Test 5: unknown token (no session) -> REJECTED 404", () => {
    expect(decideSubmission(null, at("18:05:00"))).toMatchObject({ ok: false, httpStatus: 404, code: "NOT_FOUND" });
  });
  it("Test 6: cancelled session -> REJECTED 410 CANCELLED even inside the window", () => {
    expect(decideSubmission({ ...session, status: "CANCELLED" }, at("18:05:00"))).toMatchObject({ ok: false, httpStatus: 410, code: "CANCELLED" });
  });
  it("Test 7: before start -> REJECTED 403 NOT_STARTED", () => {
    expect(decideSubmission(session, at("17:59:59"))).toMatchObject({ ok: false, httpStatus: 403, code: "NOT_STARTED" });
    expect(decideSubmission(session, at("18:00:00"))).toEqual({ ok: true });
  });
  it("Test 10: QR opened the next day -> REJECTED 410", () => {
    expect(decideSubmission(session, new Date("2026-10-09T18:05:00.000Z"))).toMatchObject({ ok: false, httpStatus: 410 });
  });
  it("draft or archived sessions are invisible (404)", () => {
    expect(decideSubmission({ ...session, status: "DRAFT" }, at("18:05:00"))).toMatchObject({ httpStatus: 404 });
    expect(decideSubmission({ ...session, archivedAt: new Date() }, at("18:05:00"))).toMatchObject({ httpStatus: 404 });
  });
  it("completed sessions reject with 410", () => {
    expect(decideSubmission({ ...session, status: "COMPLETED" }, at("18:05:00"))).toMatchObject({ httpStatus: 410 });
  });
  it("derives ACTIVE/EXPIRED from the clock, never from a stored flag", () => {
    expect(effectiveStatus(session, at("17:00:00"))).toBe("SCHEDULED");
    expect(effectiveStatus(session, at("18:00:00"))).toBe("ACTIVE");
    expect(effectiveStatus(session, at("18:09:59"))).toBe("ACTIVE");
    expect(effectiveStatus(session, at("18:10:00"))).toBe("EXPIRED");
    expect(effectiveStatus({ ...session, status: "CANCELLED" }, at("18:05:00"))).toBe("CANCELLED");
  });
  it("computes expiry from start + duration", () => {
    expect(computeExpiry(start, 10).toISOString()).toBe("2026-10-08T18:10:00.000Z");
    expect(computeExpiry(start, 25).toISOString()).toBe("2026-10-08T18:25:00.000Z");
  });
});
