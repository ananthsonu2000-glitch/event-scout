/** Offline checks for the pure logic (no DB / network). Run: npm run selftest */
import assert from "node:assert/strict";
import { buildDigest, sortForDigest } from "../src/lib/digest";
import { deriveStatus, isPastDate, toIsoDate } from "../src/lib/dates";
import { canonicalUrl, isDuplicate } from "../src/lib/pipeline/dedupe";
import { inferCity, normalizeCity, prefilterReason, qualityGate, type NormalizedEvent } from "../src/lib/pipeline/normalize";
import { parseAlertEmail } from "../src/scrapers/googleAlerts";
import { isLinkedInUrl } from "../src/scrapers/lib/page";
import { SCRAPERS } from "../src/scrapers";
import { SCRAPE_METHODS } from "../src/scrapers/methods";
import type { EventRow } from "../src/lib/types";

const t = (name: string, fn: () => void) => {
  fn();
  console.log("ok  ", name);
};

t("scrape method list matches registry", () => assert.deepEqual([...SCRAPE_METHODS].sort(), Object.keys(SCRAPERS).sort()));

t("deadline urgency: <7 days urgent, missing deadline never urgent", () => {
  assert.equal(deriveStatus("2026-10-30", "2026-10-15", "2026-10-11").deadline_urgent, true);
  assert.equal(deriveStatus("2026-10-30", "2026-10-18", "2026-10-11").deadline_urgent, false); // exactly 7 days
  assert.equal(deriveStatus("2026-10-30", null, "2026-10-11").deadline_urgent, false);
  assert.equal(deriveStatus("2026-10-30", "2026-10-09", "2026-10-11").status, "closed");
  assert.equal(deriveStatus("2026-10-01", null, "2026-10-11").status, "past");
});

t("google alert parsing unwraps redirects and skips noise", () => {
  const html = `<table><tr><td><a href="https://www.google.com/url?rct=j&sa=t&url=https%3A%2F%2Fwww.linkedin.com%2Fposts%2Fabc&ct=ga">CIO roundtable in Bengaluru</a>
    <div>Join us for a CIO roundtable on Oct 24. Register at https://lu.ma/cio-rt</div></td></tr>
    <tr><td><a href="https://www.google.com/alerts/remove?x=1">Unsubscribe</a></td></tr></table>`;
  const links = parseAlertEmail(html);
  assert.equal(links.length, 1);
  assert.equal(links[0].url, "https://www.linkedin.com/posts/abc");
  assert.match(links[0].snippet, /lu\.ma\/cio-rt/);
  assert.ok(isLinkedInUrl(links[0].url));
});

t("dedupe merges the same event across sources", () => {
  const a = { title: "CIO Roundtable: Enterprise AI Adoption", event_date: "2026-10-24", city: "Bengaluru", organizer: "ET CIO", source_url: "https://lu.ma/x?utm_source=li", sources: [] };
  const b = { title: "Enterprise AI Adoption - CIO Roundtable", event_date: "2026-10-24", city: "Bengaluru", organizer: null, source_url: "https://other.com/y", sources: [] };
  const c = { title: "CIO Roundtable: Enterprise AI Adoption", event_date: "2026-11-20", city: "Bengaluru", organizer: "ET CIO", source_url: "https://z.com", sources: [] };
  assert.equal(isDuplicate(a, b), true);
  assert.equal(isDuplicate(a, c), false);
  assert.equal(canonicalUrl("https://www.lu.ma/x/?utm_source=li"), "lu.ma/x");
});

t("city normalization", () => {
  assert.equal(normalizeCity("Bangalore"), "Bengaluru");
  assert.equal(normalizeCity("Gurugram"), "Delhi NCR");
});

t("digest ordering and sections", () => {
  const mk = (o: Partial<EventRow>): EventRow => ({
    id: 1, title: "E", description: null, event_date: "2026-10-20", date_precision: "exact", registration_deadline: null, city: "Bengaluru", venue: null, organizer: null,
    source: "S", source_type: "x", source_url: "https://e.com", sources: [{ name: "S", type: "x" }], category: null, audience: null, price: null,
    status: "deadline_unknown", deadline_urgent: false, priority: "Medium", relevance_score: 50, audience_fit: null, urgency: null, reason: "r <b>",
    recommended_action: null, confidence: 0.9, needs_review: false, review_reason: null, is_linkedin_signal: false, needs_rank: false, ...o,
  });
  const events = [
    mk({ id: 1, priority: "Medium", relevance_score: 70 }),
    mk({ id: 2, priority: "High", relevance_score: 80 }),
    mk({ id: 3, priority: "High", relevance_score: 70, deadline_urgent: true, registration_deadline: "2026-10-14" }),
    mk({ id: 4, priority: "Low" }),
    mk({ id: 5, priority: "Medium", is_linkedin_signal: true }),
  ];
  assert.deepEqual(sortForDigest(events).map((e) => e.id), [3, 2, 1, 5, 4]);
  const d = buildDigest(events, "https://app", "2026-10-11");
  assert.deepEqual(d.counts, { total: 4, high: 2, urgent: 1, linkedin: 1 });
  assert.ok(d.html.includes("Top 3 High-Priority Events") && d.html.includes("LinkedIn-Sourced Opportunities") && d.html.includes("Open Event Scout Dashboard"));
  assert.ok(!d.html.includes("<b>r")); // reason text is escaped
});

t("UTC timestamps convert to the IST day", () => {
  assert.equal(toIsoDate("2026-10-17T20:00:00.000Z"), "2026-10-18");
  assert.equal(toIsoDate("2026-10-17T12:30:00.000Z"), "2026-10-17");
  assert.equal(toIsoDate("2026-10-23T15:00:00+05:30"), "2026-10-23");
  assert.equal(toIsoDate("2026-11-12"), "2026-11-12");
});

t("tentative month is only past once the month has ended", () => {
  assert.equal(isPastDate("2026-10-01", "2026-10-13", "month"), false);
  assert.equal(isPastDate("2026-09-01", "2026-10-13", "month"), true);
  assert.equal(isPastDate("2026-10-01", "2026-10-13", "exact"), true);
  assert.equal(deriveStatus("2026-10-01", null, "2026-10-13", "month").status, "deadline_unknown");
});

const ev = (o: Partial<NormalizedEvent>): NormalizedEvent => ({
  title: "CIO Roundtable", description: null, event_date: "2026-11-20", date_precision: "exact", registration_deadline: null, city: "Bengaluru",
  venue: null, organizer: null, category: null, audience: null, price: null, source: "S", source_type: "x", source_url: null, ...o,
});

t("quality gate: needs a date or tentative month, a location, and not past", () => {
  assert.equal(qualityGate(ev({}), "2026-10-13", false), null);
  assert.equal(qualityGate(ev({ event_date: null }), "2026-10-13", false), "No date or timeline");
  assert.equal(qualityGate(ev({ event_date: "2026-12-01", date_precision: "month" }), "2026-10-13", false), null);
  assert.match(qualityGate(ev({ event_date: "2025-09-12" }), "2026-10-13", false) ?? "", /^Past event/);
  assert.equal(qualityGate(ev({ city: null, venue: null }), "2026-10-13", false), "No location");
  assert.equal(qualityGate(ev({ event_date: null, city: null }), "2026-10-13", true), null); // manual is exempt
});

t("prefilter drops consumer events and keeps business ones", () => {
  assert.ok(prefilterReason("Stand-up comedy night", null, null));
  assert.ok(prefilterReason("Yoga and meditation retreat", "relax", null));
  assert.ok(prefilterReason("Atomy Chairman Talk show", "Koramangala Indoor Stadium", "Atomy Enterprise India Pvt Ltd") === null); // 'enterprise' in organizer, judged later by ranking
  assert.equal(prefilterReason("Founders & Investors Xplore", null, null), null);
  assert.equal(prefilterReason("Bengaluru AI Leaders Roundtable", null, null), null);
  assert.ok(prefilterReason("Diwali Mela 2026", "shopping and food", null));
});

t("city cleanup: states and non-Latin names", () => {
  assert.equal(normalizeCity("Karnataka"), null);
  assert.equal(normalizeCity("मुंबई"), "Mumbai");
  assert.equal(normalizeCity("Hyderabad"), "Hyderabad");
});

t("prefilter rejects online-only events", () => {
  assert.equal(prefilterReason("Primewise Founders Club Networking Event- Bangalore (Online)", null, null), "Online-only event");
  assert.equal(prefilterReason("Online networking for founders", null, null), "Online-only event");
  assert.equal(prefilterReason("Founders networking dinner", null, null), null);
});

t("city inference from venue text", () => {
  assert.equal(inferCity("Taj MG Road, Bengaluru"), "Bengaluru");
  assert.equal(inferCity("Radisson Blu, Gurugram"), "Delhi NCR");
  assert.equal(inferCity("Somewhere unknown"), null);
});

t("dedupe: tentative month matches an exact date in the same month", () => {
  const a = { title: "Global CIO Summit", event_date: "2026-12-01", date_precision: "month" as const, city: "Bengaluru", organizer: null, source_url: "https://a.com", sources: [] };
  const b = { title: "Global CIO Summit", event_date: "2026-12-09", date_precision: "exact" as const, city: "Bengaluru", organizer: null, source_url: "https://b.com", sources: [] };
  const c = { ...b, event_date: "2027-01-09" };
  assert.equal(isDuplicate(a, b), true);
  assert.equal(isDuplicate(a, c), false);
});

console.log("All selftests passed");
