-- StructCap: accounts, member details, payments and app settings.
-- All tables are closed to the browser (RLS on, no policies). The Edge Function "api"
-- reads and writes them with the service role after checking the caller.
create table public.accounts (
  username text primary key check (username ~ '^[A-Za-z0-9_.-]{3,32}$'),
  name text,
  plan text not null default 'pro' check (plan in ('pro','free')),
  status text not null default 'active' check (status in ('active','suspended')),
  start date,
  expiry date,
  salt text not null,
  hash text not null,
  iter integer not null default 120000,
  updated timestamptz not null default now()
);
create table public.members (
  username text primary key references public.accounts(username) on delete cascade,
  email text,
  phone text,
  note text,
  created date default current_date
);
create table public.payments (
  id text primary key,
  username text references public.accounts(username) on delete set null,
  date date not null default current_date,
  amount numeric(10,2) not null default 0 check (amount >= 0),
  currency text not null default 'USD',
  method text,
  ref text,
  days integer not null default 0,
  status text not null default 'paid' check (status in ('paid','pending','refunded')),
  created timestamptz not null default now()
);
create index payments_username_idx on public.payments(username);
create table public.settings (
  id text primary key,
  value jsonb not null default '{}'::jsonb,
  updated timestamptz not null default now()
);
insert into public.settings (id, value) values ('global', '{"proFree": false}');

alter table public.accounts enable row level security;
alter table public.members enable row level security;
alter table public.payments enable row level security;
alter table public.settings enable row level security;
