import Link from "next/link";
import { fmtDate } from "@/lib/dates";
import type { EventRow } from "@/lib/types";
import { PriorityBadge, Pill, StatusPill } from "./Badges";

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function EventDetail({ event: e, closeHref }: { event: EventRow; closeHref: string }) {
  return (
    <aside className="card sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={e.priority} />
          {e.relevance_score != null && <span className="text-sm font-semibold">{e.relevance_score}/100</span>}
          <StatusPill status={e.status} />
          {e.deadline_urgent && <Pill tone="red">⚠ Deadline under 7 days</Pill>}
        </div>
        <Link href={closeHref} scroll={false} className="text-sm text-slate-500 hover:text-slate-900">
          Close ✕
        </Link>
      </div>

      <h2 className="mt-3 text-lg font-bold leading-snug">{e.title}</h2>

      {e.needs_review && (
        <p className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-900">Needs review: {e.review_reason ?? "flagged"}</p>
      )}

      {e.reason && (
        <section className="mt-4">
          <h3 className="label">Why this matters</h3>
          <p className="text-sm">{e.reason}</p>
          {e.recommended_action && (
            <p className="mt-2 text-sm">
              <b>Recommended action:</b> {e.recommended_action}
            </p>
          )}
        </section>
      )}

      <dl className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
        <Row label="Event date" value={fmtDate(e.event_date, true)} />
        <Row label="Register by" value={e.registration_deadline ? fmtDate(e.registration_deadline, true) : "Not listed"} />
        <Row label="City" value={e.city} />
        <Row label="Venue" value={e.venue} />
        <Row label="Organizer" value={e.organizer} />
        <Row label="Category" value={e.category} />
        <Row label="Audience" value={e.audience} />
        <Row label="Audience fit" value={e.audience_fit} />
        <Row label="Urgency" value={e.urgency} />
        <Row label="Price" value={e.price} />
        <Row label="AI confidence" value={e.confidence != null ? `${Math.round(e.confidence * 100)}%` : null} />
      </dl>

      {e.description && (
        <section className="mt-4">
          <h3 className="label">Description</h3>
          <p className="whitespace-pre-line text-sm text-slate-700">{e.description}</p>
        </section>
      )}

      <section className="mt-4">
        <h3 className="label">Sources</h3>
        <ul className="space-y-1 text-sm">
          {e.sources.map((s, i) => (
            <li key={i}>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                  {s.name} ↗
                </a>
              ) : (
                s.name
              )}{" "}
              <span className="text-xs text-slate-400">({s.type})</span>
            </li>
          ))}
        </ul>
      </section>

      {e.source_url && (
        <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="btn mt-5 w-full">
          Open registration / source page ↗
        </a>
      )}
    </aside>
  );
}
