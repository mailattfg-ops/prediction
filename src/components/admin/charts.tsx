"use client";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";

const config = { count: { label: "Predictions", color: "var(--chart-1)" } } satisfies ChartConfig;

/** Simple bar chart used for "per day" and "per minute" participation. */
export function CountBars({ data, className }: { data: { label: string; count: number }[]; className?: string }) {
  if (!data.length) return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No data yet.</div>;
  return (
    <ChartContainer config={config} className={className ?? "h-44 w-full"}>
      <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} interval="preserveStartEnd" />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel={false} />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

/** Horizontal share bars for the vote split. */
export function SplitBars({ rows }: { rows: { label: string; value: number; total: number; color?: string }[] }) {
  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const pct = r.total ? Math.round((r.value / r.total) * 1000) / 10 : 0;
        return (
          <div key={r.label} className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {r.value} · {pct}%
              </span>
            </div>
            <Progress value={pct} className="[&_[data-slot=progress-track]]:h-2.5" style={r.color ? ({ "--primary": r.color } as React.CSSProperties) : undefined} />
          </div>
        );
      })}
    </div>
  );
}
