# Xozen AI â€” struktur situs

Situs statis (HTML/CSS/JS biasa). Tidak perlu build tool: cukup unggah berkasnya ke hosting
(Vercel, Netlify, Cloudflare Pages, GitHub Pages, cPanel, dsb).

## Peta halaman

| URL | Berkas | Isi |
|---|---|---|
| `/` | `index.html` | Pemilih layanan; Xozen AI membuka landing page AI yang ada, ArcZ Community membuka halaman chat, Xozen Planner membuka Plan AI |
| `/ai/` | `ai/index.html` | **Aplikasi AI** (chat, login, verifikasi wajah, wizard admin, paket Basic/Plus/Pro/Ultra Coder + Plan AI) |
| `/community/` | `community/index.html` | **ArcZ Community** (akun email/password terpisah dari login Xozen AI dan chat realtime) |
| `/plan/` | `plan/index.html` | **Xozen Planner (Plan AI)** — ubah ide fitur jadi rencana siap build; masuk lewat akun Xozen AI, kuota harian Pro/Ultra Coder |
| `/free/` | `free/index.html` | Chat gratis MinimumLite dengan akun sementara anonim |
| `/pricing/` | `pricing/index.html` | Halaman harga lengkap: Basic gratis, Plus, Pro, Ultra Coder, daftar model, FAQ |
| `/blog/` | `blog/index.html` | Daftar artikel |
| `/blog/cara-menulis-prompt.html` | | Artikel: cara menulis prompt |
| `/blog/memilih-model-coding.html` | | Artikel: memilih model untuk coding |
| `/blog/model-vision-gambar.html` | | Artikel: model vision / kirim gambar |

Aset bersama: `site.css` (gaya situs), `site.js` (menu mobile, FAQ, tahun footer, animasi demo ketik di hero), `glass.css` + `glass.js` (tampilan kaca / glassmorphism), `glass-app.css` (tampilan kaca khusus aplikasi AI). Halaman pemasaran tidak memakai gambar aplikasi — hero memakai animasi ketik kode yang dibuat oleh `site.js`.

## Glass UI (glassmorphism)

Tampilan kaca di seluruh situs memakai adaptasi dari React Bits
[Glass Surface](https://www.reactbits.dev/components/glass-surface). Situs ini tidak memakai
React, jadi efeknya ditulis ulang tanpa dependensi:

| Berkas | Isi |
|---|---|
| `glass.css` | Primitif `.glass-surface` + gaya kaca untuk semua panel halaman pemasaran (card, plan, step, post, faq, band, tombol, header, dst) |
| `glass.js` | Pembuat filter SVG (displacement map + `feDisplacementMap`) yang membuat latar di belakang panel **dibelokkan** di tepinya, plus pantulan cahaya yang mengikuti kursor |
| `glass-app.css` | Lapisan kaca tambahan untuk aplikasi AI (`/ai/`) — rim cahaya + kilau, hanya untuk tema `glass` / `glassold` / `glasswhite` |

Cara memberi efek kaca pada elemen baru:

```html
<!-- frosted glass (default, ringan) -->
<div class="card">...</div>

<!-- refraction penuh: latar dibelokkan di tepi (berat, pakai untuk hero) -->
<div class="service-option" data-glass="refract">...</div>
```

Opsi per elemen: `data-glass-radius`, `data-glass-blur`, `data-glass-distortion`,
`data-glass-saturation`. Tanpa JavaScript (atau di Safari/Firefox yang tidak mendukung
`backdrop-filter: url(#filter)`) semua panel otomatis turun ke mode frosted biasa.

## Berkas yang diunggah (deploy)

```
index.html
site.css
site.js
glass.css
glass.js
glass-app.css
robots.txt
ai/              (aplikasi AI)
community/       (chat ArcZ Community)
plan/            (Xozen Planner / Plan AI)
free/            (MinimumLite gratis)
pricing/
blog/
```

**Jangan diunggah:**

| Berkas/folder | Alasan |
|---|---|
| `supabase-member-plan.sql` | skrip database (tidak untuk publik) |
| `supabase-member-plan-v2.sql` | skrip database v2 — paket baru + kuota Plan AI (tidak untuk publik) |
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

### Model bermask (Xozen Code & Xozen Mini)

Beberapa model punya nama panggilan (mask) sendiri. Di pemilih model tampil sebagai
nama panggilan, tapi request ke API tetap memakai ID model aslinya, dan **model aslinya
tetap bisa dipilih sendiri**:

| Nama tampilan | ID model yang dikirim | Paket |
|---|---|---|
| Xozen Code | `kimi-k2.7-code-highspeed` | Best |
| Xozen Mini | `hy3` | Basic & Best |

Keterangan:

- Kuota dihitung mengikuti model aslinya (kuota **Model lain**), bukan kuota Xozen AI.
- Keterbukaan paket mengikuti model aslinya, jadi Xozen Code hanya muncul di paket Best.
- Mask tidak bisa dihapus di panel admin. Kalau model aslinya dihapus dari daftar,
  mask-nya ikut hilang supaya tidak membuka model yang sengaja ditutup.

Tambah mask baru: ubah `MODEL_MASK` di `ai/index.html` (isi `ID model` → `nama panggilan`),
lalu tambahkan juga ke `MASK_LABEL` dan `BUILTIN_MODELS`.

Untuk mengizinkan model tambahan pada akun member, jalankan `supabase-member-models.sql`
sekali di SQL Editor. Admin perlu menambahkan ID model lewat bagian **Model AI** di
dashboard, lalu memilih **Model custom** pada baris akun member. Model yang ditetapkan
muncul hanya pada akun tersebut dan memakai kuota **Model lain**.

### ArcZ Community

Jalankan `community/schema.sql` sekali di Supabase SQL Editor untuk membuat tabel chat,
kebijakan akses RLS, dan mengaktifkan realtime. Pastikan provider Email aktif di Supabase
Auth dan matikan **Confirm email** agar akun baru langsung bisa digunakan tanpa verifikasi
email. Community memakai Supabase Auth dengan session key tersendiri; login Xozen AI tetap
menggunakan akun aplikasi AI dan tidak dibagikan ke Community.

**Community memakai nama pengguna + password, tanpa email.** Formulirnya tidak punya
kolom email sama sekali, dan nama pengguna hanya boleh huruf, angka, titik, garis bawah,
atau strip (3–30 karakter).

Supabase Auth tetap memerlukan alamat email di belakang layar, jadi aplikasi membuat
alamat sintetis `<nama-pengguna>@community.arcz.invalid` untuk masuk. Alamat ini tidak
pernah ditampilkan ke pengguna, dan nama aslinya diambil dari `user_metadata.username`.

| Yang dilihat pengguna | Nilai |
|---|---|
| Field form | `Nama pengguna` + `Password` (+ `Nama tampilan` saat daftar) |
| Alamat dikirim ke Supabase | `<nama-pengguna>@community.arcz.invalid` |
| Disimpan di `user_metadata` | `username`, `display_name` |
| Ditampilkan di sidebar | `display_name` atau `username` (tanpa domain sintetis) |

Catatan: akun Community yang dibuat **sebelum** pindah ke nama pengguna (yang memakai
alamat email asli) tidak bisa masuk lagi — buat ulang lewat form Daftar.

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
