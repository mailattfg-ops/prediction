import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { getPublicSession } from "@/lib/sessions";
import { Card, CardContent } from "@/components/ui/card";
import { PredictionClient } from "./PredictionClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await getPublicSession((await params).token);
  return { title: s ? `${s.match.homeTeam} vs ${s.match.awayTeam} · Football Prediction` : "Football Prediction" };
}

export default async function PredictPage({ params }: Props) {
  const { token } = await params;
  const session = await getPublicSession(token);
  return (
    <main className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_oklch(0.32_0.06_160),_oklch(0.17_0.03_260)_55%,_oklch(0.14_0.02_260))] px-4 py-6">
      <div className="mx-auto w-full max-w-md flex-1">
        {session ? (
          <PredictionClient initial={session} />
        ) : (
          <Card className="text-center shadow-2xl">
            <CardContent className="py-10">
              <SearchX className="mx-auto size-12 text-muted-foreground" />
              <h1 className="mt-4 text-2xl font-bold">Invalid QR code</h1>
              <p className="mt-2 text-muted-foreground">This prediction link is not valid. Please scan a valid QR code for an active prediction.</p>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="mt-8 text-center text-xs text-white/50">
        Football Prediction · Powered by{" "}
        <a href="https://www.thinkforgeglobal.com/" target="_blank" rel="noopener noreferrer" className="font-medium text-white/80 hover:text-white hover:underline">
          Think Forge Global
        </a>
      </p>
    </main>
  );
}
