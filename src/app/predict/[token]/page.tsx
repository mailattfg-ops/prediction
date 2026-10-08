import type { Metadata } from "next";
import { getPublicSession } from "@/lib/sessions";
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
  if (!session) {
    return (
      <Shell>
        <div className="rounded-2xl bg-white p-8 text-center shadow-xl">
          <div className="text-5xl">🔍</div>
          <h1 className="mt-4 text-2xl font-bold">Invalid QR Code</h1>
          <p className="mt-2 text-slate-600">This prediction link is not valid. Please scan a valid QR code for an active prediction.</p>
        </div>
      </Shell>
    );
  }
  return (
    <Shell>
      <PredictionClient initial={session} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-emerald-900 px-4 py-6 text-slate-900">
      <div className="mx-auto w-full max-w-md flex-1">{children}</div>
      <p className="mt-6 text-center text-xs text-slate-400">Football Prediction · Powered by QR</p>
    </main>
  );
}
