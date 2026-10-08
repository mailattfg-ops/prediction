import { QrCode, Timer, Trophy } from "lucide-react";
import { getSponsor } from "@/lib/sponsor";
import { StadiumBackdrop } from "@/components/stadium";
import { SponsorMark } from "@/components/sponsor-mark";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Admin Login · Football Prediction" };

const POINTS = [
  { icon: QrCode, text: "One QR per session, a server-enforced 10-minute window" },
  { icon: Trophy, text: "Winner picks or exact scores, fair random draw for the prize" },
  { icon: Timer, text: "Enter the score at full time, winners announced on WhatsApp" },
];

export default function LoginPage() {
  const sponsor = getSponsor();
  // Demo autofill is only offered when both variables are set (leave them empty in production).
  const demoEmail = process.env.DEMO_LOGIN_EMAIL?.trim();
  const demoPassword = process.env.DEMO_LOGIN_PASSWORD;
  const demo = demoEmail && demoPassword ? { email: demoEmail, password: demoPassword } : null;
  const enter = "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both";
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#0b1220] text-white">
      <StadiumBackdrop wide />
      <div className="relative mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-5 py-10 md:grid-cols-[1.1fr_1fr] md:gap-14 md:px-8">
        <section className={enter}>
          {sponsor && (
            <div className="mb-6 inline-flex rounded-2xl bg-white/[0.07] p-2 pr-5 ring-1 ring-white/10 backdrop-blur-md">
              <SponsorMark sponsor={sponsor} size="lg" />
            </div>
          )}
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300">Matchday control</div>
          <h1 className="mt-2 font-display text-[56px] leading-[0.9] tracking-wide md:text-[72px]">
            Admin <span className="bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent">console</span>
          </h1>
          <p className="mt-4 max-w-md text-white/65">Create matches, open prediction sessions, print QR codes, enter results and announce winners.</p>
          <ul className="mt-7 hidden space-y-3 md:block">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] ring-1 ring-white/10"><Icon className="size-4 text-emerald-300" /></span>
                {text}
              </li>
            ))}
          </ul>
        </section>

        <section className={`${enter} w-full max-w-md justify-self-center md:justify-self-end [animation-delay:120ms]`}>
          <LoginForm demo={demo} />
        </section>
      </div>
      <p className="relative pb-6 text-center text-xs text-white/40">
        Football Prediction · Powered by{" "}
        <a href="https://www.thinkforgeglobal.com/" target="_blank" rel="noopener noreferrer" className="font-medium text-white/70 hover:text-white hover:underline">
          Think Forge Global
        </a>
      </p>
    </main>
  );
}
