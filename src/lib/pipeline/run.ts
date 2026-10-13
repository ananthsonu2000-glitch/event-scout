/** Daily orchestration. Imported by scripts/daily.ts only (it pulls in Playwright-capable scrapers). */
import { todayIST } from "../dates";
import { query } from "../db";
import { refreshDerived } from "../queries";
import type { SourceRow } from "../types";
import { SCRAPERS } from "@/scrapers";
import { takeWarnings } from "@/scrapers/lib/enrich";
import { insertRawItems } from "./ingest";
import { logRun, processPending, rankPending } from "./process";

const errMsg = (e: unknown) => String(e instanceof Error ? e.message : e).slice(0, 500);

/** Run every active source. One failing scraper never stops the others. */
export async function runScrapers(): Promise<{ ok: number; failed: number }> {
  const sources = await query<SourceRow>(`select id, name, url, source_type, scrape_method, city_tags, category_tags, active, config, notes, null as last_run_at, last_status from sources where active order by id`);
  let ok = 0;
  let failed = 0;

  for (const source of sources) {
    const started = Date.now();
    const scraper = SCRAPERS[source.scrape_method];
    try {
      if (!scraper) throw new Error(`Unknown scrape_method "${source.scrape_method}"`);
      takeWarnings(); // clear leftovers from the previous source
      const items = await scraper(source);
      const { found, created } = await insertRawItems(items, { id: source.id, name: source.name, type: source.source_type });
      // Pages that couldn't be opened (blocked, 404) mean thinner data: show them as a partial run on Source health.
      const warns = takeWarnings();
      const status = warns.length ? "partial" : "success";
      await logRun(source.name, source.scrape_method, started, status, found, created, warns.length ? `${warns.length} detail page(s) unreachable, e.g. ${warns[0]}` : undefined);
      await query(`update sources set last_run_at = now(), last_status = $2 where id = $1`, [source.id, status]);
      console.log(`✓ ${source.name}: ${found} items, ${created} new${warns.length ? ` (${warns.length} detail pages unreachable)` : ""}`);
      ok++;
    } catch (err) {
      await logRun(source.name, source.scrape_method, started, "failed", 0, 0, errMsg(err)).catch(() => undefined);
      await query(`update sources set last_run_at = now(), last_status = 'failed' where id = $1`, [source.id]).catch(() => undefined);
      console.error(`✗ ${source.name}: ${errMsg(err)}`);
      failed++;
    }
  }
  return { ok, failed };
}

export async function runDaily() {
  const today = todayIST();
  await refreshDerived(today);

  const scrape = await runScrapers();

  let started = Date.now();
  const proc = await processPending(Number(process.env.MAX_PROCESS_PER_RUN ?? 200));
  await logRun("Pipeline: normalize & dedupe", "pipeline", started, proc.failed ? (proc.processed ? "partial" : "failed") : "success", proc.processed + proc.failed, proc.created, proc.firstError);
  console.log(`Normalized: ${proc.created} new, ${proc.merged} merged, ${proc.rejected} rejected, ${proc.failed} failed`);

  started = Date.now();
  const rank = await rankPending();
  await logRun("Pipeline: Gemini ranking", "pipeline", started, rank.failedBatches ? (rank.ranked ? "partial" : "failed") : "success", rank.ranked, rank.ranked, rank.firstError);
  console.log(`Ranked: ${rank.ranked} events (${rank.failedBatches} failed batches)`);

  await refreshDerived(today);
  return { scrape, proc, rank };
}
