import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, hint, icon: Icon, tone = "default" }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: "default" | "primary" | "warning" | "info";
}) {
  const tones = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/15 text-primary",
    warning: "bg-amber-500/15 text-amber-600",
    info: "bg-sky-500/15 text-sky-600",
  };
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {Icon && (
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
            <Icon className="size-5" />
          </span>
        )}
      </CardContent>
    </Card>
  );
}
