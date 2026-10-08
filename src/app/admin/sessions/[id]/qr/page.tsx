import { getSession } from "@/lib/sessions";
import { fmtDateTime } from "@/lib/format";
import { predictionUrl, qrDataUrl } from "@/lib/qr";
import { Alert, Card, LinkButton, StatusBadge } from "@/components/ui";
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
    <div className="mx-auto max-w-3xl space-y-4">
      {localOnly && (
        <div className="no-print">
          <Alert>
            This QR points to <code>{url}</code>, which only works on this computer. Set <code>APP_URL</code> in <code>.env</code> to an
            address phones can reach (your LAN IP, a tunnel, or the deployed https URL), restart the app and download the QR again.
          </Alert>
        </div>
      )}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">QR code · {title}</h1>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/sessions/${s.id}/qr?format=png`} className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Download PNG</a>
          <a href={`/api/sessions/${s.id}/qr?format=svg`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">Download SVG</a>
          <PrintButton />
          <LinkButton href={`/admin/sessions/${s.id}`}>Back</LinkButton>
        </div>
      </div>
      <Card className="print:border-0 print:shadow-none">
        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt={`QR code for ${title}`} className="mx-auto w-full max-w-xs print:max-w-md" />
            <div className="mt-2 text-lg font-bold print:text-2xl">Scan to predict</div>
            <div className="text-xl font-black print:text-3xl">{title}</div>
            {(s.eventName || s.campaignName) && <div className="text-sm text-slate-600">{[s.eventName, s.campaignName].filter(Boolean).join(" · ")}</div>}
            <div className="mt-1 break-all text-xs text-slate-500">{url}</div>
          </div>
          <dl className="no-print grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Status</dt><dd><StatusBadge status={s.effectiveStatus} /></dd>
            <dt className="text-slate-500">Match</dt><dd>{title}{s.match.competition && ` · ${s.match.competition}`}</dd>
            <dt className="text-slate-500">Kick-off</dt><dd>{fmtDateTime(s.match.kickoffAt)}</dd>
            <dt className="text-slate-500">Prediction opens</dt><dd>{fmtDateTime(s.startTime)}</dd>
            <dt className="text-slate-500">Prediction closes</dt><dd>{fmtDateTime(s.expiryTime)} ({s.durationMinutes} min)</dd>
            <dt className="text-slate-500">Draw allowed</dt><dd>{s.allowDraw ? "Yes" : "No"}</dd>
            <dt className="text-slate-500">Total predictions</dt><dd className="font-semibold">{s._count.predictions}</dd>
          </dl>
        </div>
      </Card>
    </div>
  );
}
