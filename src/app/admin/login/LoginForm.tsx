"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, Wand2 } from "lucide-react";
import { api, ApiClientError } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BrandMark } from "@/components/brand-mark";

const field = "h-12 rounded-xl border-white/10 bg-black/35 pl-10 text-base text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] placeholder:text-white/30 hover:border-white/20 focus-visible:border-emerald-400/60 focus-visible:ring-emerald-400/25";

type Demo = { email: string; password: string } | null;

export function LoginForm({ demo = null }: { demo?: Demo }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login(creds: { email: string; password: string }) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", body: creds });
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch (err) {
      setError((err as ApiClientError).message);
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void login({ email, password });
  }

  /** Fills the demo account into the fields and signs in straight away. */
  function useDemo() {
    if (!demo) return;
    setEmail(demo.email);
    setPassword(demo.password);
    void login(demo);
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-white/[0.09] to-white/[0.03] p-6 ring-1 ring-white/10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-md md:p-7">
      <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
      <div aria-hidden className="animate-float-glow pointer-events-none absolute -top-24 left-1/2 h-44 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-4">
          <BrandMark size="lg" />
          <div className="leading-none">
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-300/90">Admin access</div>
            <div className="mt-1.5 font-display text-[32px] tracking-wide">Sign in</div>
            <div className="mt-1 text-xs text-white/50">Use your administrator account.</div>
          </div>
        </div>
        <div aria-hidden className="mt-5 h-px bg-gradient-to-r from-white/15 via-white/5 to-transparent" />

        {/* suppressHydrationWarning: Chrome on iOS tags forms with __gcruniqueid for autofill before hydration. */}
        <form onSubmit={submit} className="mt-5 space-y-4" suppressHydrationWarning>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/80">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/45" />
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus className={field} placeholder="you@example.com" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/80">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/45" />
              <Input id="password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className={`${field} pr-12`} />
              <Button type="button" variant="ghost" size="icon-sm" className="absolute top-1/2 right-1.5 -translate-y-1/2 text-white/60 hover:bg-white/10 hover:text-white" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)}>
                {show ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>
          {error && (
            <Alert variant="destructive" className="border-rose-400/40 bg-rose-500/15 text-rose-100">
              <AlertDescription className="text-rose-100">{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" disabled={busy} className="h-13 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-base font-bold text-white shadow-[0_14px_30px_-10px_oklch(0.6_0.17_160)] hover:from-emerald-500 hover:to-emerald-500">
            {busy ? "Signing in…" : "Enter the console"}
            {!busy && <ArrowRight data-icon="inline-end" />}
          </Button>
          {demo && (
            <>
              <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/35">
                <span className="h-px flex-1 bg-white/10" />
                Demo
                <span className="h-px flex-1 bg-white/10" />
              </div>
              <Button type="button" variant="outline" size="lg" disabled={busy} onClick={useDemo} className="h-12 w-full rounded-2xl border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20 hover:text-white">
                <Wand2 data-icon="inline-start" /> Autofill demo credentials & sign in
              </Button>
              <p className="text-center text-[11px] text-white/40">
                Fills <span className="text-white/60">{demo.email}</span> and signs you in. Remove the demo variables from the environment to hide this.
              </p>
            </>
          )}
        </form>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-white/45">
          <ShieldCheck className="size-3.5 text-emerald-300" /> Admin access only. Sessions expire after 12 hours.
        </p>
      </div>
    </div>
  );
}
