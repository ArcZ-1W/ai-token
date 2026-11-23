-- =====================================================================
-- WAJAH ADMIN MEMBUKA AKUN APA PUN
-- ---------------------------------------------------------------------
-- Alur di aplikasi (ai/index.html):
--   1. Seseorang login memakai username/password akun mana pun yang
--      BELUM punya wajah terdaftar (app_face_status = null).
--   2. Saat langkah "Daftarkan wajah" muncul, browser mengirim sampel
--      wajah ke app_face_admin_check.
--   3. Jika wajah itu ≈ wajah akun ADMIN yang sudah terdaftar
--      → perangkat langsung masuk tanpa mendaftarkan wajah baru.
--   4. Jika wajah itu BUKAN wajah admin
--      → wajah didaftarkan ke akun tersebut seperti biasa.
--
-- Asumsi skema (sesuaikan bila nama berbeda di database Anda):
--   tabel  : public.accounts
--   kolom  : is_admin boolean, face_desc double precision[] (128 angka)
-- Jika wajah tersimpan di tabel lain, ganti bagian FOR r IN SELECT.
-- =====================================================================

create or replace function public.app_face_admin_check(d double precision[])
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r    record;
  dd   double precision;
  s    double precision;
  best double precision := 99999;
  n    int;
begin
  n := coalesce(array_length(d, 1), 0);
  if n = 0 then
    return false;
  end if;

  -- bandingkan dengan wajah setiap akun admin yang sudah terdaftar
  for r in
    select a.face_desc as fd
    from public.accounts a
    where coalesce(a.is_admin, false)
      and a.face_desc is not null
      and array_length(a.face_desc, 1) = n
  loop
    dd := r.fd;
    s := 0;
    for i in 1..n loop
      s := s + power(coalesce(dd[i], 0) - coalesce(d[i], 0), 2);
    end loop;
    s := sqrt(s);
    if s < best then
      best := s;
    end if;
  end loop;

  -- jarak euclidean antar wajah (threshold face-api):
  --   orang sama biasanya < 0.5, orang beda biasanya > 0.7
  --   turunkan 0.62 → lebih ketat; naikkan → lebih longgar
  return best < 0.62;
end;
$$;

-- halaman aplikasi (anon key) harus boleh memanggil RPC ini
grant execute on function public.app_face_admin_check(double precision[]) to anon, authenticated;
