import { submitManual } from "../actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function AddEvent({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">Add an event manually</h1>
        <p className="mt-1 text-sm text-slate-600">
          Paste a LinkedIn post URL, an event page URL, and/or the post text. LinkedIn pages are never fetched. The text you paste is
          read by Gemini, and any Luma/Meetup/Eventbrite links inside it are scraped. Processing takes about 10–20 seconds.
        </p>
      </div>

      {sp.error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{sp.error}</p>}
      {sp.notevent && (
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">Saved, but no event could be created from that input. Check it under Source health.</p>
      )}

      <form action={submitManual} className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="url">
            URL (LinkedIn post, event page…)
          </label>
          <input id="url" name="url" type="url" className="input" placeholder="https://www.linkedin.com/posts/…" />
        </div>
        <div>
          <label className="label" htmlFor="text">
            Event text (paste the post / invite)
          </label>
          <textarea id="text" name="text" rows={8} className="input" placeholder="Paste the post or email text here…" />
        </div>
        <div>
          <label className="label" htmlFor="note">
            Note for yourself (optional)
          </label>
          <input id="note" name="note" className="input" placeholder="Why this matters, who invited you…" />
        </div>
        <button className="btn">Add &amp; rank event</button>
      </form>
    </div>
  );
}
