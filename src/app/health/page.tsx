import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const TS = (col: string) => `to_char(${col} at time zone 'Asia/Kolkata', 'DD Mon HH24:MI')`;

function Status({ s }: { s: string }) {
  const tone =
    s === "success" || s === "sent" || s === "processed"
      ? "bg-green-100 text-green-800"
      : s === "failed"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${tone}`}>{s}</span>;
}

function Table({ title, head, rows }: { title: string; head: string[]; rows: React.ReactNode[][] }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{head.map((h) => <th key={h} className="p-2.5">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="p-4 text-slate-500" colSpan={head.length}>Nothing logged yet.</td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 align-top">
                {r.map((c, j) => <td key={j} className="p-2.5">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function Health() {
  let data;
  try {
    const [latest, runs, digests, emails, manual] = await Promise.all([
      query<any>(`select distinct on (source_name) source_name, scrape_method, status, items_found, items_new, error, ${TS("started_at")} as at
                  from scraper_runs order by source_name, started_at desc`),
      query<any>(`select source_name, scrape_method, status, items_found, items_new, duration_ms, error, ${TS("started_at")} as at
                  from scraper_runs order by started_at desc limit 40`),
      query<any>(`select status, recipient, provider, event_count, high_count, urgent_count, linkedin_count, error, ${TS("started_at")} as at
                  from digest_runs order by started_at desc limit 15`),
      query<any>(`select kind, sender, subject, items_found, status, error, ${TS("processed_at")} as at
                  from email_intake_logs order by processed_at desc limit 20`),
      query<any>(`select status, coalesce(url, left(text_content, 60)) as what, error, ${TS("submitted_at")} as at
                  from manual_event_submissions order by submitted_at desc limit 10`),
    ]);
    data = { latest, runs, digests, emails, manual };
  } catch (err) {
    return <p className="card p-6 text-sm text-red-700">Database error: {String(err instanceof Error ? err.message : err)}</p>;
  }
  const { latest, runs, digests, emails, manual } = data;
  const failing = latest.filter((l: any) => l.status === "failed").length;
  const digestFailed = digests[0]?.status === "failed";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Source health &amp; logs</h1>
      {(failing > 0 || digestFailed) && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-800">
          {failing > 0 && `${failing} source${failing > 1 ? "s" : ""} failed on the latest run. `}
          {digestFailed && `The last digest failed to send: ${digests[0].error}`}
        </p>
      )}

      <Table
        title="Latest status per source"
        head={["Source", "Method", "Status", "Items", "New", "When", "Error"]}
        rows={latest.map((r: any) => [r.source_name, r.scrape_method, <Status key="s" s={r.status} />, r.items_found, r.items_new, r.at, <span key="e" className="text-xs text-red-700">{r.error}</span>])}
      />
      <Table
        title="Digest runs"
        head={["When", "Status", "To", "Provider", "Events", "High", "Urgent", "LinkedIn", "Error"]}
        rows={digests.map((r: any) => [r.at, <Status key="s" s={r.status} />, r.recipient, r.provider, r.event_count, r.high_count, r.urgent_count, r.linkedin_count, <span key="e" className="text-xs text-red-700">{r.error}</span>])}
      />
      <Table
        title="Recent scraper runs"
        head={["When", "Source", "Method", "Status", "Items", "New", "ms", "Error"]}
        rows={runs.map((r: any) => [r.at, r.source_name, r.scrape_method, <Status key="s" s={r.status} />, r.items_found, r.items_new, r.duration_ms, <span key="e" className="text-xs text-red-700">{r.error}</span>])}
      />
      <Table
        title="Email intake (Google Alerts / forwards)"
        head={["When", "Kind", "From", "Subject", "Items", "Status", "Error"]}
        rows={emails.map((r: any) => [r.at, r.kind, r.sender, r.subject, r.items_found, <Status key="s" s={r.status} />, <span key="e" className="text-xs text-red-700">{r.error}</span>])}
      />
      <Table
        title="Manual submissions"
        head={["When", "Input", "Status", "Error"]}
        rows={manual.map((r: any) => [r.at, r.what, <Status key="s" s={r.status} />, <span key="e" className="text-xs text-red-700">{r.error}</span>])}
      />
    </div>
  );
}
