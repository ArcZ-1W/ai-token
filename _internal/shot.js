/* Tangkapan layar halaman situs (profil & berkas sementara di drive D). */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const page = process.argv[2];
const out = process.argv[3];
const w = process.argv[4] || '1280';
const h = process.argv[5] || '2000';
const wait = process.argv[6] || '4000';
const TMP = path.join('D:\\!Web ai', '_dev', 'tmp');
fs.mkdirSync(TMP, { recursive: true });
const prof = path.join(TMP, 'p' + Date.now());
const url = 'file:///' + page.replace(/\\/g, '/').replace(/ /g, '%20');

const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--force-device-scale-factor=1', '--disable-background-networking',
  '--window-size=' + w + ',' + h, '--user-data-dir=' + prof, '--crash-dumps-dir=' + path.join(TMP, 'crash'),
  '--screenshot=' + out, '--virtual-time-budget=' + wait]
  .concat(process.env.SHOT_MOTION === '1' ? [] : ['--force-prefers-reduced-motion'])
  .concat([url]),
  { env: Object.assign({}, process.env, { TEMP: TMP, TMP: TMP }) });

ch.on('close', () => {
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
  const ok = fs.existsSync(out);
  console.log((ok ? 'ok' : 'GAGAL') + ': ' + path.basename(out) + (ok ? ' ' + Math.round(fs.statSync(out).length / 1024) + ' KB' : ''));
});
setTimeout(() => { try { ch.kill(); } catch (e) {} }, parseInt(wait, 10) + 30000);
