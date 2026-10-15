-- ============================================================================
--  Xozen AI — Paket member (Basic / Best)
--  Cara pakai: buka Supabase > SQL Editor > New query > tempel semua isi file ini
--              > Run.  Cukup SEKALI.
--
--  Yang dibuat file ini:
--    1) tabel  public.member_plans        : menyimpan paket setiap akun
--    2) fungsi public.app_plan_set(...)   : admin menyimpan paket sebuah akun
--    3) fungsi public.app_plan_get(...)   : aplikasi membaca paket saat member login
--    4) fungsi public.app_plan_list(...)  : dashboard admin membaca semua paket
--
--  Keamanan:
--    * Fungsi memverifikasi admin lewat fungsi app_login() yang sudah ada,
--      jadi tidak ada password baru yang disimpan di mana pun.
--    * Tabel dikunci RLS (tanpa policy) sehingga tidak bisa dibaca/ditulis
--      langsung lewat API publik; hanya lewat fungsi di atas.
--
--  Efek di aplikasi:
--    * paket basic -> dropdown model hanya berisi 9 model Basic (+ Xozen AI & MinimumLite)
--    * paket best  -> dropdown model berisi 31 model Best  (+ Xozen AI & MinimumLite)
--    * tanpa file ini aplikasi tetap jalan, hanya saja paket ditebak dari kuota akun
--      (lihat catatan di dashboard admin).
-- ============================================================================

create table if not exists public.member_plans (
  username   text primary key,
  plan       text not null check (plan in ('basic','best')),
  updated_at timestamptz not null default now()
);

alter table public.member_plans enable row level security;

-- ---------------------------------------------------------------- admin: set
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
begin
  a := to_jsonb(app_login(u, p));
  if a is null or coalesce((a->>'is_admin')::boolean, false) is not true then
    raise exception 'hanya admin yang boleh mengatur paket';
  end if;
  target := lower(trim(coalesce(nu, '')));
  val    := lower(trim(coalesce(plan, '')));
  if target = '' then raise exception 'username kosong'; end if;
  if val not in ('basic', 'best') then raise exception 'paket tidak dikenal: %', plan; end if;

  insert into public.member_plans(username, plan, updated_at)
    values (target, val, now())
    on conflict (username) do update
      set plan = excluded.plan, updated_at = now();

  return jsonb_build_object('username', target, 'plan', val);
end $$;

-- --------------------------------------------------------------- member: get
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

  select jsonb_build_object('username', mp.username, 'plan', mp.plan, 'updated_at', mp.updated_at)
    into r
    from public.member_plans mp
   where mp.username = lower(trim(u));

  if r is null then
    return jsonb_build_object('username', lower(trim(u)), 'plan', null);
  end if;
  return r;
end $$;

-- ---------------------------------------------------------------- admin: list
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
    select jsonb_agg(jsonb_build_object('username', mp.username, 'plan', mp.plan) order by mp.username)
      from public.member_plans mp
  ), '[]'::jsonb);
end $$;

-- ------------------------------------------------------------- izin akses API
grant execute on function public.app_plan_set(text, text, text, text) to anon, authenticated;
grant execute on function public.app_plan_get(text, text) to anon, authenticated;
grant execute on function public.app_plan_list(text, text) to anon, authenticated;

-- minta PostgREST memuat ulang daftar fungsi supaya langsung bisa dipakai
notify pgrst, 'reload schema';

-- ============================================================================
--  BAGIAN 2 — Penanda "pengguna baru" (untuk tutorial otomatis)
--  Akun yang dibuat SETELAH file ini dijalankan otomatis bernilai is_new = true,
--  sehingga tutorial tampil sekali saat member pertama kali login.
--  Akun lama ditandai is_new = false agar tidak ikut melihat tutorial.
--  Cukup dijalankan SEKALI: kalau dijalankan ulang, semua akun jadi false lagi.
-- ============================================================================

alter table public.accounts add column if not exists is_new boolean not null default true;

update public.accounts set is_new = false;

create or replace function public.app_tour_status(u text, p text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a jsonb;
  v boolean;
begin
  a := to_jsonb(app_login(u, p));
  if a is null then raise exception 'login gagal'; end if;
  select acc.is_new into v from public.accounts acc where acc.username = lower(trim(u));
  return jsonb_build_object('username', lower(trim(u)), 'is_new', coalesce(v, false));
end $$;

create or replace function public.app_tour_done(u text, p text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a jsonb;
begin
  a := to_jsonb(app_login(u, p));
  if a is null then raise exception 'login gagal'; end if;
  update public.accounts set is_new = false where username = lower(trim(u));
  return jsonb_build_object('username', lower(trim(u)), 'is_new', false);
end $$;

grant execute on function public.app_tour_status(text, text) to anon, authenticated;
grant execute on function public.app_tour_done(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
--  Perintah tambahan (jalankan hanya bila perlu):
--    lihat semua paket   : select * from public.member_plans order by username;
--    hapus paket 1 akun  : delete from public.member_plans where username = 'budi';
--    ubah paket manual   : update public.member_plans set plan = 'best' where username = 'budi';
--    tampilkan tur lagi  : update public.accounts set is_new = true where username = 'budi';
--
--  Kalau saat Run muncul error semacam
--    "function app_login(text, text) does not exist"
--  artinya nama/urutan parameter app_login di proyek Anda berbeda. Kirimkan hasil
--    select pg_get_functiondef('public.app_login'::regproc);
--  agar baris pemanggilannya bisa saya sesuaikan (hanya 3 tempat: app_plan_set,
--  app_plan_get, app_plan_list).
-- ============================================================================
