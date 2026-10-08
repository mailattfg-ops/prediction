import { cn } from "@/lib/utils";

/** Line-art football crest used as the product mark (no emoji). */
export function FootballIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7.2l4.3 3.1-1.6 5H9.3l-1.6-5z" />
      <path d="M12 2.5v4.7M16.3 10.3l4.4-1.4M14.7 15.3l2.7 3.9M9.3 15.3l-2.7 3.9M7.7 10.3L3.3 8.9" />
    </svg>
  );
}

/**
 * Premium product tile: gradient hairline border, dark glass core, soft inner highlight and glow.
 * Replaces the emoji ball everywhere the product mark appears.
 */
export function BrandMark({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = { sm: "size-9 rounded-xl", md: "size-11 rounded-2xl", lg: "size-14 rounded-2xl" }[size];
  const icon = { sm: "size-4.5", md: "size-6", lg: "size-7" }[size];
  return (
    <span className={cn("relative inline-flex shrink-0 bg-gradient-to-br from-emerald-300/80 via-emerald-500/30 to-white/5 p-px shadow-[0_10px_30px_-12px_oklch(0.7_0.17_160)]", dims, className)}>
      <span className={cn("flex size-full items-center justify-center bg-[#0c1424] text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-8px_16px_rgba(0,0,0,0.5)]", size === "sm" ? "rounded-[11px]" : "rounded-[15px]")}>
        <FootballIcon className={cn(icon, "drop-shadow-[0_0_10px_oklch(0.75_0.2_150/0.6)]")} />
      </span>
    </span>
  );
}
