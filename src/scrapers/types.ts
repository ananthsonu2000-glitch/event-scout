import type { SourceRow } from "@/lib/types";

/** What every scraper returns. The pipeline turns these into raw_events rows. */
export interface ScrapedItem {
  title: string;
  snippet?: string;
  url?: string | null;
  /** Event date if the source states it explicitly (NOT an article publish date). */
  date?: string | null;
  /** Overrides the source's name/type, e.g. LinkedIn signals found via Google Alerts. */
  sourceName?: string;
  sourceType?: string;
  payload?: Record<string, unknown>;
}

/** A scraper takes one source definition and returns items. Throwing marks the run as failed. */
export type ScraperFn = (source: SourceRow) => Promise<ScrapedItem[]>;
