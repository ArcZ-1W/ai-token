create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists community_messages_created_at_idx
  on public.community_messages (created_at desc);

alter table public.community_messages enable row level security;

grant select, insert on public.community_messages to authenticated;

drop policy if exists community_messages_read_authenticated on public.community_messages;
create policy community_messages_read_authenticated
  on public.community_messages for select to authenticated
  using (auth.uid() is not null);

drop policy if exists community_messages_insert_own on public.community_messages;
create policy community_messages_insert_own
  on public.community_messages for insert to authenticated
  with check (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'community_messages'
     ) then
    alter publication supabase_realtime add table public.community_messages;
  end if;
end
$$;
