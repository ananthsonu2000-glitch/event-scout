import { enrichWithDetailPages } from "./lib/enrich";
import { extractItemsFromHtml, type ListingConfig } from "./lib/extract";
import { fetchHtml } from "./lib/page";
import type { ScraperFn } from "./types";

/**
 * Generic static-page scraper (Cheerio). Configure per source via sources.config, e.g.
 * { "item_selector": ".event-card", "title_selector": "h3", "link_selector": "a", "date_selector": ".date" }
 * With no config it falls back to JSON-LD Event data and then to event-looking links.
 * Each item's own page is then opened (see enrichWithDetailPages) so dates and cities are available.
 */
export const staticScraper: ScraperFn = async (source) => {
  if (!source.url) throw new Error("Source has no URL");
  const html = await fetchHtml(source.url);
  const items = extractItemsFromHtml(html, source.url, source.config as ListingConfig);
  return enrichWithDetailPages(items, source.url, source.config.max_detail_pages ?? 15);
};
