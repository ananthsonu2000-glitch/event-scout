# Industry Event Scout

Weekly event intelligence for Vikram. It discovers relevant in-person events (conferences, CXO roundtables, startup meetups, summits), ranks them with **Gemini Flash**, stores them in **Neon Postgres**, shows them in a dashboard, and emails a digest every **Monday 7:00 AM IST**.

- **Dashboard:** Next.js 15 (App Router), TypeScript, Tailwind
- **Daily automation:** GitHub Actions → `npm run scrape`
- **Digest:** GitHub Actions (or Vercel Cron) → `npm run digest`
- **AI:** Gemini Flash only (extraction, classification, ranking). No Claude/other models in the app.
- **LinkedIn:** never scraped and never logged into. It is covered only through Google Alerts emails, LinkedIn notification emails, forwarded emails and the manual paste form. External pages mentioned in those (Luma, Meetup, Eventbrite, Townscript, organizer sites) are scraped normally. The fetcher refuses LinkedIn URLs outright (`src/scrapers/lib/page.ts`).

## How it works

```
GitHub Actions (daily 06:00 IST)
  └─ scripts/daily.ts → src/lib/pipeline/run.ts
       1. refresh derived fields (past / closed / deadline_urgent)
       2. for each active row in `sources`: run its scraper (failures are logged, others continue)
            static · rss · playwright · google_alerts · email_forward   (src/scrapers)
          → raw_events
       3. normalize pending raw_events (JSON-LD first, Gemini fills gaps / rejects non-events) → dedupe/merge → events
       4. Gemini ranks new/changed events in batches → priority, score, reason, action, confidence
GitHub Actions (Monday 07:00 IST)
  └─ scripts/digest.ts → src/lib/digest.ts → Gmail API or Brevo → digest_runs
Dashboard (Next.js) reads straight from Neon.
```

Rules enforced in code (not left to the model): a registration deadline 0–6 days away sets `deadline_urgent`; no deadline never means urgent; a missing event date or Gemini confidence < 0.5 sets `needs_review`; failed scrapers/digests/emails are logged and shown on **Source health**.

## Setup

### 1. Install

```bash
npm install
cp .env.example .env.local      # then fill it in
```

### 2. Neon

1. Create a free project at <https://neon.tech>, copy the connection string into `DATABASE_URL`.
2. Create the schema and seed data:

```bash
npm run db:migrate
npm run db:seed          # sources + Vikram's preferences + 7 sample events (use -- --no-samples to skip samples)
```

Remove the sample events later with: `delete from events where raw_event_ids = '{}';`

### 3. Gemini

Get a free key at <https://aistudio.google.com/apikey> → `GEMINI_API_KEY`. The default model is `gemini-3.8-flash` (override with `GEMINI_MODEL`).

**Quota matters.** The free tier allows only about **20 requests per day per model**. So the app (a) sends many items per request (6 per extraction call, 15 per ranking call, so a normal day needs roughly 10 calls), and (b) when one model's quota is used up, falls back to the next Flash model (`gemini-3.8-flash`, `gemini-3.5-flash`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`; set `GEMINI_MODELS` to change the chain). If every model is exhausted the run stops cleanly: unprocessed items stay `pending` and are picked up on the next run. Requests are also spaced by `GEMINI_MIN_INTERVAL_MS` (default 4s).

### 4. Gmail (reads alerts/forwards, optionally sends the digest)

1. In Google Cloud Console create a project, enable the **Gmail API**, configure the OAuth consent screen (External, add yourself as a test user) and create an **OAuth client ID** (type: Web application) with redirect URI `https://developers.google.com/oauthplayground`.
2. At <https://developers.google.com/oauthplayground>: gear icon → "Use your own OAuth credentials" → paste client ID/secret. Authorize the scopes
   `https://www.googleapis.com/auth/gmail.readonly` and `https://www.googleapis.com/auth/gmail.send`, then exchange for tokens and copy the **refresh token**.
3. Set `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`.

> While the OAuth app is in "Testing", Google expires refresh tokens after 7 days. Publish the app to "In production" (personal use is fine, no verification is required for your own account) to keep the token long-lived.

Use the Gmail account that receives the alerts. Set `EMAIL_FROM` to that address (Gmail sends as the authenticated account) and `VIKRAM_EMAIL` to the recipient.

**Alternative sender: Brevo** (free tier). Set `BREVO_API_KEY` and use a verified sender in `EMAIL_FROM`; when set, Brevo is used instead of Gmail for sending. Gmail is still needed for reading alerts.

### 5. Google Alerts (LinkedIn-safe discovery)

At <https://www.google.com/alerts>, create alerts delivered to the Gmail inbox above (“As-it-happens” or daily, “All results”). `npm run db:seed` prints the suggested list:

```
"CIO roundtable" Bengaluru            site:linkedin.com/posts "CIO roundtable" Bengaluru
"CXO summit" Bengaluru                site:linkedin.com/posts "startup meetup" Bengaluru
"founder meetup" Bengaluru            site:linkedin.com/events Bengaluru startup
"startup networking" Bengaluru        site:linkedin.com/posts "CXO" "Bengaluru"
"AI leaders roundtable" Mumbai        "enterprise AI summit" India
```

LinkedIn results become items with `source = "LinkedIn signal"` (`source_type = google_alert_linkedin`). Any Luma/Meetup/Eventbrite/etc. link in the alert is scraped and merged with the signal. Processed email IDs are tracked in `email_intake_logs`, so nothing is ingested twice.

**Forwarded emails:** forward a LinkedIn post or invite to the inbox and tag it with a Gmail label named `event-scout` (a Gmail filter can apply it automatically). LinkedIn notification emails (`notifications-noreply@linkedin.com`) are picked up too. Override the search with `GMAIL_FORWARD_QUERY`.

**Manual fallback:** the **Add event** page takes a LinkedIn URL and/or pasted text. It is stored in `manual_event_submissions`, processed and ranked immediately, and always kept (flagged for review if Gemini is unsure).

### 6. Run locally

```bash
npm run dev                 # dashboard at http://localhost:3000
npm run scrape              # one full daily run against your DB
npm run digest -- --dry-run # writes digest-preview.html, sends nothing
npm run digest -- --force   # really sends the digest now
npm run selftest            # offline checks of dedupe/alert parsing/digest/urgency logic
npx playwright install chromium   # only if you enable playwright sources locally
```

### 7. Deploy

**Dashboard:** deploy to Vercel (free). Add the env vars from `.env.example`. Set `NEXT_PUBLIC_APP_URL` to the deployed URL and `DASHBOARD_PASSWORD` to protect it with basic auth.

**GitHub Actions:** push this repo to GitHub, then add **Actions secrets**: `DATABASE_URL`, `GEMINI_API_KEY`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `EMAIL_FROM`, `VIKRAM_EMAIL`, optional `BREVO_API_KEY`. Add **Actions variables**: `NEXT_PUBLIC_APP_URL` (and optionally `GEMINI_MODEL`).

| Workflow | Schedule | Notes |
|---|---|---|
| `.github/workflows/daily-scrape.yml` | daily 00:30 UTC (06:00 IST) | also runnable via *Run workflow* |
| `.github/workflows/monday-digest.yml` | Monday 01:30 UTC (07:00 IST) | `force` input to resend |

GitHub cron can start a few minutes late, and scheduled workflows in public repos pause after 60 days without repo activity (re-enable in the Actions tab).

**Vercel Cron alternative for the digest:** `GET /api/cron/digest` (protected by `CRON_SECRET` via `Authorization: Bearer`). Add `{ "crons": [{ "path": "/api/cron/digest", "schedule": "30 1 * * 1" }] }` to `vercel.json`. The digest skips itself if one was already sent in the last 12 hours, so running both is harmless. The daily scrape stays on GitHub Actions because Playwright and long Gemini runs don't fit serverless time limits.

## Project layout

```
db/migrations/001_init.sql     schema: sources, raw_events, events, vikram_preferences, digest_runs,
                               manual_event_submissions, email_intake_logs, scraper_runs
scripts/                       migrate · seed · daily · digest · selftest
src/scrapers/                  registry (index.ts) + static · rss · playwright · googleAlerts · emailForward
src/scrapers/lib/              page fetch/JSON-LD, listing extraction, email-link → items
src/lib/pipeline/              normalize · dedupe · ranking (Gemini) · process · ingest (+manual) · run
src/lib/                       db · gemini · gmail · mailer · digest · queries · dates · types
src/app/                       dashboard, add, preferences, sources, health, server actions, cron route
.github/workflows/             daily-scrape.yml · monday-digest.yml
```

## Adding a scraper

1. Create `src/scrapers/mysite.ts` exporting a `ScraperFn` (`(source) => Promise<ScrapedItem[]>`).
2. Register it in `src/scrapers/index.ts` and add the name to `src/scrapers/methods.ts`.
3. Add a row on the **Sources** page with that `scrape_method`. `src/scrapers/playwright.ts` is the template for dynamic sites.

For static/Playwright sources, set `sources.config` selectors, e.g. `{"item_selector": ".event-card", "title_selector": "h3", "date_selector": ".date", "link_selector": "a"}`. Without selectors the scraper uses schema.org Event JSON-LD, then event-looking links.

## Dashboard

- **Sidebar layout** with a **light/dark toggle** (remembered; the first visit follows your system setting).
- **KPI cards** with 14-day trend lines and counting numbers. Click a card to filter the list.
- **Two clickable charts:** upcoming events by week and priority (7D / 30D / 90D), and events by city. Clicking a bar, segment or city filters the list; chips under the filters show what is active and remove each one.
- **Auto-refresh** every 5 minutes while the tab is visible (plus a manual refresh button), with a "Last scrape" time.
- Colours are CSS variables for both themes (`src/app/theme.css`, generated by `npm run gen:theme`), so existing classes like `bg-white` and `text-slate-900` switch automatically.

## What gets stored (quality rules)

Only clean, current events reach the dashboard and the digest:

- **A date is required.** An exact day, or at least a tentative month (shown as "Nov 2026 (tentative)"). Items with no timing at all are rejected.
- **Past events are rejected**, including past-tense write-ups and recaps (the full article or event page is read, not just the headline).
- **A location is required** (city, venue or online). Online-only events and webinars are rejected.
- **Off-topic items are dropped** by a cheap keyword prefilter (concerts, yoga, festivals, job fairs...), and Gemini rejects anything that is not a real event.
- Events flagged **Needs review** (low AI confidence) and **Low priority** events stay out of the main list and the digest. They are visible under the *Needs review* view and via *More filters, Include low priority*.
- The rejection reason for every dropped item is kept in `raw_events.processing_note` for auditing.

## Sources

Verified against the live sites. Structured sources (Luma, Meetup, AllEvents, Eventbrite, Express Computer, Bengaluru Tech Summit) carry dates on the listing; the others have each event's own page read. `config.extra_urls` adds more listing pages to a source. Currently off: TiE Bangalore (no events list), ET CIO (navigation links only), 10Times (blocks bots). Add or switch sources on the *Sources* page, or edit `scripts/sources-data.ts` and run `npm run db:seed` (re-seeding refreshes URL, config and on/off for the listed sources).

## Known limits (read before relying on it)

- Neon/Gmail/Gemini/GitHub Actions paths were written against their documented APIs but **not exercised end to end** in the environment this was generated in (no credentials). The typecheck, production build and `npm run selftest` pass. Run `npm run db:migrate && npm run db:seed && npm run scrape` once and check **Source health**.
- Website layouts change. A source that stops returning items, or whose detail pages become unreadable, shows as failed or partial on *Source health*. Failures are logged, not fatal.
- Broad listings (AllEvents, Meetup) are mostly startup and tech meetups. Flagship CXO events (CIO 100, Big CIO Show...) appear mainly through Google Alerts and the organizer pages in the source list, so set up the alerts.
- Google Alerts email HTML changes occasionally. `parseAlertEmail` is heuristic, and failures appear in `email_intake_logs`.
- The digest day/time preference is informational. Actual send time is the workflow cron. The enable toggle is honored.
- Gemini free-tier quotas can defer ranking. Unprocessed items stay `pending` and unranked events keep `needs_rank`, so the next run picks them up.
