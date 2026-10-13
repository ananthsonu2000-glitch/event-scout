"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarClock, HeartPulse, LayoutDashboard, Menu, PlusCircle, Radar, Rss, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

const GROUPS = [
  {
    label: "Main",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/add", label: "Add event", icon: PlusCircle },
    ],
  },
  {
    label: "Configure",
    items: [
      { href: "/preferences", label: "Preferences", icon: SlidersHorizontal },
      { href: "/sources", label: "Sources", icon: Rss },
    ],
  },
  {
    label: "Monitor",
    items: [{ href: "/health", label: "Source health", icon: HeartPulse }],
  },
];

const TITLES: Record<string, string> = {
  "/": "Overview",
  "/add": "Add event",
  "/preferences": "Preferences",
  "/sources": "Sources",
  "/health": "Source health",
  "/privacy": "Privacy",
};

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white">
          <Radar size={18} aria-hidden />
        </span>
        <span className="text-[15px] font-bold tracking-tight text-slate-900">Event Scout</span>
        <span className="ml-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">v1</span>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Main">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                        active ? "bg-ink text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <Icon size={16} aria-hidden />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="m-3 space-y-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        <p className="flex items-center gap-2">
          <CalendarClock size={14} className="shrink-0 text-slate-400" aria-hidden /> Daily scrape 06:00 IST
        </p>
        <p className="flex items-center gap-2">
          <CalendarClock size={14} className="shrink-0 text-slate-400" aria-hidden /> Weekly digest Mon 07:00 IST
        </p>
        <p className="flex items-center gap-2">
          <ShieldCheck size={14} className="shrink-0 text-slate-400" aria-hidden />
          <Link href="/privacy" onClick={onNavigate} className="hover:text-slate-900 hover:underline">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-r border-slate-200 bg-white lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/50" />
          <aside className="absolute inset-y-0 left-0 w-[272px] animate-slide-in border-r border-slate-200 bg-white shadow-lift" role="dialog" aria-label="Menu">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
              <X size={18} />
            </button>
            <SidebarContent pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <p className="text-sm font-semibold text-slate-900">{TITLES[pathname] ?? "Event Scout"}</p>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
