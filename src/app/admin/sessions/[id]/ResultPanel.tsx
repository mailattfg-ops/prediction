"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calculator, CheckCircle2, Lock, Trophy } from "lucide-react";
import { api, ApiClientError } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Outcome = "HOME" | "AWAY" | "DRAW";
type Result = { homeScore: number; awayScore: number; winningOutcome: Outcome; resultStatus: "PENDING" | "FINAL"; version: number; finalizedLabel: string | null } | null;
type Preview = {
  homeScore: number; awayScore: number; autoOutcome: Outcome; winningOutcome: Outcome; overridden: boolean; total: number; winners: number; losers: number;
  scoreEnabled: boolean; exactScoreCount: number;
  otherSessions: { id: string; label: string; predictions: number }[];
};

export function ResultPanel({ sessionId, homeTeam, awayTeam, result, stats, cancelled }: {
  sessionId: string; homeTeam: string; awayTeam: string; result: Result; cancelled: boolean;
  stats: { total: number; winners: number; losers: number; home: number; away: number; draw: number; scoreEnabled: boolean; scoreCorrect: number; scoreWinnerName: string | null };
}) {
  const router = useRouter();
  const label = (o: Outcome) => (o === "HOME" ? homeTeam : o === "AWAY" ? awayTeam : "Draw");
  const [home, setHome] = useState(result?.homeScore ?? 0);
  const [away, setAway] = useState(result?.awayScore ?? 0);
  const [override, setOverride] = useState<"AUTO" | Outcome>("AUTO");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call<T>(fn: () => Promise<T>, after?: (r: T) => void) {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      after?.(r);
    } catch (e) {
      setError((e as ApiClientError).message);
    } finally {
      setBusy(false);
    }
  }
  const body = () => ({ homeScore: home, awayScore: away, winningOutcome: override === "AUTO" ? undefined : override });

  if (cancelled) return null;

  if (result?.resultStatus === "FINAL") {
    const winPct = stats.total ? Math.round((stats.winners / stats.total) * 1000) / 10 : 0;
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" /> Match result</CardTitle>
            <Badge variant="secondary" className="bg-violet-500/15 text-violet-700"><Lock /> Result finalized</Badge>
          </div>
          <CardDescription>
            Winning outcome <strong className="text-foreground">{label(result.winningOutcome)}</strong>
            {result.finalizedLabel && <> · finalized {result.finalizedLabel}</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-3xl font-black tracking-tight tabular-nums">
            {homeTeam} {result.homeScore} - {result.awayScore} {awayTeam}
          </div>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[["Total predictions", stats.total], ["Winners", stats.winners], ["Losers", stats.losers], ["Winning percentage", `${winPct}%`]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-xl font-bold tabular-nums">{v}</dd></div>
            ))}
          </dl>
          {stats.scoreEnabled && (
            <Alert className="border-amber-300/60 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <Trophy />
              <AlertTitle>Exact-score session</AlertTitle>
              <AlertDescription>
                Only exact scores count as winners: {stats.scoreCorrect} participant(s).{" "}
                {stats.scoreWinnerName ? <>Score-prize winner (random draw): <strong>{stats.scoreWinnerName}</strong>.</> : "No score-prize winner."}
              </AlertDescription>
            </Alert>
          )}
          <p className="text-xs text-muted-foreground">Finalized results are permanent and cannot be changed.</p>
        </CardContent>
      </Card>
    );
  }

  const outcomeItems = { AUTO: "Auto (from score)", HOME: homeTeam, AWAY: awayTeam, DRAW: "Draw" };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Trophy className="size-4 text-primary" /> Enter match result</CardTitle>
        <CardDescription>Type the final score, calculate the winners, then confirm. Finalizing is permanent.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="home-score">{homeTeam}</Label>
            <Input id="home-score" type="number" min={0} max={99} value={home} onChange={(e) => setHome(Number(e.target.value))} className="h-14 w-24 text-center text-2xl font-black tabular-nums" />
          </div>
          <div className="pb-4 text-xl font-black text-muted-foreground">–</div>
          <div className="space-y-2">
            <Label htmlFor="away-score">{awayTeam}</Label>
            <Input id="away-score" type="number" min={0} max={99} value={away} onChange={(e) => setAway(Number(e.target.value))} className="h-14 w-24 text-center text-2xl font-black tabular-nums" />
          </div>
          <div className="space-y-2">
            <Label>Official outcome</Label>
            <Select value={override} onValueChange={(v) => setOverride((v as "AUTO" | Outcome) ?? "AUTO")} items={outcomeItems}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Auto (from score)</SelectItem>
                <SelectItem value="HOME">{homeTeam}</SelectItem>
                <SelectItem value="AWAY">{awayTeam}</SelectItem>
                <SelectItem value="DRAW">Draw</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Leave on Auto unless an official ruling differs.</p>
          </div>
          <Button size="lg" disabled={busy} onClick={() => call(() => api<Preview>(`/api/sessions/${sessionId}/result/preview`, { method: "POST", body: body() }), setPreview)}>
            <Calculator data-icon="inline-start" /> Calculate winners
          </Button>
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      </CardContent>

      <Dialog open={!!preview} onOpenChange={(o) => !o && !busy && setPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm match result</DialogTitle>
                <DialogDescription>
                  {preview.winningOutcome === "DRAW"
                    ? `${homeTeam} and ${awayTeam} drew ${preview.homeScore}-${preview.awayScore}.`
                    : `${label(preview.winningOutcome)} won ${preview.winningOutcome === "HOME" ? `${preview.homeScore}-${preview.awayScore}` : `${preview.awayScore}-${preview.homeScore}`}.`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {preview.scoreEnabled ? (
                  <p>Only participants who predicted the exact score <strong>{preview.homeScore}-{preview.awayScore}</strong> will be marked as winners. The right team with a different score counts as lost.</p>
                ) : (
                  <p>All participants who predicted <strong>{label(preview.winningOutcome)}</strong> will be marked as winners.</p>
                )}
                {preview.overridden && (
                  <Alert variant="destructive"><AlertDescription>You overrode the automatic outcome ({label(preview.autoOutcome)}). Make sure this matches the official ruling.</AlertDescription></Alert>
                )}
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {[["Predictions", preview.total], ["Winners", preview.winners], ["Losers", preview.losers]].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-muted/60 p-2"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-xl font-bold tabular-nums">{v}</dd></div>
                  ))}
                </dl>
                <p className="text-xs text-muted-foreground">Numbers are for this session only.</p>
                {preview.otherSessions.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      The result belongs to the match, so it is also applied to {preview.otherSessions.length} other session(s):{" "}
                      {preview.otherSessions.map((s) => `${s.label} (${s.predictions})`).join(", ")}.
                    </AlertDescription>
                  </Alert>
                )}
                {preview.scoreEnabled && (
                  <Alert className="border-amber-300/60 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    <Trophy />
                    <AlertDescription>
                      Exact score predicted by <strong>{preview.exactScoreCount}</strong> participant(s).{" "}
                      {preview.exactScoreCount > 1
                        ? "One of them is drawn at random as the score-prize winner when you confirm (cryptographically secure draw, recorded in the audit log)."
                        : preview.exactScoreCount === 1
                          ? "That participant is the only winner and becomes the score-prize winner."
                          : "Nobody wins in this session."}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-muted-foreground">
                  Finalizing stores the result, marks every prediction WINNER or LOST and queues WhatsApp result notifications. <strong>This is permanent.</strong>
                </p>
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreview(null)} disabled={busy}>Cancel</Button>
                <Button
                  disabled={busy}
                  onClick={() =>
                    call(
                      () => api(`/api/sessions/${sessionId}/result`, { method: "POST", body: body() }),
                      () => {
                        setPreview(null);
                        toast.success("Result finalized. Winners marked and notifications queued.");
                        router.refresh();
                      },
                    )
                  }
                >
                  <CheckCircle2 data-icon="inline-start" /> {busy ? "Finalizing…" : "Confirm result"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
