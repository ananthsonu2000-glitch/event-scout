/** Offline checks for the pure logic (no DB / network). Run: npm run selftest */
import assert from "node:assert/strict";
import { buildDigest, sortForDigest } from "../src/lib/digest";
import { deriveStatus } from "../src/lib/dates";
import { canonicalUrl, isDuplicate } from "../src/lib/pipeline/dedupe";
import { normalizeCity } from "../src/lib/pipeline/normalize";
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
    id: 1, title: "E", description: null, event_date: "2026-10-20", registration_deadline: null, city: "Bengaluru", venue: null, organizer: null,
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

console.log("All selftests passed");
