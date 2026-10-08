"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, ArrowRight, Ban, CheckCircle2, Hourglass, Mail, Minus, Phone, Plus, Sparkles, Trophy, User } from "lucide-react";
import type { PublicSession } from "@/lib/sessions";
import { api, ApiClientError } from "@/components/api";
import { Button } from "@/components/ui/button";
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
const initialsOf = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();

const enter = "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both";
const rise = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.3, ease: "easeOut" as const } };

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
    const burst = (x: number) => confetti({ particleCount: 90, spread: 70, origin: { x, y: 0.6 }, colors: ["#10b981", "#34d399", "#fbbf24", "#60a5fa", "#ffffff"] });
    burst(0.3);
    setTimeout(() => burst(0.7), 250);
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
  const formVisible = !success && !timedOut && !resultOut && (phase === "open" || (phase === "closed" && session.collectLateEntries));

  return (
    <div className="space-y-4">
      <SponsorBar sponsor={session.sponsor} live={phase === "open" && !resultOut} />
      <Hero session={session} phase={phase} now={now} start={start} expiry={expiry} resultOut={resultOut} />

      <AnimatePresence mode="wait" initial={false}>
        {success ? (
          <motion.div key="success" {...rise}><SuccessCard session={session} predictedTeam={success.predictedTeam} score={success.score} /></motion.div>
        ) : timedOut ? (
          <motion.div key="timeout" {...rise}><TimeOutCard session={session} /></motion.div>
        ) : resultOut ? (
          <motion.div key="result" {...rise}><ResultCard session={session} /></motion.div>
        ) : formVisible ? (
          // After expiry (when the session keeps collecting details) the form stays as it is; the server
          // rejects the prediction at submit, the details are kept, and the popup appears then.
          <motion.div key="form" {...rise} className={cn(enter, "[animation-delay:140ms]")}>
            <PredictionForm
              session={session}
              onSuccess={(predictedTeam, score) => setSuccess({ predictedTeam, score })}
              onTimedOut={handleTimedOut}
              onClosed={(status) => setSession((s) => ({ ...s, status }))}
            />
          </motion.div>
        ) : phase === "upcoming" ? (
          <motion.div key="upcoming" {...rise}>
            <InfoCard icon={<Hourglass className="size-9 text-emerald-300" />} title="Not open yet" body="Prediction has not started yet. Keep this page open, the form appears when the window opens." />
          </motion.div>
        ) : phase === "cancelled" ? (
          <motion.div key="cancelled" {...rise}>
            <InfoCard icon={<Ban className="size-9 text-rose-300" />} title="Session cancelled" body="This prediction session has been cancelled. Please scan a valid QR code for another active prediction." />
          </motion.div>
        ) : (
          <motion.div key="closed" {...rise}><ClosedCard session={session} /></motion.div>
        )}
      </AnimatePresence>

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

/* ----------------------------------------------------------------------------------------------- */
/* Header: sponsor bar + hero scoreboard                                                            */
/* ----------------------------------------------------------------------------------------------- */

function SponsorBar({ sponsor, live }: { sponsor: PublicSession["sponsor"]; live: boolean }) {
  return (
    <div className={cn(enter, "flex items-center justify-between gap-3 rounded-2xl bg-white/[0.07] p-2 pr-3 ring-1 ring-white/10 backdrop-blur-md")}>
      {sponsor ? (
        <SponsorIdentity sponsor={sponsor} />
      ) : (
        <div className="flex items-center gap-3 pl-1">
          <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/20 text-lg">⚽</span>
          <span className="font-display text-2xl tracking-wide">Football Prediction</span>
        </div>
      )}
      {live && (
        <Badge className="h-7 gap-1.5 bg-emerald-500 px-2.5 text-xs font-bold text-white shadow-[0_0_20px_-4px_oklch(0.75_0.2_150)]">
          <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-white" /></span>
          LIVE
        </Badge>
      )}
    </div>
  );
}

function SponsorIdentity({ sponsor }: { sponsor: NonNullable<PublicSession["sponsor"]> }) {
  const inner = (
    <>
      {sponsor.logoUrl && (
        <span className="relative size-12 shrink-0 overflow-hidden rounded-xl ring-2 ring-emerald-400/40 shadow-[0_0_28px_-6px_oklch(0.75_0.2_150)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sponsor.logoUrl} alt={`${sponsor.name} logo`} className="size-full scale-[1.7] object-cover" />
        </span>
      )}
      <span className="min-w-0 leading-none">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/90">{sponsor.tagline}</span>
        <span className="mt-1 block truncate font-display text-[26px] tracking-wide text-white">{sponsor.name}</span>
      </span>
    </>
  );
  const cls = "flex min-w-0 items-center gap-3";
  return sponsor.url ? (
    <a href={sponsor.url} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function Crest({ name, logo, align }: { name: string; logo: string | null; align: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-2", align === "left" ? "text-center" : "text-center")}>
      <motion.div
        whileHover={{ scale: 1.04 }}
        className="relative flex size-[76px] items-center justify-center rounded-full bg-gradient-to-br from-white/15 to-white/5 ring-2 ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_12px_30px_-12px_rgba(0,0,0,0.8)]"
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={name} className="size-14 object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)]" />
        ) : (
          <span className="font-display text-3xl tracking-wider text-white">{initialsOf(name)}</span>
        )}
      </motion.div>
      <div className="line-clamp-2 font-display text-[22px] leading-[0.95] tracking-wide text-white">{name}</div>
    </div>
  );
}

function Hero({ session, phase, now, start, expiry, resultOut }: { session: PublicSession; phase: Phase; now: number; start: number; expiry: number; resultOut: boolean }) {
  const remaining = phase === "upcoming" ? start - now : expiry - now;
  const durationMs = Math.max(1, session.durationMinutes * 60_000);
  const progress = Math.max(0, Math.min(100, (remaining / durationMs) * 100));
  const secs = Math.ceil(remaining / 1000);
  const tone = phase !== "open" ? "neutral" : secs > 60 ? "ok" : secs > 20 ? "warn" : "danger";
  const toneText = { ok: "text-emerald-300", warn: "text-amber-300", danger: "text-rose-300", neutral: "text-white/60" }[tone];
  const toneBar = { ok: "bg-emerald-400", warn: "bg-amber-400", danger: "bg-rose-500", neutral: "bg-white/30" }[tone];
  const toneLabel = { ok: "Open now", warn: "Closing soon", danger: "Last seconds", neutral: "" }[tone];

  let label: string;
  let text: string;
  let bar = false;
  if (resultOut && session.finalScore) {
    label = "Full time";
    text = `${session.finalScore.homeScore} – ${session.finalScore.awayScore}`;
  } else if (phase === "open") {
    label = "Prediction closes in";
    text = clock(remaining);
    bar = true;
  } else if (phase === "closed" && session.collectLateEntries) {
    label = "Prediction closes in";
    text = "00:00";
  } else if (phase === "upcoming") {
    label = "Prediction opens in";
    text = clock(remaining);
  } else if (phase === "cancelled") {
    label = "Session";
    text = "Cancelled";
  } else {
    label = "Prediction";
    text = "Closed";
  }

  return (
    <section className={cn(enter, "relative overflow-hidden rounded-3xl bg-gradient-to-b from-white/[0.09] to-white/[0.03] p-5 ring-1 ring-white/10 backdrop-blur-md [animation-delay:80ms]")}>
      <div aria-hidden className="animate-float-glow pointer-events-none absolute -top-28 left-1/2 h-52 w-80 rounded-full bg-emerald-400/25 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.28em]">
          <span className="text-emerald-300">Matchday prediction</span>
          {session.match.competition && <span className="truncate pl-3 text-white/45">{session.match.competition}</span>}
        </div>
        <h1 className="mt-2 font-display text-[44px] leading-[0.9] tracking-wide">
          Predict <span className="bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent">&amp; win</span>
        </h1>
        <p className="mt-1.5 text-sm text-white/60">
          {[session.eventName, session.campaignName].filter(Boolean).join(" · ") || "Call the result before the whistle."}
        </p>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <Crest name={session.match.homeTeam} logo={session.match.homeTeamLogo} align="left" />
          <div className="mt-5 flex flex-col items-center">
            <span className="font-display text-3xl tracking-widest text-white/35">VS</span>
          </div>
          <Crest name={session.match.awayTeam} logo={session.match.awayTeamLogo} align="right" />
        </div>
        <div className="mt-3 text-center text-xs text-white/55">
          {session.match.kickoffLabel}
          {session.match.venue && <> · {session.match.venue}</>}
        </div>

        <div className="mt-5 rounded-2xl bg-black/40 px-4 py-3 ring-1 ring-white/10" aria-live="polite">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.28em] text-white/55">
            <span>{label}</span>
            {toneLabel && <span className={toneText}>{toneLabel}</span>}
          </div>
          <div className="mt-1 h-[58px] overflow-hidden text-center">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={text}
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }}
                transition={{ duration: 0.16 }}
                className={cn("font-display text-[56px] leading-none tracking-wider tabular-nums", tone === "danger" ? "animate-pulse text-rose-300" : tone === "warn" ? "text-amber-300" : "text-white")}
              >
                {text}
              </motion.div>
            </AnimatePresence>
          </div>
          {bar && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div className={cn("h-full rounded-full", toneBar)} animate={{ width: `${progress}%` }} transition={{ ease: "linear", duration: 0.25 }} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* Cards                                                                                            */
/* ----------------------------------------------------------------------------------------------- */

function Shell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-3xl bg-white p-5 text-foreground shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)]", className)}>{children}</div>;
}

function Step({ n, title, hint }: { n: string; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 font-display text-xl leading-none text-emerald-700">{n}</span>
      <div>
        <div className="font-display text-[26px] leading-none tracking-wide">{title}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Shell className="py-8 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-900">{icon}</div>
      <h2 className="mt-4 font-display text-4xl tracking-wide">{title}</h2>
      <p className="mt-2 text-muted-foreground">{body}</p>
    </Shell>
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
    <div className="mt-6 rounded-2xl bg-muted/60 p-4 text-left">
      <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">How everyone voted · {r.total}</div>
      <div className="mt-3 space-y-2.5">
        {rows.map(([label, n]) => (
          <div key={label}>
            <div className="flex justify-between text-sm">
              <span className="font-medium">{label}</span>
              <span className="font-display text-lg leading-none tabular-nums">{pct(n)}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-background">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400" initial={{ width: 0 }} animate={{ width: `${pct(n)}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClosedCard({ session }: { session: PublicSession }) {
  return (
    <Shell className="py-8 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-900"><AlarmClock className="size-8 text-white/80" /></div>
      <h2 className="mt-4 font-display text-4xl tracking-wide">Prediction closed</h2>
      <p className="mt-2 text-muted-foreground">The prediction window for this match has ended.</p>
      <p className="mt-1 text-sm text-muted-foreground">Please scan a valid QR code for another active prediction.</p>
      <ResultSplit session={session} />
    </Shell>
  );
}

function ResultCard({ session }: { session: PublicSession }) {
  const f = session.finalScore!;
  const w = session.winners;
  const outcomeText = f.winningOutcome === "DRAW" ? "The match ended in a draw" : `${f.winningOutcome === "HOME" ? session.match.homeTeam : session.match.awayTeam} won`;
  return (
    <Shell className="py-6 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-700">Final result</div>
      <div className="mt-2 font-display text-[34px] leading-none tracking-wide">
        {session.match.homeTeam} <span className="text-emerald-600">{f.homeScore} – {f.awayScore}</span> {session.match.awayTeam}
      </div>
      <div className="mt-2 text-muted-foreground">{outcomeText}</div>

      {w ? (
        <div className="mt-6 space-y-5">
          {w.scoreWinner && (
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }} className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-amber-200 via-amber-100 to-amber-50 p-5 ring-1 ring-amber-300/70">
              <div aria-hidden className="animate-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
              <div className="relative">
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}>
                  <Trophy className="mx-auto size-10 text-amber-500 drop-shadow" />
                </motion.div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-800">Winner</div>
                <div className="mt-1 font-display text-4xl tracking-wide text-amber-950">{w.scoreWinner.name}</div>
                <div className="mt-1 text-sm text-amber-900/80">
                  {w.scoreWinner.maskedMobile}
                  {w.scoreWinner.predictedScore && <> · predicted {w.scoreWinner.predictedScore}</>}
                  {" · "}
                  {w.scoreWinner.submittedLabel}
                </div>
                {w.count > 1 && <div className="mt-2 text-xs text-amber-800/80">Drawn at random from {w.count} exact-score predictions.</div>}
              </div>
            </motion.div>
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
    </Shell>
  );
}

function TimeOutCard({ session }: { session: PublicSession }) {
  return (
    <Shell className="py-8 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-rose-500/10"><AlarmClock className="size-8 text-rose-600" /></div>
      <h2 className="mt-4 font-display text-4xl tracking-wide">Prediction time over</h2>
      <p className="mt-2 text-muted-foreground">The prediction window for this match has ended, so your prediction could not be counted.</p>
      <div className="mt-4 font-display text-2xl tracking-wide">{session.match.homeTeam} vs {session.match.awayTeam}</div>
      <p className="mt-3 text-muted-foreground">Thank you for your interest.</p>
      <ResultSplit session={session} />
    </Shell>
  );
}

function SuccessCard({ session, predictedTeam, score }: { session: PublicSession; predictedTeam: string; score: string | null }) {
  return (
    <Shell className="relative overflow-hidden py-8 text-center ring-2 ring-emerald-400/60">
      <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-emerald-400/30 blur-3xl" />
      <div className="relative">
        <motion.div initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 16 }} className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_0_40px_-8px_oklch(0.72_0.17_160)]">
          <CheckCircle2 className="size-10" />
        </motion.div>
        <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-700">You&apos;re in</div>
        <h2 className="mt-1 font-display text-[40px] leading-none tracking-wide">Prediction locked</h2>
        <p className="mt-2 text-muted-foreground">Your prediction has been recorded.</p>
        <div className="mt-5 font-display text-2xl tracking-wide">{session.match.homeTeam} vs {session.match.awayTeam}</div>
        <div className="mt-4 rounded-2xl bg-slate-900 px-4 py-4 text-white">
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/60">Your call</div>
          {score ? (
            <>
              <div className="font-display text-[52px] leading-none tracking-widest text-emerald-300">{score}</div>
              <div className="mt-1 text-sm font-semibold text-white/80">{predictedTeam === "Draw" ? "Draw" : `${predictedTeam} to win`}</div>
            </>
          ) : (
            <div className="font-display text-[40px] leading-none tracking-wide text-emerald-300">{predictedTeam}</div>
          )}
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          A WhatsApp confirmation is on its way. After the match, the final score and the winner are announced on WhatsApp and right here: scan the QR code again to see them.
        </p>
        <ResultSplit session={session} />
      </div>
    </Shell>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* Form                                                                                             */
/* ----------------------------------------------------------------------------------------------- */

type FormState = {
  fullName: string; mobile: string; email: string; consent: boolean; selectedOutcome: Outcome | "";
  predictedHomeScore: string; predictedAwayScore: string; customData: Record<string, string>;
};

function ScoreStepper({ team, value, onChange, error }: { team: string; value: string; onChange: (v: string) => void; error?: boolean }) {
  const n = value === "" ? null : Number(value);
  const step = (d: number) => onChange(String(Math.min(99, Math.max(0, (n ?? 0) + d))));
  return (
    <div className="flex-1 text-center">
      <div className="line-clamp-1 font-display text-xl leading-none tracking-wide">{team}</div>
      <div className="mt-2 flex items-center gap-1.5">
        <motion.div whileTap={{ scale: 0.9 }}>
          <Button type="button" variant="outline" size="icon" className="size-11 rounded-xl" aria-label={`Decrease ${team} score`} onClick={() => step(-1)} disabled={!n}>
            <Minus />
          </Button>
        </motion.div>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
          placeholder="0"
          aria-label={`${team} score`}
          aria-invalid={error || undefined}
          className="h-16 rounded-xl bg-slate-900 text-center font-display text-[40px] tracking-widest text-emerald-300 placeholder:text-white/30 focus-visible:ring-emerald-400/40"
          required
        />
        <motion.div whileTap={{ scale: 0.9 }}>
          <Button type="button" variant="outline" size="icon" className="size-11 rounded-xl" aria-label={`Increase ${team} score`} onClick={() => step(1)}>
            <Plus />
          </Button>
        </motion.div>
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
    const o: { value: Outcome; label: string; sub: string }[] = [
      { value: "HOME", label: session.match.homeTeam, sub: "Home win" },
      { value: "AWAY", label: session.match.awayTeam, sub: "Away win" },
    ];
    if (session.allowDraw) o.push({ value: "DRAW", label: "Draw", sub: "Honours even" });
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
      onSuccess(res.prediction.predictedTeam, session.enableScorePrediction ? `${form.predictedHomeScore} – ${form.predictedAwayScore}` : null);
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
  const field = "h-12 rounded-xl pl-10 text-base";

  return (
    // suppressHydrationWarning: Chrome on iOS tags forms with __gcruniqueid for autofill before hydration.
    <form onSubmit={submit} noValidate className="space-y-4" suppressHydrationWarning>
      <Shell>
        <Step n="01" title="Your details" hint="For your WhatsApp confirmation and the winner announcement" />
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" maxLength={100} required aria-invalid={!!errors.fullName || undefined} className={field} placeholder="Your name" />
            </div>
            {err("fullName")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile">Mobile number</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="mobile" type="tel" inputMode="tel" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} autoComplete="tel" maxLength={20} required aria-invalid={!!errors.mobile || undefined} className={field} placeholder="WhatsApp number" />
            </div>
            {err("mobile")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" type="email" inputMode="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" maxLength={200} required aria-invalid={!!errors.email || undefined} className={field} placeholder="you@example.com" />
            </div>
            {err("email")}
          </div>
          {session.fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`f-${f.key}`}>
                {f.label}
                {!f.required && <span className="font-normal text-muted-foreground"> (optional)</span>}
              </Label>
              {f.type === "SELECT" ? (
                <Select value={form.customData[f.key] || null} onValueChange={(v) => setCustom(f.key, (v as string | null) ?? "")} items={Object.fromEntries(f.options.map((o) => [o, o]))}>
                  <SelectTrigger id={`f-${f.key}`} className="h-12 w-full rounded-xl text-base" aria-invalid={!!errors[f.key] || undefined}>
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
                  className="h-12 rounded-xl text-base"
                />
              )}
              {err(f.key)}
            </div>
          ))}
        </div>
      </Shell>

      <Shell>
        <Step n="02" title={session.enableScorePrediction ? "Call the score" : "Who takes it?"} hint={session.enableScorePrediction ? "Only the exact score wins the prize" : "One pick. Choose wisely."} />
        {session.enableScorePrediction ? (
          <>
            <div className="flex items-end gap-3">
              <ScoreStepper team={session.match.homeTeam} value={form.predictedHomeScore} onChange={(v) => set("predictedHomeScore", v)} error={!!errors.predictedHomeScore} />
              <div className="pb-5 font-display text-3xl text-muted-foreground">–</div>
              <ScoreStepper team={session.match.awayTeam} value={form.predictedAwayScore} onChange={(v) => set("predictedAwayScore", v)} error={!!errors.predictedAwayScore} />
            </div>
            <div className="mt-2">{err("predictedHomeScore") ?? err("predictedAwayScore") ?? err("selectedOutcome")}</div>
            <p className="mt-2 text-xs text-muted-foreground">If several people get it right, one winner is drawn at random.</p>
          </>
        ) : (
          <>
            <ToggleGroup
              value={form.selectedOutcome ? [form.selectedOutcome] : []}
              onValueChange={(v) => set("selectedOutcome", ((v as string[])[0] as Outcome | undefined) ?? "")}
              aria-label="Who will win?"
              className="grid w-full grid-cols-1 gap-2.5"
            >
              {options.map((o) => (
                <motion.div key={o.value} whileTap={{ scale: 0.985 }}>
                  <ToggleGroupItem
                    value={o.value}
                    className={cn(
                      "group h-[68px] w-full justify-start gap-3 rounded-2xl border-2 border-border bg-background px-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/40",
                      "data-pressed:border-emerald-500 data-pressed:bg-emerald-500/10",
                    )}
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 font-display text-xl tracking-wider text-white group-data-pressed:bg-emerald-500">
                      {o.value === "DRAW" ? "=" : initialsOf(o.label)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold">{o.label}</span>
                      <span className="block text-xs text-muted-foreground">{o.sub}</span>
                    </span>
                    <CheckCircle2 className="size-6 shrink-0 text-emerald-500 opacity-0 transition-opacity group-data-pressed:opacity-100" />
                  </ToggleGroupItem>
                </motion.div>
              ))}
            </ToggleGroup>
            <div className="mt-2">{err("selectedOutcome")}</div>
          </>
        )}
      </Shell>

      <Shell className="space-y-4">
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
        <motion.div whileTap={{ scale: 0.98 }}>
          <Button type="submit" size="lg" disabled={busy} className="h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-lg font-bold shadow-[0_14px_30px_-10px_oklch(0.6_0.17_160)] hover:from-emerald-600 hover:to-emerald-600">
            {busy ? "Locking it in…" : "Lock in my prediction"}
            {!busy && <ArrowRight data-icon="inline-end" />}
          </Button>
        </motion.div>
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <Sparkles className="size-3.5 text-emerald-600" /> One entry per person. Winners are announced after full time.
        </p>
      </Shell>
    </form>
  );
}
