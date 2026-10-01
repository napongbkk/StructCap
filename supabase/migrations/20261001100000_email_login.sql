-- StructCap: members sign in with their email address (stored lower-case as the username);
-- legacy short usernames stay valid. Member language for the emails we send them.
alter table public.accounts drop constraint if exists accounts_username_check;
alter table public.accounts add constraint accounts_username_check check (
  char_length(username) between 3 and 254 and (
    username ~ '^[A-Za-z0-9_.-]{3,32}$' or username ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$'
  )
);
alter table public.members add column if not exists lang text not null default 'en' check (lang in ('en','th'));
