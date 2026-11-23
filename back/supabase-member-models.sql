-- Xozen AI: model kustom per akun member.
-- Jalankan sekali di Supabase SQL Editor setelah app_login tersedia.

create table if not exists public.member_custom_models (
  username text primary key,
  models text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);

alter table public.member_custom_models enable row level security;
revoke all on public.member_custom_models from public, anon, authenticated;

create or replace function public.app_member_models_get(u text, p text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a jsonb;
  r text[];
begin
  a := to_jsonb(app_login(u, p));
  if a is null then raise exception 'login gagal'; end if;

  select models into r
    from public.member_custom_models
   where username = lower(trim(u));

  return jsonb_build_object('username', lower(trim(u)), 'models', coalesce(to_jsonb(r), '[]'::jsonb));
end $$;

create or replace function public.app_member_models_list(u text, p text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a jsonb;
begin
  a := to_jsonb(app_login(u, p));
  if a is null or coalesce((a->>'is_admin')::boolean, false) is not true then
    raise exception 'hanya admin yang boleh melihat model kustom member';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('username', username, 'models', models) order by username)
      from public.member_custom_models
  ), '[]'::jsonb);
end $$;

create or replace function public.app_member_models_set(u text, p text, nu text, models text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a jsonb;
  target text;
  clean text[];
begin
  a := to_jsonb(app_login(u, p));
  if a is null or coalesce((a->>'is_admin')::boolean, false) is not true then
    raise exception 'hanya admin yang boleh mengatur model kustom member';
  end if;

  target := lower(trim(coalesce(nu, '')));
  if target = '' then raise exception 'username kosong'; end if;

  select coalesce(array_agg(distinct trim(x) order by trim(x)), '{}'::text[])
    into clean
    from unnest(coalesce(models, '{}'::text[])) as item(x)
   where coalesce(trim(x), '') <> '';

  if cardinality(clean) > 50 then raise exception 'maksimal 50 model kustom per akun'; end if;
  if exists (select 1 from unnest(clean) as item(x) where length(x) > 128) then
    raise exception 'ID model maksimal 128 karakter';
  end if;
  if exists (select 1 from unnest(clean) as item(x) where lower(x) in ('auto', 'minimumlite')) then
    raise exception 'model bawaan tidak perlu ditambahkan sebagai model kustom';
  end if;

  if cardinality(clean) = 0 then
    delete from public.member_custom_models where username = target;
  else
    insert into public.member_custom_models(username, models, updated_at)
      values (target, clean, now())
      on conflict (username) do update set models = excluded.models, updated_at = now();
  end if;

  return jsonb_build_object('username', target, 'models', to_jsonb(clean));
end $$;

grant execute on function public.app_member_models_get(text, text) to anon, authenticated;
grant execute on function public.app_member_models_list(text, text) to anon, authenticated;
grant execute on function public.app_member_models_set(text, text, text, text[]) to anon, authenticated;
