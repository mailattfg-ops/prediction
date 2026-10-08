import type { SessionStatus } from "@prisma/client";

/** Stored statuses plus the two that are derived from the clock. */
export type EffectiveStatus = SessionStatus | "ACTIVE" | "EXPIRED";

export type WindowSession = {
  status: SessionStatus;
  startTime: Date;
  expiryTime: Date;
  archivedAt?: Date | null;
};

export function computeExpiry(startTime: Date, durationMinutes: number): Date {
  return new Date(startTime.getTime() + durationMinutes * 60_000);
}

export function effectiveStatus(s: WindowSession, now: Date): EffectiveStatus {
  if (s.status !== "SCHEDULED") return s.status;
  if (now.getTime() < s.startTime.getTime()) return "SCHEDULED";
  if (now.getTime() < s.expiryTime.getTime()) return "ACTIVE";
  return "EXPIRED";
}

export type WindowDecision =
  | { ok: true }
  | { ok: false; httpStatus: number; code: string; message: string };

const reject = (httpStatus: number, code: string, message: string): WindowDecision => ({ ok: false, httpStatus, code, message });

/**
 * The single rule every submission passes through. `now` must come from the server/database,
 * never from the client. Accepts only when startTime <= now < expiryTime.
 */
export function decideSubmission(s: WindowSession | null | undefined, now: Date): WindowDecision {
  if (!s || s.archivedAt || s.status === "DRAFT") return reject(404, "NOT_FOUND", "This QR code is not valid.");
  if (s.status === "CANCELLED") return reject(410, "CANCELLED", "This prediction session has been cancelled.");
  if (s.status === "COMPLETED") return reject(410, "EXPIRED", "Prediction window has expired.");
  if (now.getTime() < s.startTime.getTime()) return reject(403, "NOT_STARTED", "This prediction session has not started yet.");
  if (now.getTime() >= s.expiryTime.getTime()) return reject(410, "EXPIRED", "Prediction window has expired.");
  return { ok: true };
}
