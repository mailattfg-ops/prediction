import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EffectiveStatus } from "@/lib/window";

const styles: Record<EffectiveStatus, string> = {
  DRAFT: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  SCHEDULED: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  ACTIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  EXPIRED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  COMPLETED: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

const labels: Record<EffectiveStatus, string> = {
  DRAFT: "Draft", SCHEDULED: "Scheduled", ACTIVE: "Live", EXPIRED: "Expired", CANCELLED: "Cancelled", COMPLETED: "Completed",
};

export function StatusBadge({ status, className }: { status: EffectiveStatus; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("gap-1.5", styles[status], className)}>
      {status === "ACTIVE" && <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" /></span>}
      {labels[status]}
    </Badge>
  );
}

const resultStyles: Record<string, string> = {
  WINNER: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  LOST: "bg-muted text-muted-foreground",
  PENDING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  TIMED_OUT: "bg-muted text-muted-foreground",
};

export function ResultBadge({ status }: { status: string }) {
  return <Badge variant="secondary" className={resultStyles[status] ?? ""}>{status === "LOST" ? "Lost" : status === "WINNER" ? "Winner" : status === "PENDING" ? "Pending" : status}</Badge>;
}
