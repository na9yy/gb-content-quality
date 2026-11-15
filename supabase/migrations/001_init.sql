-- GameBoost Content Quality: initial schema

-- Pages we score
create table pages (
  id            bigint generated always as identity primary key,
  url           text not null unique,
  page_type     text not null check (page_type in ('blog','review','product')),
  product_type  text,            -- accounts, currency, items, gift-cards, boosting...
  game          text,
  lang          text default 'en',
  title         text,
  active        boolean not null default true,
  first_seen    timestamptz not null default now(),
  last_scored   timestamptz
);

-- One row per Firecrawl fetch
create table crawls (
  id            bigint generated always as identity primary key,
  page_id       bigint not null references pages(id) on delete cascade,
  crawled_at    timestamptz not null default now(),
  http_status   int,
  markdown      text,
  word_count    int,
  content_hash  text,            -- skip re-scoring if unchanged
  metadata      jsonb            -- title, author, dates, schema from Firecrawl
);
create index on crawls (page_id, crawled_at desc);

-- Every single check (code, serp or llm) with evidence
create table checks (
  id            bigint generated always as identity primary key,
  crawl_id      bigint not null references crawls(id) on delete cascade,
  dimension     text not null check (dimension in ('originality','effort','helpfulness','skill','accuracy','trust','people_first','spam')),
  check_key     text not null,
  method        text not null check (method in ('code','serp','llm')),
  verdict       text not null check (verdict in ('pass','fail','unclear')),
  weight        numeric not null default 1,
  evidence      text,
  reason        text,
  rubric_version text not null
);
create index on checks (crawl_id, dimension);

-- Per-dimension score
create table dimension_scores (
  crawl_id      bigint not null references crawls(id) on delete cascade,
  dimension     text not null,
  score         numeric(3,2),    -- 1.00 to 5.00, null if not enough evidence
  passed        int not null default 0,
  failed        int not null default 0,
  unclear       int not null default 0,
  confidence    text check (confidence in ('high','medium','low')),
  summary       text,
  primary key (crawl_id, dimension)
);

-- Overall score per crawl
create table page_scores (
  crawl_id      bigint primary key references crawls(id) on delete cascade,
  page_id       bigint not null references pages(id) on delete cascade,
  overall       numeric(3,2),
  is_ymyl       boolean not null default false,
  rubric_version text not null,
  scored_at     timestamptz not null default now()
);
create index on page_scores (page_id, scored_at desc);

-- Reference pages used for originality (cleaned SERP + allowlist)
create table references_used (
  id            bigint generated always as identity primary key,
  crawl_id      bigint not null references crawls(id) on delete cascade,
  url           text not null,
  domain        text,
  source        text not null check (source in ('serp','allowlist')),
  serp_position int,
  similarity    numeric(4,3),    -- cosine vs our page
  kept          boolean not null default true,
  drop_reason   text             -- own_domain, low_authority, near_duplicate, scraper...
);

-- Trusted sources per game
create table reference_allowlist (
  id            bigint generated always as identity primary key,
  game          text,            -- null = all games
  domain        text not null,
  note          text,
  unique (game, domain)
);

-- Domains never used as references
create table domain_blocklist (
  domain        text primary key,
  reason        text
);

-- GSC data per page (ground truth for calibration)
create table gsc_stats (
  page_id       bigint not null references pages(id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  clicks        int,
  impressions   int,
  ctr           numeric,
  position      numeric,
  index_status  text,            -- from URL inspection / coverage
  primary key (page_id, period_start, period_end)
);

-- Manual scores for calibration
create table manual_labels (
  page_id       bigint not null references pages(id) on delete cascade,
  dimension     text not null,
  score         int check (score between 1 and 5),
  labeled_by    text,
  labeled_at    timestamptz not null default now(),
  note          text,
  primary key (page_id, dimension, labeled_by)
);

-- Lock down: only the service role (server) touches these tables
alter table pages enable row level security;
alter table crawls enable row level security;
alter table checks enable row level security;
alter table dimension_scores enable row level security;
alter table page_scores enable row level security;
alter table references_used enable row level security;
alter table reference_allowlist enable row level security;
alter table domain_blocklist enable row level security;
alter table gsc_stats enable row level security;
alter table manual_labels enable row level security;

-- Service role (server) gets full access; anon/auth get none
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- Seed: never use our own domain as a reference
insert into domain_blocklist (domain, reason) values ('gameboost.com', 'own_domain');
