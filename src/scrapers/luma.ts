import * as cheerio from "cheerio";
import { fetchHtml } from "./lib/page";
import type { ScrapedItem, ScraperFn } from "./types";

/**
 * Luma city pages (https://lu.ma/bengaluru, /mumbai, /delhi...) are rendered from data embedded in the page
 * (__NEXT_DATA__), so no browser is needed. Each event carries its name, start time, city, hosts and link.
 * Online-only events are skipped. Config: { "max_items": 40 }.
 */
export const lumaScraper: ScraperFn = async (source) => {
  if (!source.url) throw new Error("Source has no URL");
  const $ = cheerio.load(await fetchHtml(source.url));
  const raw = $("#__NEXT_DATA__").contents().text();
  if (!raw) throw new Error("Luma page has no embedded event data (layout may have changed)");
  const data = JSON.parse(raw)?.props?.pageProps?.initialData?.data;
  const entries: any[] = data?.events ?? [];
  const max: number = source.config.max_items ?? 40;

  const items: ScrapedItem[] = [];
  for (const entry of entries.slice(0, max)) {
    const ev = entry.event;
    if (!ev?.name || !ev.start_at || !ev.url || ev.location_type === "online") continue;
    const city: string | undefined = ev.geo_address_info?.city;
    const area: string | undefined = ev.geo_address_info?.sublocality;
    const hosts: string[] = (entry.hosts ?? []).map((h: any) => h.name).filter(Boolean);
    const url = `https://lu.ma/${ev.url}`;
    items.push({
      title: ev.name,
      url,
      date: ev.start_at,
      snippet: [hosts.length ? `Hosted by ${hosts.join(", ")}` : "", area ?? "", city ?? ""].filter(Boolean).join(" · "),
      payload: {
        structured: {
          title: ev.name,
          event_date: ev.start_at, // UTC timestamp, converted to the IST day downstream
          city,
          venue: area ? `${area}, ${city ?? ""}` : city,
          organizer: hosts[0],
          url,
        },
      },
    });
  }
  return items;
};
