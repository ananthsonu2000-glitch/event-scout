import { isPastDate, toIsoDate, type DatePrecision } from "../dates";
import { geminiJson } from "../gemini";
import type { Preferences, RawEventRow } from "../types";

export interface NormalizedEvent {
  title: string;
  description: string | null;
  event_date: string | null;
  /** 'month' = only the month is known: event_date is the 1st of that month (a tentative timeline). */
  date_precision: DatePrecision;
  registration_deadline: string | null;
  city: string | null;
  venue: string | null;
  organizer: string | null;
  category: string | null;
  audience: string | null;
  price: string | null;
  source: string;
  source_type: string;
  source_url: string | null;
}

const CITY_ALIASES: Record<string, string> = {
  bangalore: "Bengaluru",
  bengaluru: "Bengaluru",
  bombay: "Mumbai",
  mumbai: "Mumbai",
  "मुंबई": "Mumbai",
  "बेंगलुरु": "Bengaluru",
  "बैंगलोर": "Bengaluru",
  delhi: "Delhi NCR",
  "new delhi": "Delhi NCR",
  "दिल्ली": "Delhi NCR",
  gurgaon: "Delhi NCR",
  gurugram: "Delhi NCR",
  noida: "Delhi NCR",
  "greater noida": "Delhi NCR",
  "delhi ncr": "Delhi NCR",
  madras: "Chennai",
  online: "Online",
  virtual: "Online",
};

/** Sources sometimes put a state where the city should be. These are not cities: infer the city from the venue instead. */
const STATES = new Set(["karnataka", "maharashtra", "haryana", "uttar pradesh", "telangana", "tamil nadu", "west bengal", "gujarat", "rajasthan", "kerala", "punjab", "india"]);

const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function normalizeCity(city?: string | null): string | null {
  if (!city) return null;
  const c = city.trim();
  if (!c) return null;
  const lower = c.toLowerCase();
  if (CITY_ALIASES[lower]) return CITY_ALIASES[lower];
  if (STATES.has(lower)) return null;
  if (/[^\u0000-ɏ]/.test(c)) return null; // unrecognised non-Latin script
  return titleCase(c);
}

const KNOWN_CITIES = [...Object.keys(CITY_ALIASES).filter((k) => /^[a-z ]+$/.test(k) && k !== "virtual"), "hyderabad", "pune", "chennai", "kolkata", "ahmedabad", "kochi", "jaipur", "chandigarh"];

/** Find a known city name inside free text (venue, title...). Used when a source gives a venue but no city. */
export function inferCity(text?: string | null): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const k of KNOWN_CITIES) if (new RegExp(`\\b${k}\\b`).test(t)) return normalizeCity(k);
  return null;
}

const clean = (s?: string | null, max = 2000): string | null => {
  const v = (s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;/g, "-")
    .replace(/&#8217;/g, "'")
    .replace(/&lt;[^&]*?&gt;/g, " ") // escaped HTML tags some sites put in descriptions
    .replace(/\s+/g, " ")
    .trim();
  return v ? v.slice(0, max) : null;
};

// ---------------------------------------------------------------------------------------------------------------
// Relevance prefilter. Broad listings (AllEvents, Meetup, Eventbrite...) are full of concerts, yoga and festivals.
// This runs in code, before any AI call, on items that already carry structured data.
// ---------------------------------------------------------------------------------------------------------------
const OFF_TOPIC =
  /\b(concert|live music|music night|stand[- ]?up|comedy|open mic|dj night|party|nightlife|yoga|zumba|dance|dancing|kids?|toddlers?|painting|pottery|art exhibition|fashion|wedding|bridal|astrology|spiritual|meditation|trek|trekking|cricket|marathon|run for|food festival|beer|pub crawl|garba|navratri|dussehra|diwali|mela|flea market|job fair|walk-?in|campus placement|admission|coaching|webinar|online course|certification|speed dating|singles|tattoo|gaming tournament|esports)\b/i;

/** Online-only events: Vikram wants in-person networking. */
const ONLINE_ONLY = /\((online|virtual)\)|\bonline[- ]only\b|\b(online|virtual) (event|meetup|session|networking|workshop|masterclass|summit)\b/i;

const BUSINESS_TERMS =
  /\b(summit|conference|conclave|roundtable|round table|forum|symposium|expo|meetup|meet-up|networking|mixer|founders?|startups?|start-up|investors?|vc|cxo|ceo|cio|cto|cfo|chro|leadership|leaders|enterprise|saas|b2b|ai|genai|artificial intelligence|machine learning|cloud|cyber|fintech|data|digital|tech|technology|innovation|business|entrepreneurs?|demo day|pitch|panel|keynote|gcc|transformation|industry|operators?|growth|product)\b/i;

/** Returns a rejection reason, or null when the item looks like a business/tech event worth considering. */
export function prefilterReason(title: string, description: string | null, organizer: string | null): string | null {
  if (OFF_TOPIC.test(title)) return "Off-topic (not a business event)";
  if (ONLINE_ONLY.test(title)) return "Online-only event";
  if (!BUSINESS_TERMS.test(`${title} ${description ?? ""} ${organizer ?? ""}`)) return "Off-topic (no business signal)";
  return null;
}

/**
 * The quality gate: only complete, current events are stored. Returns a rejection reason or null.
 * A date is required, but a tentative month counts. Manual submissions are exempt (added on purpose).
 */
export function qualityGate(e: NormalizedEvent, today: string, manual: boolean): string | null {
  if (manual) return null;
  if (!e.title) return "No title";
  if (!e.event_date) return "No date or timeline";
  if (isPastDate(e.event_date, today, e.date_precision)) return `Past event (${e.event_date})`;
  if (!e.city && !e.venue) return "No location";
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Gemini extraction. Free-tier quota is tiny, so many items are sent in ONE request.
// ---------------------------------------------------------------------------------------------------------------
export interface AiExtraction {
  is_event: boolean;
  title?: string | null;
  description?: string | null;
  event_date?: string | null;
  date_precision?: string | null;
  registration_deadline?: string | null;
  city?: string | null;
  venue?: string | null;
  organizer?: string | null;
  category?: string | null;
  audience?: string | null;
  price?: string | null;
}

const nullableString = { type: "STRING", nullable: true };
const EXTRACT_FIELDS = {
  is_event: { type: "BOOLEAN" },
  title: nullableString,
  description: nullableString,
  event_date: { ...nullableString, description: "YYYY-MM-DD, start date of the event. For a month-only timeline use the 1st of that month." },
  date_precision: { type: "STRING", nullable: true, enum: ["exact", "month"] },
  registration_deadline: { ...nullableString, description: "YYYY-MM-DD, only if explicitly stated" },
  city: nullableString,
  venue: nullableString,
  organizer: nullableString,
  category: nullableString,
  audience: nullableString,
  price: nullableString,
};
const BATCH_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { index: { type: "INTEGER" }, ...EXTRACT_FIELDS }, required: ["index", "is_event"] },
    },
  },
  required: ["items"],
};

const itemText = (raw: RawEventRow, max: number) => [raw.raw_title, raw.raw_snippet, raw.raw_payload?.text].filter(Boolean).join("\n\n").slice(0, max);

/** Gemini Flash extraction for a batch of raw items. Returns results keyed by raw_events.id (missing = no answer). */
export async function extractBatch(raws: RawEventRow[], today: string): Promise<Map<number, AiExtraction>> {
  const blocks = raws
    .map((r, i) => `### ITEM ${i}\nSource: ${r.source_name} (${r.source_type})\nURL: ${r.raw_url ?? "n/a"}\n${itemText(r, 2800)}`)
    .join("\n\n");
  const prompt = `Today's date is ${today} (India). For EACH item below, extract structured event data. Return one entry per item, with "index" equal to the item number.

Rules:
- is_event is true only for a specific UPCOMING (or currently running) in-person or hybrid conference, summit, roundtable, conclave, expo, founder/investor/CXO meetup or networking event.
- is_event is FALSE for: news articles and opinion pieces, speaker-lineup or "what happened" write-ups, job posts, ads, course listings, webinars and online-only trainings, job fairs, student or campus events, consumer entertainment, and anything that has ALREADY taken place.
- Past events: if the text is written in the past tense ("brought together", "was held", "explored", "concluded") or the event date is before today's date, set is_event to false. Still fill event_date if you can read it.
- Use ONLY facts present in the item's text. Use null when unknown. Never guess dates.
- Dates must be YYYY-MM-DD. Resolve relative dates ("this Friday") using today's date. If no year is given, assume the next occurrence unless the text says it already happened.
- date_precision: "exact" when a specific day is stated. "month" when only a month or season is stated (for example "March 2027" or "Q1 2027"): then set event_date to the 1st of that month and date_precision to "month". If the text gives no timing at all, event_date is null.
- registration_deadline only if a deadline/last date to register is explicitly stated.
- city: the city name (e.g. Bengaluru, Mumbai, Delhi NCR) or "Online" for virtual events. Use the venue or address if the city is not named.
- category: a short label such as "CXO", "Enterprise AI", "Startup", "SaaS", "Investor", "General Tech".
- audience: who it targets, e.g. "CIOs, founders". price: "Free", "Paid" or the stated price.

${blocks}`;

  const res = await geminiJson<{ items: (AiExtraction & { index: number })[] }>(prompt, BATCH_SCHEMA, {
    system: "You extract structured event data. Respond with JSON only.",
  });
  const out = new Map<number, AiExtraction>();
  for (const it of res.items ?? []) {
    const raw = raws[it.index];
    if (raw) out.set(raw.id, it);
  }
  return out;
}

/** Either a normalized event, or the reason the item should be rejected (kept in raw_events for audit). */
export type NormalizeResult = { event: NormalizedEvent } | { rejected: string };

export interface PendingAi {
  raw: RawEventRow;
  base: NormalizedEvent;
  structured: Record<string, string | undefined>;
  manual: boolean;
}

/** Step 1 (no AI): use structured data when complete, apply the prefilter, or flag the item as needing Gemini. */
export function prepareNormalize(raw: RawEventRow, today: string): { done: NormalizeResult } | { pending: PendingAi } {
  const s = (raw.raw_payload?.structured ?? {}) as Record<string, string | undefined>;
  const manual = raw.source_type.startsWith("manual");

  const base: NormalizedEvent = {
    title: clean(s.title ?? raw.raw_title, 300) ?? "",
    description: clean(s.description ?? raw.raw_snippet),
    event_date: toIsoDate(s.event_date ?? raw.raw_date),
    date_precision: "exact",
    registration_deadline: toIsoDate(s.registration_deadline),
    city: normalizeCity(s.city),
    venue: clean(s.venue, 300),
    organizer: clean(s.organizer, 200),
    category: null,
    audience: null,
    price: clean(s.price, 100),
    source: raw.source_name,
    source_type: raw.source_type,
    source_url: raw.raw_url,
  };

  const structuredComplete = !!(s.title && base.event_date && (base.city || base.venue));
  if (!structuredComplete) return { pending: { raw, base, structured: s, manual } };

  if (!manual) {
    const reason = prefilterReason(base.title, base.description, base.organizer);
    if (reason) return { done: { rejected: reason } };
  }
  return { done: finalize(base, today, manual) };
}

/** Step 2: merge Gemini's answer into the base event, then finalize. */
export function completeNormalize(p: PendingAi, ai: AiExtraction, today: string): NormalizeResult {
  const { base, raw, structured: s, manual } = p;
  if (!ai.is_event && !manual) {
    const aiDate = toIsoDate(ai.event_date);
    return { rejected: aiDate && isPastDate(aiDate, today) ? `Past event (${aiDate})` : "Not an event" };
  }
  base.title = clean(s.title ?? ai.title ?? raw.raw_title, 300) ?? base.title;
  base.description = base.description ?? clean(ai.description);
  if (!base.event_date) {
    base.event_date = toIsoDate(ai.event_date);
    if (ai.date_precision === "month") base.date_precision = "month";
  }
  base.registration_deadline = base.registration_deadline ?? toIsoDate(ai.registration_deadline);
  base.city = base.city ?? normalizeCity(ai.city);
  base.venue = base.venue ?? clean(ai.venue, 300);
  base.organizer = base.organizer ?? clean(ai.organizer, 200);
  base.category = clean(ai.category, 100);
  base.audience = clean(ai.audience, 200);
  base.price = base.price ?? clean(ai.price, 100);
  if (!manual && ONLINE_ONLY.test(base.title)) return { rejected: "Online-only event" };
  return finalize(base, today, manual);
}

function finalize(base: NormalizedEvent, today: string, manual: boolean): NormalizeResult {
  // Some sources give a venue but no city: read it from the venue/title.
  if (!base.city) base.city = inferCity(base.venue) ?? inferCity(base.title);
  if (base.date_precision === "month" && base.event_date) base.event_date = `${base.event_date.slice(0, 7)}-01`;
  const reason = qualityGate(base, today, manual);
  return reason ? { rejected: reason } : { event: base };
}

/** Single-item convenience wrapper (one Gemini request). The pipeline batches instead. */
export async function normalizeRaw(raw: RawEventRow, _prefs: Preferences, today: string): Promise<NormalizeResult> {
  const p = prepareNormalize(raw, today);
  if ("done" in p) return p.done;
  const ai = (await extractBatch([raw], today)).get(raw.id);
  if (!ai) throw new Error("Gemini returned no result for this item");
  return completeNormalize(p.pending, ai, today);
}
