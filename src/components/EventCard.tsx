import Link from "next/link";
import { fmtDate } from "@/lib/dates";
import type { EventRow } from "@/lib/types";
import { PriorityBadge, Pill } from "./Badges";

export function EventCard({ event: e, href, selected }: { event: EventRow; href: string; selected?: boolean }) {
  const border = e.priority === "High" ? "border-l-red-500" : e.priority === "Medium" ? "border-l-amber-400" : "border-l-slate-300";
  const sources = [...new Set(e.sources.map((s) => s.name))].join(" + ") || e.source;

  return (
    <article className={`card border-l-4 ${border} p-4 ${selected ? "ring-2 ring-ink" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={e.priority} />
        {e.relevance_score != null && <span className="text-xs font-semibold text-slate-600">{e.relevance_score}/100</span>}
        {e.deadline_urgent && <Pill tone="red">⚠ Deadline soon</Pill>}
        {e.is_linkedin_signal && <Pill tone="blue">LinkedIn signal</Pill>}
        {e.needs_review && <Pill tone="amber">Needs review</Pill>}
      </div>

      <h3 className="mt-2 text-base font-semibold leading-snug">
        <Link href={href} scroll={false} className="hover:underline">
          {e.title}
        </Link>
      </h3>

      <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <div>📅 {fmtDate(e.event_date)}</div>
        <div>📍 {e.city ?? "City unknown"}</div>
        {e.organizer && <div>🏢 {e.organizer}</div>}
        <div>🔎 {sources}</div>
        {e.registration_deadline && (
          <div className={e.deadline_urgent ? "font-semibold text-red-700" : ""}>⏳ Register by {fmtDate(e.registration_deadline)}</div>
        )}
      </dl>

      {e.reason && <p className="mt-2 text-sm text-slate-800">{e.reason}</p>}

      <div className="mt-3 flex gap-2">
        <Link href={href} scroll={false} className="btn-secondary">
          Details
        </Link>
        {e.source_url && (
          <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            {e.source_type.includes("linkedin") ? "View source ↗" : "Register / view ↗"}
          </a>
        )}
      </div>
    </article>
  );
}
