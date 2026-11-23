-- ============================================================================
--  Xozen AI — RASUK ACCOUNT (paksa masuk ke akun member)
--  Cara pakai: Supabase > SQL Editor > New query > tempel semua isi file ini
--              > Run.  Cukup SEKALI (aman dijalankan ulang).
--
--  WAJIB SEBELUMNYA: app_login(u,p) sudah ada (dipakai untuk verifikasi admin).
--
--  Yang dibuat file ini:
--    1) tabel  public.rasuk_sessions          : cadangan baris akun + audit
--    2) fungsi public.app_admin_rasuk(...)    : admin masuk ke akun member
--    3) fungsi public.app_admin_rasuk_restore(...)  : pulihkan password asli
--    4) fungsi public.app_admin_rasuk_list(...)     : daftar rasuk aktif
--    5) fungsi public.app_admin_rasuk_restore_all(...) : pulihkan semua
--
--  CARA KERJA (tanpa perlu tahu skema hash password Anda):
--    * fungsi membaca baris akun target apa adanya (to_jsonb) lalu menyimpannya
--      sebagai cadangan di rasuk_sessions;
--    * kolom password dideteksi otomatis (password / pass / pwd / *_hash / hash);
--    * password sementara dibuat, lalu di-hash MENIRU format nilai lama:
--        $2a$/$2b$/$2y$  -> bcrypt      (crypt + gen_salt('bf'))
--        32 hex          -> md5(pw)
--        40 hex          -> sha1 hex
--        64 hex          -> sha256 hex
--        selain itu      -> plaintext (disimpan apa adanya)
--      Format argon2 tidak bisa ditiru -> fungsi berhenti dengan pesan jelas;
--      dalam kasus itu pakai tombol "Ganti pass" biasa dari dashboard.
--    * app_admin_rasuk_restore menulis kembali nilai password lama dari
--      cadangan, jadi akun member kembali seperti semula (tanpa jejak ubahan).
--
--  KEAMANAN:
--    * semua fungsi security definer + verifikasi admin lewat app_login();
--    * tabel rasuk_sessions dikunci RLS dan tidak diberi akses ke anon;
--    * akun admin tidak bisa dirasuk (mencegah eskalasi tak sengaja);
--    * password sementara hanya dikembalikan sekali ke pemanggil (admin).
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- 1) tabel
create table if not exists public.rasuk_sessions (
  id            uuid primary key default gen_random_uuid(),
  admin_user    text        not null,
  target_user   text        not null,
  pw_column     text        not null,
  temp_password text        not null,
  backup        jsonb       not null,
  created_at    timestamptz not null default now(),
  restored_at   timestamptz
);

create index if not exists rasuk_sessions_target_idx
  on public.rasuk_sessions (target_user, restored_at);

alter table public.rasuk_sessions enable row level security;
revoke all on public.rasuk_sessions from public, anon, authenticated;

-- ------------------------------------------------- 2) deteksi kolom password
create or replace function public._rasuk_pw_column()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  c text;
begin
  select column_name into c
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'accounts'
     and column_name in ('password','passwd','pass','pwd',
                         'password_hash','pass_hash','passhash','hash','secret')
   order by array_position(
     array['password','passwd','pass','pwd','password_hash','pass_hash','passhash','hash','secret'],
     column_name)
   limit 1;
  return c;
end $$;

-- ------------------------------------- 3) hash password mengikuti format lama
create or replace function public._rasuk_hash(pw text, prev text)
returns text
language plpgsql
set search_path = public, extensions
as $$
declare
  v text := coalesce(prev, '');
begin
  if v = '' then
    return pw;                                   -- akun tanpa password tersimpan
  end if;
  if v ~ '^\$2[aby]\$' then
    return crypt(pw, gen_salt('bf', 10));        -- bcrypt
  end if;
  if v ~ '^\$1\$' then
    return crypt(pw, gen_salt('md5'));           -- md5-crypt lama
  end if;
  if v ~* '^\$argon2' then
    raise exception 'password akun ini memakai argon2 — rasuk otomatis tidak didukung. Pakai "Ganti pass" biasa.';
  end if;
  if v ~ '^[0-9a-f]{32}$' then
    return md5(pw);
  end if;
  if v ~ '^[0-9a-f]{40}$' then
    return encode(digest(pw, 'sha1'), 'hex');
  end if;
  if v ~ '^[0-9a-f]{64}$' then
    return encode(digest(pw, 'sha256'), 'hex');
  end if;
  return pw;                                     -- plaintext
end $$;

create or replace function public._rasuk_scheme(prev text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(prev,'') = ''                then 'kosong'
    when prev ~ '^\$2[aby]\$'                  then 'bcrypt'
    when prev ~ '^\$1\$'                       then 'md5-crypt'
    when prev ~* '^\$argon2'                   then 'argon2'
    when prev ~ '^[0-9a-f]{32}$'               then 'md5'
    when prev ~ '^[0-9a-f]{40}$'               then 'sha1'
    when prev ~ '^[0-9a-f]{64}$'               then 'sha256'
    else 'plaintext'
  end
$$;

-- ------------------------------------------------------- 4) buka akun (rasuk)
create or replace function public.app_admin_rasuk(au text, ap text, nu text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  a       jsonb;
  target  text := lower(trim(coalesce(nu, '')));
  col     text;
  oldrow  jsonb;
  oldval  text;
  tmp     text;
  newval  text;
  isadm   boolean;
  rid     uuid;
begin
  a := to_jsonb(app_login(au, ap));
  if a is null or coalesce((a->>'is_admin')::boolean, false) is not true then
    raise exception 'hanya admin yang boleh merasuk akun';
  end if;
  if target = '' then
    raise exception 'username target kosong';
  end if;

  select coalesce(acc.is_admin, false) into isadm
    from public.accounts acc where lower(acc.username) = target;
  if not found then
    raise exception 'akun % tidak ditemukan', target;
  end if;
  if isadm then
    raise exception 'akun admin tidak bisa dirasuk';
  end if;

  col := public._rasuk_pw_column();
  if col is null then
    raise exception 'kolom password tidak ditemukan di public.accounts';
  end if;

  execute format('select to_jsonb(t) from public.accounts t where lower(t.username) = $1 limit 1')
    into oldrow using target;
  oldval := oldrow ->> col;

  tmp := 'Rs-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  newval := public._rasuk_hash(tmp, oldval);

  execute format('update public.accounts set %I = $1 where lower(username) = $2', col)
    using newval, target;

  insert into public.rasuk_sessions(admin_user, target_user, pw_column, temp_password, backup)
    values (lower(trim(au)), target, col, tmp, oldrow)
    returning id into rid;

  return jsonb_build_object(
    'ok',         true,
    'id',         rid,
    'username',   target,
    'password',   tmp,
    'scheme',     public._rasuk_scheme(oldval),
    'pw_column',  col,
    'created_at', now()
  );
end $$;

-- --------------------------------------------------- 5) pulihkan satu rasuk
create or replace function public.app_admin_rasuk_restore(au text, ap text, rid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a  jsonb;
  r  public.rasuk_sessions%rowtype;
begin
  a := to_jsonb(app_login(au, ap));
  if a is null or coalesce((a->>'is_admin')::boolean, false) is not true then
    raise exception 'hanya admin yang boleh memulihkan akun';
  end if;

  select * into r from public.rasuk_sessions where id = rid;
  if not found then
    raise exception 'sesi rasuk tidak ditemukan';
  end if;
  if r.restored_at is not null then
    return jsonb_build_object('ok', true, 'username', r.target_user, 'already', true);
  end if;

  execute format('update public.accounts set %I = $1 where lower(username) = $2', r.pw_column)
    using (r.backup ->> r.pw_column), r.target_user;

  update public.rasuk_sessions set restored_at = now() where id = rid;

  return jsonb_build_object('ok', true, 'username', r.target_user, 'restored_at', now());
end $$;

-- ------------------------------------------------------- 6) daftar rasuk aktif
create or replace function public.app_admin_rasuk_list(au text, ap text)
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
    raise exception 'hanya admin yang boleh melihat daftar rasuk';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id',          rs.id,
             'username',    rs.target_user,
             'password',    rs.temp_password,
             'admin',       rs.admin_user,
             'created_at',  rs.created_at,
             'restored_at', rs.restored_at
           ) order by rs.created_at desc)
      from public.rasuk_sessions rs
     where rs.restored_at is null
  ), '[]'::jsonb);
end $$;

-- --------------------------------------------------- 7) pulihkan semua rasuk
create or replace function public.app_admin_rasuk_restore_all(au text, ap text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a   jsonb;
  r   record;
  n   int := 0;
begin
  a := to_jsonb(app_login(au, ap));
  if a is null or coalesce((a->>'is_admin')::boolean, false) is not true then
    raise exception 'hanya admin yang boleh memulihkan akun';
  end if;

  for r in
    select * from public.rasuk_sessions where restored_at is null order by created_at
  loop
    execute format('update public.accounts set %I = $1 where lower(username) = $2', r.pw_column)
      using (r.backup ->> r.pw_column), r.target_user;
    update public.rasuk_sessions set restored_at = now() where id = r.id;
    n := n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'restored', n);
end $$;

-- ------------------------------------------------------------- izin akses API
grant execute on function public.app_admin_rasuk(text, text, text)              to anon, authenticated;
grant execute on function public.app_admin_rasuk_restore(text, text, uuid)      to anon, authenticated;
grant execute on function public.app_admin_rasuk_list(text, text)               to anon, authenticated;
grant execute on function public.app_admin_rasuk_restore_all(text, text)        to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
--  Perintah tambahan (jalankan hanya bila perlu):
--    lihat semua rasuk      : select * from public.rasuk_sessions order by created_at desc;
--    lihat yang masih aktif : select id, target_user, created_at from public.rasuk_sessions
--                             where restored_at is null order by created_at desc;
--    cek kolom akun         : select column_name, data_type from information_schema.columns
--                             where table_schema='public' and table_name='accounts'
--                             order by ordinal_position;
--
--  Kalau muncul "function app_login(text, text) does not exist", nama/urutan
--  parameter app_login di proyek ini berbeda. Kirim hasil:
--    select pg_get_functiondef('public.app_login'::regproc);
--  agar pemanggilannya bisa disesuaikan (hanya di app_admin_rasuk,
--  app_admin_rasuk_restore, app_admin_rasuk_list, app_admin_rasuk_restore_all).
-- ============================================================================
