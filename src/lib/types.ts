export type Priority = "High" | "Medium" | "Low";

export interface EventSourceRef {
  name: string;
  type: string;
  url?: string | null;
}

export interface EventRow {
  id: number;
  title: string;
  description: string | null;
  event_date: string | null; // YYYY-MM-DD
  registration_deadline: string | null; // YYYY-MM-DD
  city: string | null;
  venue: string | null;
  organizer: string | null;
  source: string;
  source_type: string;
  source_url: string | null;
  sources: EventSourceRef[];
  category: string | null;
  audience: string | null;
  price: string | null;
  status: string;
  deadline_urgent: boolean;
  priority: Priority | null;
  relevance_score: number | null;
  audience_fit: string | null;
  urgency: string | null;
  reason: string | null;
  recommended_action: string | null;
  confidence: number | null;
  needs_review: boolean;
  review_reason: string | null;
  is_linkedin_signal: boolean;
  needs_rank: boolean;
}

export interface SourceRow {
  id: number;
  name: string;
  url: string | null;
  source_type: string;
  scrape_method: string;
  city_tags: string[];
  category_tags: string[];
  active: boolean;
  config: Record<string, any>;
  notes: string | null;
  last_run_at: string | null;
  last_status: string | null;
}

export interface RawEventRow {
  id: number;
  source_id: number | null;
  source_name: string;
  source_type: string;
  raw_title: string | null;
  raw_snippet: string | null;
  raw_url: string | null;
  raw_date: string | null;
  raw_payload: Record<string, any>;
}

export interface Preferences {
  target_cities: string[];
  focus_domains: string[];
  audience_types: string[];
  excluded_topics: string[];
  priority_rules: string;
  digest_day: string;
  digest_time: string;
  digest_timezone: string;
  digest_enabled: boolean;
}

/** Source types that count as LinkedIn-derived signals (never scraped directly from LinkedIn). */
export const LINKEDIN_SOURCE_TYPES = [
  "google_alert_linkedin",
  "linkedin_notification",
  "linkedin_forward",
  "manual_linkedin",
] as const;

export const isLinkedInType = (t: string) => (LINKEDIN_SOURCE_TYPES as readonly string[]).includes(t);
