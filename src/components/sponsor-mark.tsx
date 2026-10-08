import type { Sponsor } from "@/lib/sponsor";
import { cn } from "@/lib/utils";

/** Sponsor identity for dark surfaces: glowing logo tile, tagline, wordmark. */
export function SponsorMark({ sponsor, size = "md", className }: { sponsor: Sponsor; size?: "md" | "lg"; className?: string }) {
  const tile = size === "lg" ? "size-14" : "size-12";
  const word = size === "lg" ? "text-[30px]" : "text-[26px]";
  const inner = (
    <>
      {sponsor.logoUrl && (
        <span className={cn("relative shrink-0 overflow-hidden rounded-xl ring-2 ring-emerald-400/40 shadow-[0_0_28px_-6px_oklch(0.75_0.2_150)]", tile)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sponsor.logoUrl} alt={`${sponsor.name} logo`} className="size-full scale-[1.7] object-cover" />
        </span>
      )}
      <span className="min-w-0 leading-none">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/90">{sponsor.tagline}</span>
        <span className={cn("mt-1 block truncate font-display tracking-wide text-white", word)}>{sponsor.name}</span>
      </span>
    </>
  );
  const cls = cn("flex min-w-0 items-center gap-3", className);
  return sponsor.url ? (
    <a href={sponsor.url} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
