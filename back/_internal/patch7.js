const fs = require('fs');
const FILE = 'D:\\!Web ai\\ai\\index.html';
let s = fs.readFileSync(FILE, 'utf8');
const count = (n) => s.split(n).length - 1;
const CRLF = t => t.replace(/\r?\n/g, '\r\n');
function swap(anchor, block, label) {
  const n = count(anchor);
  if (n !== 1) throw new Error('[swap] ' + label + ' -> ' + n + ' (harus 1)');
  s = s.replace(anchor, () => block);
}
function before(anchor, block, label) {
  const n = count(anchor);
  if (n !== 1) throw new Error('[before] ' + label + ' -> ' + n + ' (harus 1)');
  s = s.replace(anchor, () => block + anchor);
}

/* ---------- 1. CSS ---------- */
const CSS = CRLF(`
/* ===== tombol silang melayang (hentikan jawaban) ===== */
.stopfloat{position:absolute;left:50%;bottom:calc(100% + 10px);z-index:6;width:48px;height:48px;border-radius:50%;
  display:none;place-items:center;cursor:pointer;color:var(--ink);
  border:1px solid var(--glass-edge);background:var(--glass-strong);
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);
  box-shadow:0 12px 30px rgba(0,0,0,.4);
  opacity:0;transform:translateX(-50%) scale(.86);
  transition:opacity .18s ease,transform .18s cubic-bezier(.2,.8,.2,1),background .15s,border-color .15s}
.stopfloat.show{display:grid;opacity:1;transform:translateX(-50%) scale(1);animation:sfIn .22s cubic-bezier(.2,.8,.2,1)}
@keyframes sfIn{from{opacity:0;transform:translateX(-50%) scale(.8)}to{opacity:1;transform:translateX(-50%) scale(1)}}
.stopfloat:hover{background:rgba(255,122,138,.3);border-color:rgba(255,122,138,.55)}
.stopfloat:active{transform:translateX(-50%) scale(.94)}
.stopfloat:focus-visible{outline:2px solid var(--accent-2);outline-offset:2px}
.stopfloat svg{width:21px;height:21px}
.stopfloat .lbl{position:absolute;top:calc(100% + 7px);left:50%;transform:translateX(-50%);white-space:nowrap;
  font:inherit;font-size:11.5px;font-weight:600;color:var(--ink-dim);background:rgba(8,11,24,.42);border:1px solid var(--glass-edge);
  padding:3px 9px;border-radius:999px;pointer-events:none}
html[data-theme^="neu"] .stopfloat{background:var(--bg);border:0;box-shadow:var(--raise-s)}
html[data-theme^="neu"] .stopfloat .lbl{background:var(--bg);border:0;box-shadow:var(--inset-xs)}
@media (max-width:820px){.stopfloat{width:44px;height:44px}.stopfloat .lbl{display:none}}
@media (prefers-reduced-motion:reduce){.stopfloat,.stopfloat.show{transition:none;animation:none}}
`);
before(CRLF('</style>\n</head>'), CSS, 'css7');

/* ---------- 2. markup tombol ---------- */
before('<div class="jump" id="jump">',
  CRLF(`<button type="button" class="stopfloat" id="stopFloat" title="Hentikan jawaban" aria-label="Hentikan jawaban">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        <span class="lbl">Hentikan</span>
      </button>
      `), 'markup stop');

/* ---------- 3. scroll mengikuti panjang jawaban ---------- */
swap(CRLF(`function toBottom(force){
  var near=feed.scrollHeight-feed.scrollTop-feed.clientHeight<140;
  if(force||near){feed.scrollTop=feed.scrollHeight}
}`),
CRLF(`var stick=true;                                  /* true = ikuti ujung bawah saat jawaban bertambah */
function nearBottom(px){return (feed.scrollHeight-feed.scrollTop-feed.clientHeight)<(px||64)}
function toBottom(force){
  if(force)stick=true;
  if(!stick)return;
  var sb=feed.style.scrollBehavior;
  feed.style.scrollBehavior="auto";              /* tanpa animasi: agar tidak tertinggal saat teks bertambah */
  feed.scrollTop=feed.scrollHeight;
  feed.style.scrollBehavior=sb||"";
}`), 'toBottom');

/* ---------- 4. status tombol saat streaming ---------- */
swap(CRLF(`function setBusy(v){
  busy=v;sendBtn.innerHTML=v?ICON_STOP:ICON_SEND;
  sendBtn.setAttribute("aria-label",v?"Hentikan":"Kirim");
  sendBtn.disabled=false;
}`),
CRLF(`function setBusy(v){
  busy=v;sendBtn.innerHTML=v?ICON_STOP:ICON_SEND;
  sendBtn.setAttribute("aria-label",v?"Hentikan":"Kirim");
  sendBtn.disabled=false;
  var sf=$("stopFloat");
  if(sf)sf.classList.toggle("show",!!v);
}
function stopStream(){
  if(busy&&ctrl)ctrl.abort();
}`), 'setBusy');

/* ---------- 5. handler tombol + Escape ---------- */
swap(CRLF(`sendBtn.onclick=function(){
  if(busy){if(ctrl)ctrl.abort();return}
  send(input.value);
};`),
CRLF(`sendBtn.onclick=function(){
  if(busy){stopStream();return}
  send(input.value);
};
$("stopFloat").onclick=stopStream;
document.addEventListener("keydown",function(e){
  if(e.key!=="Escape"||!busy)return;
  if(document.querySelector("dialog[open]"))return;
  var mp=document.getElementById("modelPick"),pp=document.getElementById("pricePage");
  if((mp&&mp.classList.contains("show"))||(pp&&pp.classList.contains("show")))return;
  e.preventDefault();stopStream();
});`), 'handler stop');

/* ---------- 6. pelacak gulir ---------- */
swap(CRLF('function updJump(){jump.classList.toggle("show",feed.scrollHeight-feed.clientHeight>120)}\nfeed.addEventListener("scroll",updJump,{passive:true});'),
CRLF(`var feedScrollLock=false;
feed.addEventListener("scroll",function(){
  if(feedScrollLock)return;
  var far=feed.scrollHeight-feed.scrollTop-feed.clientHeight>120;
  stick=!far;                                     /* pengguna menggulir ke atas: jangan tarik paksa */
  jump.classList.toggle("show",far);
},{passive:true});
new MutationObserver(function(){
  var far=feed.scrollHeight-feed.scrollTop-feed.clientHeight>120;
  jump.classList.toggle("show",far);
}).observe(feed,{childList:true,subtree:true,characterData:true});`), 'scroll tracker');

/* MutationObserver lama pada col tidak lagi diperlukan */
swap('new MutationObserver(updJump).observe(col,{childList:true,subtree:true,characterData:true});', '', 'hapus observer lama');
swap('window.addEventListener("resize",updJump);', 'window.addEventListener("resize",function(){var far=feed.scrollHeight-feed.scrollTop-feed.clientHeight>120;jump.classList.toggle("show",far)});', 'resize');

fs.writeFileSync(FILE, s, 'utf8');

/* ---------- verifikasi ---------- */
const out = fs.readFileSync(FILE, 'utf8');
const c2 = (n) => out.split(n).length - 1;
console.log('baris=' + out.split('\n').length + ' byte=' + Buffer.byteLength(out));
console.log('CRLF konsisten: ' + ((out.split('\n').length - 1) === out.split('\r\n').length - 1 ? 'ya' : 'TIDAK'));
new Function(out.slice(out.lastIndexOf('<script>') + 8, out.lastIndexOf('</script>')));
console.log('sintaks <script> utama: valid');
[['css stopfloat', '.stopfloat{position:absolute'], ['markup', 'id="stopFloat"'], ['stick', 'var stick=true;'],
 ['scroll auto', 'feed.style.scrollBehavior="auto"'], ['stopStream', 'function stopStream(){'],
 ['handler escape', 'if(e.key!=="Escape"||!busy)return;'], ['observer feed', 'observe(feed,{childList:true'], ['updJump lama', 'function updJump']]
  .forEach(function (p) { const n = c2(p[1]); const ok = p[0] === 'updJump lama' ? n === 0 : n > 0; console.log((ok ? 'OK   ' : 'CEK  ') + p[0] + ' x' + n); });
