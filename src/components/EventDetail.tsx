import Link from "next/link";
import { Building2, CalendarDays, ExternalLink, MapPin, Sparkles, Tag, Ticket, Users, X, Zap } from "lucide-react";
import { fmtDate } from "@/lib/dates";
import type { EventRow } from "@/lib/types";
import { deadlineInfo, relDays } from "@/lib/ui";
import { DeadlineChip, PriorityBadge, SourceBadge, StatusPill } from "./Badges";
import { ScoreRing } from "./ScoreRing";

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value?: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
        <dd className="text-sm text-slate-800">{value}</dd>
      </div>
    </div>
  );
}

export function EventDetail({ event: e, closeHref, today }: { event: EventRow; closeHref: string; today: string }) {
  const dl = deadlineInfo(e.registration_deadline, e.deadline_urgent, e.status, today);
  const when = relDays(e.event_date, today);

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={e.priority} />
          {e.status === "past" && <StatusPill status={e.status} />}
          <DeadlineChip info={dl} />
        </div>
        <Link href={closeHref} scroll={false} className="-mr-1 -mt-1 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label="Close details">
          <X size={18} />
        </Link>
      </div>

      <div className="mt-3 flex items-start gap-3">
        <h2 className="flex-1 text-lg font-bold leading-snug text-slate-900">{e.title}</h2>
        <ScoreRing score={e.relevance_score} size={52} />
      </div>

      {e.needs_review && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-900">
          <b>Needs review:</b> {e.review_reason ?? "flagged for a manual check"}
        </p>
      )}

      {(e.reason || e.recommended_action) && (
        <section className="mt-4 rounded-lg bg-indigo-50/70 p-3.5 ring-1 ring-inset ring-indigo-100">
          <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700">
            <Sparkles size={13} aria-hidden /> Why this matters
          </h3>
          {e.reason && <p className="text-sm leading-relaxed text-slate-800">{e.reason}</p>}
          {e.recommended_action && (
            <p className="mt-2 flex gap-1.5 text-sm font-medium text-indigo-900">
              <Zap size={14} className="mt-0.5 shrink-0" aria-hidden /> {e.recommended_action}
            </p>
          )}
          {e.confidence != null && <p className="mt-2 text-xs text-slate-500">AI confidence {Math.round(e.confidence * 100)}%{e.audience_fit ? ` · Audience fit: ${e.audience_fit}` : ""}</p>}
        </section>
      )}

      <dl className="mt-5 grid gap-3.5 sm:grid-cols-2">
        <Fact icon={<CalendarDays size={15} />} label="Event date" value={e.event_date ? `${fmtDate(e.event_date, true)}${when ? ` (${when})` : ""}` : "Date not found"} />
        <Fact icon={<MapPin size={15} />} label="City" value={e.city} />
        <Fact icon={<MapPin size={15} />} label="Venue" value={e.venue} />
        <Fact icon={<Building2 size={15} />} label="Organizer" value={e.organizer} />
        <Fact icon={<Tag size={15} />} label="Category" value={e.category} />
        <Fact icon={<Users size={15} />} label="Audience" value={e.audience} />
        <Fact icon={<Ticket size={15} />} label="Price" value={e.price} />
        <Fact icon={<Zap size={15} />} label="Urgency" value={e.urgency} />
      </dl>

      {e.description && (
        <section className="mt-5">
          <h3 className="label">Description</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{e.description}</p>
        </section>
      )}

      <section className="mt-5">
        <h3 className="label">Found via</h3>
        <ul className="space-y-1.5">
          {e.sources.map((s, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <SourceBadge source={s} />
              {s.url && (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-sky-700 hover:underline">
                  <span className="truncate">{s.url.replace(/^https?:\/\/(www\.)?/, "")}</span> <ExternalLink size={11} className="shrink-0" aria-hidden />
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      {e.source_url && (
        <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="btn mt-6 w-full">
          {e.source_type.includes("linkedin") ? "Open source post" : "Open registration page"} <ExternalLink size={15} aria-hidden />
        </a>
      )}
    </div>
  );
}
