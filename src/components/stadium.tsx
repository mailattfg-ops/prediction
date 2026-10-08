import { cn } from "@/lib/utils";

/** Faint pitch markings. */
export function PitchLines({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 900" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="20" y="20" width="560" height="860" rx="6" />
      <line x1="20" y1="450" x2="580" y2="450" />
      <circle cx="300" cy="450" r="80" />
      <circle cx="300" cy="450" r="4" fill="currentColor" />
      <rect x="140" y="20" width="320" height="140" />
      <rect x="220" y="20" width="160" height="50" />
      <rect x="140" y="740" width="320" height="140" />
      <rect x="220" y="830" width="160" height="50" />
    </svg>
  );
}

/** Night-stadium backdrop: floodlight glows, pitch lines and grain. Place inside a `relative` container. */
export function StadiumBackdrop({ className, wide = false }: { className?: string; wide?: boolean }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_-5%,oklch(0.6_0.18_160/0.55),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(45%_35%_at_95%_25%,oklch(0.62_0.16_250/0.28),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(50%_40%_at_0%_90%,oklch(0.65_0.17_160/0.22),transparent_70%)]" />
      <PitchLines className={cn("absolute left-1/2 top-20 -translate-x-1/2 text-white opacity-[0.07]", wide ? "w-[120%] max-w-[1400px] md:top-[-10%]" : "w-[150%] max-w-[720px]")} />
      <div className="absolute inset-0 bg-grain opacity-[0.06]" />
    </div>
  );
}
