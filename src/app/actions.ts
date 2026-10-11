"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { submitManualEvent } from "@/lib/pipeline/ingest";

const list = (v: FormDataEntryValue | null): string[] =>
  String(v ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

export async function savePreferences(form: FormData) {
  await query(
    `insert into vikram_preferences (id, target_cities, focus_domains, audience_types, excluded_topics, priority_rules,
        digest_day, digest_time, digest_enabled, updated_at)
     values (1, $1, $2, $3, $4, $5, $6, $7, $8, now())
     on conflict (id) do update set target_cities = excluded.target_cities, focus_domains = excluded.focus_domains,
        audience_types = excluded.audience_types, excluded_topics = excluded.excluded_topics,
        priority_rules = excluded.priority_rules, digest_day = excluded.digest_day, digest_time = excluded.digest_time,
        digest_enabled = excluded.digest_enabled, updated_at = now()`,
    [
      list(form.get("target_cities")), list(form.get("focus_domains")), list(form.get("audience_types")),
      list(form.get("excluded_topics")), str(form.get("priority_rules")), str(form.get("digest_day")) || "Monday",
      str(form.get("digest_time")) || "07:00", form.get("digest_enabled") === "on",
    ],
  );
  revalidatePath("/preferences");
  redirect("/preferences?saved=1");
}

export async function addSource(form: FormData) {
  let config: unknown = {};
  const rawConfig = str(form.get("config"));
  if (rawConfig) {
    try {
      config = JSON.parse(rawConfig);
    } catch {
      redirect("/sources?error=Config+must+be+valid+JSON");
    }
  }
  await query(
    `insert into sources (name, url, source_type, scrape_method, city_tags, category_tags, active, config)
     values ($1, $2, $3, $4, $5, $6, true, $7::jsonb) on conflict (name) do nothing`,
    [
      str(form.get("name")), str(form.get("url")) || null, str(form.get("source_type")) || "event_platform",
      str(form.get("scrape_method")) || "static", list(form.get("city_tags")), list(form.get("category_tags")), JSON.stringify(config),
    ],
  );
  revalidatePath("/sources");
  redirect("/sources");
}

export async function toggleSource(form: FormData) {
  await query(`update sources set active = not active where id = $1`, [Number(form.get("id"))]);
  revalidatePath("/sources");
}

export async function deleteSource(form: FormData) {
  await query(`delete from sources where id = $1`, [Number(form.get("id"))]);
  revalidatePath("/sources");
}

export async function submitManual(form: FormData) {
  let result;
  try {
    result = await submitManualEvent({ url: str(form.get("url")), text: str(form.get("text")), note: str(form.get("note")) });
  } catch (err) {
    redirect(`/add?error=${encodeURIComponent(err instanceof Error ? err.message : "Submission failed")}`);
  }
  revalidatePath("/");
  if (result.error) redirect(`/add?error=${encodeURIComponent(`Saved, but processing failed (it will retry on the next daily run): ${result.error}`)}`);
  redirect(result.eventId ? `/?event=${result.eventId}` : "/add?notevent=1");
}
