import { query } from "./db";
import type { EventRow, Preferences, SourceRow } from "./types";

/** Dates are cast to text so every runtime sees plain YYYY-MM-DD strings. */
export const EVENT_COLS = `id, title, description,
  to_char(event_date, 'YYYY-MM-DD') as event_date,
  to_char(registration_deadline, 'YYYY-MM-DD') as registration_deadline,
  city, venue, organizer, source, source_type, source_url, sources, category, audience, price,
  status, deadline_urgent, priority, relevance_score, audience_fit, urgency, reason,
  recommended_action, confidence::float8 as confidence, needs_review, review_reason,
  is_linkedin_signal, needs_rank`;

export const DEFAULT_PREFS: Preferences = {
  target_cities: ["Bengaluru"],
  focus_domains: [],
  audience_types: [],
  excluded_topics: [],
  priority_rules: "",
  digest_day: "Monday",
  digest_time: "07:00",
  digest_timezone: "Asia/Kolkata",
  digest_enabled: true,
};

export async function getPreferences(): Promise<Preferences> {
  const rows = await query<Preferences>(
    `select target_cities, focus_domains, audience_types, excluded_topics, priority_rules,
            digest_day, digest_time, digest_timezone, digest_enabled
     from vikram_preferences where id = 1`,
  );
  return rows[0] ?? DEFAULT_PREFS;
}

export interface EventFilters {
  view?: string;
  city?: string;
  category?: string;
  source?: string;
  from?: string;
  to?: string;
  q?: string;
  includePast?: boolean;
  /** relevance (default) | date | deadline | recent */
  sort?: string;
}

/** SQL condition: the event has a date, or was added manually. */
export const DATED_OR_MANUAL = `(event_date is not null or source_type like 'manual%')`;

const PRIORITY_ORDER =`case priority when 'High' then 1 when 'Medium' then 2 when 'Low' then 3 else 4 end`;

export async function listEvents(f: EventFilters, limit = 200): Promise<EventRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (f.view === "high") where.push(`priority = 'High'`);
  if (f.view === "deadline") where.push(`deadline_urgent`);
  if (f.view === "linkedin") where.push(`is_linkedin_signal`);
  if (f.view === "review") where.push(`needs_review`);
  // Events with no date found are only listed under "Needs review" (manual entries are always shown).
  if (f.view !== "review") where.push(DATED_OR_MANUAL);
  if (!f.includePast && f.view !== "review") where.push(`status <> 'past'`);
  if (f.city) where.push(`city = ${p(f.city)}`);
  if (f.category) where.push(`category = ${p(f.category)}`);
  if (f.source) where.push(`sources @> ${p(JSON.stringify([{ name: f.source }]))}::jsonb`);
  if (f.from) where.push(`event_date >= ${p(f.from)}::date`);
  if (f.to) where.push(`event_date <= ${p(f.to)}::date`);
  if (f.q) {
    const like = p(`%${f.q}%`);
    where.push(`(title ilike ${like} or description ilike ${like} or organizer ilike ${like} or reason ilike ${like})`);
  }

  const order =
    f.sort === "date"
      ? `event_date asc nulls last, relevance_score desc nulls last`
      : f.sort === "deadline"
        ? `registration_deadline asc nulls last, ${PRIORITY_ORDER}`
        : f.sort === "recent"
          ? `created_at desc`
          : f.view === "deadline"
            ? `registration_deadline asc, ${PRIORITY_ORDER}`
            : `${PRIORITY_ORDER}, relevance_score desc nulls last, event_date asc nulls last`;

  return query<EventRow>(
    `select ${EVENT_COLS} from events ${where.length ? `where ${where.join(" and ")}` : ""}
     order by ${order} limit ${Number(limit)}`,
    params,
  );
}

export async function getEvent(id: number): Promise<EventRow | null> {
  const rows = await query<EventRow>(`select ${EVENT_COLS} from events where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function viewCounts(): Promise<Record<string, number>> {
  const [r] = await query<Record<string, string>>(
    `select
       count(*) filter (where status <> 'past' and ${DATED_OR_MANUAL}) as "all",
       count(*) filter (where priority = 'High' and status <> 'past' and ${DATED_OR_MANUAL}) as high,
       count(*) filter (where deadline_urgent and status <> 'past' and ${DATED_OR_MANUAL}) as deadline,
       count(*) filter (where is_linkedin_signal and status <> 'past' and ${DATED_OR_MANUAL}) as linkedin,
       count(*) filter (where needs_review) as review
     from events`,
  );
  return Object.fromEntries(Object.entries(r ?? {}).map(([k, v]) => [k, Number(v)]));
}

export async function filterOptions() {
  const [cities, categories, sources] = await Promise.all([
    query<{ v: string }>(`select distinct city as v from events where city is not null order by 1`),
    query<{ v: string }>(`select distinct category as v from events where category is not null order by 1`),
    query<{ v: string }>(`select distinct s->>'name' as v from events, jsonb_array_elements(sources) s order by 1`),
  ]);
  return { cities: cities.map((r) => r.v), categories: categories.map((r) => r.v), sources: sources.map((r) => r.v) };
}

export async function listSources(): Promise<SourceRow[]> {
  return query<SourceRow>(
    `select id, name, url, source_type, scrape_method, city_tags, category_tags, active, config, notes,
            to_char(last_run_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI') as last_run_at, last_status
     from sources order by active desc, name`,
  );
}

/** Recompute time-dependent fields (past / closed / urgent) for every event. Call daily and before digests. */
export async function refreshDerived(today: string): Promise<void> {
  await query(
    `update events set
       deadline_urgent = registration_deadline is not null
         and registration_deadline >= $1::date and registration_deadline < $1::date + 7,
       status = case
         when event_date is not null and event_date < $1::date then 'past'
         when registration_deadline is not null and registration_deadline < $1::date then 'closed'
         when registration_deadline is not null then 'registration_open'
         else 'deadline_unknown' end`,
    [today],
  );
}

export interface DashboardMeta {
  sourcesCheckedToday: number;
  sourcesFailing: number;
  lastRunEpoch: number | null;
}

/** Freshness + source health for the dashboard header. Pipeline pseudo-sources are excluded. */
export async function dashboardMeta(today: string): Promise<DashboardMeta> {
  const [checked] = await query<{ n: string }>(
    `select count(distinct source_name) as n from scraper_runs
     where source_name not like 'Pipeline:%' and (started_at at time zone 'Asia/Kolkata')::date = $1::date`,
    [today],
  );
  const [failing] = await query<{ n: string }>(
    `select count(*) as n from (
       select distinct on (source_name) source_name, status from scraper_runs
       where source_name not like 'Pipeline:%' order by source_name, started_at desc
     ) t where status = 'failed'`,
  );
  const [last] = await query<{ e: string | null }>(`select extract(epoch from max(finished_at))::text as e from scraper_runs`);
  return {
    sourcesCheckedToday: Number(checked?.n ?? 0),
    sourcesFailing: Number(failing?.n ?? 0),
    lastRunEpoch: last?.e ? Number(last.e) * 1000 : null,
  };
}
