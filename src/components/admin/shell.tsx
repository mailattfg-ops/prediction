"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, Menu, Plus, QrCode, ShieldCheck, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/components/api";
import type { Sponsor } from "@/lib/sponsor";
import { cn } from "@/lib/utils";

type User = { name: string; email: string; role: string };

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/sessions", label: "Sessions", icon: QrCode, exact: false },
  { href: "/admin/matches", label: "Matches", icon: Trophy, exact: false },
];

export function AdminShell({ user, sponsor, children }: { user: User; sponsor: Sponsor | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (item: (typeof NAV)[number]) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));

  const nav = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-sidebar-primary" />}
            <item.icon className={cn("size-4", active && "text-sidebar-primary")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-lg shadow-[0_8px_20px_-8px_oklch(0.7_0.17_160)]">⚽</span>
      <div className="leading-none">
        <div className="font-display text-[22px] tracking-wide">Prediction</div>
        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/50">Admin console</div>
      </div>
    </div>
  );

  const partner = sponsor && (
    <div className="rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/10">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/45">Event partner</div>
      <div className="mt-2 flex items-center gap-2.5">
        {sponsor.logoUrl && (
          <span className="size-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sponsor.logoUrl} alt={`${sponsor.name} logo`} className="size-full scale-[1.7] object-cover" />
          </span>
        )}
        <span className="truncate font-display text-xl tracking-wide">{sponsor.name}</span>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="no-print hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-[72px] items-center px-5">{brand}</div>
        <div className="px-3 py-2">{nav()}</div>
        <div className="px-3 pt-2">
          <Button nativeButton={false} render={<Link href="/admin/sessions/new" />} className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
            <Plus data-icon="inline-start" /> New session
          </Button>
        </div>
        <div className="mt-auto space-y-2 p-3">
          {partner}
          <div className="border-t border-sidebar-border pt-2">
            <UserMenu user={user} onSidebar />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Open menu" />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar text-sidebar-foreground">
              <SheetHeader>
                <SheetTitle className="text-sidebar-foreground">{brand}</SheetTitle>
              </SheetHeader>
              <div className="px-3">{nav(() => setOpen(false))}</div>
              <div className="px-3 pt-2">
                <Button nativeButton={false} render={<Link href="/admin/sessions/new" onClick={() => setOpen(false)} />} className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
                  <Plus data-icon="inline-start" /> New session
                </Button>
              </div>
              <div className="mt-auto p-3">{partner}</div>
            </SheetContent>
          </Sheet>
          <span className="font-display text-xl tracking-wide">⚽ Prediction</span>
          <div className="ml-auto">
            <UserMenu user={user} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

function UserMenu({ user, onSidebar = false }: { user: User; onSidebar?: boolean }) {
  const router = useRouter();
  const initials = user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className={cn("h-auto justify-start gap-2 px-2 py-1.5", onSidebar ? "w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" : "")}
          />
        }
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/30 to-emerald-600/30 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30">{initials || "A"}</span>
        {onSidebar && (
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-sidebar-foreground/60">{user.role === "SUPER_ADMIN" ? "Super admin" : "Admin"}</span>
          </span>
        )}
        <ChevronDown className="size-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={onSidebar ? "start" : "end"} className="w-56">
        <DropdownMenuLabel>
          <div className="text-sm font-medium text-foreground">{user.name}</div>
          <div className="truncate text-xs font-normal">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <ShieldCheck /> {user.role === "SUPER_ADMIN" ? "Super admin" : "Admin"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            await api("/api/auth/logout", { method: "POST" });
            router.push("/admin/login");
            router.refresh();
          }}
        >
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
