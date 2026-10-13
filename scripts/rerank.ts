/**
 * Re-rank every upcoming event with the current preferences and ranking rules.
 * Run after changing Preferences or the ranking prompt: npm run rerank
 * Ranking uses Gemini (batched, with model fallback). If the daily quota runs out it stops; run it again tomorrow.
 */
import "./load-env";
import { query } from "../src/lib/db";
import { rankPending } from "../src/lib/pipeline/process";

async function main() {
  await query(`update events set needs_rank = true where status <> 'past'`);
  for (let round = 1; round <= 20; round++) {
    const r = await rankPending();
    console.log(`round ${round}: ranked ${r.ranked}${r.failedBatches ? `, ${r.failedBatches} failed batch(es): ${r.firstError}` : ""}`);
    const [{ n }] = await query<{ n: string }>(`select count(*) as n from events where needs_rank and status <> 'past' and (event_date is not null or source_type like 'manual%')`);
    if (Number(n) === 0 || r.ranked === 0) {
      console.log(Number(n) === 0 ? "All events ranked." : `${n} events still waiting (quota or errors). Run again later.`);
      break;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
