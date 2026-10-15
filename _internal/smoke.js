/* Uji asap halaman situs: buka tiap halaman di Chrome, lalu periksa isi DOM. */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = 'D:\\!Web ai';
const TMP = path.join(ROOT, '_dev', 'tmp');
fs.mkdirSync(TMP, { recursive: true });

function dump(page, wait) {
  return new Promise((resolve) => {
    const prof = path.join(TMP, 'p' + Date.now() + Math.random().toString(36).slice(2, 7));
    const url = 'file:///' + page.replace(/\\/g, '/').replace(/ /g, '%20');
    const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--hide-scrollbars', '--disable-background-networking', '--force-prefers-reduced-motion', '--window-size=1280,900',
      '--user-data-dir=' + prof, '--crash-dumps-dir=' + path.join(TMP, 'crash'),
      '--dump-dom', '--timeout=' + (wait || 7000), url], { env: Object.assign({}, process.env, { TEMP: TMP, TMP: TMP }) });
    let buf = '';
    ch.stdout.on('data', (d) => { buf += d; });
    ch.stderr.on('data', () => {});
    ch.on('close', () => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {} resolve(buf); });
    setTimeout(() => { try { ch.kill(); } catch (e) {} }, (wait || 7000) + 25000);
  });
}

const count = (t, re) => (t.match(re) || []).length;
const fails = [];
function check(name, cond, detail) {
  console.log((cond ? 'OK   ' : 'GAGAL ') + name + (detail ? '  (' + detail + ')' : ''));
  if (!cond) fails.push(name);
}

(async () => {
  /* 1. landing */
  let t = await dump(path.join(ROOT, 'index.html'));
  check('landing: judul hero', /Semua model AI favoritmu/.test(t));
  check('landing: 6 kartu fitur', count(t, /class="card"/g) >= 6, count(t, /class="card"/g) + ' kartu');
  check('landing: 3 kartu harga', count(t, /class="plan/g) >= 3);
  check('landing: 3 kartu blog', count(t, /class="post"/g) === 3);
  check('landing: FAQ 5 item', count(t, /details class="faq"/g) === 5);
  check('landing: demo kode ada', /id="cdBody"/.test(t) && /class="cd-msg u"/.test(t) && /class="cd-msg code"/.test(t) && /Kopi Senja/.test(t));
  check('landing: tanpa gambar aplikasi', !/assets\//.test(t) && !/hero-shot/.test(t));
  check('landing: badge dihapus', !/Gratis dicoba/.test(t));
  check('landing: tautan ke aplikasi', /href="ai\/index\.html"/.test(t));
  check('landing: tautan harga & blog', /href="pricing\/index\.html"/.test(t) && /href="blog\/index\.html"/.test(t));
  check('landing: tidak ada teks rusak', !/undefined|\[object Object\]/.test(t));

  /* 2. harga */
  t = await dump(path.join(ROOT, 'pricing', 'index.html'));
  check('harga: 6 kartu paket', count(t, /class="plan[" ]/g) === 6, count(t, /class="plan[" ]/g) + ' kartu');
  check('harga: harga 3k/5k/7k/10k', /Rp 3\.000/.test(t) && /Rp 5\.000/.test(t) && /Rp 7\.000/.test(t) && /Rp 10\.000/.test(t));
  check('harga: daftar 31 model', count(t, /<span>/g) >= 31);
  check('harga: tombol WhatsApp', count(t, /wa\.me\/6289523042979/g) === 8, count(t, /wa\.me\/6289523042979/g) + ' tautan');
  check('harga: bagian ultra', /id="ultra"/.test(t));

  /* 3. blog */
  t = await dump(path.join(ROOT, 'blog', 'index.html'));
  check('blog: 3 artikel', count(t, /class="post"/g) === 3);
  check('blog: tautan artikel', /cara-menulis-prompt\.html/.test(t) && /memilih-model-coding\.html/.test(t) && /model-vision-gambar\.html/.test(t));

  /* 4. artikel */
  t = await dump(path.join(ROOT, 'blog', 'cara-menulis-prompt.html'));
  check('artikel: 4 bagian isi', count(t, /<h2 /g) === 4, count(t, /<h2 /g) + ' h2');
  check('artikel: daftar isi', /class="toc"/.test(t));
  check('artikel: blok CTA', /class="cta"/.test(t));
  check('artikel: contoh kode', count(t, /<pre>/g) >= 2, count(t, /<pre>/g) + ' blok kode');

  /* 5. aplikasi AI */
  t = await dump(path.join(ROOT, 'ai', 'index.html'), 9000);
  check('ai: markup aplikasi', /id="loginForm"/.test(t) && /id="modelPick"/.test(t) && /id="pricePage"/.test(t));
  check('ai: tombol beranda', /id="homeLink"/.test(t) && /href="\.\.\/index\.html"/.test(t));
  check('ai: tautan harga & blog', /href="\.\.\/pricing\/index\.html"/.test(t) && /href="\.\.\/blog\/index\.html"/.test(t));

  console.log(fails.length ? '\n' + fails.length + ' GAGAL: ' + fails.join(' | ') : '\nSEMUA UJI ASAP LULUS');
})();
