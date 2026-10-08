import { CheckCircle2 } from "lucide-react";
import { getSponsor } from "@/lib/sponsor";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Admin Login · Football Prediction" };

const POINTS = ["QR sessions with a server-enforced 10-minute window", "Winner and exact-score predictions with a fair random draw", "WhatsApp confirmations and result notifications"];

export default function LoginPage() {
  const sponsor = getSponsor();
  return (
    <main className="flex min-h-screen bg-[radial-gradient(ellipse_at_top_left,_oklch(0.32_0.06_160),_oklch(0.17_0.03_260)_55%,_oklch(0.14_0.02_260))]">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:gap-12 md:px-8">
        <section className="text-white">
          {sponsor && (
            <div className="mb-6 inline-flex items-center gap-3 rounded-xl bg-white/10 p-2.5 pr-5 ring-1 ring-white/15">
              {sponsor.logoUrl && (
                <span className="size-14 shrink-0 overflow-hidden rounded-xl ring-2 ring-white/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sponsor.logoUrl} alt={`${sponsor.name} logo`} className="size-full scale-[1.7] object-cover" />
                </span>
              )}
              <span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">{sponsor.tagline}</span>
                <span className="block text-lg font-black leading-tight">{sponsor.name}</span>
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-2xl shadow-lg">⚽</span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Football Prediction</div>
              <h1 className="text-3xl font-black tracking-tight">Admin console</h1>
            </div>
          </div>
          <p className="mt-4 max-w-md text-white/70">Create matches, open prediction sessions, print QR codes, enter results and announce winners.</p>
          <ul className="mt-6 hidden space-y-2.5 text-sm text-white/80 md:block">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full max-w-md justify-self-center md:justify-self-end">
          <LoginForm />
          <p className="mt-6 text-center text-xs text-white/50">
            Powered by{" "}
            <a href="https://www.thinkforgeglobal.com/" target="_blank" rel="noopener noreferrer" className="font-medium text-white/80 hover:text-white hover:underline">
              Think Forge Global
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
