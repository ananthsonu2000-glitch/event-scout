import * as cheerio from "cheerio";
import type { ScrapedItem } from "../types";

const UA = "Mozilla/5.0 (compatible; IndustryEventScout/0.1; +personal-use)";

export function isLinkedInUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "linkedin.com" || h.endsWith(".linkedin.com") || h === "lnkd.in";
  } catch {
    return false;
  }
}

/** Fetch a public page. LinkedIn is refused outright: it is only ever used via alert/forwarded emails. */
export async function fetchHtml(url: string, timeoutMs = 15_000): Promise<string> {
  if (isLinkedInUrl(url)) throw new Error("Refusing to fetch LinkedIn directly");
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export interface StructuredEvent {
  title?: string;
  description?: string;
  event_date?: string;
  registration_deadline?: string;
  city?: string;
  venue?: string;
  organizer?: string;
  price?: string;
  url?: string;
}

/** Pull schema.org Event objects out of JSON-LD blocks. */
export function extractJsonLdEvents($: cheerio.CheerioAPI): StructuredEvent[] {
  const out: StructuredEvent[] = [];
  const visit = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node !== "object") return;
    if (node["@graph"]) visit(node["@graph"]);
    const types = ([] as string[]).concat(node["@type"] ?? []);
    if (types.some((t) => /Event$/.test(String(t)))) out.push(mapEvent(node));
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      visit(JSON.parse($(el).contents().text()));
    } catch {
      /* ignore malformed JSON-LD */
    }
  });
  return out;
}

function mapEvent(n: any): StructuredEvent {
  const loc = Array.isArray(n.location) ? n.location[0] : n.location;
  const addr = loc?.address;
  const offers = Array.isArray(n.offers) ? n.offers[0] : n.offers;
  const org = Array.isArray(n.organizer) ? n.organizer[0] : n.organizer;
  let price: string | undefined;
  if (n.isAccessibleForFree === true) price = "Free";
  else if (offers?.price !== undefined) price = Number(offers.price) === 0 ? "Free" : `${offers.priceCurrency ?? ""} ${offers.price}`.trim();
  return {
    title: n.name,
    description: typeof n.description === "string" ? n.description : undefined,
    event_date: n.startDate,
    registration_deadline: offers?.validThrough,
    venue: loc?.name,
    city: typeof addr === "string" ? undefined : addr?.addressLocality,
    organizer: org?.name,
    price,
    url: n.url,
  };
}

/** Turn a single public event page (Luma, Meetup, Eventbrite, organizer site...) into a ScrapedItem. */
export async function fetchEventPage(url: string, extra: Partial<ScrapedItem> = {}): Promise<ScrapedItem | null> {
  const $ = cheerio.load(await fetchHtml(url));
  const structured = extractJsonLdEvents($)[0];
  const title =
    structured?.title || $('meta[property="og:title"]').attr("content") || $("title").first().text().trim();
  if (!title) return null;
  const description =
    structured?.description ||
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    "";
  $("script, style, nav, footer, header, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 4000);
  return {
    title: title.trim(),
    snippet: description.trim().slice(0, 1500),
    url,
    date: structured?.event_date ?? null,
    payload: { structured, text },
    ...extra,
  };
}

export const EVENT_PLATFORM_HOSTS = [
  "lu.ma",
  "luma.com",
  "meetup.com",
  "eventbrite.",
  "townscript.com",
  "allevents.in",
  "insider.in",
  "konfhub.com",
  "hasgeek.com",
  "10times.com",
  "airmeet.com",
  "hopin.com",
];

export function isEventPlatformUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return EVENT_PLATFORM_HOSTS.some((p) => h === p || h.endsWith(`.${p}`) || h.includes(p));
  } catch {
    return false;
  }
}

export function extractUrls(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [];
  return [...new Set(found.map((u) => u.replace(/[.,;:!?]+$/, "")))];
}
