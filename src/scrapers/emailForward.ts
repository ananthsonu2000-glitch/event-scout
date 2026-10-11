import * as cheerio from "cheerio";
import { query } from "@/lib/db";
import { getMessage, searchMessageIds } from "@/lib/gmail";
import { extractUrls, isLinkedInUrl } from "./lib/page";
import { linksToItems } from "./lib/signals";
import type { ScrapedItem, ScraperFn } from "./types";

/**
 * Reads forwarded event emails and LinkedIn notification emails from Gmail.
 * Vikram forwards a post/invite to the scout inbox and tags it with the Gmail label "event-scout"
 * (a Gmail filter can do this automatically). Override the search with config.query or GMAIL_FORWARD_QUERY.
 */
export const emailForwardScraper: ScraperFn = async (source) => {
  const q =
    source.config.query ??
    process.env.GMAIL_FORWARD_QUERY ??
    "(label:event-scout OR from:notifications-noreply@linkedin.com OR from:invitations@linkedin.com) newer_than:7d";
  const ids = await searchMessageIds(q, source.config.max_messages ?? 40);
  if (!ids.length) return [];

  const done = new Set(
    (await query<{ id: string }>(`select gmail_message_id as id from email_intake_logs where gmail_message_id = any($1)`, [ids])).map((r) => r.id),
  );
  const budget = { left: 20 };
  const items: ScrapedItem[] = [];

  for (const id of ids.filter((i) => !done.has(i))) {
    try {
      const msg = await getMessage(id);
      const body = (msg.text || (msg.html ? cheerio.load(msg.html).text() : "")).replace(/\s+\n/g, "\n").trim();
      const hrefs = msg.html ? cheerio.load(msg.html)("a[href]").map((_, a) => cheerio.load(msg.html)(a).attr("href") ?? "").get() : [];
      const urls = [...new Set([...extractUrls(body), ...hrefs.filter((h) => /^https?:/.test(h))])];
      const fromLinkedIn = /linkedin\.com/i.test(msg.from);
      const mentionsLinkedIn = fromLinkedIn || urls.some(isLinkedInUrl);
      const sourceType = fromLinkedIn ? "linkedin_notification" : mentionsLinkedIn ? "linkedin_forward" : "email_forward";
      const title = msg.subject.replace(/^((fwd?|re):\s*)+/i, "").trim() || "Forwarded event email";

      // The email itself is the primary item; its text carries the clues.
      items.push({
        title,
        snippet: body.slice(0, 3000),
        url: urls.find(isLinkedInUrl) ?? urls[0] ?? null,
        sourceName: mentionsLinkedIn ? "LinkedIn signal" : "Gmail forward",
        sourceType,
        payload: { gmail_message_id: id, from: msg.from },
      });
      // External event pages linked in the email are scraped as well.
      const external = await linksToItems(
        urls.filter((u) => !isLinkedInUrl(u)).map((url) => ({ url, title, snippet: "" })),
        {
          baseName: mentionsLinkedIn ? "LinkedIn signal" : "Gmail forward",
          baseType: sourceType,
          linkedinType: sourceType,
          meta: { gmail_message_id: id },
          budget,
        },
      );
      // Only keep fetched event pages, not bare tracking links.
      const pages = external.filter((e) => (e.payload as any)?.structured || (e.payload as any)?.text);
      items.push(...pages);

      await query(
        `insert into email_intake_logs (gmail_message_id, kind, sender, subject, received_at, items_found, status)
         values ($1, $2, $3, $4, $5, $6, 'processed') on conflict do nothing`,
        [id, sourceType, msg.from, msg.subject, msg.date, 1 + pages.length],
      );
    } catch (err) {
      await query(
        `insert into email_intake_logs (gmail_message_id, kind, status, error) values ($1, 'email_forward', 'failed', $2) on conflict do nothing`,
        [id, String(err instanceof Error ? err.message : err).slice(0, 500)],
      );
    }
  }
  return items;
};
