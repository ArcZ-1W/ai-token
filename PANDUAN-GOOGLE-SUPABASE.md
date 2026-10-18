# Panduan Login Google dengan Supabase

Panduan ini mengaktifkan tombol **Lanjutkan dengan Google** pada halaman MinimumLite gratis (`/free/`). Pengguna yang belum pernah masuk akan didaftarkan oleh Supabase Auth secara otomatis; tidak perlu membuat tabel akun aplikasi.

## 1. Siapkan Google Auth Platform

1. Buka [Google Cloud Console](https://console.cloud.google.com/) dan pilih atau buat project.
2. Buka **Google Auth Platform**. Lengkapi **Branding** dan pilih **Audience** `External` jika pengguna berasal dari luar organisasi.
3. Saat aplikasi masih berstatus `Testing`, tambahkan alamat Gmail yang akan dipakai untuk uji coba ke daftar **Test users**. Untuk penggunaan publik, selesaikan langkah publikasi/verifikasi yang diminta Google.
4. Buka **Data Access** dan pastikan scope `openid` tersedia. Scope email dan profil dasar digunakan untuk identitas akun; jangan menambahkan scope lain yang tidak diperlukan.

## 2. Buat OAuth Client ID Web

1. Di Google Auth Platform, buka **Clients** lalu pilih **Create client**.
2. Pilih tipe aplikasi **Web application**.
3. Isi **Authorized JavaScript origins** dengan origin situs. Origin hanya berisi skema, host, dan port, tanpa path:

   ```text
   https://your-domain.example
   http://localhost:8000
   http://127.0.0.1:8000
   ```

   Ganti `https://your-domain.example` dengan domain produksi. Hapus baris localhost dari konfigurasi produksi jika tidak lagi diperlukan.
4. Isi **Authorized redirect URIs** dengan callback Supabase berikut:

   ```text
   https://beqlxnlhvarjhkuxndmr.supabase.co/auth/v1/callback
   ```

   Callback ini menuju Supabase, bukan ke `/free/`. Pertahankan skema `https`, path, dan penulisan persis seperti di atas.
5. Buat client, lalu salin **Client ID** dan **Client Secret**. Simpan Secret secara aman; jangan memasukkannya ke HTML, JavaScript, README, atau GitHub.

## 3. Aktifkan Provider Google di Supabase

1. Buka [Supabase Dashboard](https://supabase.com/dashboard) dan pilih project Xozen AI.
2. Buka **Authentication → Providers → Google** (di beberapa tampilan dashboard tertulis **Sign In / Providers**).
3. Aktifkan provider Google.
4. Masukkan Google **Client ID** dan **Client Secret**, lalu simpan.

## 4. Izinkan Redirect Kembali ke Situs

Di Supabase, buka **Authentication → URL Configuration**.

- Atur **Site URL** ke URL dasar situs produksi, misalnya `https://your-domain.example`.
- Tambahkan alamat halaman berikut ke **Redirect URLs**. Sesuaikan domain dan port dengan tempat aplikasi dijalankan:

  ```text
  https://your-domain.example/free/
  http://localhost:8000/free/
  http://127.0.0.1:8000/free/
  ```

  Path dan garis miring terakhir harus cocok dengan URL halaman. Untuk produksi, gunakan HTTPS dan domain yang benar-benar dipakai pengunjung.

## 5. Uji Login

1. Jalankan situs melalui HTTPS, atau server lokal seperti `python -m http.server 8000`.
2. Buka `https://your-domain.example/free/` atau `http://localhost:8000/free/`.
3. Tekan **Lanjutkan dengan Google** dan pilih akun yang diizinkan.
4. Setelah kembali ke `/free/`, email/nama akun tampil di header dan kolom chat aktif.
5. Kirim pesan singkat. Jawaban harus datang dari MinimumLite tanpa memakai kuota paket.
6. Tekan **Keluar**, lalu pastikan halaman kembali menampilkan tombol login.

## 6. Jika Gagal

- `redirect_uri_mismatch`: pastikan callback pada Google Client persis `https://beqlxnlhvarjhkuxndmr.supabase.co/auth/v1/callback`.
- Supabase menolak redirect setelah login: pastikan URL halaman `/free/` yang lengkap, termasuk trailing slash dan port lokal, sudah ada di **Redirect URLs** Supabase.
- Google menampilkan `Access blocked` atau aplikasi belum diverifikasi: saat mode Testing, tambahkan akun Google sebagai **Test user**. Untuk akses publik, selesaikan verifikasi/publikasi Google yang diminta.
- Pesan `provider is not enabled`: aktifkan provider Google di **Authentication → Providers → Google** dan simpan.
- Tombol login menyatakan perlu HTTPS: gunakan domain HTTPS atau `localhost`/`127.0.0.1`; jangan buka file dengan skema `file://`.

## Referensi Resmi

- [Supabase: Sign in with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase: Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Google: OAuth 2.0 untuk aplikasi web](https://developers.google.com/identity/protocols/oauth2/web-server)
