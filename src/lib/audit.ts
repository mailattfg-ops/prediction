import type { Prisma } from "@prisma/client";
import type { Tx } from "./db";

export type AuditInput = {
  actorId?: string | null;
  action: string;
  entityType: "PredictionSession" | "Match" | "MatchResult" | "Notification";
  entityId: string;
  before?: unknown;
  after?: unknown;
};

export function audit(tx: Tx, input: AuditInput) {
  return tx.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: (input.before === undefined ? undefined : JSON.parse(JSON.stringify(input.before))) as Prisma.InputJsonValue | undefined,
      after: (input.after === undefined ? undefined : JSON.parse(JSON.stringify(input.after))) as Prisma.InputJsonValue | undefined,
    },
  });
}
