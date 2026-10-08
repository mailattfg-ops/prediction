import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MatchForm } from "../../MatchForm";
import { toInputValue } from "@/components/datetime";

export const metadata = { title: "Edit match · Prediction Admin" };

export default async function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await prisma.match.findUnique({ where: { id } });
  if (!m) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Edit match</h1>
      <MatchForm
        id={m.id}
        initial={{
          homeTeam: m.homeTeam, awayTeam: m.awayTeam, homeTeamLogo: m.homeTeamLogo ?? "", awayTeamLogo: m.awayTeamLogo ?? "",
          competition: m.competition ?? "", kickoffAt: toInputValue(m.kickoffAt.toISOString()), venue: m.venue ?? "", externalId: m.externalId ?? "",
        }}
      />
    </div>
  );
}
