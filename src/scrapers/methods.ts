/** Names of registered scrape methods. Kept separate from the registry so the UI never imports scraper code. Keep in sync with src/scrapers/index.ts. */
export const SCRAPE_METHODS = ["static", "rss", "playwright", "google_alerts", "email_forward"];
