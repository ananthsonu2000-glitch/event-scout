import { addDays, daysBetween, fmtDate, todayIST } from "./dates";
import { query } from "./db";
import { sendEmail } from "./mailer";
import { EVENT_COLS, getPreferences, refreshDerived } from "./queries";
import type { EventRow } from "./types";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface Digest {
  subject: string;
  html: string;
  text: string;
  counts: { total: number; high: number; urgent: number; linkedin: number };
}

const priRank = (e: EventRow) => (e.priority === "High" ? 0 : e.priority === "Medium" ? 1 : 2);

/** High first, then urgent deadlines, then Medium; ties by score. */
export function sortForDigest(events: EventRow[]): EventRow[] {
  return [...events].sort(
    (a, b) =>
      priRank(a) - priRank(b) ||
      Number(b.deadline_urgent) - Number(a.deadline_urgent) ||
      (b.relevance_score ?? 0) - (a.relevance_score ?? 0),
  );
}

function deadlineLabel(e: EventRow, today: string): string {
  if (!e.registration_deadline) return "";
  const d = daysBetween(today, e.registration_deadline);
  const when = fmtDate(e.registration_deadline);
  if (e.deadline_urgent) return `⚠ Registration closes ${when} (${d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`})`;
  return `Deadline: ${when}`;
}

function card(e: EventRow, today: string): string {
  const meta = [fmtDate(e.event_date), e.city, e.organizer && `by ${e.organizer}`].filter(Boolean).map(esc).join(" · ");
  const sources = [...new Set(e.sources.map((s) => s.name))].map(esc).join(" + ");
  const dl = deadlineLabel(e, today);
  const badgeColor = e.priority === "High" ? "#b91c1c" : e.priority === "Medium" ? "#b45309" : "#475569";
  return `
  <tr><td style="padding:14px 0;border-bottom:1px solid #e5e7eb">
    <div style="font-size:12px;font-weight:700;color:${badgeColor};letter-spacing:.04em">${esc((e.priority ?? "Unranked").toUpperCase())}${e.relevance_score != null ? ` · ${e.relevance_score}/100` : ""}${e.is_linkedin_signal ? " · LINKEDIN SIGNAL" : ""}</div>
    <div style="font-size:16px;font-weight:700;margin:3px 0"><a href="${esc(e.source_url ?? "#")}" style="color:#0f1c3f;text-decoration:none">${esc(e.title)}</a></div>
    <div style="font-size:13px;color:#475569">${meta}</div>
    <div style="font-size:13px;color:#475569">Source: ${sources}</div>
    ${dl ? `<div style="font-size:13px;font-weight:600;color:${e.deadline_urgent ? "#b91c1c" : "#475569"}">${esc(dl)}</div>` : ""}
    ${e.reason ? `<div style="font-size:14px;margin-top:6px"><b>Why it matters:</b> ${esc(e.reason)}</div>` : ""}
    ${e.recommended_action ? `<div style="font-size:14px"><b>Action:</b> ${esc(e.recommended_action)}</div>` : ""}
    ${e.source_url ? `<div style="margin-top:6px"><a href="${esc(e.source_url)}" style="font-size:13px;color:#1d4ed8">View / register →</a></div>` : ""}
  </td></tr>`;
}

function section(title: string, events: EventRow[], today: string, empty: string): string {
  return `
  <h2 style="font-size:17px;color:#0f1c3f;margin:28px 0 4px">${esc(title)}</h2>
  <table width="100%" cellpadding="0" cellspacing="0">${events.length ? events.map((e) => card(e, today)).join("") : `<tr><td style="padding:10px 0;color:#64748b;font-size:14px">${esc(empty)}</td></tr>`}</table>`;
}

export function buildDigest(events: EventRow[], dashboardUrl: string, today = todayIST()): Digest {
  const sorted = sortForDigest(events.filter((e) => e.priority !== "Low"));
  const high = sorted.filter((e) => e.priority === "High");
  const top3 = high.slice(0, 3);
  const urgent = sorted
    .filter((e) => e.deadline_urgent)
    .sort((a, b) => (a.registration_deadline ?? "").localeCompare(b.registration_deadline ?? ""));
  const linkedin = sorted.filter((e) => e.is_linkedin_signal);
  const medium = sorted.filter((e) => e.priority === "Medium").slice(0, 10);

  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 10px">
  <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border-radius:10px;padding:24px 28px">
  <tr><td>
    <div style="font-size:22px;font-weight:800;color:#0f1c3f">Vikram's Event Scout</div>
    <div style="color:#64748b;font-size:14px;margin-top:2px">Top opportunities for ${esc(fmtDate(today))} – ${esc(fmtDate(addDays(today, 30), true))}</div>
    <p style="font-size:15px;margin:16px 0 0">Good morning Vikram, here are the highest-value events discovered for the next 30 days.</p>
    ${section("Top 3 High-Priority Events", top3, today, "No high-priority events found for the next 30 days.")}
    ${section("Urgent Deadlines This Week", urgent, today, "No registration deadlines in the next 7 days.")}
    ${section("LinkedIn-Sourced Opportunities", linkedin, today, "No LinkedIn-sourced opportunities this week.")}
    ${section("Medium-Priority Events", medium, today, "No medium-priority events.")}
    <div style="margin:30px 0 6px;text-align:center"><a href="${esc(dashboardUrl)}" style="background:#0f1c3f;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Open Event Scout Dashboard</a></div>
  </td></tr></table></td></tr></table></body></html>`;

  const line = (e: EventRow) =>
    `- [${e.priority ?? "?"}] ${e.title} | ${fmtDate(e.event_date)} | ${e.city ?? "?"}${e.registration_deadline ? ` | deadline ${fmtDate(e.registration_deadline)}` : ""}${e.source_url ? `\n  ${e.source_url}` : ""}`;
  const text = [
    "Vikram's Event Scout: top opportunities for the next 30 days",
    "",
    "TOP 3 HIGH-PRIORITY EVENTS",
    ...top3.map(line),
    "",
    "URGENT DEADLINES THIS WEEK",
    ...urgent.map(line),
    "",
    "LINKEDIN-SOURCED OPPORTUNITIES",
    ...linkedin.map(line),
    "",
    "MEDIUM-PRIORITY EVENTS",
    ...medium.map(line),
    "",
    `Dashboard: ${dashboardUrl}`,
  ].join("\n");

  return {
    subject: "Vikram's Event Scout: Top opportunities for the next 30 days",
    html,
    text,
    counts: { total: sorted.length, high: high.length, urgent: urgent.length, linkedin: linkedin.length },
  };
}

export async function fetchDigestEvents(today = todayIST()): Promise<EventRow[]> {
  return query<EventRow>(
    `select ${EVENT_COLS} from events
     where event_date between $1::date and $2::date and date_precision = 'exact' and not needs_review
       and status <> 'past' and status <> 'closed'`,
    [today, addDays(today, 30)],
  );
}

export interface DigestResult {
  status: "sent" | "failed" | "skipped" | "dry_run";
  runId?: number;
  detail?: string;
  html?: string;
}

/** Build and send the digest, logging the attempt in digest_runs. Failures are logged, not thrown. */
export async function runDigest(opts: { force?: boolean; dryRun?: boolean } = {}): Promise<DigestResult> {
  const prefs = await getPreferences();
  const to = process.env.VIKRAM_EMAIL;
  const today = todayIST();
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!opts.force && !opts.dryRun) {
    if (!prefs.digest_enabled) {
      await query(`insert into digest_runs (status, recipient, finished_at, error) values ('skipped', $1, now(), 'Digest disabled in preferences')`, [to ?? null]);
      return { status: "skipped", detail: "Digest disabled in preferences" };
    }
    // Only guards against two schedulers firing together (e.g. GitHub Actions and Vercel Cron). A short window means a
    // test digest the day before never blocks the real Monday one.
    const [recent] = await query<{ n: string }>(`select count(*) as n from digest_runs where status = 'sent' and started_at > now() - interval '12 hours'`);
    if (Number(recent.n) > 0) {
      const detail = "A digest was already sent in the last 12 hours (use force to override)";
      await query(`insert into digest_runs (status, recipient, finished_at, error) values ('skipped', $1, now(), $2)`, [to ?? null, detail]);
      return { status: "skipped", detail };
    }
  }

  await refreshDerived(today);
  const digest = buildDigest(await fetchDigestEvents(today), dashboardUrl, today);
  if (opts.dryRun) return { status: "dry_run", html: digest.html, detail: JSON.stringify(digest.counts) };

  const [run] = await query<{ id: number }>(
    `insert into digest_runs (status, recipient, subject, event_count, high_count, urgent_count, linkedin_count, html)
     values ('running', $1, $2, $3, $4, $5, $6, $7) returning id`,
    [to ?? null, digest.subject, digest.counts.total, digest.counts.high, digest.counts.urgent, digest.counts.linkedin, digest.html],
  );

  try {
    if (!to) throw new Error("VIKRAM_EMAIL is not set");
    const provider = await sendEmail({ to, subject: digest.subject, html: digest.html, text: digest.text });
    await query(`update digest_runs set status = 'sent', provider = $1, finished_at = now() where id = $2`, [provider, run.id]);
    return { status: "sent", runId: run.id };
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err).slice(0, 500);
    await query(`update digest_runs set status = 'failed', error = $1, finished_at = now() where id = $2`, [msg, run.id]);
    return { status: "failed", runId: run.id, detail: msg };
  }
}
