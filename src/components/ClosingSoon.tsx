import Link from "next/link";
import { AlarmClock } from "lucide-react";
import { fmtDate } from "@/lib/dates";
import type { EventRow } from "@/lib/types";
import { deadlineInfo } from "@/lib/ui";
import { PriorityBadge } from "./Badges";

/** Compact rail of events whose registration closes within 7 days. */
export function ClosingSoon({ events, hrefFor, today }: { events: EventRow[]; hrefFor: (id: number) => string; today: string }) {
  if (!events.length) return null;
  return (
    <section aria-label="Closing soon" className="rounded-lg border border-red-200 bg-red-50/60 p-3 sm:p-4">
      <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-red-800">
        <AlarmClock size={16} aria-hidden /> Registration closing soon
        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">{events.length}</span>
      </h2>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {events.map((e) => {
          const dl = deadlineInfo(e.registration_deadline, e.deadline_urgent, e.status, today);
          return (
            <Link
              key={e.id}
              href={hrefFor(e.id)}
              scroll={false}
              className="w-64 shrink-0 rounded-lg bg-white p-3 shadow-card transition hover:-translate-y-px hover:shadow-lift"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <PriorityBadge priority={e.priority} />
                <span className="text-xs font-semibold text-red-700">{dl.label}</span>
              </div>
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{e.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {fmtDate(e.event_date)} · {e.city ?? "City unknown"}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
