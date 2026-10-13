import { daysBetween } from "../dates";
import { geminiJson } from "../gemini";
import type { EventRow, Preferences, Priority } from "../types";

export interface Ranking {
  id: number;
  priority: Priority;
  relevance_score: number;
  category: string;
  audience_fit: string;
  urgency: string;
  reason: string;
  recommended_action: string;
  confidence: number;
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    rankings: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "INTEGER" },
          priority: { type: "STRING", enum: ["High", "Medium", "Low"] },
          relevance_score: { type: "INTEGER", description: "0-100" },
          category: { type: "STRING" },
          audience_fit: { type: "STRING", enum: ["Strong", "Moderate", "Weak"] },
          urgency: { type: "STRING", description: "e.g. 'Deadline in 5 days', 'Event in 12 days', 'No deadline listed'" },
          reason: { type: "STRING", description: "1-2 sentences on why this matters (or not) for Vikram" },
          recommended_action: { type: "STRING", description: "e.g. 'Register this week', 'Watch', 'Skip'" },
          confidence: { type: "NUMBER", description: "0 to 1" },
        },
        required: ["id", "priority", "relevance_score", "category", "audience_fit", "urgency", "reason", "recommended_action", "confidence"],
      },
    },
  },
  required: ["rankings"],
};

const SYSTEM = `You rank in-person business events for Vikram, an independent management consultant who wins clients through
conferences, CXO roundtables, startup meetups and industry summits. Respond with JSON only.

Priority rules:
- High: in a target city, strong business audience (CXO / founder / operator / investor relevance), within the next 30 days, registration open.
- Medium: relevant topic but weaker audience, or less urgent / adjacent city or domain.
- Low: generic webinar, wrong city, student / job-fair / training-heavy, weak networking value, or matches an excluded topic.
- BE SELECTIVE. High should be roughly the top 15% of events, never the default. Use the full 0-100 range; do not give 95 to everything.
- High needs ALL of: a substantial event (summit, conference, CXO or investor roundtable, curated founder-investor gathering, flagship ecosystem event); senior decision-makers in the audience (CXOs, CIOs/CTOs, founders of funded companies, investors); in one of the target cities (suburbs such as Thane or Navi Mumbai do not count as the target city); and within the next 30 days.
- Generic open startup meetups, community and hobby groups, developer workshops and hackathons, "networking" events with a vague audience, and events aimed at students, beginners or job-seekers are Medium at best (score 35-65), usually Low.
- Anything outside the target cities (Pune, Hyderabad, Agra, Kolkata, overseas...) is Low unless it is a genuinely exceptional CXO event.
- Any registration deadline under 7 days must be called out in "urgency" and "recommended_action".
- Be honest in "confidence" (0-1): use below 0.5 when key facts (date, city, audience) are missing or you are guessing.
- Never invent facts; base the reason on the event data given.`;

export async function rankBatch(events: EventRow[], prefs: Preferences, today: string): Promise<Ranking[]> {
  const payload = events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description?.slice(0, 400) ?? null,
    event_date: e.event_date,
    date_note: e.date_precision === "month" ? "Only the month is known (tentative)" : "Confirmed day",
    days_until_event: e.event_date ? daysBetween(today, e.event_date) : null,
    registration_deadline: e.registration_deadline,
    days_until_deadline: e.registration_deadline ? daysBetween(today, e.registration_deadline) : null,
    city: e.city,
    venue: e.venue,
    organizer: e.organizer,
    audience: e.audience,
    category: e.category,
    price: e.price,
    discovered_via: e.sources.map((s) => s.name),
    linkedin_signal: e.is_linkedin_signal,
  }));

  const prompt = `Today is ${today}.

Vikram's preferences:
- Target cities: ${prefs.target_cities.join(", ") || "not set"}
- Focus domains: ${prefs.focus_domains.join(", ") || "not set"}
- Target audience: ${prefs.audience_types.join(", ") || "not set"}
- Excluded topics: ${prefs.excluded_topics.join(", ") || "none"}
- His own priority rules: ${prefs.priority_rules || "none"}

Rank each event below. Return one ranking per event id.

EVENTS:
${JSON.stringify(payload, null, 1)}`;

  const res = await geminiJson<{ rankings: Ranking[] }>(prompt, SCHEMA, { system: SYSTEM });
  const ids = new Set(events.map((e) => e.id));
  return (res.rankings ?? []).filter((r) => ids.has(r.id)).map(sanitize);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function sanitize(r: Ranking): Ranking {
  const score = clamp(Math.round(Number(r.relevance_score) || 0), 0, 100);
  const priority: Priority = (["High", "Medium", "Low"] as const).includes(r.priority) ? r.priority : score >= 75 ? "High" : score >= 45 ? "Medium" : "Low";
  return { ...r, relevance_score: score, priority, confidence: clamp(Number(r.confidence) || 0, 0, 1) };
}
