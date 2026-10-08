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

/** Faint pitch markings for the stadium backdrop. */
function PitchLines({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 900" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="20" y="20" width="560" height="860" rx="6" />
      <line x1="20" y1="450" x2="580" y2="450" />
      <circle cx="300" cy="450" r="80" />
      <circle cx="300" cy="450" r="4" fill="currentColor" />
      <rect x="140" y="20" width="320" height="140" />
      <rect x="220" y="20" width="160" height="50" />
      <rect x="140" y="740" width="320" height="140" />
      <rect x="220" y="830" width="160" height="50" />
    </svg>
  );
}

export default async function PredictPage({ params }: Props) {
  const { token } = await params;
  const session = await getPublicSession(token);
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#0b1220] px-4 py-5 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_-5%,oklch(0.6_0.18_160/0.55),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(45%_35%_at_95%_25%,oklch(0.62_0.16_250/0.28),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(50%_40%_at_0%_90%,oklch(0.65_0.17_160/0.22),transparent_70%)]" />
        <PitchLines className="absolute left-1/2 top-20 w-[150%] max-w-[720px] -translate-x-1/2 text-white opacity-[0.07]" />
        <div className="absolute inset-0 bg-grain opacity-[0.06]" />
      </div>

      <div className="relative mx-auto w-full max-w-md flex-1">
        {session ? (
          <PredictionClient initial={session} />
        ) : (
          <Card className="mt-10 text-center shadow-2xl">
            <CardContent className="py-10">
              <SearchX className="mx-auto size-12 text-muted-foreground" />
              <h1 className="mt-4 font-display text-4xl tracking-wide">Invalid QR code</h1>
              <p className="mt-2 text-muted-foreground">This prediction link is not valid. Please scan a valid QR code for an active prediction.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <p className="relative mt-8 text-center text-xs text-white/40">
        Football Prediction · Powered by{" "}
        <a href="https://www.thinkforgeglobal.com/" target="_blank" rel="noopener noreferrer" className="font-medium text-white/70 hover:text-white hover:underline">
          Think Forge Global
        </a>
      </p>
    </main>
  );
}
