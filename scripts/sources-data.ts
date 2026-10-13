/**
 * Event sources, each probed against the live site. "config.extra_urls" adds more listing pages (other categories or
 * cities) under one source. Listings with structured event data (JSON-LD or Luma's embedded data) carry dates;
 * the rest have each item's own page read for the date and city.
 */
export interface SeedSource {
  name: string;
  url: string | null;
  type: string;
  method: string;
  cities: string[];
  cats: string[];
  active: boolean;
  config: Record<string, unknown>;
  notes: string;
}

const meetup = (location: string, keywords: string) => `https://www.meetup.com/find/?keywords=${encodeURIComponent(keywords)}&location=${location}&source=EVENTS`;
const eb = (city: string, cat: string) => `https://www.eventbrite.com/d/india--${city}/${cat}--events/`;

export const SOURCES: SeedSource[] = [
  // --- Email: the only way LinkedIn-sourced signals enter (LinkedIn itself is never scraped) ---
  { name: "Google Alerts", url: null, type: "web_discovery", method: "google_alerts", cities: [], cats: ["LinkedIn", "Web"], active: true,
    config: { query: "from:googlealerts-noreply@google.com newer_than:3d" }, notes: "Reads Google Alert emails from Gmail. LinkedIn results become LinkedIn signals." },
  { name: "Gmail forwards", url: null, type: "email_forward", method: "email_forward", cities: [], cats: ["LinkedIn", "Manual"], active: true,
    config: {}, notes: "Forwarded posts/invites labelled event-scout, plus LinkedIn notification emails." },

  // --- Community and startup platforms (structured data, dated) ---
  { name: "Luma Bengaluru", url: "https://lu.ma/bengaluru", type: "event_platform", method: "luma", cities: ["Bengaluru"], cats: ["Startup", "AI", "Community"], active: true,
    config: { max_items: 40 }, notes: "Luma city page, read from its embedded data (no browser needed)." },
  { name: "Luma Mumbai", url: "https://lu.ma/mumbai", type: "event_platform", method: "luma", cities: ["Mumbai"], cats: ["Startup", "AI", "Community"], active: true,
    config: { max_items: 40 }, notes: "Luma city page." },
  { name: "Luma Delhi NCR", url: "https://lu.ma/delhi", type: "event_platform", method: "luma", cities: ["Delhi NCR"], cats: ["Startup", "AI", "Community"], active: true,
    config: { max_items: 40 }, notes: "Luma city page." },
  { name: "Luma Gurugram", url: "https://lu.ma/gurgaon", type: "event_platform", method: "luma", cities: ["Delhi NCR"], cats: ["Startup", "AI", "Community"], active: true,
    config: { max_items: 40 }, notes: "Luma city page." },
  { name: "Meetup Bengaluru", url: meetup("in--bengaluru", "startup"), type: "event_platform", method: "static", cities: ["Bengaluru"], cats: ["Startup", "Business"], active: true,
    config: { extra_urls: [meetup("in--bengaluru", "business networking"), meetup("in--bengaluru", "founders investors"), meetup("in--bengaluru", "AI leaders")] }, notes: "Meetup search pages (JSON-LD events)." },
  { name: "Meetup Mumbai", url: meetup("in--maharashtra--mumbai", "startup"), type: "event_platform", method: "static", cities: ["Mumbai"], cats: ["Startup", "Business"], active: true,
    config: { extra_urls: [meetup("in--maharashtra--mumbai", "business networking"), meetup("in--maharashtra--mumbai", "founders investors")] }, notes: "Meetup search pages." },
  { name: "Meetup Delhi NCR", url: meetup("in--delhi", "startup"), type: "event_platform", method: "static", cities: ["Delhi NCR"], cats: ["Startup", "Business"], active: true,
    config: { extra_urls: [meetup("in--delhi", "business networking"), meetup("in--delhi", "founders investors")] }, notes: "Meetup search pages." },
  { name: "AllEvents Bengaluru", url: "https://allevents.in/bangalore/business", type: "event_listing", method: "static", cities: ["Bengaluru"], cats: ["Business", "Conference"], active: true,
    config: { extra_urls: ["https://allevents.in/bangalore/conferences", "https://allevents.in/bangalore/startup"], deadline_from_detail: true }, notes: "Broad listing: many consumer events, filtered by the relevance prefilter and ranking." },
  { name: "AllEvents Mumbai", url: "https://allevents.in/mumbai/business", type: "event_listing", method: "static", cities: ["Mumbai"], cats: ["Business", "Conference"], active: true,
    config: { extra_urls: ["https://allevents.in/mumbai/conferences"], deadline_from_detail: true }, notes: "Broad listing." },
  { name: "AllEvents Delhi NCR", url: "https://allevents.in/new-delhi/business", type: "event_listing", method: "static", cities: ["Delhi NCR"], cats: ["Business", "Conference"], active: true,
    config: { extra_urls: ["https://allevents.in/new-delhi/conferences", "https://allevents.in/gurgaon/business"], deadline_from_detail: true }, notes: "Broad listing." },
  { name: "Eventbrite Bengaluru", url: eb("bengaluru", "business"), type: "event_platform", method: "static", cities: ["Bengaluru"], cats: ["Business"], active: true,
    config: { extra_urls: [eb("bengaluru", "science-and-tech")], deadline_from_detail: true }, notes: "Eventbrite category pages (ItemList JSON-LD)." },
  { name: "Eventbrite Mumbai", url: eb("mumbai", "business"), type: "event_platform", method: "static", cities: ["Mumbai"], cats: ["Business"], active: true,
    config: { extra_urls: [eb("mumbai", "science-and-tech")], deadline_from_detail: true }, notes: "Eventbrite category pages." },
  { name: "Eventbrite Delhi NCR", url: eb("new-delhi", "business"), type: "event_platform", method: "static", cities: ["Delhi NCR"], cats: ["Business"], active: true,
    config: { extra_urls: [eb("new-delhi", "science-and-tech")], deadline_from_detail: true }, notes: "Eventbrite category pages." },

  // --- Industry bodies, media and organizers ---
  { name: "Express Computer Events", url: "https://www.expresscomputer.in/events/", type: "media", method: "static", cities: [], cats: ["CXO", "Enterprise IT"], active: true,
    config: {}, notes: "CIO/CXO summits and senates across India (JSON-LD). Webinars are filtered out." },
  { name: "Bengaluru Tech Summit", url: "https://www.bengalurutechsummit.com/", type: "industry_events", method: "static", cities: ["Bengaluru"], cats: ["Technology", "Startup"], active: true,
    config: {}, notes: "Flagship annual summit (JSON-LD)." },
  { name: "Zinnov Events", url: "https://zinnov.com/events/", type: "industry_events", method: "static", cities: [], cats: ["Enterprise", "GCC", "AI"], active: true,
    config: {}, notes: "Enterprise AI / GCC events. Each event page is read." },
  { name: "IAMAI Events", url: "https://www.iamai.in/events", type: "industry_body", method: "static", cities: [], cats: ["Digital", "Policy"], active: true,
    config: {}, notes: "Internet industry body. Each event page is read." },
  { name: "Inc42 Events", url: "https://inc42.com/events/", type: "media", method: "static", cities: [], cats: ["Startup"], active: true,
    config: {}, notes: "Startup conclaves. Past events are rejected." },
  { name: "HasGeek", url: "https://hasgeek.com/", type: "event_platform", method: "static", cities: ["Bengaluru"], cats: ["Technology"], active: true,
    config: {}, notes: "Tech conferences and meetups. Each event page is read." },
  { name: "NASSCOM Events", url: "https://nasscom.in/events", type: "industry_body", method: "static", cities: ["Bengaluru", "Delhi NCR"], cats: ["SaaS", "AI", "GCC"], active: true,
    config: {}, notes: "Industry body events. Each event page is read for the date." },
  { name: "YourStory", url: "https://yourstory.com/feed", type: "media", method: "rss", cities: ["Bengaluru"], cats: ["Startup"], active: true,
    config: { max_items: 30, keywords: ["summit", "conference", "meetup", "roundtable", "event", "expo", "forum", "conclave"] }, notes: "RSS with the full article text from the feed (the site blocks bots on article pages)." },

  // --- Off: not usable right now ---
  { name: "TiE Bangalore", url: "https://bangalore.tie.org/", type: "startup_network", method: "static", cities: ["Bengaluru"], cats: ["Startup", "Investor"], active: false,
    config: {}, notes: "Off: the homepage shows only past recaps and has no events list." },
  { name: "ET CIO Events", url: "https://cio.economictimes.indiatimes.com/events", type: "industry_events", method: "static", cities: ["Mumbai", "Bengaluru"], cats: ["CXO", "Enterprise"], active: false,
    config: {}, notes: "Off: the page yields only navigation links without selectors." },
  { name: "10Times India", url: "https://10times.com/india", type: "event_listing", method: "playwright", cities: ["Bengaluru", "Mumbai", "Delhi NCR"], cats: ["Conference", "Expo"], active: false,
    config: { scroll: true }, notes: "Off: blocks automated requests (HTTP 403)." },
];

/** Sources replaced by the ones above; removed from the database on seed. */
export const RETIRED = ["Meetup Bengaluru Tech"];
