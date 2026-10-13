import { CheckCircle2, ClipboardPaste, Link2, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";
import { submitManual } from "../actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function AddEvent({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="page-title">Add an event</h1>
        <p className="page-lead">For anything the scrapers can&apos;t see: a private LinkedIn post, a forwarded invite, a conference flyer.</p>
      </div>

      {sp.error && (
        <p className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> {sp.error}
        </p>
      )}
      {sp.notevent && (
        <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> Saved, but no event could be created from that input. See Source health for details.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form action={submitManual} className="card space-y-4 p-5">
          <div>
            <label className="label" htmlFor="url">
              URL (LinkedIn post or event page)
            </label>
            <div className="relative">
              <Link2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              <input id="url" name="url" type="url" className="input pl-9" placeholder="https://www.linkedin.com/posts/…" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="text">
              Event text
            </label>
            <textarea id="text" name="text" rows={9} className="input" placeholder="Paste the post, invite or email text here…" />
            <p className="mt-1 text-xs text-slate-500">Give a URL, text, or both. Text works best for LinkedIn posts.</p>
          </div>
          <div>
            <label className="label" htmlFor="note">
              Note to self (optional)
            </label>
            <input id="note" name="note" className="input" placeholder="Why this matters, who invited you…" />
          </div>
          <SubmitButton pendingLabel="Reading and ranking… (10–20 s)" icon={<Sparkles size={16} aria-hidden />}>
            Add and rank event
          </SubmitButton>
        </form>

        <aside className="card h-fit space-y-4 p-5 text-sm text-slate-600">
          <h2 className="section-title">What happens next</h2>
          <ol className="space-y-3">
            <li className="flex gap-2.5">
              <ClipboardPaste size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden /> Your text is read by Gemini to pull out the date, city, organizer and deadline.
            </li>
            <li className="flex gap-2.5">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden /> It is ranked against your preferences and added to the dashboard.
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden /> LinkedIn pages are never opened. Only the text you paste, plus any Luma, Meetup or Eventbrite links inside it.
            </li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
