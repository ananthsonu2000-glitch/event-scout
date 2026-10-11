import { isLinkedInType, type EventRow, type EventSourceRef } from "../types";
import type { NormalizedEvent } from "./normalize";

const STOP = new Set(["the", "a", "an", "of", "and", "in", "on", "for", "to", "at", "by", "with", "2025", "2026", "2027", "event", "india"]);

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export function canonicalUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|ref|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}${u.search}`.toLowerCase();
  } catch {
    return null;
  }
}

type Candidate = Pick<EventRow, "title" | "event_date" | "city" | "organizer" | "source_url" | "sources">;

/**
 * Two records are the same event when they share a registration URL, or have very similar titles
 * on compatible dates/cities, or similar titles plus the same date and city/organizer.
 */
export function isDuplicate(a: Candidate, b: Candidate): boolean {
  const urlsA = new Set([canonicalUrl(a.source_url), ...(a.sources ?? []).map((s) => canonicalUrl(s.url))].filter(Boolean));
  const urlsB = [canonicalUrl(b.source_url), ...(b.sources ?? []).map((s) => canonicalUrl(s.url))].filter(Boolean);
  if (urlsB.some((u) => urlsA.has(u))) return true;

  const sim = jaccard(titleTokens(a.title), titleTokens(b.title));
  const dateKnownBoth = !!a.event_date && !!b.event_date;
  if (dateKnownBoth && a.event_date !== b.event_date) return false;
  const cityOk = !a.city || !b.city || a.city === b.city;
  if (!cityOk) return false;
  if (sim >= 0.75) return true;
  const sameOrg = !!a.organizer && !!b.organizer && a.organizer.toLowerCase() === b.organizer.toLowerCase();
  return sim >= 0.5 && dateKnownBoth && (!!a.city || sameOrg);
}

export function findDuplicate(candidate: Candidate, existing: Candidate[]): number {
  return existing.findIndex((e) => isDuplicate(candidate, e));
}

export type EventPatch = Partial<
  Pick<
    EventRow,
    | "description" | "event_date" | "registration_deadline" | "city" | "venue" | "organizer" | "category"
    | "audience" | "price" | "source" | "source_type" | "source_url" | "sources" | "is_linkedin_signal"
  >
>;

/** Merge a new sighting into an existing event. Returns the fields to update (empty = nothing new). */
export function mergeEvent(existing: EventRow, n: NormalizedEvent): EventPatch {
  const patch: EventPatch = {};
  const fill = <K extends keyof NormalizedEvent & keyof EventRow>(k: K) => {
    if (!existing[k] && n[k]) (patch as any)[k] = n[k];
  };
  (["event_date", "registration_deadline", "city", "venue", "organizer", "category", "audience", "price"] as const).forEach(fill);
  if (n.description && n.description.length > (existing.description?.length ?? 0) + 40) patch.description = n.description;

  // Sources list: add this sighting if new.
  const ref: EventSourceRef = { name: n.source, type: n.source_type, url: n.source_url };
  const has = existing.sources.some((s) => s.name === ref.name && canonicalUrl(s.url) === canonicalUrl(ref.url));
  if (!has) {
    patch.sources = [...existing.sources, ref];
    patch.is_linkedin_signal = existing.is_linkedin_signal || patch.sources.some((s) => isLinkedInType(s.type));
  }

  // A real registration page beats a LinkedIn post as the primary link.
  if (isLinkedInType(existing.source_type) && !isLinkedInType(n.source_type) && n.source_url) {
    patch.source = n.source;
    patch.source_type = n.source_type;
    patch.source_url = n.source_url;
  }
  return patch;
}
