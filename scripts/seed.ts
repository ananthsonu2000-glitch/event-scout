import "./load-env";
import { query } from "../src/lib/db";
import { addDays, deriveStatus, todayIST } from "../src/lib/dates";
import { RETIRED, SOURCES } from "./sources-data";

const PREFS = {
  target_cities: ["Bengaluru", "Mumbai", "Delhi NCR"],
  focus_domains: ["CIO roundtables", "AI adoption", "SaaS", "startup ecosystem", "enterprise tech"],
  audience_types: ["CXOs", "founders", "investors", "tech leaders", "operators"],
  excluded_topics: ["student events", "generic webinars", "job fairs"],
  priority_rules: "High priority if CXO/founder audience + target city + registration open.",
};

const GOOGLE_ALERT_QUERIES = [
  '"CIO roundtable" Bengaluru', '"CXO summit" Bengaluru', '"founder meetup" Bengaluru', '"startup networking" Bengaluru',
  '"AI leaders roundtable" Mumbai', '"enterprise AI summit" India', 'site:linkedin.com/posts "CIO roundtable" Bengaluru',
  'site:linkedin.com/posts "startup meetup" Bengaluru', "site:linkedin.com/events Bengaluru startup", 'site:linkedin.com/posts "CXO" "Bengaluru"',
];

async function main() {
  const withSamples = !process.argv.includes("--no-samples");

  // Upsert by name: re-running the seed refreshes URL, method, config and the on/off flag from sources-data.ts.
  for (const s of SOURCES) {
    await query(
      `insert into sources (name, url, source_type, scrape_method, city_tags, category_tags, active, config, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
       on conflict (name) do update set url = excluded.url, source_type = excluded.source_type, scrape_method = excluded.scrape_method,
         city_tags = excluded.city_tags, category_tags = excluded.category_tags, active = excluded.active, config = excluded.config, notes = excluded.notes`,
      [s.name, s.url, s.type, s.method, s.cities, s.cats, s.active, JSON.stringify(s.config), s.notes],
    );
  }
  await query(`delete from sources where name = any($1)`, [RETIRED]);
  await query(
    `insert into vikram_preferences (id, target_cities, focus_domains, audience_types, excluded_topics, priority_rules)
     values (1, $1, $2, $3, $4, $5) on conflict (id) do nothing`,
    [PREFS.target_cities, PREFS.focus_domains, PREFS.audience_types, PREFS.excluded_topics, PREFS.priority_rules],
  );
  console.log(`Seeded ${SOURCES.length} sources and preferences.`);
  console.log("Create these Google Alerts (deliver to the Gmail inbox the app reads):\n  " + GOOGLE_ALERT_QUERIES.join("\n  "));

  if (!withSamples) return;
  const [{ n }] = await query<{ n: string }>(`select count(*) as n from events`);
  if (Number(n) > 0) {
    console.log("Events table not empty, skipping sample events.");
    return;
  }

  const today = todayIST();
  const d = (n: number) => addDays(today, n);
  const L = (name: string, type: string, url: string) => ({ name, type, url });
  const samples = [
    { title: "CIO Roundtable: Enterprise AI Adoption", description: "Closed-door roundtable for CIOs and enterprise technology leaders on moving AI pilots into production.", date: d(13), deadline: d(5), city: "Bengaluru", venue: "Taj MG Road", organizer: "ET CIO", cat: "CXO / Enterprise AI", aud: "CIOs, CTOs, tech leaders", price: "Free (invite)", priority: "High", score: 93, fit: "Strong", reason: "Strong fit: the audience is CIOs and enterprise technology leaders in Bengaluru, exactly the decision-makers for consulting engagements.", action: "Register this week: closes in 5 days.", sources: [L("LinkedIn signal", "google_alert_linkedin", "https://www.linkedin.com/posts/sample-cio-roundtable"), L("Eventbrite", "event_platform", "https://www.eventbrite.com/e/sample-cio-roundtable")], url: "https://www.eventbrite.com/e/sample-cio-roundtable", li: true },
    { title: "SaaS Founders Breakfast", description: "Small-group breakfast for B2B SaaS founders and operators discussing go-to-market and scale.", date: d(17), deadline: null, city: "Bengaluru", venue: "Indiranagar", organizer: "SaaSBoomi", cat: "SaaS / Startup", aud: "Founders, operators", price: "Free", priority: "High", score: 86, fit: "Strong", reason: "Founder/operator audience in a target city with strong business development potential.", action: "Register: no deadline listed, limited seats.", sources: [L("Luma Bengaluru", "event_platform", "https://lu.ma/sample-saas-breakfast")], url: "https://lu.ma/sample-saas-breakfast", li: false },
    { title: "CXO Summit Mumbai 2026", description: "Annual summit for CXOs across BFSI and manufacturing on digital transformation.", date: d(24), deadline: d(6), city: "Mumbai", venue: "JW Marriott Juhu", organizer: "CXOToday", cat: "CXO", aud: "CXOs, senior leaders", price: "Paid", priority: "High", score: 81, fit: "Strong", reason: "Senior CXO audience in a target city, with a registration deadline inside the week.", action: "Decide this week: deadline in 6 days.", sources: [L("Google Alerts", "google_alert", "https://example.com/cxo-summit-mumbai")], url: "https://example.com/cxo-summit-mumbai", li: false },
    { title: "Bengaluru Startup Meetup: AI Agents in Production", description: "Evening meetup for founders and engineers building with AI agents.", date: d(9), deadline: null, city: "Bengaluru", venue: "WeWork Embassy", organizer: "Bengaluru AI Community", cat: "Startup / AI", aud: "Founders, engineers", price: "Free", priority: "Medium", score: 62, fit: "Moderate", reason: "Relevant topic and city, but the audience skews technical rather than buyer-level.", action: "Attend if free that evening.", sources: [L("Meetup", "event_platform", "https://www.meetup.com/sample-ai-agents")], url: "https://www.meetup.com/sample-ai-agents", li: false },
    { title: "Enterprise Transformation Roundtable (shared by organizer)", description: "Organizer post on LinkedIn about an enterprise transformation roundtable. Details on the registration page.", date: d(20), deadline: null, city: "Bengaluru", venue: null, organizer: "Transform Forum", cat: "Enterprise", aud: "Enterprise leaders", price: null, priority: "Medium", score: 68, fit: "Moderate", reason: "Promising enterprise audience, but few details are public yet.", action: "Check the registration page for the guest list.", sources: [L("LinkedIn signal", "google_alert_linkedin", "https://www.linkedin.com/posts/sample-transformation-roundtable")], url: "https://www.linkedin.com/posts/sample-transformation-roundtable", li: true },
    { title: "Campus Placement Webinar Series", description: "Webinar for final-year students on placement preparation.", date: d(6), deadline: null, city: "Online", venue: "Online", organizer: "EduPrep", cat: "Education", aud: "Students", price: "Free", priority: "Low", score: 8, fit: "Weak", reason: "Student-focused webinar with no networking value for Vikram.", action: "Skip.", sources: [L("YourStory", "media", "https://example.com/campus-webinar")], url: "https://example.com/campus-webinar", li: false },
    { title: "Founders and Investors Mixer (date TBC)", description: "Mixer announced via a forwarded email, date not yet confirmed.", date: null, deadline: null, city: "Bengaluru", venue: null, organizer: "TiE Bangalore", cat: "Startup / Investor", aud: "Founders, investors", price: null, priority: "Medium", score: 55, fit: "Moderate", reason: "Good audience but the date is missing, so it needs a manual check.", action: "Confirm the date with the organizer.", sources: [L("Gmail forward", "email_forward", "https://example.com/mixer")], url: "https://example.com/mixer", li: false, review: "Missing event date" },
  ];

  for (const e of samples) {
    const { status, deadline_urgent } = deriveStatus(e.date, e.deadline, today);
    await query(
      `insert into events (title, description, event_date, registration_deadline, city, venue, organizer, source, source_type, source_url,
         sources, category, audience, price, status, deadline_urgent, priority, relevance_score, audience_fit, urgency, reason,
         recommended_action, confidence, needs_review, review_reason, is_linkedin_signal, needs_rank, ranked_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,false,now())`,
      [
        e.title, e.description, e.date, e.deadline, e.city, e.venue, e.organizer, e.sources[e.sources.length - 1].name,
        e.sources[e.sources.length - 1].type, e.url, JSON.stringify(e.sources), e.cat, e.aud, e.price, status, deadline_urgent,
        e.priority, e.score, e.fit, deadline_urgent ? `Deadline soon (${e.deadline})` : e.date ? `Event on ${e.date}` : "Date unknown",
        e.reason, e.action, e.review ? 0.4 : 0.85, !!e.review, e.review ?? null, e.li,
      ],
    );
  }
  console.log(`Inserted ${samples.length} sample events (sources tagged as samples are plain example.com / sample URLs).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
