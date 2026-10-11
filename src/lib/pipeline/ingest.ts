import { createHash } from "node:crypto";
import { query } from "../db";
import { extractUrls, fetchEventPage, isLinkedInUrl } from "@/scrapers/lib/page";
import type { ScrapedItem } from "@/scrapers/types";
import { processPending, rankPending } from "./process";

export function fingerprint(sourceName: string, url: string | null | undefined, title: string): string {
  return createHash("sha1").update(`${sourceName}|${url ?? ""}|${title.toLowerCase().trim()}`).digest("hex");
}

/** Store scraped items in raw_events (duplicates by fingerprint are ignored). Returns how many were new. */
export async function insertRawItems(
  items: ScrapedItem[],
  source: { id: number | null; name: string; type: string },
): Promise<{ found: number; created: number; ids: number[] }> {
  let created = 0;
  const ids: number[] = [];
  for (const it of items) {
    const title = (it.title ?? "").trim();
    if (!title) continue;
    const name = it.sourceName ?? source.name;
    const rows = await query<{ id: number }>(
      `insert into raw_events (source_id, source_name, source_type, raw_title, raw_snippet, raw_url, raw_date, raw_payload, fingerprint)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) on conflict (fingerprint) do nothing returning id`,
      [
        source.id, name, it.sourceType ?? source.type, title.slice(0, 500), it.snippet?.slice(0, 3000) ?? null,
        it.url ?? null, it.date ?? null, JSON.stringify(it.payload ?? {}), fingerprint(name, it.url, title),
      ],
    );
    if (rows[0]) {
      created++;
      ids.push(rows[0].id);
    }
  }
  return { found: items.length, created, ids };
}

/**
 * Manual submission flow: Vikram pastes a LinkedIn post URL, an event page URL, and/or raw text.
 * LinkedIn URLs are stored as a signal but never fetched. External event pages found in the text
 * (or given directly) are scraped. The item is processed and ranked immediately.
 */
export async function submitManualEvent(input: { url?: string; text?: string; note?: string }): Promise<{ submissionId: number; eventId: number | null; error?: string }> {
  const url = input.url?.trim() || null;
  const text = input.text?.trim() || null;
  if (!url && !text) throw new Error("Provide a URL or some event text");

  const [sub] = await query<{ id: number }>(
    `insert into manual_event_submissions (url, text_content, note) values ($1, $2, $3) returning id`,
    [url, text, input.note?.trim() || null],
  );

  try {
    const items: ScrapedItem[] = [];
    const linkedin = (url && isLinkedInUrl(url)) || (text ? extractUrls(text).some(isLinkedInUrl) : false);
    const type = linkedin ? "manual_linkedin" : "manual";
    const name = linkedin ? "LinkedIn signal" : "Manual submission";

    if (url && !isLinkedInUrl(url)) {
      const page = await fetchEventPage(url, { sourceName: name, sourceType: type }).catch(() => null);
      if (page) items.push({ ...page, payload: { ...(page.payload ?? {}), manual: true } });
      else items.push({ title: text?.split("\n")[0].slice(0, 200) || url, snippet: text ?? "", url, sourceName: name, sourceType: type, payload: { manual: true } });
    }
    if (text || (url && isLinkedInUrl(url))) {
      const firstLine = (text ?? "").split("\n").find((l) => l.trim())?.trim().slice(0, 200);
      items.push({
        title: firstLine || "LinkedIn post (manual)",
        snippet: [input.note, text].filter(Boolean).join("\n\n"),
        url: url ?? null,
        sourceName: name,
        sourceType: type,
        payload: { manual: true, submission_id: sub.id },
      });
      for (const ext of text ? extractUrls(text).filter((u) => !isLinkedInUrl(u)).slice(0, 3) : []) {
        const page = await fetchEventPage(ext, { sourceName: name, sourceType: type }).catch(() => null);
        if (page) items.push({ ...page, payload: { ...(page.payload ?? {}), manual: true } });
      }
    }

    const { ids } = await insertRawItems(items, { id: null, name, type });
    await query(`update manual_event_submissions set raw_event_id = $1 where id = $2`, [ids[0] ?? null, sub.id]);
    await processPending(items.length + 5);
    await rankPending(10);

    const [ev] = await query<{ event_id: number | null }>(
      `select event_id from raw_events where id = any($1) and event_id is not null limit 1`,
      [ids],
    );
    await query(`update manual_event_submissions set status = 'processed', event_id = $1 where id = $2`, [ev?.event_id ?? null, sub.id]);
    return { submissionId: sub.id, eventId: ev?.event_id ?? null };
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err).slice(0, 500);
    await query(`update manual_event_submissions set status = 'failed', error = $1 where id = $2`, [msg, sub.id]);
    return { submissionId: sub.id, eventId: null, error: msg };
  }
}
