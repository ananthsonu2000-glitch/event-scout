import { query } from "@/lib/db";
import { fetchEventPage, isLinkedInUrl } from "./page";
import type { ScrapedItem } from "../types";

const stripHash = (u: string) => u.split("#")[0].replace(/\/$/, "");

/** Items whose full text is already attached (e.g. from an RSS feed's content) don't need their page fetched. */
const MIN_TEXT = 800;

let warnings: string[] = [];
/** Detail pages that could not be read during the last scraper run (blocked, 404...). Cleared on read. */
export function takeWarnings(): string[] {
  const w = warnings;
  warnings = [];
  return w;
}

/**
 * Listing pages and feeds usually carry only a title and a short blurb. The date, city and deadline live on the
 * item's own page, so open it and attach its structured data and text for Gemini to read.
 *
 * Skips: LinkedIn (never fetched), items that already have structured data or full text, links back to the
 * listing itself, and URLs already stored in raw_events (so a daily run doesn't re-fetch pages it has seen).
 * Capped per run. Unreachable pages are recorded as warnings so they show up on the Source health page.
 */
export async function enrichWithDetailPages(items: ScrapedItem[], listingUrl: string | null, max = 15): Promise<ScrapedItem[]> {
  const wanted = (i: ScrapedItem) =>
    !!i.url &&
    /^https?:/.test(i.url) &&
    !isLinkedInUrl(i.url) &&
    !(i.payload as any)?.structured &&
    String((i.payload as any)?.text ?? "").length < MIN_TEXT &&
    (!listingUrl || stripHash(i.url) !== stripHash(listingUrl));

  const candidates = items.filter(wanted);
  if (!candidates.length) return items;

  const known = new Set(
    (await query<{ u: string }>(`select raw_url as u from raw_events where raw_url = any($1)`, [candidates.map((c) => c.url)])).map((r) => r.u),
  );

  let budget = max;
  const out: ScrapedItem[] = [];
  for (const item of items) {
    if (budget <= 0 || !wanted(item) || known.has(item.url!)) {
      out.push(item);
      continue;
    }
    budget--;
    try {
      const page = await fetchEventPage(item.url!);
      if (page) {
        out.push({
          ...item, // keep the listing title: page <title> often carries the site name
          snippet: (page.snippet?.length ?? 0) > (item.snippet?.length ?? 0) ? page.snippet : item.snippet,
          date: item.date ?? page.date ?? null,
          payload: { ...(item.payload ?? {}), ...(page.payload ?? {}) },
        });
        continue;
      }
    } catch (err) {
      warnings.push(`${item.url} (${String(err instanceof Error ? err.message : err).slice(0, 60)})`);
    }
    out.push(item);
  }
  return out;
}
