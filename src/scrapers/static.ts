import { enrichWithDetailPages } from "./lib/enrich";
import { extractItemsFromHtml, type ListingConfig } from "./lib/extract";
import { fetchHtml } from "./lib/page";
import type { ScrapedItem, ScraperFn } from "./types";

/**
 * Generic static-page scraper (Cheerio). Configure per source via sources.config, e.g.
 * { "item_selector": ".event-card", "title_selector": "h3", "link_selector": "a", "date_selector": ".date" }
 * With no config it falls back to JSON-LD Event data and then to event-looking links.
 * "extra_urls": [...] scrapes more listing pages (other categories or cities) under the same source.
 * Each item's own page is then opened (see enrichWithDetailPages) so dates and cities are available.
 */
export const staticScraper: ScraperFn = async (source) => {
  if (!source.url) throw new Error("Source has no URL");
  const urls: string[] = [source.url, ...((source.config.extra_urls as string[] | undefined) ?? [])];
  const items: ScrapedItem[] = [];
  const seen = new Set<string>();
  let firstError: unknown;
  let okPages = 0;

  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      for (const it of extractItemsFromHtml(html, url, source.config as ListingConfig)) {
        const key = it.url ?? it.title;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(it);
      }
      okPages++;
    } catch (err) {
      firstError ??= err;
    }
  }
  if (!okPages) throw firstError ?? new Error("No listing page could be read");
  return enrichWithDetailPages(items, source.url, source.config.max_detail_pages ?? 15);
};
