"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicSession } from "@/lib/sessions";
import { api, ApiClientError } from "@/components/api";
import { Alert, Button, Checkbox, Field, Input, Select } from "@/components/ui";

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
  // Server clock offset: the browser clock is only used to animate, never to decide.
  const [offset, setOffset] = useState(() => Date.parse(initial.serverTime) - Date.now());
  const [now, setNow] = useState(() => Date.now() + offset);
  const [success, setSuccess] = useState<{ predictedTeam: string; score: string | null } | null>(null);
  const [timedOut, setTimedOut] = useState<"late" | "missed" | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(id);
  }, [offset]);

  // Re-sync with the server every 30 s (picks up cancellations and clock drift).
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

  const start = Date.parse(session.startTime);
  const expiry = Date.parse(session.expiryTime);
  const phase: Phase =
    session.status === "CANCELLED" ? "cancelled"
    : session.status === "COMPLETED" ? "closed"
    : now < start ? "upcoming"
    : now < expiry ? "open"
    : "closed";

  return (
    <div className="space-y-4">
      <MatchHeader session={session} phase={phase} remaining={phase === "upcoming" ? start - now : expiry - now} />
      {success ? (
        <SuccessCard session={session} predictedTeam={success.predictedTeam} score={success.score} />
      ) : timedOut ? (
        <TimeOutCard session={session} reason={timedOut} />
      ) : phase === "open" ? (
        <PredictionForm
          session={session}
          onSuccess={(predictedTeam, score) => setSuccess({ predictedTeam, score })}
          onTimedOut={setTimedOut}
          onClosed={(status) => setSession((s) => ({ ...s, status }))}
        />
      ) : phase === "upcoming" ? (
        <InfoCard icon="⏳" title="Not Open Yet" body="Prediction has not started yet. Keep this page open, the form will appear when the window opens." />
      ) : phase === "cancelled" ? (
        <InfoCard icon="🚫" title="Session Cancelled" body="This prediction session has been cancelled. Please scan a valid QR code for another active prediction." />
      ) : session.collectLateEntries ? (
        <PredictionForm session={session} late onSuccess={() => undefined} onTimedOut={setTimedOut} onClosed={(status) => setSession((s) => ({ ...s, status }))} />
      ) : (
        <ClosedCard session={session} />
      )}
    </div>
  );
}

function TeamBadge({ name, logo }: { name: string; logo: string | null }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={name} className="h-16 w-16 object-contain" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-700">{initials}</div>
      )}
      <div className="text-center text-sm font-semibold leading-tight">{name}</div>
    </div>
  );
}

function MatchHeader({ session, phase, remaining }: { session: PublicSession; phase: Phase; remaining: number }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-xl">
      <div className="text-center text-xs font-semibold uppercase tracking-widest text-emerald-700">Football Prediction</div>
      {(session.campaignName || session.eventName) && (
        <div className="mt-1 text-center text-xs text-slate-500">{[session.eventName, session.campaignName].filter(Boolean).join(" · ")}</div>
      )}
      <div className="mt-4 flex items-center gap-2">
        <TeamBadge name={session.match.homeTeam} logo={session.match.homeTeamLogo} />
        <div className="text-xl font-black text-slate-400">VS</div>
        <TeamBadge name={session.match.awayTeam} logo={session.match.awayTeamLogo} />
      </div>
      <div className="mt-4 text-center text-sm text-slate-600">
        {session.match.competition && <div>{session.match.competition}</div>}
        <div>{session.match.kickoffLabel}</div>
        {session.match.venue && <div className="text-xs text-slate-500">{session.match.venue}</div>}
      </div>
      <div className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-center text-white" aria-live="polite">
        {phase === "open" && (
          <>
            <div className="text-xs uppercase tracking-wide text-slate-300">Prediction closes in</div>
            <div className="font-mono text-3xl font-bold tabular-nums">{clock(remaining)}</div>
          </>
        )}
        {phase === "upcoming" && (
          <>
            <div className="text-xs uppercase tracking-wide text-slate-300">Prediction opens in</div>
            <div className="font-mono text-3xl font-bold tabular-nums">{clock(remaining)}</div>
          </>
        )}
        {phase === "closed" && <div className="text-lg font-bold">Prediction Closed</div>}
        {phase === "cancelled" && <div className="text-lg font-bold">Session Cancelled</div>}
      </div>
    </div>
  );
}

function InfoCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-xl">
      <div className="text-4xl">{icon}</div>
      <h2 className="mt-3 text-xl font-bold">{title}</h2>
      <p className="mt-2 text-slate-600">{body}</p>
    </div>
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
    <div className="mt-5 rounded-xl bg-slate-50 p-4 text-left">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">How everyone voted ({r.total})</div>
      <div className="mt-2 space-y-2">
        {rows.map(([label, n]) => (
          <div key={label}>
            <div className="flex justify-between text-sm">
              <span>{label}</span>
              <span className="font-semibold">{pct(n)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-emerald-500" style={{ width: `${pct(n)}%` }} />
            </div>
          </div>
        ))}
      </div>
      {session.finalScore && (
        <div className="mt-3 text-center text-sm font-semibold">
          Final score: {session.match.homeTeam} {session.finalScore.homeScore} - {session.finalScore.awayScore} {session.match.awayTeam}
        </div>
      )}
    </div>
  );
}

function ClosedCard({ session }: { session: PublicSession }) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-xl">
      <div className="text-4xl">⏰</div>
      <h2 className="mt-3 text-xl font-bold">Prediction Closed</h2>
      <p className="mt-2 text-slate-600">The prediction window for this match has ended.</p>
      <p className="mt-1 text-sm text-slate-500">Please scan a valid QR code for another active prediction.</p>
      <ResultSplit session={session} />
    </div>
  );
}

function TimeOutCard({ session, reason }: { session: PublicSession; reason: "late" | "missed" }) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-xl">
      <div className="text-4xl">⏰</div>
      <h2 className="mt-3 text-xl font-bold">Time Out</h2>
      <p className="mt-2 text-slate-600">
        {reason === "missed"
          ? "The prediction window closed while you were submitting, so your prediction could not be counted."
          : "The prediction window for this match had already ended, so no prediction was recorded."}
      </p>
      <div className="mt-4 text-lg font-bold">
        {session.match.homeTeam} vs {session.match.awayTeam}
      </div>
      <p className="mt-3 text-slate-700">Your details have been registered for this event. Thank you for participating!</p>
      <ResultSplit session={session} />
    </div>
  );
}

function SuccessCard({ session, predictedTeam, score }: { session: PublicSession; predictedTeam: string; score: string | null }) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-xl">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl">✅</div>
      <h2 className="mt-3 text-xl font-bold">Prediction Submitted Successfully</h2>
      <p className="mt-2 text-slate-600">Your prediction has been recorded.</p>
      <div className="mt-4 text-lg font-bold">
        {session.match.homeTeam} vs {session.match.awayTeam}
      </div>
      <div className="mt-3 text-sm text-slate-500">Your prediction:</div>
      {score ? (
        <>
          <div className="text-3xl font-black text-emerald-700">{score}</div>
          <div className="text-sm font-semibold text-slate-700">{predictedTeam === "Draw" ? "Draw" : `${predictedTeam} to win`}</div>
        </>
      ) : (
        <div className="text-2xl font-black text-emerald-700">{predictedTeam}</div>
      )}
      <p className="mt-4 text-slate-600">Thank you for participating.</p>
      <p className="mt-1 text-xs text-slate-500">A WhatsApp confirmation will be sent to your number. We will message you again when the result is in.</p>
      <ResultSplit session={session} />
    </div>
  );
}

type FormState = {
  fullName: string; mobile: string; email: string; consent: boolean; selectedOutcome: Outcome | "";
  predictedHomeScore: string; predictedAwayScore: string; customData: Record<string, string>;
};

function PredictionForm({ session, late = false, onSuccess, onTimedOut, onClosed }: {
  session: PublicSession;
  /** Window already closed: collect details only, no prediction. */
  late?: boolean;
  onSuccess: (team: string, score: string | null) => void;
  onTimedOut: (reason: "late" | "missed") => void;
  onClosed: (status: "CANCELLED" | "COMPLETED") => void;
}) {
  const [form, setForm] = useState<FormState>({ fullName: "", mobile: "", email: "", consent: false, selectedOutcome: "", predictedHomeScore: "", predictedAwayScore: "", customData: {} });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof FormState, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const setCustom = (k: string, v: string) => setForm((f) => ({ ...f, customData: { ...f.customData, [k]: v } }));
  const setScore = (k: "predictedHomeScore" | "predictedAwayScore", v: string) => set(k, v.replace(/\D/g, "").slice(0, 2));

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
    const lateEntry = () => api(`/api/public/sessions/${session.token}/late-entry`, { method: "POST", body: details });
    let selectedOutcome = form.selectedOutcome;
    if (late) {
      // nothing to validate beyond the details
    } else if (session.enableScorePrediction) {
      // Single question: the score. The winner follows from it (the server derives it again).
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
      if (late) {
        await lateEntry();
        onTimedOut("late");
        return;
      }
      const res = await api<{ prediction: { predictedTeam: string } }>(`/api/public/sessions/${session.token}/prediction`, {
        method: "POST",
        body: { ...details, selectedOutcome, predictedHomeScore: form.predictedHomeScore, predictedAwayScore: form.predictedAwayScore },
      });
      onSuccess(res.prediction.predictedTeam, session.enableScorePrediction ? `${form.predictedHomeScore} - ${form.predictedAwayScore}` : null);
    } catch (err) {
      const e = err as ApiClientError;
      if (e.code === "EXPIRED" && !late && session.collectLateEntries) {
        // The window closed between page load and submit (e.g. opened 18:09:55, submitted 18:10:05):
        // the prediction is rejected, but the details are kept as a timed-out registration.
        try {
          await lateEntry();
          onTimedOut("missed");
          return;
        } catch {
          /* fall through to the closed screen */
        }
      }
      if (e.code === "EXPIRED") onClosed("COMPLETED");
      else if (e.code === "CANCELLED") onClosed("CANCELLED");
      else if (e.status === 422 && e.details) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(e.details)) mapped[k.replace(/^customData\./, "")] = v;
        setErrors(mapped);
        setMessage("Please check the highlighted fields.");
      } else setMessage(e.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 shadow-xl" noValidate>
      {late && (
        <Alert kind="info">
          Prediction time is over for this match, so predictions are no longer accepted. You can still register your details to take part in this event.
        </Alert>
      )}
      <h2 className="text-lg font-bold">Your details</h2>
      <Field label="Full Name" required error={errors.fullName}>
        <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" maxLength={100} required />
      </Field>
      <Field label="Mobile Number" required error={errors.mobile} hint="Used for your WhatsApp confirmation">
        <Input type="tel" inputMode="tel" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} autoComplete="tel" maxLength={20} required />
      </Field>
      <Field label="Email Address" required error={errors.email}>
        <Input type="email" inputMode="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" maxLength={200} required />
      </Field>
      {session.fields.map((f) => (
        <Field key={f.key} label={f.label} required={f.required} error={errors[f.key]}>
          {f.type === "SELECT" ? (
            <Select value={form.customData[f.key] ?? ""} onChange={(e) => setCustom(f.key, e.target.value)} required={f.required}>
              <option value="">Select…</option>
              {f.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </Select>
          ) : (
            <Input
              type={f.type === "NUMBER" ? "number" : "text"}
              inputMode={f.type === "NUMBER" ? "numeric" : undefined}
              value={form.customData[f.key] ?? ""}
              onChange={(e) => setCustom(f.key, e.target.value)}
              required={f.required}
              maxLength={500}
            />
          )}
        </Field>
      ))}

      {!late && !session.enableScorePrediction && (
      <div>
        <h2 className="text-lg font-bold">Who will win?</h2>
        <div className="mt-2 grid gap-2" role="radiogroup" aria-label="Who will win?">
          {options.map((o) => {
            const selected = form.selectedOutcome === o.value;
            return (
              <button
                type="button"
                key={o.value}
                role="radio"
                aria-checked={selected}
                onClick={() => set("selectedOutcome", o.value)}
                className={`w-full rounded-xl border-2 px-4 py-3 text-left text-base font-semibold transition ${
                  selected ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white hover:border-slate-400"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        {errors.selectedOutcome && <p className="mt-1 text-sm text-rose-600">{errors.selectedOutcome}</p>}
      </div>
      )}

      {!late && session.enableScorePrediction && (
        <div>
          <h2 className="text-lg font-bold">What will the final score be?</h2>
          <div className="mt-2 flex items-end gap-3">
            <label className="flex-1 text-center text-sm font-medium">
              {session.match.homeTeam}
              <Input type="text" inputMode="numeric" pattern="[0-9]*" value={form.predictedHomeScore} onChange={(e) => setScore("predictedHomeScore", e.target.value)} className="mt-1 text-center text-2xl font-bold" placeholder="0" required aria-label={`${session.match.homeTeam} score`} />
            </label>
            <span className="pb-3 text-2xl font-black text-slate-400">-</span>
            <label className="flex-1 text-center text-sm font-medium">
              {session.match.awayTeam}
              <Input type="text" inputMode="numeric" pattern="[0-9]*" value={form.predictedAwayScore} onChange={(e) => setScore("predictedAwayScore", e.target.value)} className="mt-1 text-center text-2xl font-bold" placeholder="0" required aria-label={`${session.match.awayTeam} score`} />
            </label>
          </div>
          {(errors.predictedHomeScore || errors.predictedAwayScore || errors.selectedOutcome) && (
            <p className="mt-1 text-sm text-rose-600">{errors.predictedHomeScore || errors.predictedAwayScore || errors.selectedOutcome}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            The winning team follows from your score. Get the exact score to win the score prize; if several people get it right, the earliest submission is selected.
          </p>
        </div>
      )}

      <p className="text-xs text-slate-500">
        We use your details only to record your prediction and to send you WhatsApp updates about this match. They are never shown publicly.
      </p>
      {session.requireConsent && (
        <div>
          <Checkbox checked={form.consent} onChange={(e) => set("consent", e.target.checked)} label="I agree to the use of my details for this prediction and related WhatsApp messages." />
          {errors.consent && <p className="mt-1 text-sm text-rose-600">{errors.consent}</p>}
        </div>
      )}
      {message && <Alert>{message}</Alert>}
      <Button type="submit" disabled={busy} className="w-full py-3 text-base">
        {busy ? "Submitting…" : late ? "Register My Details" : "Submit Prediction"}
      </Button>
    </form>
  );
}
