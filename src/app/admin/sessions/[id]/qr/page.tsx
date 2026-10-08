import Link from "next/link";
import { ArrowLeft, Download, TriangleAlert } from "lucide-react";
import { getSession } from "@/lib/sessions";
import { fmtDateTime } from "@/lib/format";
import { predictionUrl, qrDataUrl } from "@/lib/qr";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { PrintButton } from "./PrintButton";

export const metadata = { title: "QR code · Prediction Admin" };

export default async function QrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  const url = predictionUrl(s.secureToken);
  const dataUrl = await qrDataUrl(url);
  const title = `${s.match.homeTeam} vs ${s.match.awayTeam}`;
  const localOnly = /localhost|127\.0\.0\.1/.test(url);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print">
        <PageHeader
          title="QR code"
          description={title}
          badge={<StatusBadge status={s.effectiveStatus} />}
          actions={
            <>
              <Button nativeButton={false} render={<a href={`/api/sessions/${s.id}/qr?format=png`} />}><Download data-icon="inline-start" /> PNG</Button>
              <Button nativeButton={false} variant="outline" render={<a href={`/api/sessions/${s.id}/qr?format=svg`} />}><Download data-icon="inline-start" /> SVG</Button>
              <PrintButton />
              <Button nativeButton={false} variant="ghost" render={<Link href={`/admin/sessions/${s.id}`} />}><ArrowLeft data-icon="inline-start" /> Back</Button>
            </>
          }
        />
        {localOnly && (
          <Alert variant="destructive" className="mb-4">
            <TriangleAlert />
            <AlertTitle>This QR only works on this computer</AlertTitle>
            <AlertDescription>
              It points to <code>{url}</code>. Set <code>APP_URL</code> in <code>.env</code> to an address phones can reach (your LAN IP, a tunnel, or the deployed https URL), restart the app and download the QR again.
            </AlertDescription>
          </Alert>
        )}
      </div>
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="text-center">
            <div className="mx-auto w-full max-w-xs rounded-2xl border bg-white p-4 print:max-w-md print:border-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dataUrl} alt={`QR code for ${title}`} className="w-full" />
            </div>
            <div className="mt-4 text-sm font-semibold uppercase tracking-widest text-primary print:text-xl">Scan to predict</div>
            <div className="text-2xl font-black print:text-4xl">{title}</div>
            {(s.eventName || s.campaignName) && <div className="text-sm text-muted-foreground">{[s.eventName, s.campaignName].filter(Boolean).join(" · ")}</div>}
            <div className="mt-2 break-all text-xs text-muted-foreground">{url}</div>
          </div>
          <dl className="no-print grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
            <dt className="text-muted-foreground">Match</dt><dd>{title}{s.match.competition && ` · ${s.match.competition}`}</dd>
            <dt className="text-muted-foreground">Kick-off</dt><dd>{fmtDateTime(s.match.kickoffAt)}</dd>
            <dt className="text-muted-foreground">Prediction opens</dt><dd>{fmtDateTime(s.startTime)}</dd>
            <dt className="text-muted-foreground">Prediction closes</dt><dd>{fmtDateTime(s.expiryTime)} ({s.durationMinutes} min)</dd>
            <dt className="text-muted-foreground">Mode</dt><dd>{s.enableScorePrediction ? "Exact score" : "Winner pick"}{s.allowDraw ? " · draw allowed" : ""}</dd>
            <dt className="text-muted-foreground">Predictions</dt><dd className="font-semibold tabular-nums">{s._count.predictions}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
