"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { AlarmClock, Ban, CheckCircle2, Hourglass, Minus, Plus, Trophy } from "lucide-react";
import type { PublicSession } from "@/lib/sessions";
import { api, ApiClientError } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Phase = "upcoming" | "open" | "closed" | "cancelled";
type Outcome = "HOME" | "AWAY" | "DRAW";

const pad = (n: number) => String(n).padStart(2, "0");
function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? pad(h) + ":" : ""}${pad(m)}:${pad(s % 60)}`;
}

export function PredictionClient({ initial }: { initial: PublicSession }) {
  const [session, setSession] = useState(initial);
  // Server clock offset: the browser clock only animates, it never decides.
  const [offset, setOffset] = useState(() => Date.parse(initial.serverTime) - Date.now());
  const [now, setNow] = useState(() => Date.now() + offset);
  const [success, setSuccess] = useState<{ predictedTeam: string; score: string | null } | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [popup, setPopup] = useState(false);
  const handleTimedOut = () => {
    setTimedOut(true);
    setPopup(true);
  };

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(id);
  }, [offset]);

  // Re-sync with the server every 30 s (picks up cancellations, results and clock drift).
  const resync = useCallback(async () => {
    try {
      const { session: fresh } = await api<{ session: PublicSession }>(`/api/public/sessions/${initial.token}`);
      setSession(fresh);
      setOffset(Date.parse(fresh.serverTime) - Date.now());
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 404) setSession((s) => ({ ...s, status: "CANCELLED" }));
    }
  }, [initial.token]);
  useEffect(() => {
    const id = setInterval(resync, 30_000);
    return () => clearInterval(id);
  }, [resync]);

  useEffect(() => {
    if (!success) return;
    confetti({ particleCount: 140, spread: 75, origin: { y: 0.65 }, colors: ["#10b981", "#34d399", "#fbbf24", "#60a5fa", "#ffffff"] });
  }, [success]);

  const start = Date.parse(session.startTime);
  const expiry = Date.parse(session.expiryTime);
  const phase: Phase =
    session.status === "CANCELLED" ? "cancelled"
    : session.status === "COMPLETED" ? "closed"
    : now < start ? "upcoming"
    : now < expiry ? "open"
    : "closed";
  const resultOut = !!session.finalScore && phase !== "cancelled";

  return (
    <div className="space-y-4">
      <MatchHeader session={session} phase={phase} remaining={phase === "upcoming" ? start - now : expiry - now} />
      {success ? (
        <SuccessCard session={session} predictedTeam={success.predictedTeam} score={success.score} />
      ) : timedOut ? (
        <TimeOutCard session={session} />
      ) : resultOut ? (
        <ResultCard session={session} />
      ) : phase === "open" || (phase === "closed" && session.collectLateEntries) ? (
        // After expiry (when the session keeps collecting details) the form stays as it is; the server
        // rejects the prediction at submit, the details are kept, and the popup appears then.
        <PredictionForm
          session={session}
          onSuccess={(predictedTeam, score) => setSuccess({ predictedTeam, score })}
          onTimedOut={handleTimedOut}
          onClosed={(status) => setSession((s) => ({ ...s, status }))}
        />
      ) : phase === "upcoming" ? (
        <InfoCard icon={<Hourglass className="size-10 text-primary" />} title="Not open yet" body="Prediction has not started yet. Keep this page open, the form appears when the window opens." />
      ) : phase === "cancelled" ? (
        <InfoCard icon={<Ban className="size-10 text-destructive" />} title="Session cancelled" body="This prediction session has been cancelled. Please scan a valid QR code for another active prediction." />
      ) : (
        <ClosedCard session={session} />
      )}
      <Dialog open={popup} onOpenChange={setPopup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlarmClock className="size-5 text-destructive" /> Prediction time over</DialogTitle>
            <DialogDescription>The prediction window for this match has ended, so your prediction could not be counted.</DialogDescription>
          </DialogHeader>
          <p className="text-sm">Thank you for your interest.</p>
          <DialogFooter>
            <Button onClick={() => setPopup(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Sponsor strip for the dark hero: logo tile + "Presented by" + name. */
function SponsorStrip({ sponsor }: { sponsor: PublicSession["sponsor"] }) {
  if (!sponsor) return null;
  const inner = (
    <>
      {sponsor.logoUrl && (
        <span className="size-14 shrink-0 overflow-hidden rounded-xl ring-2 ring-white/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sponsor.logoUrl} alt={`${sponsor.name} logo`} className="size-full scale-[1.7] object-cover" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">{sponsor.tagline}</span>
        <span className="block truncate text-lg font-black leading-tight text-white">{sponsor.name}</span>
      </span>
    </>
  );
  const cls = "mb-4 flex items-center gap-3 rounded-xl bg-white/10 p-2.5 pr-4 ring-1 ring-white/15";
  return sponsor.url ? (
    <a href={sponsor.url} target="_blank" rel="noopener noreferrer" className={cn(cls, "hover:bg-white/15")}>{inner}</a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function TeamBadge({ name, logo }: { name: string; logo: string | null }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={name} className="size-16 object-contain drop-shadow" />
      ) : (
        <div className="flex size-16 items-center justify-center rounded-full bg-white/10 text-lg font-black text-white ring-1 ring-white/20">{initials}</div>
      )}
      <div className="text-center text-sm font-semibold leading-tight text-white">{name}</div>
    </div>
  );
}

function MatchHeader({ session, phase, remaining }: { session: PublicSession; phase: Phase; remaining: number }) {
  const final = session.finalScore && phase !== "cancelled" ? session.finalScore : null;
  const live = !final && phase === "open";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white shadow-2xl backdrop-blur">
      <SponsorStrip sponsor={session.sponsor} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Football Prediction</span>
        {live && <Badge className="bg-emerald-500 text-white"><span className="size-1.5 animate-pulse rounded-full bg-white" /> Live</Badge>}
      </div>
      {(session.campaignName || session.eventName) && (
        <div className="mt-1 text-xs text-white/60">{[session.eventName, session.campaignName].filter(Boolean).join(" · ")}</div>
      )}
      <div className="mt-5 flex items-center gap-2">
        <TeamBadge name={session.match.homeTeam} logo={session.match.homeTeamLogo} />
        <div className="px-2 text-xl font-black text-white/40">VS</div>
        <TeamBadge name={session.match.awayTeam} logo={session.match.awayTeamLogo} />
      </div>
      <div className="mt-4 text-center text-sm text-white/70">
        {session.match.competition && <div>{session.match.competition}</div>}
        <div>{session.match.kickoffLabel}</div>
        {session.match.venue && <div className="text-xs text-white/50">{session.match.venue}</div>}
      </div>
      <div className="mt-4 rounded-xl bg-black/30 px-4 py-3 text-center ring-1 ring-white/10" aria-live="polite">
        {final ? (
          <>
            <div className="text-[11px] uppercase tracking-widest text-white/60">Full time</div>
            <div className="font-mono text-4xl font-black tabular-nums">{final.homeScore} - {final.awayScore}</div>
          </>
        ) : phase === "open" || (phase === "closed" && session.collectLateEntries) ? (
          <>
            <div className="text-[11px] uppercase tracking-widest text-white/60">Prediction closes in</div>
            <div className="font-mono text-4xl font-black tabular-nums">{phase === "open" ? clock(remaining) : "00:00"}</div>
          </>
        ) : phase === "upcoming" ? (
          <>
            <div className="text-[11px] uppercase tracking-widest text-white/60">Prediction opens in</div>
            <div className="font-mono text-4xl font-black tabular-nums">{clock(remaining)}</div>
          </>
        ) : phase === "cancelled" ? (
          <div className="text-lg font-bold">Session cancelled</div>
        ) : (
          <div className="text-lg font-bold">Prediction closed</div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card className="shadow-2xl">
      <CardContent className="py-8 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted">{icon}</div>
        <h2 className="mt-4 text-xl font-bold">{title}</h2>
        <p className="mt-2 text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function ResultSplit({ session }: { session: PublicSession }) {
  const r = session.results;
  if (!r) return null;
  const pct = (n: number) => (r.total ? Math.round((n / r.total) * 100) : 0);
  const rows = [
    [session.match.homeTeam, r.home],
    [session.match.awayTeam, r.away],
    ...(session.allowDraw ? [["Draw", r.draw] as const] : []),
  ] as const;
  return (
    <div className="mt-6 rounded-xl bg-muted/60 p-4 text-left">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">How everyone voted ({r.total})</div>
      <div className="mt-3 space-y-2.5">
        {rows.map(([label, n]) => (
          <div key={label}>
            <div className="flex justify-between text-sm">
              <span>{label}</span>
              <span className="font-semibold tabular-nums">{pct(n)}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct(n)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClosedCard({ session }: { session: PublicSession }) {
  return (
    <Card className="shadow-2xl">
      <CardContent className="py-8 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted"><AlarmClock className="size-8 text-muted-foreground" /></div>
        <h2 className="mt-4 text-xl font-bold">Prediction closed</h2>
        <p className="mt-2 text-muted-foreground">The prediction window for this match has ended.</p>
        <p className="mt-1 text-sm text-muted-foreground">Please scan a valid QR code for another active prediction.</p>
        <ResultSplit session={session} />
      </CardContent>
    </Card>
  );
}

function ResultCard({ session }: { session: PublicSession }) {
  const f = session.finalScore!;
  const w = session.winners;
  const outcomeText = f.winningOutcome === "DRAW" ? "The match ended in a draw" : `${f.winningOutcome === "HOME" ? session.match.homeTeam : session.match.awayTeam} won`;
  return (
    <Card className="shadow-2xl">
      <CardContent className="py-6 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-primary">Final result</div>
        <div className="mt-2 text-2xl font-black tracking-tight">
          {session.match.homeTeam} {f.homeScore} - {f.awayScore} {session.match.awayTeam}
        </div>
        <div className="mt-1 text-muted-foreground">{outcomeText}</div>

        {w ? (
          <div className="mt-6 space-y-5">
            {w.scoreWinner && (
              <div className="rounded-2xl border border-amber-300/70 bg-gradient-to-b from-amber-50 to-amber-100/60 p-5 dark:from-amber-950/40 dark:to-amber-900/20">
                <Trophy className="mx-auto size-9 text-amber-500" />
                <div className="mt-1 text-xs font-semibold uppercase tracking-widest text-amber-800 dark:text-amber-200">Winner</div>
                <div className="mt-1 text-2xl font-black text-amber-950 dark:text-amber-50">{w.scoreWinner.name}</div>
                <div className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
                  {w.scoreWinner.maskedMobile}
                  {w.scoreWinner.predictedScore && <> · predicted {w.scoreWinner.predictedScore}</>}
                  {" · "}
                  {w.scoreWinner.submittedLabel}
                </div>
                {w.count > 1 && <div className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80">Drawn at random from {w.count} exact-score predictions.</div>}
              </div>
            )}
            <div>
              <div className="text-sm font-semibold">
                {w.count === 0
                  ? session.enableScorePrediction ? "Nobody predicted the exact score." : "Nobody predicted the result."
                  : session.enableScorePrediction
                    ? `${w.count} participant${w.count === 1 ? "" : "s"} predicted the exact score`
                    : `${w.count} participant${w.count === 1 ? "" : "s"} predicted correctly`}
              </div>
              {w.names.length > 0 && (
                <ul className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {w.names.map((n, i) => (
                    <li key={`${n}-${i}`}><Badge variant="secondary" className="h-6 px-2.5 text-xs">{n}</Badge></li>
                  ))}
                  {w.count > w.names.length && <li className="px-2 py-1 text-xs text-muted-foreground">and {w.count - w.names.length} more</li>}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Winners are notified on WhatsApp.</p>
        )}
        <ResultSplit session={session} />
        <p className="mt-6 text-xs text-muted-foreground">Thank you for participating!</p>
      </CardContent>
    </Card>
  );
}

function TimeOutCard({ session }: { session: PublicSession }) {
  return (
    <Card className="shadow-2xl">
      <CardContent className="py-8 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10"><AlarmClock className="size-8 text-destructive" /></div>
        <h2 className="mt-4 text-xl font-bold">Prediction time over</h2>
        <p className="mt-2 text-muted-foreground">The prediction window for this match has ended, so your prediction could not be counted.</p>
        <div className="mt-4 text-lg font-bold">{session.match.homeTeam} vs {session.match.awayTeam}</div>
        <p className="mt-3 text-muted-foreground">Thank you for your interest.</p>
        <ResultSplit session={session} />
      </CardContent>
    </Card>
  );
}

function SuccessCard({ session, predictedTeam, score }: { session: PublicSession; predictedTeam: string; score: string | null }) {
  return (
    <Card className="shadow-2xl">
      <CardContent className="py-8 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/15"><CheckCircle2 className="size-9 text-primary" /></div>
        <h2 className="mt-4 text-xl font-bold">Prediction submitted</h2>
        <p className="mt-1 text-muted-foreground">Your prediction has been recorded.</p>
        <div className="mt-5 text-lg font-bold">{session.match.homeTeam} vs {session.match.awayTeam}</div>
        <div className="mt-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your prediction</div>
        {score ? (
          <>
            <div className="font-mono text-4xl font-black tabular-nums text-primary">{score}</div>
            <div className="text-sm font-semibold">{predictedTeam === "Draw" ? "Draw" : `${predictedTeam} to win`}</div>
          </>
        ) : (
          <div className="text-3xl font-black text-primary">{predictedTeam}</div>
        )}
        <p className="mt-5 text-muted-foreground">Thank you for participating.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          A WhatsApp confirmation will be sent to your number. After the match, the final score and the winner are announced on WhatsApp and right here: scan the QR code again to see them.
        </p>
        <ResultSplit session={session} />
      </CardContent>
    </Card>
  );
}

type FormState = {
  fullName: string; mobile: string; email: string; consent: boolean; selectedOutcome: Outcome | "";
  predictedHomeScore: string; predictedAwayScore: string; customData: Record<string, string>;
};

function ScoreStepper({ team, value, onChange, error }: { team: string; value: string; onChange: (v: string) => void; error?: boolean }) {
  const n = value === "" ? null : Number(value);
  const step = (d: number) => onChange(String(Math.min(99, Math.max(0, (n ?? 0) + d))));
  return (
    <div className="flex-1 space-y-2 text-center">
      <Label className="justify-center text-sm font-semibold">{team}</Label>
      <div className="flex items-center gap-1.5">
        <Button type="button" variant="outline" size="icon" aria-label={`Decrease ${team} score`} onClick={() => step(-1)} disabled={!n}>
          <Minus />
        </Button>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
          placeholder="0"
          aria-label={`${team} score`}
          aria-invalid={error || undefined}
          className="h-14 text-center font-mono text-3xl font-black tabular-nums"
          required
        />
        <Button type="button" variant="outline" size="icon" aria-label={`Increase ${team} score`} onClick={() => step(1)}>
          <Plus />
        </Button>
      </div>
    </div>
  );
}

function PredictionForm({ session, onSuccess, onTimedOut, onClosed }: {
  session: PublicSession;
  onSuccess: (team: string, score: string | null) => void;
  onTimedOut: () => void;
  onClosed: (status: "CANCELLED" | "COMPLETED") => void;
}) {
  const [form, setForm] = useState<FormState>({ fullName: "", mobile: "", email: "", consent: false, selectedOutcome: "", predictedHomeScore: "", predictedAwayScore: "", customData: {} });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof FormState, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const setCustom = (k: string, v: string) => setForm((f) => ({ ...f, customData: { ...f.customData, [k]: v } }));

  const options = useMemo(() => {
    const o: { value: Outcome; label: string }[] = [
      { value: "HOME", label: session.match.homeTeam },
      { value: "AWAY", label: session.match.awayTeam },
    ];
    if (session.allowDraw) o.push({ value: "DRAW", label: "Draw" });
    return o;
  }, [session]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setMessage(null);
    const details = { fullName: form.fullName, mobile: form.mobile, email: form.email, consent: form.consent || undefined, customData: form.customData };
    const showFieldErrors = (err: ApiClientError) => {
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(err.details ?? {})) mapped[k.replace(/^customData\./, "")] = v;
      setErrors(mapped);
      setMessage("Please check the highlighted fields.");
    };
    let selectedOutcome = form.selectedOutcome;
    if (session.enableScorePrediction) {
      if (form.predictedHomeScore === "" || form.predictedAwayScore === "") {
        setErrors({ predictedHomeScore: "Enter the score for both teams" });
        return;
      }
      const h = Number(form.predictedHomeScore);
      const a = Number(form.predictedAwayScore);
      const implied: Outcome = h > a ? "HOME" : h < a ? "AWAY" : "DRAW";
      if (implied === "DRAW" && !session.allowDraw) {
        setErrors({ predictedHomeScore: "A draw score is not allowed for this match. Pick a winner." });
        return;
      }
      selectedOutcome = implied;
    } else if (!selectedOutcome) {
      setErrors({ selectedOutcome: "Select who you think will win" });
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ prediction: { predictedTeam: string } }>(`/api/public/sessions/${session.token}/prediction`, {
        method: "POST",
        body: { ...details, selectedOutcome, predictedHomeScore: form.predictedHomeScore, predictedAwayScore: form.predictedAwayScore },
      });
      onSuccess(res.prediction.predictedTeam, session.enableScorePrediction ? `${form.predictedHomeScore} - ${form.predictedAwayScore}` : null);
    } catch (err) {
      const e = err as ApiClientError;
      if (e.code === "EXPIRED" && session.collectLateEntries) {
        // The server has closed the window: the prediction is rejected, the details are kept as a
        // timed-out registration (no outcome, no score) and the participant is told now, at submit.
        try {
          await api(`/api/public/sessions/${session.token}/late-entry`, { method: "POST", body: details });
          onTimedOut();
        } catch (err2) {
          const e2 = err2 as ApiClientError;
          if (e2.code === "DUPLICATE") onTimedOut();
          else if (e2.status === 422) showFieldErrors(e2);
          else setMessage(e2.message || "Something went wrong. Please try again.");
        }
      } else if (e.code === "EXPIRED") onClosed("COMPLETED");
      else if (e.code === "CANCELLED") onClosed("CANCELLED");
      else if (e.status === 422 && e.details) showFieldErrors(e);
      else setMessage(e.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => (errors[k] ? <p className="text-xs text-destructive">{errors[k]}</p> : null);

  return (
    // suppressHydrationWarning: Chrome on iOS tags forms with __gcruniqueid for autofill before hydration.
    <form onSubmit={submit} noValidate className="space-y-4" suppressHydrationWarning>
      <Card className="shadow-2xl">
        <CardHeader>
          <CardTitle>Your details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" maxLength={100} required aria-invalid={!!errors.fullName || undefined} className="h-11" />
            {err("fullName")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile">Mobile number</Label>
            <Input id="mobile" type="tel" inputMode="tel" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} autoComplete="tel" maxLength={20} required aria-invalid={!!errors.mobile || undefined} className="h-11" />
            {err("mobile") ?? <p className="text-xs text-muted-foreground">Used for your WhatsApp confirmation</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" inputMode="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" maxLength={200} required aria-invalid={!!errors.email || undefined} className="h-11" />
            {err("email")}
          </div>
          {session.fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`f-${f.key}`}>
                {f.label}
                {!f.required && <span className="font-normal text-muted-foreground"> (optional)</span>}
              </Label>
              {f.type === "SELECT" ? (
                <Select
                  value={form.customData[f.key] || null}
                  onValueChange={(v) => setCustom(f.key, (v as string | null) ?? "")}
                  items={Object.fromEntries(f.options.map((o) => [o, o]))}
                >
                  <SelectTrigger id={`f-${f.key}`} className="h-11 w-full" aria-invalid={!!errors[f.key] || undefined}>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={`f-${f.key}`}
                  type={f.type === "NUMBER" ? "number" : "text"}
                  inputMode={f.type === "NUMBER" ? "numeric" : undefined}
                  value={form.customData[f.key] ?? ""}
                  onChange={(e) => setCustom(f.key, e.target.value)}
                  required={f.required}
                  maxLength={500}
                  aria-invalid={!!errors[f.key] || undefined}
                  className="h-11"
                />
              )}
              {err(f.key)}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-2xl">
        <CardHeader>
          <CardTitle>{session.enableScorePrediction ? "What will the final score be?" : "Who will win?"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {session.enableScorePrediction ? (
            <>
              <div className="flex items-end gap-3">
                <ScoreStepper team={session.match.homeTeam} value={form.predictedHomeScore} onChange={(v) => set("predictedHomeScore", v)} error={!!errors.predictedHomeScore} />
                <div className="pb-4 text-2xl font-black text-muted-foreground">–</div>
                <ScoreStepper team={session.match.awayTeam} value={form.predictedAwayScore} onChange={(v) => set("predictedAwayScore", v)} error={!!errors.predictedAwayScore} />
              </div>
              {err("predictedHomeScore") ?? err("predictedAwayScore") ?? err("selectedOutcome")}
              <p className="text-xs text-muted-foreground">Only the exact score counts as a correct prediction. If several people get it right, one winner is drawn at random.</p>
            </>
          ) : (
            <>
              <ToggleGroup
                value={form.selectedOutcome ? [form.selectedOutcome] : []}
                onValueChange={(v) => set("selectedOutcome", ((v as string[])[0] as Outcome | undefined) ?? "")}
                aria-label="Who will win?"
                className="grid w-full grid-cols-1 gap-2"
              >
                {options.map((o) => (
                  <ToggleGroupItem
                    key={o.value}
                    value={o.value}
                    className={cn(
                      "h-14 w-full justify-start rounded-xl border-2 border-border bg-background px-4 text-base font-semibold",
                      "data-pressed:border-primary data-pressed:bg-primary/10 data-pressed:text-primary hover:bg-muted",
                    )}
                  >
                    <span className={cn("mr-3 flex size-5 items-center justify-center rounded-full border-2", form.selectedOutcome === o.value ? "border-primary bg-primary" : "border-muted-foreground/40")}>
                      {form.selectedOutcome === o.value && <CheckCircle2 className="size-4 text-primary-foreground" />}
                    </span>
                    {o.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {err("selectedOutcome")}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-2xl">
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            We use your details only to record your prediction and to send you WhatsApp updates about this match. They are never shown publicly.
          </p>
          {session.requireConsent && (
            <div className="space-y-1.5">
              <label className="flex items-start gap-2.5 text-sm">
                <Checkbox checked={form.consent} onCheckedChange={(c) => set("consent", c === true)} className="mt-0.5" />
                <span>I agree to the use of my details for this prediction and related WhatsApp messages.</span>
              </label>
              {err("consent")}
            </div>
          )}
          {message && <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>}
          <Button type="submit" size="lg" disabled={busy} className="h-12 w-full text-base">
            {busy ? "Submitting…" : "Submit prediction"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
