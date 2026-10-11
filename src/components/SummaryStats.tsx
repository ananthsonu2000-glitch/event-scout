import Link from "next/link";
import { AlarmClock, CalendarDays, Radio, Star, Rss } from "lucide-react";
import type { DashboardMeta } from "@/lib/queries";

interface Props {
  counts: Record<string, number>;
  meta: DashboardMeta;
  activeView: string;
  hrefFor: (view: string) => string;
}

function Tile({ href, active, icon, label, value, sub, tone }: { href: string; active?: boolean; icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode; tone: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`group card flex flex-col gap-2 p-4 transition hover:-translate-y-px hover:shadow-lift ${active ? "ring-2 ring-ink" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${tone}`}>{icon}</span>
      </div>
      <div className="text-3xl font-bold leading-none tracking-tight tabular-nums text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </Link>
  );
}

export function SummaryStats({ counts, meta, activeView, hrefFor }: Props) {
  const healthy = meta.sourcesFailing === 0;
  return (
    <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Tile href={hrefFor("all")} active={activeView === "all"} icon={<CalendarDays size={15} />} tone="bg-slate-100 text-slate-700" label="Events found" value={counts.all ?? 0} sub="Upcoming, all sources" />
      <Tile href={hrefFor("high")} active={activeView === "high"} icon={<Star size={15} />} tone="bg-rose-50 text-rose-600" label="High priority" value={counts.high ?? 0} sub="Best-fit opportunities" />
      <Tile href={hrefFor("deadline")} active={activeView === "deadline"} icon={<AlarmClock size={15} />} tone="bg-red-50 text-red-600" label="Deadlines under 7 days" value={counts.deadline ?? 0} sub={(counts.deadline ?? 0) > 0 ? "Act this week" : "Nothing closing soon"} />
      <Tile href={hrefFor("linkedin")} active={activeView === "linkedin"} icon={<Radio size={15} />} tone="bg-sky-50 text-sky-700" label="LinkedIn signals" value={counts.linkedin ?? 0} sub="Via alerts and forwards" />
      <Link href="/health" className="group card col-span-2 flex flex-col gap-2 p-4 transition hover:-translate-y-px hover:shadow-lift md:col-span-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Sources checked today</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <Rss size={15} />
          </span>
        </div>
        <div className="text-3xl font-bold leading-none tracking-tight tabular-nums text-slate-900">{meta.sourcesCheckedToday}</div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className={`h-2 w-2 rounded-full ${healthy ? "bg-emerald-500" : "bg-red-500"}`} aria-hidden />
          {healthy ? "All sources healthy" : `${meta.sourcesFailing} failing`}
        </div>
      </Link>
    </section>
  );
}
