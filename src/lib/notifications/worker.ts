import { prisma } from "../db";
import { sendTemplate } from "./whatsapp";

/** Attempt 1 immediately, attempt 2 after 30 s, attempt 3 after 2 min, then FAILED. */
export const RETRY_DELAYS_MS = [0, 30_000, 120_000];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;
const LEASE_MS = 5 * 60_000;

type Payload = { language?: string; params?: string[] };

/**
 * Claims a batch of due jobs with FOR UPDATE SKIP LOCKED (safe with several workers),
 * sends each one, and records the outcome. Returns counts for logging.
 */
export async function processQueue(batch = 25) {
  const claimed = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Notification"
      WHERE status IN ('QUEUED', 'RETRYING') AND "nextAttemptAt" <= now()
      ORDER BY "nextAttemptAt" ASC
      LIMIT ${batch}
      FOR UPDATE SKIP LOCKED`;
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    // Lease: push nextAttemptAt forward so a second worker will not pick the same rows while we send.
    await tx.notification.updateMany({ where: { id: { in: ids } }, data: { nextAttemptAt: new Date(Date.now() + LEASE_MS) } });
    return tx.notification.findMany({ where: { id: { in: ids } } });
  });

  let sent = 0;
  let failed = 0;
  for (const n of claimed) {
    const attempt = n.attempts + 1;
    const payload = (n.payload ?? {}) as Payload;
    try {
      const { id } = await sendTemplate({
        to: n.phoneNumber,
        templateName: n.templateName,
        language: payload.language || "en",
        params: payload.params ?? [],
      });
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: "SENT", attempts: attempt, providerMessageId: id || null, sentAt: new Date(), errorMessage: null },
      });
      sent++;
    } catch (e) {
      const errorMessage = (e instanceof Error ? e.message : String(e)).slice(0, 1000);
      const exhausted = attempt >= MAX_ATTEMPTS;
      await prisma.notification.update({
        where: { id: n.id },
        data: exhausted
          ? { status: "FAILED", attempts: attempt, errorMessage }
          : { status: "RETRYING", attempts: attempt, errorMessage, nextAttemptAt: new Date(Date.now() + RETRY_DELAYS_MS[attempt]) },
      });
      if (exhausted) failed++;
    }
  }
  return { processed: claimed.length, sent, failed };
}
