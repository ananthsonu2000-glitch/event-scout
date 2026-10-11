import * as cheerio from "cheerio";
import { extractJsonLdEvents } from "./page";
import type { ScrapedItem } from "../types";

/** Per-source config (stored in sources.config) shared by the static and Playwright scrapers. */
export interface ListingConfig {
  item_selector?: string;
  title_selector?: string;
  link_selector?: string;
  date_selector?: string;
  snippet_selector?: string;
  max_items?: number;
  /** Playwright only */
  wait_for?: string;
  scroll?: boolean;
}

const EVENTISH = /event|summit|conference|roundtable|meetup|forum|expo|webinar|workshop|conclave|\/e\//i;

/**
 * Extract event items from a listing page's HTML. Strategy, in order:
 *  1. schema.org Event JSON-LD on the page
 *  2. configured CSS selectors (config.item_selector, ...)
 *  3. heuristic: anchors that look like event links
 */
export function extractItemsFromHtml(html: string, baseUrl: string, cfg: ListingConfig = {}): ScrapedItem[] {
  const $ = cheerio.load(html);
  const max = cfg.max_items ?? 40;
  const abs = (href?: string) => {
    if (!href) return null;
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  };
  const items: ScrapedItem[] = [];

  for (const ev of extractJsonLdEvents($)) {
    if (!ev.title) continue;
    items.push({
      title: ev.title,
      snippet: ev.description?.slice(0, 1500),
      url: abs(ev.url) ?? baseUrl,
      date: ev.event_date ?? null,
      payload: { structured: ev },
    });
  }

  if (!items.length && cfg.item_selector) {
    $(cfg.item_selector).each((_, el) => {
      const node = $(el);
      const link = cfg.link_selector ? node.find(cfg.link_selector).first() : node.find("a").first();
      const title = (cfg.title_selector ? node.find(cfg.title_selector).first().text() : link.text() || node.text()).trim();
      if (!title) return;
      items.push({
        title,
        snippet: cfg.snippet_selector ? node.find(cfg.snippet_selector).first().text().trim() : node.text().replace(/\s+/g, " ").trim().slice(0, 600),
        url: abs(link.attr("href") ?? node.attr("href")) ?? baseUrl,
        date: cfg.date_selector ? node.find(cfg.date_selector).first().text().trim() || null : null,
      });
    });
  }

  if (!items.length) {
    const seen = new Set<string>();
    $("a[href]").each((_, el) => {
      const a = $(el);
      const href = abs(a.attr("href"));
      const title = a.text().replace(/\s+/g, " ").trim();
      if (!href || title.length < 15 || seen.has(href)) return;
      if (!EVENTISH.test(href) && !EVENTISH.test(title)) return;
      seen.add(href);
      items.push({
        title,
        snippet: a.closest("li, article, div").text().replace(/\s+/g, " ").trim().slice(0, 600),
        url: href,
      });
    });
  }

  return items.slice(0, max);
}
