-- StructCap: access log. One row per visit event (page opened, free start, sign-in, registration), written by the
-- Edge Function "api" with the client IP address taken from the request headers. Closed to the browser (RLS on,
-- no policies); the administrator reads it through the api function. Rows older than 400 days are purged by the function.
create table if not exists public.visits (
  id bigserial primary key,
  at timestamptz not null default now(),
  ip text,
  country text,
  vid text,            -- random id kept in the visitor's browser (counts devices without an account)
  username text,       -- member email when signed in, else null
  role text,           -- guest / free / pro / admin
  event text,          -- open / free / login / register / view
  page text,
  lang text,
  ua text,
  ref text
);
create index if not exists visits_at_idx on public.visits (at desc);
create index if not exists visits_ip_idx on public.visits (ip);
create index if not exists visits_vid_idx on public.visits (vid, event, at desc);
alter table public.visits enable row level security;
