import { ChevronDown, CircleCheck, CircleX, Mail } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const TS = (col: string) => `to_char(${col} at time zone 'Asia/Kolkata', 'DD Mon HH24:MI')`;

function Status({ s }: { s: string }) {
  const tone =
    s === "success" || s === "sent" || s === "processed"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : s === "failed"
        ? "bg-red-50 text-red-700 ring-red-200"
        : "bg-amber-50 text-amber-800 ring-amber-200";
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone}`}>{s}</span>;
}

function Dot({ s }: { s: string }) {
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s === "failed" ? "bg-red-500" : s === "success" || s === "sent" ? "bg-emerald-500" : "bg-amber-400"}`} aria-hidden />;
}

function Table({ title, head, rows, open = false }: { title: string; head: string[]; rows: React.ReactNode[][]; open?: boolean }) {
  return (
    <details className="card" open={open}>
      <summary className="flex cursor-pointer items-center gap-2 p-4 font-semibold text-slate-900">
        {title} <span className="text-xs font-normal text-slate-400">{rows.length}</span>
        <ChevronDown size={15} className="chevron ml-auto text-slate-400 transition" aria-hidden />
      </summary>
      <div className="overflow-x-auto border-t border-slate-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              {head.map((h) => (
                <th key={h} className="whitespace-nowrap p-2.5 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="p-4 text-slate-500" colSpan={head.length}>
                  Nothing logged yet.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
                {r.map((c, j) => (
                  <td key={j} className="p-2.5">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const err = (e: string | null) => (e ? <span className="text-xs text-red-700">{e}</span> : null);

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
  } catch (e) {
    return <ErrorState title="Can't load health data" detail={String(e instanceof Error ? e.message : e)} />;
  }
  const { latest, runs, digests, emails, manual } = data;
  const failing = latest.filter((l: any) => l.status === "failed");
  const digestFailed = digests[0]?.status === "failed";
  const lastDigest = digests[0];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Source health</h1>
        <p className="text-sm text-slate-500">Latest result per source, digest delivery and raw logs. Times are IST.</p>
      </div>

      <div className={`flex items-center gap-3 rounded-lg border p-3.5 text-sm ${failing.length || digestFailed ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`} role="status">
        {failing.length || digestFailed ? <CircleX size={18} aria-hidden /> : <CircleCheck size={18} aria-hidden />}
        <p>
          {failing.length || digestFailed
            ? `${failing.length ? `${failing.length} source${failing.length > 1 ? "s" : ""} failed on the latest run. ` : ""}${digestFailed ? `The last digest failed to send: ${digests[0].error}` : ""}`
            : "Everything ran successfully on the latest run."}
        </p>
      </div>

      <section aria-label="Latest status per source" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {latest.map((r: any) => (
          <article key={r.source_name} className="card p-4">
            <div className="flex items-center gap-2">
              <Dot s={r.status} />
              <h2 className="min-w-0 flex-1 truncate font-semibold text-slate-900">{r.source_name}</h2>
              <Status s={r.status} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {r.scrape_method} · {r.at}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              <b className="tabular-nums">{r.items_found}</b> found · <b className="tabular-nums">{r.items_new}</b> new
            </p>
            {r.error && <p className="mt-2 break-words rounded-md bg-red-50 p-2 text-xs text-red-700">{r.error}</p>}
          </article>
        ))}
        <article className="card p-4">
          <div className="flex items-center gap-2">
            <Mail size={15} className="text-slate-400" aria-hidden />
            <h2 className="flex-1 font-semibold text-slate-900">Last digest</h2>
            {lastDigest && <Status s={lastDigest.status} />}
          </div>
          {lastDigest ? (
            <>
              <p className="mt-1 text-xs text-slate-500">
                {lastDigest.at} · {lastDigest.provider ?? "n/a"} → {lastDigest.recipient}
              </p>
              <p className="mt-2 text-sm text-slate-700">
                <b>{lastDigest.event_count}</b> events · <b>{lastDigest.high_count}</b> high · <b>{lastDigest.urgent_count}</b> urgent · <b>{lastDigest.linkedin_count}</b> LinkedIn
              </p>
              {lastDigest.error && <p className="mt-2 break-words rounded-md bg-red-50 p-2 text-xs text-red-700">{lastDigest.error}</p>}
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No digest has run yet.</p>
          )}
        </article>
      </section>

      {latest.length === 0 && <EmptyState title="No scraper runs yet" hint="Run the Daily event scrape workflow, or npm run scrape locally." />}

      <div className="space-y-3">
        <Table
          title="Digest runs"
          head={["When", "Status", "To", "Provider", "Events", "High", "Urgent", "LinkedIn", "Error"]}
          rows={digests.map((r: any) => [r.at, <Status key="s" s={r.status} />, r.recipient, r.provider, r.event_count, r.high_count, r.urgent_count, r.linkedin_count, err(r.error)])}
        />
        <Table
          title="Recent scraper runs"
          head={["When", "Source", "Method", "Status", "Items", "New", "ms", "Error"]}
          rows={runs.map((r: any) => [r.at, r.source_name, r.scrape_method, <Status key="s" s={r.status} />, r.items_found, r.items_new, r.duration_ms, err(r.error)])}
        />
        <Table
          title="Email intake (Google Alerts and forwards)"
          head={["When", "Kind", "From", "Subject", "Items", "Status", "Error"]}
          rows={emails.map((r: any) => [r.at, r.kind, r.sender, r.subject, r.items_found, <Status key="s" s={r.status} />, err(r.error)])}
        />
        <Table title="Manual submissions" head={["When", "Input", "Status", "Error"]} rows={manual.map((r: any) => [r.at, r.what, <Status key="s" s={r.status} />, err(r.error)])} />
      </div>
    </div>
  );
}
