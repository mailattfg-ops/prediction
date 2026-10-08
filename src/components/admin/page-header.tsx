import type { ReactNode } from "react";

export function PageHeader({ title, description, actions, badge, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; badge?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{eyebrow}</div>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[34px] leading-none tracking-wide">{title}</h1>
          {badge}
        </div>
        {description && <div className="mt-2 text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
