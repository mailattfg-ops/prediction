import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Prisma.TransactionClient;

/** The database clock is the only clock business rules trust. */
export async function dbNow(client: Pick<PrismaClient, "$queryRaw"> | Tx = prisma): Promise<Date> {
  const rows = await client.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
  return rows[0].now;
}
