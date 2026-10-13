/**
 * Fill in registration deadlines for events already stored by reading each event page's ticket-sales-end date.
 * Only touches events with no deadline whose source is AllEvents or Eventbrite. Run: npm run backfill:deadlines
 */
import "./load-env";
import { deriveStatus, toIsoDate, todayIST } from "../src/lib/dates";
import { query } from "../src/lib/db";
import { fetchEventPage } from "../src/scrapers/lib/page";

async function main() {
  const today = todayIST();
  const rows = await query<{ id: number; source_url: string; event_date: string | null; date_precision: "exact" | "month"; title: string }>(
    `select id, source_url, to_char(event_date,'YYYY-MM-DD') as event_date, date_precision, title from events
     where registration_deadline is null and source_url is not null and (source like 'AllEvents%' or source like 'Eventbrite%') and status <> 'past' order by id`,
  );
  console.log(`${rows.length} events to check`);
  let found = 0;
  for (const r of rows) {
    try {
      const page = await fetchEventPage(r.source_url);
      const deadline = toIsoDate((page?.payload as any)?.structured?.registration_deadline);
      if (!deadline) continue;
      const d = deriveStatus(r.event_date, deadline, today, r.date_precision);
      await query(`update events set registration_deadline = $1, status = $2, deadline_urgent = $3, needs_rank = true where id = $4`, [deadline, d.status, d.deadline_urgent, r.id]);
      found++;
      if (d.deadline_urgent) console.log(`  urgent: ${r.title.slice(0, 60)} closes ${deadline}`);
    } catch {
      /* page unreachable: leave as unknown */
    }
  }
  console.log(`Done: deadline found for ${found} of ${rows.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
