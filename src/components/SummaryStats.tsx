import Link from "next/link";
import { AlarmClock, CalendarDays, Radio, Rss, Star } from "lucide-react";
import type { DashboardMeta, KpiSeries } from "@/lib/queries";
import { CountUp } from "./CountUp";
import { MiniRing, Sparkline } from "./Sparkline";

interface Props {
  counts: Record<string, number>;
  meta: DashboardMeta;
  series: KpiSeries;
  activeView: string;
  hrefFor: (view: string) => string;
}

function Tile({ href, active, icon, label, value, sub, tone, visual }: { href: string; active?: boolean; icon: React.ReactNode; label: string; value: number; sub?: React.ReactNode; tone: string; visual?: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`group card flex flex-col gap-3 p-4 transition hover:-translate-y-px hover:shadow-lift ${active ? "ring-2 ring-ink" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${tone}`}>{icon}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <CountUp value={value} className="block text-3xl font-bold leading-none tracking-tight tabular-nums text-slate-900" />
          {sub && <div className="mt-2 text-xs leading-snug text-slate-500">{sub}</div>}
        </div>
        {visual}
      </div>
    </Link>
  );
}

export function SummaryStats({ counts, meta, series, activeView, hrefFor }: Props) {
  const healthy = meta.sourcesFailing === 0;
  const okSources = Math.max(0, meta.sourcesCheckedToday - meta.sourcesFailing);
  return (
    <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Tile href={hrefFor("all")} active={activeView === "all"} icon={<CalendarDays size={15} />} tone="bg-slate-100 text-slate-700" label="Events found" value={counts.all ?? 0} sub="Upcoming, all sources" visual={<Sparkline values={series.events} color="var(--chart-accent)" label="Events per day, next 14 days" />} />
      <Tile href={hrefFor("high")} active={activeView === "high"} icon={<Star size={15} />} tone="bg-rose-50 text-rose-600" label="High priority" value={counts.high ?? 0} sub="Best-fit opportunities" visual={<Sparkline values={series.high} color="var(--chart-high)" label="High priority events per day, next 14 days" />} />
      <Tile href={hrefFor("deadline")} active={activeView === "deadline"} icon={<AlarmClock size={15} />} tone="bg-red-50 text-red-600" label="Deadlines under 7 days" value={counts.deadline ?? 0} sub={(counts.deadline ?? 0) > 0 ? "Act this week" : "Nothing closing soon"} visual={<Sparkline values={series.deadlines} color="var(--chart-medium)" label="Registration deadlines per day, next 14 days" />} />
      <Tile href={hrefFor("linkedin")} active={activeView === "linkedin"} icon={<Radio size={15} />} tone="bg-sky-50 text-sky-700" label="LinkedIn signals" value={counts.linkedin ?? 0} sub="Via alerts and forwards" visual={<Sparkline values={series.linkedin} color="var(--chart-accent)" label="LinkedIn signals per day, next 14 days" />} />
      <div className="col-span-2 md:col-span-1">
        <Tile
          href="/health"
          icon={<Rss size={15} />}
          tone="bg-emerald-50 text-emerald-700"
          label="Sources checked today"
          value={meta.sourcesCheckedToday}
          sub={
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${healthy ? "bg-emerald-500" : "bg-red-500"}`} aria-hidden />
              {healthy ? "All healthy" : `${meta.sourcesFailing} failing`}
            </span>
          }
          visual={<MiniRing fraction={meta.sourcesCheckedToday ? okSources / meta.sourcesCheckedToday : 0} color={healthy ? "16 185 129" : "239 68 68"} />}
        />
      </div>
    </section>
  );
}
