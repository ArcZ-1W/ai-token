/* Pemeriksa tautan & aset untuk situs Xozen AI (dijalankan di Node). */
const fs = require('fs');
const path = require('path');

const ROOT = 'D:\\!Web ai';
const SKIP_DIRS = ['backup', '_dev', 'preview', 'node_modules', '.git'];

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (SKIP_DIRS.indexOf(e.name) === -1) walk(p, out); }
    else if (/\.html$/i.test(e.name)) out.push(p);
  }
  return out;
}

const pages = walk(ROOT, []);
const ids = {};
const raw = {};
for (const p of pages) {
  const t = fs.readFileSync(p, 'utf8');
  raw[p] = t;
  const set = new Set();
  for (const m of t.matchAll(/\sid="([^"]+)"/g)) set.add(m[1]);
  for (const m of t.matchAll(/\sname="([^"]+)"/g)) set.add(m[1]);
  ids[p] = set;
}

const problems = [];
let checked = 0;

for (const p of pages) {
  const t = raw[p].replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<pre[\s\S]*?<\/pre>/gi, '');
  const dir = path.dirname(p);
  const attrs = [...t.matchAll(/\s(?:href|src)="([^"]+)"/g)].map(m => m[1]);
  for (const a of attrs) {
    if (/^(https?:|mailto:|tel:|data:|javascript:|#)/i.test(a)) {
      if (a.startsWith('#') && a.length > 1 && !ids[p].has(a.slice(1))) problems.push(path.relative(ROOT, p) + ' â†’ anchor tidak ada: ' + a);
      continue;
    }
    checked++;
    const [filePart, frag] = a.split('#');
    const target = path.resolve(dir, filePart || path.basename(p));
    let file = target;
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) file = path.join(target, 'index.html');
    if (!fs.existsSync(file)) { problems.push(path.relative(ROOT, p) + ' â†’ berkas tidak ada: ' + a); continue; }
    if (frag) {
      const destIds = ids[file] || new Set([...fs.readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
      if (!destIds.has(frag)) problems.push(path.relative(ROOT, p) + ' â†’ anchor tidak ada di ' + path.relative(ROOT, file) + ': #' + frag);
    }
  }
  /* tag yang biasanya tidak seimbang */
  const open = (t.match(/<div\b/gi) || []).length, close = (t.match(/<\/div>/gi) || []).length;
  if (open !== close) problems.push(path.relative(ROOT, p) + ' â†’ div tidak seimbang: ' + open + ' buka / ' + close + ' tutup');
  if (!/<\/html>\s*$/i.test(t.trim())) problems.push(path.relative(ROOT, p) + ' â†’ tidak diakhiri </html>');
}

console.log('halaman diperiksa: ' + pages.length);
pages.forEach(p => console.log('  Â· ' + path.relative(ROOT, p) + ' (' + Math.round(raw[p].length / 1024) + ' KB)'));
console.log('tautan/aset lokal diperiksa: ' + checked);
console.log(problems.length ? '\nMASALAH (' + problems.length + '):\n  ' + problems.join('\n  ') : '\nSEMUA TAUTAN & ASET OK');
