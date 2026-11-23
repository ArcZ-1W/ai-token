# Panduan Akun Sementara Supabase

Halaman `/free/` memakai **Anonymous Sign-Ins** dari Supabase Auth. Pengunjung tidak memasukkan email, password, atau akun Google; Supabase membuat user anonim dan memberikan sesi pada browser.

## Aktifkan Anonymous Sign-Ins

1. Buka [Supabase Dashboard](https://supabase.com/dashboard) dan pilih project Xozen AI.
2. Buka **Authentication → Sign In / Providers**.
3. Temukan **Anonymous Sign-Ins**, aktifkan, lalu simpan.
4. Tidak perlu membuat tabel akun aplikasi, Google OAuth Client, callback OAuth, atau redirect allow-list untuk mode anonim ini.

## Uji Halaman

1. Jalankan situs lewat HTTPS atau localhost. Contoh lokal:

   ```powershell
   python -m http.server 8000
   ```

2. Buka `http://localhost:8000/free/`.
3. Tekan **Buat akun sementara**. Jika berhasil, label `Akun sementara` muncul dan chat MinimumLite terbuka.
4. Kirim pesan. MinimumLite hanya menerima pesan terbaru dan tidak menggunakan kuota paket.
5. Tekan **Keluar**, lalu muat ulang. Untuk mulai lagi, buat sesi anonim baru.

## Sifat Akun Anonim

- Sesi disimpan di browser. Jika pengguna keluar, menghapus data browser, atau berpindah perangkat, sesi lama tidak dapat dipulihkan.
- Supabase tetap menyimpan record anonim di `auth.users`; akun tidak otomatis dihapus ketika sesi berakhir. Gunakan nama yang tepat: sesi sementara, bukan record server yang otomatis kedaluwarsa.
- User anonim memakai role Postgres `authenticated`. Jika aplikasi menambahkan tabel/data yang bisa diakses akun ini, pastikan kebijakan RLS memeriksa claim `is_anonymous` sesuai kebutuhan.
- Supabase menerapkan rate limit untuk pembuatan akun anonim. Sebelum membuka layanan luas, aktifkan CAPTCHA/Cloudflare Turnstile di Supabase. Jika CAPTCHA diaktifkan, halaman perlu mengirim `captchaToken` bersama `signInAnonymously()`; versi halaman saat ini belum mengirim token tersebut.

## Hapus Record Anonim Lama

Supabase belum menghapus user anonim secara otomatis. Setelah memastikan tidak ada data terkait yang perlu dipertahankan dan membuat backup, administrator dapat menghapus akun anonim berumur lebih dari 30 hari dari SQL Editor:

```sql
delete from auth.users
where is_anonymous is true
  and created_at < now() - interval '30 days';
```

Jangan menjalankan query penghapusan sebelum memeriksa tabel lain yang mungkin menyimpan referensi user ID.

## Referensi Resmi

- [Supabase: Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Supabase: CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)
