# Xozen AI â€” struktur situs

Situs statis (HTML/CSS/JS biasa). Tidak perlu build tool: cukup unggah berkasnya ke hosting
(Vercel, Netlify, Cloudflare Pages, GitHub Pages, cPanel, dsb).

## Peta halaman

| URL | Berkas | Isi |
|---|---|---|
| `/` | `index.html` | Pemilih layanan; Xozen AI membuka landing page AI yang ada, ArcZ Community membuka halaman chat |
| `/auth/` | `auth/index.html` | Callback verifikasi email Community, lalu mengarahkan sesi valid ke chat |
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
auth/             (callback verifikasi email Community)
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

### ArcZ Community

Jalankan `community/schema.sql` sekali di Supabase SQL Editor untuk membuat tabel chat,
kebijakan akses RLS, dan mengaktifkan realtime. Pastikan provider Email aktif di Supabase
Auth. Community memakai Supabase Auth dengan session key tersendiri; login Xozen AI tetap
menggunakan akun aplikasi AI dan tidak dibagikan ke Community.
Tambahkan `https://xozen.web.id/auth?tokenrahasia=true` ke daftar **Redirect URLs** Supabase
Auth. Callback hanya meneruskan pengguna ke chat jika Supabase berhasil memulihkan sesi
Community; parameter `tokenrahasia=true` sendiri bukan token autentikasi.

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
