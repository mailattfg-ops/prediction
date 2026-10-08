import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const tones = {
  default: { icon: "bg-muted text-muted-foreground", bar: "from-slate-300 to-slate-200" },
  primary: { icon: "bg-emerald-500/15 text-emerald-600", bar: "from-emerald-500 to-lime-400" },
  warning: { icon: "bg-amber-500/15 text-amber-600", bar: "from-amber-500 to-yellow-300" },
  info: { icon: "bg-sky-500/15 text-sky-600", bar: "from-sky-500 to-cyan-300" },
};

export function StatCard({ label, value, hint, icon: Icon, tone = "default" }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: keyof typeof tones;
}) {
  return (
    <Card className="relative overflow-hidden">
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", tones[tone].bar)} />
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
          <div className="mt-1.5 font-display text-[40px] leading-none tracking-wide tabular-nums">{value}</div>
          {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {Icon && (
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tones[tone].icon)}>
            <Icon className="size-5" />
          </span>
        )}
      </CardContent>
    </Card>
  );
}
