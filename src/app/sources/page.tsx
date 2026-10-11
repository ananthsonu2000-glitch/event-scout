import { Pill } from "@/components/Badges";
import { listSources } from "@/lib/queries";
import { SCRAPE_METHODS } from "@/scrapers/methods";
import { addSource, deleteSource, toggleSource } from "../actions";

export const dynamic = "force-dynamic";

const TYPES = ["event_platform", "event_listing", "media", "industry_body", "startup_network", "web_discovery", "email_forward", "other"];

export default async function Sources({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sources = await listSources();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Event sources</h1>
      {sp.error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{sp.error}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Source</th>
              <th className="p-3">Method</th>
              <th className="p-3">Tags</th>
              <th className="p-3">Last run</th>
              <th className="p-3">Active</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 align-top">
                <td className="p-3">
                  <div className="font-medium">{s.name}</div>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-blue-700 hover:underline">
                      {s.url}
                    </a>
                  )}
                  <div className="text-xs text-slate-500">{s.source_type}</div>
                  {s.notes && <div className="mt-1 max-w-md text-xs text-slate-500">{s.notes}</div>}
                </td>
                <td className="p-3">
                  <Pill>{s.scrape_method}</Pill>
                </td>
                <td className="p-3 text-xs text-slate-600">{[...s.city_tags, ...s.category_tags].join(", ")}</td>
                <td className="p-3 text-xs">
                  {s.last_run_at ?? "Never"}
                  {s.last_status && <div className={s.last_status === "failed" ? "font-semibold text-red-700" : "text-green-700"}>{s.last_status}</div>}
                </td>
                <td className="p-3">
                  <form action={toggleSource}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className={`rounded-full px-3 py-1 text-xs font-semibold ${s.active ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"}`}>
                      {s.active ? "Active" : "Inactive"}
                    </button>
                  </form>
                </td>
                <td className="p-3">
                  <form action={deleteSource}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="text-xs text-red-700 hover:underline">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={addSource} className="card grid gap-3 p-5 sm:grid-cols-2">
        <h2 className="text-base font-semibold sm:col-span-2">Add a source</h2>
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
          <button className="btn">Add source</button>
        </div>
      </form>
    </div>
  );
}
