import { extractUrls, fetchEventPage, isEventPlatformUrl, isLinkedInUrl } from "./page";
import type { ScrapedItem } from "../types";

export interface MailLink {
  url: string;
  title: string;
  snippet: string;
}

export interface SignalContext {
  baseName: string; // e.g. "Google Alerts"
  baseType: string; // e.g. "google_alert"
  linkedinType: string; // e.g. "google_alert_linkedin"
  meta: Record<string, unknown>;
  /** Shared cap on outbound page fetches per run, to stay polite and fast. */
  budget: { left: number };
}

const LINKEDIN_NAME = "LinkedIn signal";

/**
 * Convert links found in an alert/forwarded email into raw items.
 *  - LinkedIn links are NEVER fetched. They become "LinkedIn signal" items built from the email text.
 *    Any external event page mentioned alongside (Luma, Meetup, Eventbrite...) is scraped instead.
 *  - Event-platform links are fetched and parsed.
 *  - Anything else is stored as a plain item for Gemini to classify.
 */
export async function linksToItems(links: MailLink[], ctx: SignalContext): Promise<ScrapedItem[]> {
  const items: ScrapedItem[] = [];
  const push = (it: ScrapedItem) => items.push({ ...it, payload: { ...(it.payload ?? {}), ...ctx.meta } });

  const tryFetch = async (url: string, extra: Partial<ScrapedItem>): Promise<ScrapedItem | null> => {
    if (ctx.budget.left <= 0 || isLinkedInUrl(url)) return null;
    ctx.budget.left--;
    try {
      return await fetchEventPage(url, extra);
    } catch {
      return null;
    }
  };

  for (const link of links) {
    if (isLinkedInUrl(link.url)) {
      push({ title: link.title, snippet: link.snippet, url: link.url, sourceName: LINKEDIN_NAME, sourceType: ctx.linkedinType });
      for (const ext of extractUrls(`${link.title} ${link.snippet}`).filter((u) => !isLinkedInUrl(u) && isEventPlatformUrl(u))) {
        const page = await tryFetch(ext, { sourceName: LINKEDIN_NAME, sourceType: ctx.linkedinType });
        if (page) push({ ...page, payload: { ...(page.payload ?? {}), discovered_via: link.url } });
      }
    } else if (isEventPlatformUrl(link.url)) {
      const page = await tryFetch(link.url, { sourceName: ctx.baseName, sourceType: ctx.baseType });
      push(page ?? { title: link.title, snippet: link.snippet, url: link.url });
    } else {
      push({ title: link.title, snippet: link.snippet, url: link.url });
    }
  }
  return items;
}
