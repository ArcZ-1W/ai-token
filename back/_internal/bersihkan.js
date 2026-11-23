/* Bersihkan sisa variabel tak terpakai (dilakukan lewat Node agar encoding UTF-8 aman). */
const fs = require('fs');
const FILE = 'D:\\!Web ai\\ai\\index.html';
let s = fs.readFileSync(FILE, 'utf8');
const before = s.length;

s = s.replace('var feedScrollLock=false;\r\nfeed.addEventListener("scroll",function(){\r\n  if(feedScrollLock)return;\r\n', 'feed.addEventListener("scroll",function(){\r\n');

fs.writeFileSync(FILE, s, 'utf8');
const out = fs.readFileSync(FILE, 'utf8');
console.log('feedScrollLock tersisa: ' + (out.match(/feedScrollLock/g) || []).length);
console.log('updJump tersisa: ' + (out.match(/updJump/g) || []).length);
console.log('baris=' + out.split('\n').length + ' byte=' + Buffer.byteLength(out));
console.log('CRLF konsisten: ' + ((out.split('\n').length - 1) === out.split('\r\n').length - 1 ? 'ya' : 'TIDAK'));
new Function(out.slice(out.lastIndexOf('<script>') + 8, out.lastIndexOf('</script>')));
console.log('sintaks valid');
console.log('karakter rusak: ' + (out.match(/Ã|â€|ðŸ/g) || []).length);
