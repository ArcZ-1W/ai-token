# Xozen AI â€” struktur situs

Situs statis (HTML/CSS/JS biasa). Tidak perlu build tool: cukup unggah berkasnya ke hosting
(Vercel, Netlify, Cloudflare Pages, GitHub Pages, cPanel, dsb).

## Peta halaman

| URL | Berkas | Isi |
|---|---|---|
| `/` | `index.html` | Pemilih layanan; Xozen AI membuka landing page AI yang ada, ArcZ Community membuka halaman chat |
| `/ai/` | `ai/index.html` | **Aplikasi AI** (chat, login, verifikasi wajah, wizard admin, paket) |
| `/community/` | `community/index.html` | **ArcZ Community** (akun email/password terpisah dari login Xozen AI dan chat realtime) |
| `/free/` | `free/index.html` | Chat gratis MinimumLite dengan akun sementara anonim |
| `/pricing/` | `pricing/index.html` | Halaman harga lengkap: 6 paket Basic/Best, daftar model, paket Ultra, FAQ |
| `/blog/` | `blog/index.html` | Daftar artikel |
| `/blog/cara-menulis-prompt.html` | | Artikel: cara menulis prompt |
| `/blog/memilih-model-coding.html` | | Artikel: memilih model untuk coding |
| `/blog/model-vision-gambar.html` | | Artikel: model vision / kirim gambar |

Aset bersama: `site.css` (gaya situs), `site.js` (menu mobile, FAQ, tahun footer, animasi demo ketik di hero). Halaman pemasaran tidak memakai gambar aplikasi — hero memakai animasi ketik kode yang dibuat oleh `site.js`.

## Berkas yang diunggah (deploy)

```
index.html
site.css
site.js
robots.txt
ai/              (aplikasi AI)
community/       (chat ArcZ Community)
free/            (MinimumLite gratis)
pricing/
blog/
```

**Jangan diunggah:**

| Berkas/folder | Alasan |
|---|---|
| `supabase-member-plan.sql` | skrip database (tidak untuk publik) |
| `supabase-member-models.sql` | skrip database (tidak untuk publik) |
| `community/schema.sql` | skrip database (tidak untuk publik) |
| `_internal/` | arsip lama, tangkapan layar, dan skrip uji lokal |
| `supabase-api-keys.sql` | migrasi database API key eksternal (jalankan di Supabase SQL Editor) |
| `supabase/functions/` | source Supabase Edge Function (deploy dengan Supabase CLI) |

Tambahkan aturan hosting agar `/_internal/` tidak dapat diakses bila folder itu tetap ikut terunggah.

## Setelah domain aktif

1. **Meta tag**: ganti/tambahkan `og:url` dan `<link rel="canonical">` di setiap halaman
   memakai domain final (mis. `https://xozen.ai/ai/`). Saat ini keduanya sengaja dikosongkan
   karena domain belum diketahui.
2. **Sitemap**: aktifkan baris `Sitemap:` di `robots.txt` setelah `sitemap.xml` dibuat.
3. **Pratinjau WhatsApp**: uji tautan di Facebook Sharing Debugger agar cache pratinjau
   (judul, deskripsi, logo) diperbarui.
4. **HTTPS wajib** untuk aplikasi di `/ai/`: kamera (verifikasi wajah) hanya berjalan di
   `https://` atau `localhost`.

## Alur aplikasi (`/ai/`)

1. Pengunjung membuka `/ai/` â†’ layar login. Ada tautan **Lihat paket & harga** (overlay) dan
   tautan ke halaman `/pricing/`, `/blog/`, serta **Beranda** di sidebar.
2. Login â†’ verifikasi wajah (diproses di browser, yang dikirim hanya descriptor angka).
3. Di dalam aplikasi: pilih model (popup dengan pencarian, filter, favorit, riwayat),
   kirim pesan/lampiran (gambar dikirim ke model, video â†’ cuplikan + tautan).
4. Admin membuka **Dashboard Admin** â†’ wizard paket (Basic/Best) untuk membuat akun.

Supabase (paket per akun + penanda pengguna baru) diaktifkan dengan menjalankan
`supabase-member-plan.sql` **sekali** di SQL Editor.

Untuk mengizinkan model tambahan pada akun member, jalankan `supabase-member-models.sql`
sekali di SQL Editor. Admin perlu menambahkan ID model lewat bagian **Model AI** di
dashboard, lalu memilih **Model custom** pada baris akun member. Model yang ditetapkan
muncul hanya pada akun tersebut dan memakai kuota **Model lain**.

### API untuk coding agent dan tool eksternal

Menu **API Key** pada aplikasi membuat key pribadi per akun Xozen. Endpoint kompatibel dengan
OpenAI Chat Completions, Anthropic Messages, daftar model, dan pemeriksaan kuota. Akses model
mengikuti paket akun; setiap completion berhasil memakai satu unit kuota seperti chat web.
Key mentah hanya ditampilkan saat dibuat, sedangkan database hanya menyimpan hash-nya.

Fitur ini memerlukan backend Supabase dan tidak aktif hanya dengan mengunggah berkas statis:

1. Jalankan `supabase-api-keys.sql` sekali di Supabase SQL Editor setelah skema inti akun
   Xozen (fungsi `app_login` dan tabel `accounts`) tersedia.
2. Pasang Supabase CLI, login, lalu dari root proyek jalankan
   `supabase functions deploy xozen-api --project-ref <PROJECT_REF>`.
3. Isi secrets Edge Function dengan upstream Base URL dan API key yang sama dengan provider
   di **Pengaturan** admin aplikasi:
   `supabase secrets set XOZEN_UPSTREAM_BASE_URL="https://provider.example/v1" XOZEN_UPSTREAM_API_KEY="<provider-key>" --project-ref <PROJECT_REF>`.
   Supabase menyediakan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` untuk Edge Function.
4. Endpoint API akun: `https://<PROJECT_REF>.supabase.co/functions/v1/xozen-api/v1`.
   Kelola key dan salin konfigurasi OpenCode, OpenClaw, Claude Code, 9Router, atau Hermes
   lewat menu **API Key** setelah login.

Jika Base URL atau API key provider admin berubah, secrets Edge Function juga harus diperbarui.
Jangan gunakan provider key admin sebagai API key di tool pengguna; gunakan key `xz_live_...`
yang dibuat per akun. `MinimumLite` gratis tidak disediakan lewat endpoint eksternal.

### ArcZ Community

Jalankan `community/schema.sql` sekali di Supabase SQL Editor untuk membuat tabel chat,
kebijakan akses RLS, dan mengaktifkan realtime. Pastikan provider Email aktif di Supabase
Auth dan matikan **Confirm email** agar akun baru langsung bisa digunakan tanpa verifikasi
email. Community memakai Supabase Auth dengan session key tersendiri; login Xozen AI tetap
menggunakan akun aplikasi AI dan tidak dibagikan ke Community.

### Akun sementara untuk `/free/`

Panduan lengkap: [PANDUAN-AKUN-SEMENTARA.md](PANDUAN-AKUN-SEMENTARA.md).

Aktifkan **Anonymous Sign-Ins** di Supabase **Authentication → Sign In / Providers**. Halaman lalu membuat sesi anonim tanpa email, password, atau Google. Sesi tersimpan di browser; jika pengguna keluar atau menghapus data browser, akun itu tidak bisa dipulihkan. Record akun anonim tetap berada di `auth.users` sampai dihapus, jadi siapkan CAPTCHA dan pembersihan berkala sebelum membuka layanan untuk publik.

## Uji lokal

```bash
# dari folder ini
npx serve .          # lalu buka http://localhost:3000
# atau
python -m http.server 8080
```

Membuka `index.html` langsung dari berkas (file://) juga jalan, tetapi kamera dan beberapa
fitur browser hanya aktif lewat `http(s)://`.
