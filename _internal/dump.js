/* Buka halaman di Chrome headless (waktu nyata) lalu tulis DOM ke berkas. */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const page = process.argv[2];
const out = process.argv[3];
const wait = parseInt(process.argv[4] || '15000', 10);
const TMP = path.join('D:\\!Web ai', '_dev', 'tmp');
fs.mkdirSync(TMP, { recursive: true });
const prof = path.join(TMP, 'p' + Date.now());
const url = 'file:///' + page.replace(/\\/g, '/').replace(/ /g, '%20');

const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required',
  '--window-size=1200,900', '--user-data-dir=' + prof, '--crash-dumps-dir=' + path.join(TMP, 'crash')]
  .concat(process.env.VT === '1' ? ['--dump-dom', '--virtual-time-budget=' + wait] : ['--dump-dom', '--timeout=' + wait])
  .concat([url]),
  { env: Object.assign({}, process.env, { TEMP: TMP, TMP: TMP }) });

let buf = '';
ch.stdout.on('data', (d) => { buf += d; });
ch.stderr.on('data', () => {});
ch.on('close', () => {
  fs.writeFileSync(out, buf, 'utf8');
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
  console.log('DOM ' + buf.length + ' byte → ' + path.basename(out));
});
setTimeout(() => { try { ch.kill(); } catch (e) {} }, wait + 30000);
