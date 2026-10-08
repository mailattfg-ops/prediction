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
import { cn } from "@/lib/utils";

type User = { name: string; email: string; role: string };

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/sessions", label: "Sessions", icon: QrCode, exact: false },
  { href: "/admin/matches", label: "Matches", icon: Trophy, exact: false },
];

export function AdminShell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (item: (typeof NAV)[number]) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));

  const nav = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(item)
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          )}
        >
          <item.icon className="size-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-lg">⚽</span>
      <div>
        <div className="text-sm font-bold leading-tight">Prediction</div>
        <div className="text-xs text-sidebar-foreground/60">Admin console</div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="no-print hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center px-5">{brand}</div>
        <div className="px-3 py-2">{nav()}</div>
        <div className="px-3 pt-2">
          <Button nativeButton={false} render={<Link href="/admin/sessions/new" />} className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
            <Plus data-icon="inline-start" /> New session
          </Button>
        </div>
        <div className="mt-auto border-t border-sidebar-border p-3">
          <UserMenu user={user} onSidebar />
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
            </SheetContent>
          </Sheet>
          <span className="font-semibold">⚽ Prediction Admin</span>
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
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">{initials || "A"}</span>
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
