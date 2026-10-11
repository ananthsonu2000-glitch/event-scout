import { toIsoDate } from "../dates";
import { geminiJson } from "../gemini";
import type { Preferences, RawEventRow } from "../types";

export interface NormalizedEvent {
  title: string;
  description: string | null;
  event_date: string | null;
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
  delhi: "Delhi NCR",
  "new delhi": "Delhi NCR",
  gurgaon: "Delhi NCR",
  gurugram: "Delhi NCR",
  noida: "Delhi NCR",
  "delhi ncr": "Delhi NCR",
  madras: "Chennai",
  online: "Online",
  virtual: "Online",
};

export function normalizeCity(city?: string | null): string | null {
  if (!city) return null;
  const c = city.trim();
  if (!c) return null;
  return CITY_ALIASES[c.toLowerCase()] ?? c;
}

const clean = (s?: string | null, max = 2000): string | null => {
  const v = (s ?? "").replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : null;
};

interface AiExtraction {
  is_event: boolean;
  title?: string | null;
  description?: string | null;
  event_date?: string | null;
  registration_deadline?: string | null;
  city?: string | null;
  venue?: string | null;
  organizer?: string | null;
  category?: string | null;
  audience?: string | null;
  price?: string | null;
}

const nullableString = { type: "STRING", nullable: true };
const EXTRACT_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_event: { type: "BOOLEAN" },
    title: nullableString,
    description: nullableString,
    event_date: { ...nullableString, description: "YYYY-MM-DD, start date of the event" },
    registration_deadline: { ...nullableString, description: "YYYY-MM-DD, only if explicitly stated" },
    city: nullableString,
    venue: nullableString,
    organizer: nullableString,
    category: nullableString,
    audience: nullableString,
    price: nullableString,
  },
  required: ["is_event"],
};

/** Gemini Flash extraction: classify a raw item and fill normalized fields. */
async function extractWithGemini(raw: RawEventRow, today: string): Promise<AiExtraction> {
  const text = [raw.raw_title, raw.raw_snippet, raw.raw_payload?.text].filter(Boolean).join("\n\n").slice(0, 6000);
  const prompt = `Today's date is ${today} (India). Extract structured event data from the item below.

Rules:
- is_event is true only for a specific upcoming conference, summit, roundtable, meetup, workshop or similar gathering. It is false for news articles, opinion pieces, job posts, ads, course listings, or recaps of past events.
- Use ONLY facts present in the text. Use null when unknown. Never guess dates.
- Resolve relative dates ("this Friday") using today's date. Dates must be YYYY-MM-DD.
- registration_deadline only if a deadline/last date to register is explicitly stated.
- city: the city name (e.g. Bengaluru, Mumbai, Delhi NCR) or "Online" for virtual events.
- category: a short label such as "CXO", "Enterprise AI", "Startup", "SaaS", "Investor", "General Tech".
- audience: who it targets, e.g. "CIOs, founders".
- price: "Free", "Paid" or the stated price.

Source: ${raw.source_name} (${raw.source_type})
URL: ${raw.raw_url ?? "n/a"}

ITEM:
${text}`;
  return geminiJson<AiExtraction>(prompt, EXTRACT_SCHEMA, { system: "You extract structured event data. Respond with JSON only." });
}

/**
 * Normalize a raw item. Structured data (JSON-LD) is used when complete; otherwise Gemini fills the gaps.
 * Returns null when the item is not an event (stored as a rejected candidate), except manual submissions,
 * which are always kept and flagged for review.
 */
export async function normalizeRaw(raw: RawEventRow, _prefs: Preferences, today: string): Promise<NormalizedEvent | null> {
  const s = (raw.raw_payload?.structured ?? {}) as Record<string, string | undefined>;
  const manual = raw.source_type.startsWith("manual");

  const base: NormalizedEvent = {
    title: clean(s.title ?? raw.raw_title, 300) ?? "",
    description: clean(s.description ?? raw.raw_snippet),
    event_date: toIsoDate(s.event_date ?? raw.raw_date),
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
  if (!structuredComplete) {
    const ai = await extractWithGemini(raw, today);
    if (!ai.is_event && !manual) return null;
    base.title = clean(s.title ?? ai.title ?? raw.raw_title, 300) ?? base.title;
    base.description = base.description ?? clean(ai.description);
    base.event_date = base.event_date ?? toIsoDate(ai.event_date);
    base.registration_deadline = base.registration_deadline ?? toIsoDate(ai.registration_deadline);
    base.city = base.city ?? normalizeCity(ai.city);
    base.venue = base.venue ?? clean(ai.venue, 300);
    base.organizer = base.organizer ?? clean(ai.organizer, 200);
    base.category = clean(ai.category, 100);
    base.audience = clean(ai.audience, 200);
    base.price = base.price ?? clean(ai.price, 100);
  }

  if (!base.title) return null;
  return base;
}
