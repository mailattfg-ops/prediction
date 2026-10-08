-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SCORE_WINNER';

-- AlterTable
ALTER TABLE "Prediction" ADD COLUMN     "predictedAwayScore" INTEGER,
ADD COLUMN     "predictedHomeScore" INTEGER,
ADD COLUMN     "scoreCorrect" BOOLEAN,
ADD COLUMN     "scoreWinner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PredictionSession" ADD COLUMN     "enableScorePrediction" BOOLEAN NOT NULL DEFAULT false;
