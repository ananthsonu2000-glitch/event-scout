import Link from "next/link";
import { Building2, CalendarDays, ExternalLink, MapPin, ScanSearch, Sparkles } from "lucide-react";
import { fmtDate } from "@/lib/dates";
import type { EventRow } from "@/lib/types";
import { deadlineInfo, relDays } from "@/lib/ui";
import { DeadlineChip, PriorityBadge, SourceBadge } from "./Badges";
import { ScoreRing } from "./ScoreRing";

export function EventCard({ event: e, href, selected, today, delay = 0 }: { event: EventRow; href: string; selected?: boolean; today: string; delay?: number }) {
  const rail = e.priority === "High" ? "bg-rose-500" : e.priority === "Medium" ? "bg-amber-400" : "bg-slate-300";
  const dl = deadlineInfo(e.registration_deadline, e.deadline_urgent, e.status, today);
  const when = relDays(e.event_date, today);
  // One badge per distinct source label (LinkedIn + its Luma page etc.), capped to keep the card tidy.
  const seen = new Set<string>();
  const sources = e.sources.filter((s) => {
    const key = s.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <article
      style={{ animationDelay: `${Math.min(delay, 8) * 30}ms` }}
      className={`group relative flex overflow-hidden rounded-lg bg-white shadow-card transition duration-150 animate-fade-up hover:-translate-y-px hover:shadow-lift ${selected ? "ring-2 ring-ink" : ""}`}
    >
      <span className={`w-1 shrink-0 ${rail}`} aria-hidden />
      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <PriorityBadge priority={e.priority} />
              {e.needs_review && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200" title={e.review_reason ?? undefined}>
                  <ScanSearch size={11} aria-hidden /> Needs review
                </span>
              )}
              <DeadlineChip info={dl} />
            </div>
            <h3 className="text-[15px] font-semibold leading-snug text-slate-900">
              <Link href={href} scroll={false} className="after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ink/40">
                {e.title}
              </Link>
            </h3>
          </div>
          <ScoreRing score={e.relevance_score} />
        </div>

        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-600">
          <div className="flex items-center gap-1.5">
            <CalendarDays size={14} className="text-slate-400" aria-hidden />
            <dt className="sr-only">Date</dt>
            <dd>
              {fmtDate(e.event_date)}
              {when && <span className="text-slate-400"> · {when}</span>}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin size={14} className="text-slate-400" aria-hidden />
            <dt className="sr-only">City</dt>
            <dd>{e.city ?? "City unknown"}</dd>
          </div>
          {e.organizer && (
            <div className="flex min-w-0 items-center gap-1.5">
              <Building2 size={14} className="shrink-0 text-slate-400" aria-hidden />
              <dt className="sr-only">Organizer</dt>
              <dd className="truncate">{e.organizer}</dd>
            </div>
          )}
        </dl>

        {e.reason && (
          <p className="mt-2.5 flex gap-1.5 text-[13px] leading-relaxed text-slate-700">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-indigo-500" aria-hidden />
            <span className="line-clamp-2">{e.reason}</span>
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {sources.slice(0, 3).map((s, i) => (
              <SourceBadge key={i} source={s} />
            ))}
            {sources.length > 3 && <span className="text-[11px] text-slate-400">+{sources.length - 3}</span>}
          </div>
          {e.source_url && (
            <a
              href={e.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary relative z-10 shrink-0"
              aria-label={`${e.source_type.includes("linkedin") ? "View source" : "Register"} for ${e.title} (opens in a new tab)`}
            >
              {e.source_type.includes("linkedin") ? "View source" : "Register"} <ExternalLink size={13} aria-hidden />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
