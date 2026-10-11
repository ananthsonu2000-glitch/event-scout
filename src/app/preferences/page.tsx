import { getPreferences } from "@/lib/queries";
import { savePreferences } from "../actions";

export const dynamic = "force-dynamic";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function Preferences({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const p = await getPreferences();
  const field = (name: string, label: string, value: string[], hint: string) => (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <textarea id={name} name={name} rows={2} defaultValue={value.join(", ")} className="input" />
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Preferences</h1>
      {sp.saved && <p className="rounded bg-green-50 p-3 text-sm text-green-800">Saved. New rankings use these preferences. Existing events are re-ranked only when they change.</p>}
      <form action={savePreferences} className="card space-y-4 p-5">
        {field("target_cities", "Target cities", p.target_cities, "Comma-separated, e.g. Bengaluru, Mumbai, Delhi NCR")}
        {field("focus_domains", "Focus domains", p.focus_domains, "e.g. CIO roundtables, AI adoption, SaaS")}
        {field("audience_types", "Audience types", p.audience_types, "e.g. CXOs, founders, investors")}
        {field("excluded_topics", "Excluded topics", p.excluded_topics, "e.g. student events, job fairs")}
        <div>
          <label className="label" htmlFor="priority_rules">
            Priority rules (plain English)
          </label>
          <textarea id="priority_rules" name="priority_rules" rows={3} defaultValue={p.priority_rules} className="input" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="digest_day">
              Digest day
            </label>
            <select id="digest_day" name="digest_day" defaultValue={p.digest_day} className="input">
              {DAYS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="digest_time">
              Digest time (IST)
            </label>
            <input id="digest_time" name="digest_time" type="time" defaultValue={p.digest_time} className="input" />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" name="digest_enabled" defaultChecked={p.digest_enabled} /> Send digest
          </label>
        </div>
        <p className="rounded bg-slate-50 p-3 text-xs text-slate-600">
          The send time is set by the cron schedule in <code>.github/workflows/monday-digest.yml</code> (default Monday 07:00 IST). The enable
          toggle is honored on every run. Day and time here are recorded for reference.
        </p>
        <button className="btn">Save preferences</button>
      </form>
    </div>
  );
}
