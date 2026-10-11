import { ChevronDown, Plus, Power, Trash2, TriangleAlert } from "lucide-react";
import { Pill } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { SubmitButton } from "@/components/SubmitButton";
import { listSources } from "@/lib/queries";
import { SCRAPE_METHODS } from "@/scrapers/methods";
import { addSource, deleteSource, toggleSource } from "../actions";

export const dynamic = "force-dynamic";

const TYPES = ["event_platform", "event_listing", "media", "industry_body", "startup_network", "web_discovery", "email_forward", "other"];

export default async function Sources({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sources = await listSources();
  const active = sources.filter((s) => s.active).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Event sources</h1>
          <p className="text-sm text-slate-500">
            {active} active of {sources.length}. Only active sources run in the daily scrape.
          </p>
        </div>
      </div>

      {sp.error && (
        <p className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> {sp.error}
        </p>
      )}

      {sources.length === 0 && <EmptyState title="No sources yet" hint="Add one below, or run npm run db:seed." />}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sources.map((s) => (
          <article key={s.id} className={`card flex flex-col gap-3 p-4 transition ${s.active ? "" : "opacity-70"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-slate-900">{s.name}</h2>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-sky-700 hover:underline">
                    {s.url.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">Reads from Gmail</span>
                )}
              </div>
              <Pill tone={s.active ? "green" : "slate"}>{s.active ? "Active" : "Inactive"}</Pill>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Pill>{s.scrape_method}</Pill>
              <Pill>{s.source_type}</Pill>
              {[...s.city_tags, ...s.category_tags].slice(0, 4).map((t) => (
                <span key={t} className="rounded-md bg-white px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-inset ring-slate-200">
                  {t}
                </span>
              ))}
            </div>

            {s.notes && <p className="line-clamp-2 text-xs text-slate-500">{s.notes}</p>}

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`h-2 w-2 rounded-full ${s.last_status === "failed" ? "bg-red-500" : s.last_status === "success" ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden />
                {s.last_status ? `${s.last_status} · ${s.last_run_at ?? ""}` : "Never run"}
              </div>
              <div className="flex gap-1.5">
                <form action={toggleSource}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="btn-secondary" aria-label={`${s.active ? "Deactivate" : "Activate"} ${s.name}`}>
                    <Power size={13} aria-hidden /> {s.active ? "Turn off" : "Turn on"}
                  </button>
                </form>
                <form action={deleteSource}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="btn-secondary text-red-700 hover:bg-red-50" aria-label={`Delete ${s.name}`}>
                    <Trash2 size={13} aria-hidden />
                  </button>
                </form>
              </div>
            </div>
          </article>
        ))}
      </div>

      <details className="card group" open={!!sp.error}>
        <summary className="flex cursor-pointer items-center gap-2 p-4 font-semibold text-slate-900">
          <Plus size={16} aria-hidden /> Add a source
          <ChevronDown size={15} className="chevron ml-auto text-slate-400 transition" aria-hidden />
        </summary>
        <form action={addSource} className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" name="name" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="url">URL</label>
            <input id="url" name="url" type="url" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="scrape_method">Scrape method</label>
            <select id="scrape_method" name="scrape_method" className="input">
              {SCRAPE_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="source_type">Source type</label>
            <select id="source_type" name="source_type" className="input">
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="city_tags">City tags</label>
            <input id="city_tags" name="city_tags" className="input" placeholder="Bengaluru, Mumbai" />
          </div>
          <div>
            <label className="label" htmlFor="category_tags">Category tags</label>
            <input id="category_tags" name="category_tags" className="input" placeholder="Startup, CXO" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="config">Config (JSON, optional)</label>
            <textarea id="config" name="config" rows={3} className="input font-mono text-xs" placeholder='{"item_selector": ".event-card", "title_selector": "h3", "date_selector": ".date"}' />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Adding…" icon={<Plus size={16} aria-hidden />}>
              Add source
            </SubmitButton>
          </div>
        </form>
      </details>
    </div>
  );
}
