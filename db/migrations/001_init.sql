-- Industry Event Scout: initial schema.
-- The migration runner splits on ";" at end of line, so avoid semicolons inside string literals.

create table if not exists sources (
  id serial primary key,
  name text not null unique,
  url text,
  source_type text not null default 'event_platform',
  scrape_method text not null default 'static',
  city_tags text[] not null default '{}',
  category_tags text[] not null default '{}',
  active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  notes text,
  last_run_at timestamptz,
  last_status text,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id serial primary key,
  title text not null,
  description text,
  event_date date,
  registration_deadline date,
  city text,
  venue text,
  organizer text,
  source text not null,
  source_type text not null,
  source_url text,
  sources jsonb not null default '[]'::jsonb,
  category text,
  audience text,
  price text,
  status text not null default 'deadline_unknown',
  deadline_urgent boolean not null default false,
  priority text check (priority in ('High', 'Medium', 'Low')),
  relevance_score integer check (relevance_score between 0 and 100),
  audience_fit text,
  urgency text,
  reason text,
  recommended_action text,
  confidence numeric(4, 3),
  needs_review boolean not null default false,
  review_reason text,
  is_linkedin_signal boolean not null default false,
  needs_rank boolean not null default true,
  raw_event_ids integer[] not null default '{}',
  ranked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_event_date_idx on events (event_date);
create index if not exists events_priority_idx on events (priority);
create index if not exists events_needs_rank_idx on events (needs_rank) where needs_rank;

create table if not exists raw_events (
  id serial primary key,
  source_id integer references sources (id) on delete set null,
  source_name text not null,
  source_type text not null,
  raw_title text,
  raw_snippet text,
  raw_url text,
  raw_date text,
  scraped_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  fingerprint text not null unique,
  processing_status text not null default 'pending' check (processing_status in ('pending', 'processed', 'rejected', 'failed')),
  processing_note text,
  event_id integer
);

create index if not exists raw_events_status_idx on raw_events (processing_status);

create table if not exists vikram_preferences (
  id integer primary key default 1 check (id = 1),
  target_cities text[] not null default '{}',
  focus_domains text[] not null default '{}',
  audience_types text[] not null default '{}',
  excluded_topics text[] not null default '{}',
  priority_rules text not null default '',
  digest_day text not null default 'Monday',
  digest_time text not null default '07:00',
  digest_timezone text not null default 'Asia/Kolkata',
  digest_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists digest_runs (
  id serial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'sent', 'failed', 'skipped', 'dry_run')),
  recipient text,
  subject text,
  provider text,
  event_count integer not null default 0,
  high_count integer not null default 0,
  urgent_count integer not null default 0,
  linkedin_count integer not null default 0,
  error text,
  html text
);

create table if not exists manual_event_submissions (
  id serial primary key,
  submitted_at timestamptz not null default now(),
  url text,
  text_content text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'processed', 'rejected', 'failed')),
  raw_event_id integer,
  event_id integer,
  error text
);

create table if not exists email_intake_logs (
  id serial primary key,
  gmail_message_id text not null unique,
  kind text not null,
  sender text,
  subject text,
  received_at timestamptz,
  items_found integer not null default 0,
  status text not null default 'processed',
  error text,
  processed_at timestamptz not null default now()
);

create table if not exists scraper_runs (
  id serial primary key,
  source_id integer references sources (id) on delete set null,
  source_name text not null,
  scrape_method text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed', 'skipped')),
  items_found integer not null default 0,
  items_new integer not null default 0,
  error text
);

create index if not exists scraper_runs_started_idx on scraper_runs (started_at desc);
