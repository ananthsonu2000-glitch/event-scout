import { query } from "./db";
import type { EventRow, Preferences, SourceRow } from "./types";

/** Dates are cast to text so every runtime sees plain YYYY-MM-DD strings. */
export const EVENT_COLS = `id, title, description,
  to_char(event_date, 'YYYY-MM-DD') as event_date, date_precision,
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
  includeLow?: boolean;
  /** exact priority filter, set by clicking a chart bar */
  priority?: string;
  /** relevance (default) | date | deadline | recent */
  sort?: string;
}

/**
 * What counts as clean data for Vikram: dated, not flagged for review. Manual entries are always shown
 * (he added them on purpose). Review items live under the "Needs review" view only.
 */
export const DATED_OR_MANUAL = `(source_type like 'manual%' or (event_date is not null and not needs_review))`;

const PRIORITY_ORDER =`case priority when 'High' then 1 when 'Medium' then 2 when 'Low' then 3 else 4 end`;

type Ignorable = "view" | "dates" | "city" | "priority" | "low";

/**
 * Builds the WHERE clause shared by the event list and the charts, so they always agree.
 * `ignore` drops filters a chart should not obey (e.g. the city ring ignores the city filter so you can switch city).
 */
function buildWhere(f: EventFilters, ignore: Ignorable[] = []): { where: string[]; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  const skip = (k: Ignorable) => ignore.includes(k);
  const view = skip("view") ? undefined : f.view;

  if (view === "high") where.push(`priority = 'High'`);
  if (view === "deadline") where.push(`deadline_urgent`);
  if (view === "linkedin") where.push(`is_linkedin_signal`);
  if (view === "review") where.push(`needs_review`);
  // Events with no date found are only listed under "Needs review" (manual entries are always shown).
  if (view !== "review") where.push(DATED_OR_MANUAL);
  if (!f.includePast && view !== "review") where.push(`status <> 'past'`);
  // Low-priority events (wrong city, generic, weak audience) stay out of the lists unless asked for.
  if (!f.includeLow && !skip("low") && view !== "review") where.push(`priority is distinct from 'Low'`);
  if (f.priority && !skip("priority")) where.push(`priority = ${p(f.priority)}`);
  if (f.city && !skip("city")) where.push(`city = ${p(f.city)}`);
  if (f.category) where.push(`category = ${p(f.category)}`);
  if (f.source) where.push(`sources @> ${p(JSON.stringify([{ name: f.source }]))}::jsonb`);
  if (f.from && !skip("dates")) where.push(`event_date >= ${p(f.from)}::date`);
  if (f.to && !skip("dates")) where.push(`event_date <= ${p(f.to)}::date`);
  if (f.q) {
    const like = p(`%${f.q}%`);
    where.push(`(title ilike ${like} or description ilike ${like} or organizer ilike ${like} or reason ilike ${like})`);
  }
  return { where, params };
}

export async function listEvents(f: EventFilters, limit = 200): Promise<EventRow[]> {
  const { where, params } = buildWhere(f);

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

// ---------------------------------------------------------------------------------------------------------------
// Chart data
// ---------------------------------------------------------------------------------------------------------------
export interface Bucket {
  label: string;
  from: string; // inclusive window used when the bar is clicked
  to: string;
  high: number;
  medium: number;
}

const dayMs = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addIso = (s: string, n: number) => iso(new Date(Date.parse(`${s}T00:00:00Z`) + n * dayMs));
const mondayOf = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return addIso(s, -((d.getUTCDay() + 6) % 7));
};
const shortDay = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Upcoming High and Medium events grouped into bars: one bar per day for 7D, per week (Monday start) for 30D and 90D.
 * Obeys city/category/source/search filters, not the view or date filters.
 */
export async function eventsByPeriod(f: EventFilters, range: 7 | 30 | 90, today: string): Promise<Bucket[]> {
  const { where, params } = buildWhere(f, ["view", "dates", "priority", "low"]);
  const end = addIso(today, range - 1);
  const daily = range === 7;
  params.push(today, end);
  const trunc = daily ? `to_char(event_date, 'YYYY-MM-DD')` : `to_char(date_trunc('week', event_date), 'YYYY-MM-DD')`;
  const rows = await query<{ b: string; priority: string; n: number }>(
    `select ${trunc} as b, priority, count(*)::int as n from events
     where ${[...where, `priority in ('High','Medium')`, `event_date between $${params.length - 1}::date and $${params.length}::date`].join(" and ")}
     group by 1, 2`,
    params,
  );
  const counts = new Map<string, { high: number; medium: number }>();
  for (const r of rows) {
    const c = counts.get(r.b) ?? { high: 0, medium: 0 };
    if (r.priority === "High") c.high = r.n;
    else c.medium = r.n;
    counts.set(r.b, c);
  }

  const buckets: Bucket[] = [];
  if (daily) {
    for (let i = 0; i < 7; i++) {
      const day = addIso(today, i);
      const c = counts.get(day) ?? { high: 0, medium: 0 };
      buckets.push({ label: shortDay(day), from: day, to: day, ...c });
    }
  } else {
    for (let start = mondayOf(today); start <= end; start = addIso(start, 7)) {
      const c = counts.get(start) ?? { high: 0, medium: 0 };
      buckets.push({ label: shortDay(start), from: start < today ? today : start, to: addIso(start, 6) > end ? end : addIso(start, 6), ...c });
    }
  }
  return buckets;
}

export interface CitySlice {
  city: string;
  n: number;
}

/** Upcoming events by city (top 4 plus "Other"). Ignores the city filter so another city can be picked. */
export async function eventsByCity(f: EventFilters): Promise<CitySlice[]> {
  const { where, params } = buildWhere(f, ["view", "city", "priority"]);
  const rows = await query<{ city: string; n: number }>(
    `select coalesce(city, 'Unknown') as city, count(*)::int as n from events ${where.length ? `where ${where.join(" and ")}` : ""} group by 1 order by 2 desc`,
    params,
  );
  const top = rows.slice(0, 4);
  const other = rows.slice(4).reduce((a, r) => a + r.n, 0);
  return other ? [...top, { city: "Other", n: other }] : top;
}

export interface KpiSeries {
  events: number[];
  high: number[];
  deadlines: number[];
  linkedin: number[];
}

/** 14-day lookahead for the KPI sparklines: how many upcoming events fall on each day (deadlines: close on each day). */
export async function kpiSeries(today: string): Promise<KpiSeries> {
  const rows = await query<{ day: string; events: number; high: number; linkedin: number; deadlines: number }>(
    `with v as (
       select event_date, registration_deadline, priority, is_linkedin_signal from events
       where ${DATED_OR_MANUAL} and status <> 'past' and priority is distinct from 'Low'
     )
     select to_char(d, 'YYYY-MM-DD') as day,
       (select count(*)::int from v where v.event_date = d::date) as events,
       (select count(*)::int from v where v.event_date = d::date and v.priority = 'High') as high,
       (select count(*)::int from v where v.event_date = d::date and v.is_linkedin_signal) as linkedin,
       (select count(*)::int from v where v.registration_deadline = d::date) as deadlines
     from generate_series($1::date, $1::date + 13, '1 day') d order by d`,
    [today],
  );
  return {
    events: rows.map((r) => r.events),
    high: rows.map((r) => r.high),
    deadlines: rows.map((r) => r.deadlines),
    linkedin: rows.map((r) => r.linkedin),
  };
}

export async function getEvent(id: number): Promise<EventRow | null> {
  const rows = await query<EventRow>(`select ${EVENT_COLS} from events where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function viewCounts(): Promise<Record<string, number>> {
  const [r] = await query<Record<string, string>>(
    `select
       count(*) filter (where status <> 'past' and priority is distinct from 'Low' and ${DATED_OR_MANUAL}) as "all",
       count(*) filter (where priority = 'High' and status <> 'past' and ${DATED_OR_MANUAL}) as high,
       count(*) filter (where deadline_urgent and status <> 'past' and priority is distinct from 'Low' and ${DATED_OR_MANUAL}) as deadline,
       count(*) filter (where is_linkedin_signal and status <> 'past' and priority is distinct from 'Low' and ${DATED_OR_MANUAL}) as linkedin,
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
         when event_date is not null and (
           (date_precision = 'exact' and event_date < $1::date)
           or (date_precision = 'month' and to_char(event_date, 'YYYY-MM') < to_char($1::date, 'YYYY-MM'))) then 'past'
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
