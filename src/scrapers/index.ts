import { emailForwardScraper } from "./emailForward";
import { googleAlertsScraper } from "./googleAlerts";
import { playwrightScraper } from "./playwright";
import { rssScraper } from "./rss";
import { staticScraper } from "./static";
import type { ScraperFn } from "./types";

/**
 * Scraper registry. sources.scrape_method selects the entry.
 * To add a scraper: create src/scrapers/<name>.ts exporting a ScraperFn, register it here,
 * and add its name to SCRAPE_METHODS in ./methods.ts (used by the Sources page; selftest checks they match).
 */
export const SCRAPERS: Record<string, ScraperFn> = {
  static: staticScraper,
  rss: rssScraper,
  playwright: playwrightScraper,
  google_alerts: googleAlertsScraper,
  email_forward: emailForwardScraper,
};
