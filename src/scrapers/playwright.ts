import { extractItemsFromHtml, type ListingConfig } from "./lib/extract";
import { isLinkedInUrl } from "./lib/page";
import type { ScraperFn } from "./types";

/**
 * Playwright template for JavaScript-rendered listing pages (Meetup, Luma city pages, 10Times...).
 * It renders the page in headless Chromium, then reuses the same extraction as the static scraper.
 * Config (sources.config): { wait_for: ".event-card", scroll: true, item_selector, title_selector, ... }
 *
 * To add a bespoke dynamic scraper, copy this file, replace the "render" step with page interactions
 * (clicks, pagination, cookie banners), and register it in src/scrapers/index.ts.
 * Requires: npx playwright install chromium
 */
export const playwrightScraper: ScraperFn = async (source) => {
  if (!source.url) throw new Error("Source has no URL");
  if (isLinkedInUrl(source.url)) throw new Error("LinkedIn must not be scraped directly");
  const cfg = source.config as ListingConfig;

  // Imported lazily so the Next.js app never bundles Playwright.
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: "Mozilla/5.0 (compatible; IndustryEventScout/0.1)" });
    await page.goto(source.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (cfg.wait_for) await page.waitForSelector(cfg.wait_for, { timeout: 15_000 });
    else await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    if (cfg.scroll) {
      for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, 3000);
        await page.waitForTimeout(800);
      }
    }
    return extractItemsFromHtml(await page.content(), source.url, cfg);
  } finally {
    await browser.close();
  }
};
