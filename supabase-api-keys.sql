-- Xozen AI external API keys and per-account usage for the xozen-api Edge Function.
-- Run after the core Xozen AI schema (accounts and app_login) is installed.

create extension if not exists pgcrypto;

create table if not exists public.member_plans (
  username text primary key,
  plan text not null check (plan in ('basic', 'best')),
  updated_at timestamptz not null default now()
);

alter table public.member_plans enable row level security;
revoke all on public.member_plans from public, anon, authenticated;

create table if not exists public.member_api_keys (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  key_hash text not null unique,
  key_prefix text not null,
  name text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists member_api_keys_username_idx
  on public.member_api_keys (lower(username));

alter table public.member_api_keys enable row level security;
revoke all on public.member_api_keys from public, anon, authenticated;

create or replace function public.app_api_key_create(u text, p text, label text, secret text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  account jsonb;
  clean_name text;
  clean_secret text;
  new_id uuid;
begin
  account := to_jsonb(public.app_login(u, p));
  if account is null or coalesce((account->>'expired')::boolean, false) then
    raise exception 'login gagal atau masa aktif akun habis';
  end if;

  clean_name := left(trim(coalesce(label, '')), 60);
  clean_secret := trim(coalesce(secret, ''));
  if clean_name = '' then raise exception 'nama API key wajib diisi'; end if;
  if clean_secret !~ '^xz_live_[A-Za-z0-9_-]{32,}$' then
    raise exception 'format API key tidak valid';
  end if;
  perform pg_advisory_xact_lock(hashtext(lower(trim(u))));
  if (select count(*) from public.member_api_keys
       where lower(username) = lower(trim(u)) and revoked_at is null) >= 10 then
    raise exception 'maksimal 10 API key aktif per akun';
  end if;

  insert into public.member_api_keys(username, key_hash, key_prefix, name)
  values (
    lower(trim(u)),
    encode(digest(convert_to(clean_secret, 'UTF8'), 'sha256'), 'hex'),
    left(clean_secret, 16),
    clean_name
  )
  returning id into new_id;

  return jsonb_build_object(
    'id', new_id,
    'name', clean_name,
    'key', clean_secret,
    'prefix', left(clean_secret, 16),
    'created_at', now()
  );
end $$;

create or replace function public.app_api_key_list(u text, p text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account jsonb;
begin
  account := to_jsonb(public.app_login(u, p));
  if account is null then raise exception 'login gagal'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'name', name,
      'prefix', key_prefix,
      'created_at', created_at,
      'last_used_at', last_used_at,
      'revoked_at', revoked_at
    ) order by created_at desc)
    from public.member_api_keys
    where lower(username) = lower(trim(u))
  ), '[]'::jsonb);
end $$;

create or replace function public.app_api_key_revoke(u text, p text, target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account jsonb;
  affected integer;
begin
  account := to_jsonb(public.app_login(u, p));
  if account is null then raise exception 'login gagal'; end if;

  update public.member_api_keys
     set revoked_at = coalesce(revoked_at, now())
   where id = target and lower(username) = lower(trim(u));
  get diagnostics affected = row_count;
  if affected = 0 then raise exception 'API key tidak ditemukan'; end if;
  return jsonb_build_object('id', target, 'revoked', true);
end $$;

-- Internal lookup used only by the Edge Function's service-role client.
create or replace function public.app_api_key_auth(p_key_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.member_api_keys%rowtype;
  account jsonb;
  plan_name text;
  models text[];
  account_expiry timestamptz;
  is_admin boolean;
begin
  select * into k from public.member_api_keys
   where member_api_keys.key_hash = p_key_hash
     and revoked_at is null;
  if not found then return null; end if;

  select to_jsonb(a) into account
    from public.accounts a
   where lower(a.username) = lower(k.username);
  if account is null then return null; end if;

  is_admin := coalesce((account->>'is_admin')::boolean, false);
  account_expiry := nullif(account->>'expires_at', '')::timestamptz;
  if account_expiry is not null and account_expiry <= now() then return null; end if;

  select mp.plan into plan_name
    from public.member_plans mp
   where lower(mp.username) = lower(k.username);
  if is_admin then
    plan_name := 'admin';
  elsif plan_name is null or plan_name not in ('basic', 'best') then
    if (coalesce(nullif(account->>'limit_auto', '')::bigint, 0) = 10
        and coalesce(nullif(account->>'limit_other', '')::bigint, 0) = 3)
       or (coalesce(nullif(account->>'limit_auto', '')::bigint, 0) = 15
        and coalesce(nullif(account->>'limit_other', '')::bigint, 0) = 5)
       or (coalesce(nullif(account->>'limit_auto', '')::bigint, 0) = 20
        and coalesce(nullif(account->>'limit_other', '')::bigint, 0) = 8) then
      plan_name := 'best';
    else
      plan_name := 'basic';
    end if;
  end if;

  if plan_name = 'basic' then
    models := array['kimi-k2.5','kimi-k2.6','kimi-k2.7-code','mimo-v2.5-pro','hy3','hy4','glm-5.3','glm-5.2','deepseek-v4-pro'];
  else
    models := array[
      'deepseek-v4-flash','deepseek-v4-flash-0731','deepseek-v4-mod','deepseek-v4-pro','deepseek-v4-pro-0813','deepseek-v4.1-mod',
      'glm-5.2','glm-5.2-mod','glm-5.3','glm-5.3-mod','hy3','hy4','kimi-k2.5','kimi-k2.6','kimi-k2.7-code',
      'kimi-k2.7-code-highspeed','mimo-v2.5-pro','deepseek-v4-flash-vision-exp','deepseek-v4.1-flash','glm-5.3-flash',
      'glm-5.3-flash-mod','glm-5.3-flashx','glm-5.3-flashx-mod','gpt-5.6','gpt-5.6-luna','gpt-5.6-luna-b',
      'kimi-k2.8','kimi-k3-mod','mimo-v2.6-flash','mimo-v2.6-pro','step-5-preview'
    ];
  end if;

  if not is_admin and to_regclass('public.member_custom_models') is not null then
    execute 'select coalesce(array_agg(x.model_id), array[]::text[]) from public.member_custom_models m, unnest(m.models) as x(model_id) where lower(m.username) = lower($1)'
      into models using k.username;
    if plan_name = 'basic' then
      models := array[
        'kimi-k2.5','kimi-k2.6','kimi-k2.7-code','mimo-v2.5-pro','hy3','hy4','glm-5.3','glm-5.2','deepseek-v4-pro'
      ] || coalesce(models, array[]::text[]);
    else
      models := array[
        'deepseek-v4-flash','deepseek-v4-flash-0731','deepseek-v4-mod','deepseek-v4-pro','deepseek-v4-pro-0813','deepseek-v4.1-mod',
        'glm-5.2','glm-5.2-mod','glm-5.3','glm-5.3-mod','hy3','hy4','kimi-k2.5','kimi-k2.6','kimi-k2.7-code',
        'kimi-k2.7-code-highspeed','mimo-v2.5-pro','deepseek-v4-flash-vision-exp','deepseek-v4.1-flash','glm-5.3-flash',
        'glm-5.3-flash-mod','glm-5.3-flashx','glm-5.3-flashx-mod','gpt-5.6','gpt-5.6-luna','gpt-5.6-luna-b',
        'kimi-k2.8','kimi-k3-mod','mimo-v2.6-flash','mimo-v2.6-pro','step-5-preview'
      ] || coalesce(models, array[]::text[]);
    end if;
  end if;

  update public.member_api_keys set last_used_at = now() where id = k.id;
  return jsonb_build_object(
    'id', k.id,
    'username', k.username,
    'is_admin', is_admin,
    'plan', plan_name,
    'models', to_jsonb(models),
    'limit_auto', coalesce(nullif(account->>'limit_auto', '')::bigint, 0),
    'used_auto', coalesce(nullif(account->>'used_auto', '')::bigint, 0),
    'limit_other', coalesce(nullif(account->>'limit_other', '')::bigint, 0),
    'used_other', coalesce(nullif(account->>'used_other', '')::bigint, 0),
    'expires_at', account->>'expires_at'
  );
end $$;

-- Reserve one Xozen usage unit atomically before forwarding each paid request.
create or replace function public.app_api_usage_reserve(key_id uuid, kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_name text;
  updated jsonb;
begin
  if kind not in ('auto', 'other') then raise exception 'jenis pemakaian tidak valid'; end if;
  select username into owner_name from public.member_api_keys
   where id = key_id and revoked_at is null;
  if owner_name is null then return null; end if;

  if kind = 'auto' then
    update public.accounts
       set used_auto = coalesce(used_auto, 0) + 1
     where lower(username) = lower(owner_name)
       and coalesce(used_auto, 0) < coalesce(limit_auto, 0)
       and (expires_at is null or expires_at > now())
     returning to_jsonb(accounts) into updated;
  else
    update public.accounts
       set used_other = coalesce(used_other, 0) + 1
     where lower(username) = lower(owner_name)
       and coalesce(used_other, 0) < coalesce(limit_other, 0)
       and (expires_at is null or expires_at > now())
     returning to_jsonb(accounts) into updated;
  end if;
  if updated is null then return null; end if;
  return jsonb_build_object('reserved', true, 'used_auto', updated->>'used_auto', 'used_other', updated->>'used_other');
end $$;

create or replace function public.app_api_usage_refund(key_id uuid, kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_name text;
begin
  if kind not in ('auto', 'other') then raise exception 'jenis pemakaian tidak valid'; end if;
  select username into owner_name from public.member_api_keys
   where id = key_id;
  if owner_name is null then return; end if;
  if kind = 'auto' then
    update public.accounts set used_auto = greatest(0, coalesce(used_auto, 0) - 1)
     where lower(username) = lower(owner_name);
  else
    update public.accounts set used_other = greatest(0, coalesce(used_other, 0) - 1)
     where lower(username) = lower(owner_name);
  end if;
end $$;

revoke all on function public.app_api_key_auth(text) from public, anon, authenticated;
revoke all on function public.app_api_usage_reserve(uuid, text) from public, anon, authenticated;
revoke all on function public.app_api_usage_refund(uuid, text) from public, anon, authenticated;
grant execute on function public.app_api_key_auth(text) to service_role;
grant execute on function public.app_api_usage_reserve(uuid, text) to service_role;
grant execute on function public.app_api_usage_refund(uuid, text) to service_role;

grant execute on function public.app_api_key_create(text, text, text, text) to anon, authenticated;
grant execute on function public.app_api_key_list(text, text) to anon, authenticated;
grant execute on function public.app_api_key_revoke(text, text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
