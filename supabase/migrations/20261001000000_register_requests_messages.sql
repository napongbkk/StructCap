-- StructCap: self-registration, Pro applications with payment slips, contact / feedback messages.
-- Same rule as before: RLS on, no policies; only the Edge Function (service role) reads and writes.
alter table public.accounts alter column plan set default 'free';
alter table public.members add column if not exists company text;
alter table public.members add column if not exists country text;
alter table public.members add column if not exists registered timestamptz default now();

create table if not exists public.requests (
  id text primary key,
  username text references public.accounts(username) on delete cascade,
  kind text not null default 'pro' check (kind in ('pro')),
  months integer not null default 1 check (months between 1 and 36),
  amount numeric(10,2) not null default 0 check (amount >= 0),
  currency text not null default 'USD' check (currency in ('USD','THB')),
  method text,
  ref text,
  slip_path text,
  slip_name text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  note text,
  created timestamptz not null default now(),
  decided timestamptz
);
create index if not exists requests_username_idx on public.requests(username);
create index if not exists requests_status_idx on public.requests(status);

create table if not exists public.messages (
  id text primary key,
  kind text not null default 'contact' check (kind in ('contact','feedback','register','pro')),
  name text,
  email text,
  username text,
  message text not null check (char_length(message) <= 5000),
  status text not null default 'new' check (status in ('new','read')),
  created timestamptz not null default now()
);
create index if not exists messages_created_idx on public.messages(created desc);

alter table public.payments drop constraint if exists payments_currency_check;
alter table public.payments add constraint payments_currency_check check (currency in ('USD','THB'));

alter table public.requests enable row level security;
alter table public.messages enable row level security;

-- private bucket for payment slips (images / PDF, 5 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slips', 'slips', false, 5242880, array['image/png','image/jpeg','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;
