-- ============================================================================
--  Xozen AI — Paket member v2 (Basic gratis / Plus / Pro / Ultra Coder) + Plan AI
--  Cara pakai: buka Supabase > SQL Editor > New query > tempel semua isi file ini
--              > Run.  Cukup SEKALI (aman dijalankan ulang).
--
--  WAJIB SEBELUMNYA: file supabase-member-plan.sql sudah dijalankan
--  (tabel member_plans + fungsi app_login + app_plan_set/get/list).
--
--  Yang dibuat file ini:
--    1) Perluas nilai paket di public.member_plans:
--         lama : 'basic' (9 model), 'best' (31 model)   -> tetap didukung
--         baru : 'free'  (Basic gratis: Xozen AI + MinimumLite + XozenLow),
--                'plus' ("daftar model Basic lama"), 'pro' ("daftar Best Value
--                lama" + Plan AI harian), 'ultra' (semua model + Plan AI harian)
--    2) Kolom pelacakan Plan AI harian (reset tengah malam WIB, Asia/Jakarta)
--    3) app_plan_set  : terima paket baru + atur kuota Plan AI per paket
--    4) app_plan_get  : hasil kaya (plan + kuota Plan AI per akun)
--    5) app_planai_get / app_planai_spend : cesi & pemakaian Plan AI harian
--    6) app_planai_reset : admin me-reset pakai Plan AI harian satu akun
--
--  Catatan konsep kolam token (sisi aplikasi, bukan server):
--    Paket baru memakai SATU kolam token: admin set limit_auto = jumlah
--    pemakaian (1 pemakaian = 1.000 xoz token) dan limit_other = 0.
--    Tampilan "kira-kira acak" per pemakaian tetap berasal dari aplikasi
--    (fungsi tokParts), total pemakaian selalu tepat N x 1.000 token.
-- ============================================================================

-- ------------------------------------------------------------ 1) nilai paket
alter table public.member_plans drop constraint if exists member_plans_plan_check;
alter table public.member_plans
  add constraint member_plans_plan_check
  check (plan in ('basic','best','free','plus','pro','ultra'));

-- ------------------------------------------------- 2) kolom pelacakan Plan AI
alter table public.member_plans
  add column if not exists planai_daily int  not null default 0,
  add column if not exists planai_date  date,
  add column if not exists planai_used  int  not null default 0;

-- ------------------------------------------------------- 3) keluarga paket
--  Map paket -> { pin: batas pin (informatif; enforce tetap app_admin_setpin),
--                 planai: token Plan AI per hari (0 = tidak tersedia) }
create or replace function public.app_plan_benefits(plan text)
returns jsonb
language plpgsql
stable
as $$
begin
  case lower(trim(coalesce(plan,'')))
    when 'free'   then return jsonb_build_object('pins',0,'planai_daily',0);
    when 'plus'   then return jsonb_build_object('pins',1,'planai_daily',0);
    when 'pro'    then return jsonb_build_object('pins',1,'planai_daily',5000);
    when 'ultra'  then return jsonb_build_object('pins',3,'planai_daily',15000);
    else               return jsonb_build_object('pins',0,'planai_daily',0);
  end case;
end $$;

-- ------------------------------------------------------------- 3) set paket
create or replace function public.app_plan_set(u text, p text, nu text, plan text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a      jsonb;
  target text;
  val    text;
  b      jsonb;
begin
  a := to_jsonb(app_login(u, p));
  if a is null or coalesce((a->>'is_admin')::boolean, false) is not true then
    raise exception 'hanya admin yang boleh mengatur paket';
  end if;
  target := lower(trim(coalesce(nu, '')));
  val    := lower(trim(coalesce(plan, '')));
  if target = '' then raise exception 'username kosong'; end if;
  if val not in ('basic','best','free','plus','pro','ultra') then
    raise exception 'paket tidak dikenal: %', plan;
  end if;

  b := public.app_plan_benefits(val);

  insert into public.member_plans(username, plan, updated_at, planai_daily, planai_date, planai_used)
    values (target, val, now(), (b->>'planai_daily')::int, null, 0)
    on conflict (username) do update
      set plan         = excluded.plan,
          planai_daily = excluded.planai_daily,
          planai_date  = null,
          planai_used  = 0,
          updated_at   = now();

  return jsonb_build_object('username', target, 'plan', val,
    'planai_daily', (b->>'planai_daily')::int);
end $$;

-- --------------------------------------------------------------- get paket
create or replace function public.app_plan_get(u text, p text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a jsonb;
  r jsonb;
begin
  a := to_jsonb(app_login(u, p));
  if a is null then raise exception 'login gagal'; end if;

  select jsonb_build_object(
           'username',      mp.username,
           'plan',          mp.plan,
           'updated_at',    mp.updated_at,
           'planai_daily',  mp.planai_daily,
           'planai_date',   mp.planai_date,
           'planai_used',   mp.planai_used)
    into r
    from public.member_plans mp
   where mp.username = lower(trim(u));

  if r is null then
    return jsonb_build_object('username', lower(trim(u)), 'plan', null,
      'planai_daily', 0, 'planai_date', null, 'planai_used', 0);
  end if;
  return r;
end $$;

-- ------------------------------------------------ app_plan_list (tetap sama)
create or replace function public.app_plan_list(u text, p text)
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
    raise exception 'hanya admin yang boleh melihat daftar paket';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'username',     mp.username,
             'plan',         mp.plan,
             'planai_daily', coalesce(mp.planai_daily,0)
           ) order by mp.username)
      from public.member_plans mp
  ), '[]'::jsonb);
end $$;

-- ============================================== kuota Plan AI harian (WIB) ==
--  Nilai khusus: planai_daily = -1 berarti TANPA BATAS (admin dapat
--  mengaturnya lewat app_planai_set_daily).
--  Verifikasi pemanggil lewat app_login(u,p). Parameter t disertakan untuk
--  kesesuaian pola panggilan aplikasi (tcall) namun tidak diverifikasi ulang.

create or replace function public.app_planai_get(u text, p text, t text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a      jsonb;
  r      public.member_plans%rowtype;
  today  date;
  used   int;
  remain int;
begin
  a := to_jsonb(app_login(u, p));
  if a is null then raise exception 'login gagal'; end if;
  today := (now() at time zone 'Asia/Jakarta')::date;

  select * into r from public.member_plans where username = lower(trim(u));
  if not found then
    return jsonb_build_object('daily',0,'used',0,'remaining',0,'date',today);
  end if;
  if coalesce(r.planai_daily,0) < 0 then
    return jsonb_build_object('daily',-1,'used',coalesce(r.planai_used,0),
      'remaining',-1,'date',today);
  end if;
  if r.planai_daily = 0 then
    return jsonb_build_object('daily',0,'used',0,'remaining',0,'date',today);
  end if;

  if r.planai_date = today then used := coalesce(r.planai_used,0); else used := 0; end if;
  remain := greatest(r.planai_daily - used, 0);
  return jsonb_build_object('daily',r.planai_daily,'used',used,'remaining',remain,'date',today);
end $$;

create or replace function public.app_planai_spend(u text, p text, t text default null, n int default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a      jsonb;
  r      public.member_plans%rowtype;
  today  date;
  used   int;
  remain int;
  inc    int;
begin
  a := to_jsonb(app_login(u, p));
  if a is null then raise exception 'login gagal'; end if;
  today := (now() at time zone 'Asia/Jakarta')::date;

  select * into r from public.member_plans where username = lower(trim(u));
  if not found then
    return jsonb_build_object('daily',0,'used',0,'remaining',0,'date',today,'spent',0);
  end if;
  if coalesce(r.planai_daily,0) < 0 then
    inc := greatest(coalesce(n,0),0);
    used := coalesce(r.planai_used,0) + inc;
    update public.member_plans
       set planai_date = today, planai_used = used, updated_at = now()
     where username = lower(trim(u));
    return jsonb_build_object('daily',-1,'used',used,'remaining',-1,'date',today,'spent',inc);
  end if;
  if r.planai_daily = 0 then
    return jsonb_build_object('daily',0,'used',0,'remaining',0,'date',today,'spent',0);
  end if;

  if r.planai_date = today then used := coalesce(r.planai_used,0); else used := 0; end if;
  remain := greatest(r.planai_daily - used, 0);
  inc    := least(greatest(coalesce(n,0),0), remain);
  remain := remain - inc;
  used   := used + inc;

  update public.member_plans
     set planai_date = today, planai_used = used, updated_at = now()
   where username = lower(trim(u));

  return jsonb_build_object('daily',r.planai_daily,'used',used,
    'remaining',remain,'date',today,'spent',inc);
end $$;

--  Admin: atur kuota Plan AI harian akun apa pun.
--  daily = -1 -> tanpa batas; 0 -> tidak tersedia; >0 -> token per hari.
create or replace function public.app_planai_set_daily(au text, ap text, nu text, daily int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a jsonb;
  v int;
begin
  a := to_jsonb(app_login(au, ap));
  if a is null or coalesce((a->>'is_admin')::boolean, false) is not true then
    raise exception 'hanya admin yang boleh mengatur kuota Plan AI';
  end if;
  v := coalesce(daily, 0);
  if v < -1 then v := -1; end if;
  update public.member_plans
     set planai_daily = v, planai_date = null, planai_used = 0, updated_at = now()
   where username = lower(trim(nu));
  if not found then
    raise exception 'akun % belum punya baris paket; set paketnya dulu', nu;
  end if;
  return jsonb_build_object('username', lower(trim(nu)), 'planai_daily', v);
end $$;

create or replace function public.app_planai_reset(au text, ap text, nu text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a jsonb;
begin
  a := to_jsonb(app_login(au, ap));
  if a is null or coalesce((a->>'is_admin')::boolean, false) is not true then
    raise exception 'hanya admin yang boleh me-reset Plan AI';
  end if;
  update public.member_plans
     set planai_date = null, planai_used = 0, updated_at = now()
   where username = lower(trim(nu));
  return jsonb_build_object('username', lower(trim(nu)), 'reset', true);
end $$;

-- ------------------------------------------------------------- izin akses API
grant execute on function public.app_plan_benefits(text)                  to anon, authenticated;
grant execute on function public.app_plan_set(text, text, text, text)    to anon, authenticated;
grant execute on function public.app_plan_get(text, text)                to anon, authenticated;
grant execute on function public.app_plan_list(text, text)               to anon, authenticated;
grant execute on function public.app_planai_get(text, text, text)        to anon, authenticated;
grant execute on function public.app_planai_spend(text, text, text, int) to anon, authenticated;
grant execute on function public.app_planai_reset(text, text, text)      to anon, authenticated;
grant execute on function public.app_planai_set_daily(text, text, text, int) to anon, authenticated;

-- minta PostgREST memuat ulang daftar fungsi supaya langsung bisa dipakai
notify pgrst, 'reload schema';
