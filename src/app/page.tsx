import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { EventDetail } from "@/components/EventDetail";
import { Filters } from "@/components/Filters";
import { filterOptions, getEvent, listEvents, viewCounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "all", label: "All Events" },
  { key: "high", label: "High Priority" },
  { key: "deadline", label: "Deadline Soon" },
  { key: "linkedin", label: "LinkedIn Signals" },
  { key: "review", label: "Needs Review" },
];

type SP = Record<string, string | string[] | undefined>;

export default async function Dashboard({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = await searchParams;
  const sp: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && v) sp[k] = v;
  const view = VIEWS.some((v) => v.key === sp.view) ? sp.view : "all";

  const href = (patch: Record<string, string | undefined>) => {
    const next = { ...sp, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    return `/?${qs.toString()}`;
  };

  const eventId = Number(sp.event);
  let data;
  try {
    const [events, counts, options, selected] = await Promise.all([
      listEvents({ view, city: sp.city, category: sp.category, source: sp.source, from: sp.from, to: sp.to, q: sp.q, includePast: sp.past === "1" }),
      viewCounts(),
      filterOptions(),
      eventId ? getEvent(eventId) : Promise.resolve(null),
    ]);
    data = { events, counts, options, selected };
  } catch (err) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-bold">Database not reachable</h1>
        <p className="mt-2 text-sm text-slate-600">
          Set <code>DATABASE_URL</code> in <code>.env.local</code>, then run <code>npm run db:migrate</code> and <code>npm run db:seed</code>.
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-slate-100 p-3 text-xs">{String(err instanceof Error ? err.message : err)}</pre>
      </div>
    );
  }
  const { events, counts, options, selected } = data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={href({ view: v.key, event: undefined })}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
              view === v.key ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {v.label} <span className="opacity-70">{counts[v.key] ?? 0}</span>
          </Link>
        ))}
      </div>

      <Filters values={{ ...sp, view }} options={options} />

      <div className={`grid gap-4 ${selected ? "lg:grid-cols-[1fr_440px]" : ""}`}>
        <section className="space-y-3">
          <p className="text-sm text-slate-500">{events.length} event{events.length === 1 ? "" : "s"}</p>
          {events.length === 0 && (
            <div className="card p-8 text-center text-sm text-slate-500">
              No events match. Try another view or reset the filters.
            </div>
          )}
          {events.map((e) => (
            <EventCard key={e.id} event={e} href={href({ event: String(e.id) })} selected={selected?.id === e.id} />
          ))}
        </section>
        {selected && (
          <div>
            <EventDetail event={selected} closeHref={href({ event: undefined })} />
          </div>
        )}
      </div>
    </div>
  );
}
