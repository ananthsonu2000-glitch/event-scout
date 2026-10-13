/** Merge duplicate events already in the database (same rules as the pipeline). Run: npm run dedupe */
import "./load-env";
import { query } from "../src/lib/db";
import { EVENT_COLS } from "../src/lib/queries";
import { isDuplicate, mergeEvent } from "../src/lib/pipeline/dedupe";
import type { EventRow } from "../src/lib/types";

async function main() {
  const events = await query<EventRow>(`select ${EVENT_COLS}, raw_event_ids from events order by id`);
  const gone = new Set<number>();
  let merged = 0;
  for (let i = 0; i < events.length; i++) {
    const keep = events[i];
    if (gone.has(keep.id)) continue;
    for (let j = i + 1; j < events.length; j++) {
      const dup = events[j];
      if (gone.has(dup.id) || !isDuplicate(keep, dup)) continue;
      // Fold every source of the duplicate into the kept event.
      let sources = keep.sources;
      for (const s of dup.sources) if (!sources.some((x) => x.name === s.name && x.url === s.url)) sources = [...sources, s];
      const patch = mergeEvent(keep, {
        title: dup.title, description: dup.description, event_date: dup.event_date, date_precision: dup.date_precision,
        registration_deadline: dup.registration_deadline, city: dup.city, venue: dup.venue, organizer: dup.organizer, category: dup.category,
        audience: dup.audience, price: dup.price, source: dup.source, source_type: dup.source_type, source_url: dup.source_url,
      });
      const linkedin = sources.some((s) => s.type.includes("linkedin")) || keep.is_linkedin_signal || dup.is_linkedin_signal;
      await query(
        `update events set sources = $1::jsonb, is_linkedin_signal = $2, city = coalesce(city, $3), venue = coalesce(venue, $4), organizer = coalesce(organizer, $5),
           raw_event_ids = raw_event_ids || $6::int[], needs_rank = true, updated_at = now() where id = $7`,
        [JSON.stringify(sources), linkedin, patch.city ?? dup.city, patch.venue ?? dup.venue, patch.organizer ?? dup.organizer, (dup as any).raw_event_ids ?? [], keep.id],
      );
      keep.sources = sources;
      await query(`update raw_events set event_id = $1 where event_id = $2`, [keep.id, dup.id]);
      await query(`delete from events where id = $1`, [dup.id]);
      gone.add(dup.id);
      merged++;
      console.log(`merged #${dup.id} "${dup.title}" into #${keep.id} "${keep.title}"`);
    }
  }
  console.log(`Done: ${merged} duplicate(s) merged.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
