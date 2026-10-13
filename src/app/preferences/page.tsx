import { CheckCircle2, Mail, Save, Target } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";
import { TagInput } from "@/components/TagInput";
import { getPreferences } from "@/lib/queries";
import { savePreferences } from "../actions";

export const dynamic = "force-dynamic";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function Preferences({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const p = await getPreferences();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="page-title">Preferences</h1>
        <p className="page-lead">These guide how Gemini ranks every event. Type a value and press Enter or comma to add it.</p>
      </div>

      {sp.saved && (
        <p className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden /> Saved. New rankings use these preferences. Existing events are re-ranked only when they change.
        </p>
      )}

      <form action={savePreferences} className="space-y-5">
        <section className="card space-y-4 p-5">
          <h2 className="section-title flex items-center gap-2">
            <Target size={16} className="text-slate-400" aria-hidden /> What to look for
          </h2>
          <TagInput name="target_cities" label="Target cities" defaultValue={p.target_cities} placeholder="Bengaluru, Mumbai…" hint="Events here score highest." />
          <TagInput name="focus_domains" label="Focus domains" defaultValue={p.focus_domains} placeholder="CIO roundtables, AI adoption…" />
          <TagInput name="audience_types" label="Audience types" defaultValue={p.audience_types} placeholder="CXOs, founders, investors…" hint="The people you want in the room." />
          <TagInput name="excluded_topics" label="Excluded topics" defaultValue={p.excluded_topics} placeholder="Student events, job fairs…" hint="Matching events are ranked Low." />
          <div>
            <label className="label" htmlFor="priority_rules">
              Priority rules (plain English)
            </label>
            <textarea id="priority_rules" name="priority_rules" rows={3} defaultValue={p.priority_rules} className="input" />
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="section-title flex items-center gap-2">
            <Mail size={16} className="text-slate-400" aria-hidden /> Weekly digest
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="digest_day">
                Day
              </label>
              <select id="digest_day" name="digest_day" defaultValue={p.digest_day} className="input">
                {DAYS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="digest_time">
                Time (IST)
              </label>
              <input id="digest_time" name="digest_time" type="time" defaultValue={p.digest_time} className="input" />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input type="checkbox" name="digest_enabled" defaultChecked={p.digest_enabled} className="h-4 w-4 rounded border-slate-300" /> Send the digest
            </label>
          </div>
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            The actual send time is set by the cron schedule in <code>.github/workflows/monday-digest.yml</code> (Monday 07:00 IST). The on/off toggle is honoured on every run. Day and time here are for reference.
          </p>
        </section>

        <SubmitButton pendingLabel="Saving…" icon={<Save size={16} aria-hidden />}>
          Save preferences
        </SubmitButton>
      </form>
    </div>
  );
}
