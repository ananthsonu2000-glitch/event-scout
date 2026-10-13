import { deriveStatus, todayIST } from "../dates";
import { query } from "../db";
import { EVENT_COLS, getPreferences } from "../queries";
import { isLinkedInType, type EventRow, type RawEventRow } from "../types";
import { findDuplicate, mergeEvent, type EventPatch } from "./dedupe";
import { normalizeRaw, type NormalizedEvent } from "./normalize";
import { rankBatch } from "./ranking";

const errMsg = (e: unknown) => String(e instanceof Error ? e.message : e).slice(0, 500);

export async function logRun(name: string, method: string, started: number, status: string, found: number, created: number, error?: string) {
  await query(
    `insert into scraper_runs (source_name, scrape_method, started_at, finished_at, duration_ms, status, items_found, items_new, error)
     values ($1, $2, to_timestamp($3 / 1000.0), now(), $4, $5, $6, $7, $8)`,
    [name, method, started, Date.now() - started, status, found, created, error ?? null],
  );
}

async function insertEvent(n: NormalizedEvent, rawId: number, today: string): Promise<EventRow> {
  const { status, deadline_urgent } = deriveStatus(n.event_date, n.registration_deadline, today);
  const linkedin = isLinkedInType(n.source_type);
  const sources = [{ name: n.source, type: n.source_type, url: n.source_url }];
  const [row] = await query<EventRow>(
    `insert into events (title, description, event_date, registration_deadline, city, venue, organizer, source, source_type,
        source_url, sources, category, audience, price, status, deadline_urgent, is_linkedin_signal, needs_review,
        review_reason, needs_rank, raw_event_ids)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18,$19,true,$20)
     returning ${EVENT_COLS}`,
    [
      n.title, n.description, n.event_date, n.registration_deadline, n.city, n.venue, n.organizer, n.source,
      n.source_type, n.source_url, JSON.stringify(sources), n.category, n.audience, n.price, status,
      deadline_urgent, linkedin, !n.event_date, n.event_date ? null : "Missing event date", [rawId],
    ],
  );
  return row;
}

const PATCH_COLUMNS = new Set([
  "description", "event_date", "registration_deadline", "city", "venue", "organizer", "category", "audience", "price",
  "source", "source_type", "source_url", "sources", "is_linkedin_signal",
]);

async function applyPatch(id: number, patch: EventPatch, rawId: number, today: string) {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (!PATCH_COLUMNS.has(k)) continue;
    params.push(k === "sources" ? JSON.stringify(v) : v);
    sets.push(`${k} = $${params.length}${k === "sources" ? "::jsonb" : ""}`);
  }
  params.push(rawId, id);
  await query(
    `update events set ${sets.join(", ")}${sets.length ? "," : ""} needs_rank = ${sets.length ? "true" : "needs_rank"},
       raw_event_ids = array_append(raw_event_ids, $${params.length - 1}), updated_at = now() where id = $${params.length}`,
    params,
  );
  if (patch.event_date || patch.registration_deadline) {
    const [e] = await query<{ event_date: string | null; registration_deadline: string | null }>(
      `select to_char(event_date,'YYYY-MM-DD') as event_date, to_char(registration_deadline,'YYYY-MM-DD') as registration_deadline from events where id = $1`,
      [id],
    );
    const d = deriveStatus(e.event_date, e.registration_deadline, today);
    await query(
      `update events set status = $1, deadline_urgent = $2,
         needs_review = case when $3::date is null then true else needs_review end,
         review_reason = case when $3::date is null then 'Missing event date' else review_reason end
       where id = $4`,
      [d.status, d.deadline_urgent, e.event_date, id],
    );
  }
}

export interface ProcessResult {
  processed: number;
  created: number;
  merged: number;
  rejected: number;
  failed: number;
  firstError?: string;
}

/** Normalize pending raw_events, deduplicate against existing events, and save to events. */
export async function processPending(limit = 60): Promise<ProcessResult> {
  const res: ProcessResult = { processed: 0, created: 0, merged: 0, rejected: 0, failed: 0 };
  const prefs = await getPreferences();
  const today = todayIST();
  const pending = await query<RawEventRow>(
    `select id, source_id, source_name, source_type, raw_title, raw_snippet, raw_url, raw_date, raw_payload
     from raw_events where processing_status = 'pending' order by id limit $1`,
    [limit],
  );
  if (!pending.length) return res;

  const existing = await query<EventRow>(
    `select ${EVENT_COLS} from events where event_date is null or event_date >= current_date - 7`,
  );
  const mark = (id: number, status: string, note: string | null, eventId: number | null) =>
    query(`update raw_events set processing_status = $1, processing_note = $2, event_id = $3 where id = $4`, [status, note, eventId, id]);

  for (const raw of pending) {
    try {
      const result = await normalizeRaw(raw, prefs, today);
      if ("rejected" in result) {
        await mark(raw.id, "rejected", result.rejected, null);
        res.rejected++;
        continue;
      }
      const n = result.event;
      const idx = findDuplicate(
        { title: n.title, event_date: n.event_date, city: n.city, organizer: n.organizer, source_url: n.source_url, sources: [] },
        existing,
      );
      if (idx >= 0) {
        const target = existing[idx];
        const patch = mergeEvent(target, n);
        await applyPatch(target.id, patch, raw.id, today);
        Object.assign(target, patch);
        await mark(raw.id, "processed", "Merged into existing event", target.id);
        res.merged++;
      } else {
        const created = await insertEvent(n, raw.id, today);
        existing.push(created);
        await mark(raw.id, "processed", null, created.id);
        res.created++;
      }
      res.processed++;
    } catch (err) {
      res.failed++;
      res.firstError ??= errMsg(err);
      // Leave transient failures (e.g. Gemini quota) pending so the next run retries them.
      await query(`update raw_events set processing_note = $1 where id = $2`, [errMsg(err), raw.id]);
    }
  }
  return res;
}

export interface RankResult {
  ranked: number;
  failedBatches: number;
  firstError?: string;
}

/** Rank unranked/changed events with Gemini Flash and apply deterministic urgency/review rules. */
export async function rankPending(limit = 50, batchSize = 5): Promise<RankResult> {
  const res: RankResult = { ranked: 0, failedBatches: 0 };
  const prefs = await getPreferences();
  const today = todayIST();
  const events = await query<EventRow>(
    // Undated events aren't ranked (a score without a date is meaningless). They are ranked once a date appears.
    `select ${EVENT_COLS} from events where needs_rank and status <> 'past' and (event_date is not null or source_type like 'manual%') order by id limit $1`,
    [limit],
  );

  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    try {
      const rankings = await rankBatch(batch, prefs, today);
      for (const r of rankings) {
        const ev = batch.find((e) => e.id === r.id)!;
        const { deadline_urgent } = deriveStatus(ev.event_date, ev.registration_deadline, today);
        const reasons: string[] = [];
        if (!ev.event_date) reasons.push("Missing event date");
        if (r.confidence < 0.5) reasons.push("Low AI confidence");
        await query(
          `update events set priority = $1, relevance_score = $2, category = coalesce(nullif($3, ''), category),
             audience_fit = $4, urgency = $5, reason = $6, recommended_action = $7, confidence = $8,
             deadline_urgent = $9, needs_review = $10, review_reason = $11, needs_rank = false,
             ranked_at = now(), updated_at = now() where id = $12`,
          [
            r.priority, r.relevance_score, r.category, r.audience_fit, r.urgency, r.reason, r.recommended_action,
            r.confidence, deadline_urgent, reasons.length > 0, reasons.join("; ") || null, r.id,
          ],
        );
        res.ranked++;
      }
    } catch (err) {
      res.failedBatches++;
      res.firstError ??= errMsg(err);
    }
  }
  return res;
}
