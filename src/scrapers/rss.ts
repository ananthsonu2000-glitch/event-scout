import Parser from "rss-parser";
import { enrichWithDetailPages } from "./lib/enrich";
import type { ScraperFn } from "./types";

/**
 * RSS/Atom scraper. Feed items are often articles rather than events, so they are stored raw and
 * Gemini decides in the normalization step whether each one is a real event.
 * Optional config: { "max_items": 30, "keywords": ["summit", "roundtable"] }
 */
export const rssScraper: ScraperFn = async (source) => {
  if (!source.url) throw new Error("Source has no URL");
  const parser = new Parser({ timeout: 15_000, headers: { "User-Agent": "IndustryEventScout/0.1" } });
  const feed = await parser.parseURL(source.url);
  const keywords: string[] = (source.config.keywords ?? []).map((k: string) => k.toLowerCase());
  const max: number = source.config.max_items ?? 30;

  const items = (feed.items ?? [])
    .filter((it) => {
      if (!keywords.length) return true;
      const hay = `${it.title ?? ""} ${it.contentSnippet ?? ""}`.toLowerCase();
      return keywords.some((k) => hay.includes(k));
    })
    .slice(0, max)
    .map((it) => ({
      title: (it.title ?? "").trim(),
      snippet: (it.contentSnippet ?? it.content ?? "").slice(0, 1500),
      url: it.link ?? null,
      // pubDate is when the post was published, not when the event happens, so it goes in payload only.
      payload: { published: it.isoDate ?? it.pubDate ?? null, categories: it.categories ?? [] },
    }))
    .filter((it) => it.title);

  // Open each article so Gemini can read the date and city, not just the feed blurb.
  return enrichWithDetailPages(items, null, source.config.max_detail_pages ?? 15);
};
