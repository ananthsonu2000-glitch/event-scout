import * as cheerio from "cheerio";
import { query } from "@/lib/db";
import { getMessage, searchMessageIds } from "@/lib/gmail";
import { linksToItems, type MailLink } from "./lib/signals";
import type { ScrapedItem, ScraperFn } from "./types";

const NOISE = /unsubscribe|view all|see more results|edit this alert|flag as|delete this alert|manage your alerts|google alerts?$/i;

/** Google wraps result links as https://www.google.com/url?...&url=<real>. */
export function unwrapGoogleUrl(href: string): string | null {
  try {
    const u = new URL(href);
    if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname === "/url") {
      return u.searchParams.get("url") ?? u.searchParams.get("q");
    }
    return href;
  } catch {
    return null;
  }
}

/** Pull result links (title, snippet, real URL) out of a Google Alerts email body. */
export function parseAlertEmail(html: string): MailLink[] {
  const $ = cheerio.load(html);
  const out: MailLink[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, el) => {
    const a = $(el);
    const url = unwrapGoogleUrl(a.attr("href") ?? "");
    const title = a.text().replace(/\s+/g, " ").trim();
    if (!url || !/^https?:/.test(url) || !title || NOISE.test(title)) return;
    if (/(^|\.)google\.[a-z.]+$/.test(new URL(url).hostname)) return;
    if (seen.has(url)) return;

    // Snippet: grow outwards until the surrounding block has some text beyond the title.
    let snippet = "";
    let node = a.parent();
    for (let i = 0; i < 4 && node.length; i++, node = node.parent()) {
      const text = node.text().replace(/\s+/g, " ").trim();
      if (text.length > title.length + 30 && text.length < 1500) {
        snippet = text.replace(title, "").trim();
        break;
      }
    }
    seen.add(url);
    out.push({ url, title, snippet });
  });
  return out;
}

/**
 * Reads Google Alerts emails from Gmail. LinkedIn results become "LinkedIn signal" items; external
 * event pages mentioned in them are scraped. Processed message ids are tracked in email_intake_logs.
 * Config: { "query": "from:googlealerts-noreply@google.com newer_than:3d", "max_messages": 50 }
 */
export const googleAlertsScraper: ScraperFn = async (source) => {
  const q = source.config.query ?? "from:googlealerts-noreply@google.com newer_than:3d";
  const ids = await searchMessageIds(q, source.config.max_messages ?? 50);
  if (!ids.length) return [];

  const done = new Set(
    (await query<{ id: string }>(`select gmail_message_id as id from email_intake_logs where gmail_message_id = any($1)`, [ids])).map((r) => r.id),
  );
  const budget = { left: 30 };
  const items: ScrapedItem[] = [];

  for (const id of ids.filter((i) => !done.has(i))) {
    try {
      const msg = await getMessage(id);
      const alertQuery = msg.subject.replace(/^google alert\s*-\s*/i, "");
      const links = parseAlertEmail(msg.html || `<div>${msg.text}</div>`);
      const found = await linksToItems(links, {
        baseName: "Google Alerts",
        baseType: "google_alert",
        linkedinType: "google_alert_linkedin",
        meta: { alert_query: alertQuery, gmail_message_id: id },
        budget,
      });
      items.push(...found);
      await query(
        `insert into email_intake_logs (gmail_message_id, kind, sender, subject, received_at, items_found, status)
         values ($1, 'google_alert', $2, $3, $4, $5, 'processed') on conflict do nothing`,
        [id, msg.from, msg.subject, msg.date, found.length],
      );
    } catch (err) {
      await query(
        `insert into email_intake_logs (gmail_message_id, kind, status, error) values ($1, 'google_alert', 'failed', $2) on conflict do nothing`,
        [id, String(err instanceof Error ? err.message : err).slice(0, 500)],
      );
    }
  }
  return items;
};
