"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartPulse, LayoutDashboard, PlusCircle, Radar, Rss, SlidersHorizontal } from "lucide-react";

const LINKS = [
  { href: "/", label: "Events", icon: LayoutDashboard },
  { href: "/add", label: "Add event", icon: PlusCircle },
  { href: "/preferences", label: "Preferences", icon: SlidersHorizontal },
  { href: "/sources", label: "Sources", icon: Rss },
  { href: "/health", label: "Source health", icon: HeartPulse },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white">
            <Radar size={18} aria-hidden />
          </span>
          <span className="hidden text-[15px] font-bold tracking-tight text-ink sm:block">Industry Event Scout</span>
        </Link>
        <nav className="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Main">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-4 text-sm font-medium transition ${
                  active ? "border-ink text-ink" : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon size={16} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
