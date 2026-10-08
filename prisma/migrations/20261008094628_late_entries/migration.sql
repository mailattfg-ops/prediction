-- AlterTable
ALTER TABLE "PredictionSession" ADD COLUMN     "collectLateEntries" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "LateEntry" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "customData" JSONB,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "LateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LateEntry_sessionId_submittedAt_idx" ON "LateEntry"("sessionId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LateEntry_sessionId_participantId_key" ON "LateEntry"("sessionId", "participantId");

-- AddForeignKey
ALTER TABLE "LateEntry" ADD CONSTRAINT "LateEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PredictionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateEntry" ADD CONSTRAINT "LateEntry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
