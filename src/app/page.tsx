import { Suspense } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { ClosingSoon } from "@/components/ClosingSoon";
import { DetailDrawer } from "@/components/DetailDrawer";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import { EventCard } from "@/components/EventCard";
import { EventDetail } from "@/components/EventDetail";
import { FilterBar } from "@/components/FilterBar";
import { SummaryStats } from "@/components/SummaryStats";
import { addDays, todayIST } from "@/lib/dates";
import { dashboardMeta, filterOptions, getEvent, listEvents, viewCounts, type EventFilters } from "@/lib/queries";
import type { EventRow } from "@/lib/types";
import { timeAgo } from "@/lib/ui";

export const dynamic = "force-dynamic";

const VIEW_KEYS = ["all", "high", "deadline", "linkedin", "review"];
type SP = Record<string, string | string[] | undefined>;

const GROUPS: { key: string; label: string; dot: string }[] = [
  { key: "High", label: "High priority", dot: "bg-rose-500" },
  { key: "Medium", label: "Medium priority", dot: "bg-amber-400" },
  { key: "Low", label: "Low priority", dot: "bg-slate-300" },
  { key: "Unranked", label: "Not yet ranked", dot: "bg-slate-200" },
];

export default async function Dashboard({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = await searchParams;
  const sp: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && v) sp[k] = v;
  const view = VIEW_KEYS.includes(sp.view) ? sp.view : "all";
  const sort = sp.sort ?? "relevance";
  const today = todayIST();

  // "This week" / "Next 30 days" presets become a date window; custom From/To wins when set.
  const from = sp.from ?? (sp.range ? today : undefined);
  const to = sp.to ?? (sp.range === "week" ? addDays(today, 7) : sp.range === "30" ? addDays(today, 30) : undefined);

  const href = (patch: Record<string, string | undefined>) => {
    const next = { ...sp, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    return `/?${qs.toString()}`;
  };

  const filters: EventFilters = { view, city: sp.city, category: sp.category, source: sp.source, from, to, q: sp.q, includePast: sp.past === "1", includeLow: sp.low === "1", sort };
  const eventId = Number(sp.event);

  let data;
  try {
    const [events, counts, options, meta, selected, closing] = await Promise.all([
      listEvents(filters),
      viewCounts(),
      filterOptions(),
      dashboardMeta(today),
      eventId ? getEvent(eventId) : Promise.resolve(null),
      view === "deadline" ? Promise.resolve([] as EventRow[]) : listEvents({ view: "deadline", sort: "deadline" }, 8),
    ]);
    data = { events, counts, options, meta, selected, closing };
  } catch (err) {
    return (
      <ErrorState title="Can't load events" detail={String(err instanceof Error ? err.message : err)}>
        <p>
          Check <code>DATABASE_URL</code>, then reload. For a fresh database run <code>npm run db:migrate</code> and <code>npm run db:seed</code>.
        </p>
      </ErrorState>
    );
  }
  const { events, counts, options, meta, selected, closing } = data;
  const grouped = sort === "relevance" && view !== "deadline";
  const filtered = !!(sp.q || sp.city || sp.category || sp.source || sp.range || sp.from || sp.to || view !== "all");
  let n = 0;

  const card = (e: EventRow) => <EventCard key={e.id} event={e} href={href({ event: String(e.id) })} selected={selected?.id === e.id} today={today} delay={n++} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Event intelligence</h1>
          <p className="text-sm text-slate-500">Ranked opportunities for the next 30 days.</p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-slate-500" title="Time of the most recent scraper run">
          <Clock size={13} aria-hidden /> Last updated {timeAgo(meta.lastRunEpoch)}
        </p>
      </div>

      <SummaryStats counts={counts} meta={meta} activeView={view} hrefFor={(v) => href({ view: v === "all" ? undefined : v, event: undefined })} />

      <Suspense fallback={<div className="card h-32 animate-pulse bg-slate-100" />}>
        <FilterBar options={options} counts={counts} />
      </Suspense>

      {view !== "deadline" && !filtered && <ClosingSoon events={closing} today={today} hrefFor={(id) => href({ event: String(id) })} />}

      <div className={`grid items-start gap-4 ${selected ? "lg:grid-cols-[minmax(0,1fr)_440px]" : ""}`}>
        <section aria-label="Events" className="min-w-0 space-y-4">
          <p className="text-sm text-slate-500" aria-live="polite">
            {events.length} event{events.length === 1 ? "" : "s"}
            {filtered ? " match your filters" : ""}
          </p>

          {events.length === 0 && (
            <EmptyState
              title={filtered ? "No events match these filters" : "No events yet"}
              hint={filtered ? "Try a wider time range or clear a filter." : "Events appear after the next daily scrape, or add one manually."}
              action={filtered ? { href: "/", label: "Clear all filters" } : { href: "/add", label: "Add an event" }}
            />
          )}

          {grouped
            ? GROUPS.map((g) => {
                const items = events.filter((e) => (e.priority ?? "Unranked") === g.key);
                if (!items.length) return null;
                return (
                  <details key={g.key} open className="group/section">
                    <summary className="mb-2 flex cursor-pointer items-center gap-2 select-none">
                      <span className={`h-2.5 w-2.5 rounded-full ${g.dot}`} aria-hidden />
                      <h2 className="text-sm font-semibold text-slate-800">{g.label}</h2>
                      <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">{items.length}</span>
                      <ChevronDown size={15} className="chevron ml-auto text-slate-400 transition" aria-hidden />
                    </summary>
                    <div className="space-y-2.5">{items.map(card)}</div>
                  </details>
                );
              })
            : events.length > 0 && <div className="space-y-2.5">{events.map(card)}</div>}
        </section>

        {selected && (
          <DetailDrawer closeHref={href({ event: undefined })}>
            <EventDetail event={selected} closeHref={href({ event: undefined })} today={today} />
          </DetailDrawer>
        )}
      </div>
    </div>
  );
}
