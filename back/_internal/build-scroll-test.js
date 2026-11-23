const fs = require('fs');
const src = fs.readFileSync('D:\\!Web ai\\ai\\index.html', 'utf8');

/* Sesi palsu + fetch tiruan: balasan streaming panjang (SSE) supaya scroll benar-benar diuji. */
const head = `<script>
localStorage.clear();
localStorage.setItem("glassai.auth",JSON.stringify({u:"tester",p:"pw",t:"tok",admin:false,la:9,lo:9,ua:0,uo:0,exp:Date.now()+86400000}));
window.__req=[];window.__alert=[];window.alert=function(m){window.__alert.push(m)};
window.__stop=[];
window.XMLHttpRequest=function(){var s=this;this.upload={};this.open=function(m,u){s._u=u};this.setRequestHeader=function(){};this.send=function(){setTimeout(function(){s.status=200;s.responseText=JSON.stringify({files:[{url:"https://d.uguu.se/x.png"}]});s.readyState=4;if(s.onload)s.onload()},30)}};
var rf=window.fetch;
window.fetch=function(u,o){
  u=String(u);
  if(u.indexOf("/chat/completions")>-1){
    window.__req.push(1);
    var enc=new TextEncoder(),isi=[];
    for(var i=1;i<=45;i++)isi.push("data: "+JSON.stringify({choices:[{delta:{content:"Baris "+i+" dari jawaban panjang. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.\\n"}}]})+"\\n\\n");
    isi.push("data: [DONE]\\n\\n");
    var st=new ReadableStream({
      start:function(c){
        var n=0;
        (function pump(){
          if(o&&o.signal&&o.signal.aborted){window.__stop.push(n);try{c.close()}catch(e){}return}
          if(n>=isi.length){try{c.close()}catch(e){}return}
          try{c.enqueue(enc.encode(isi[n++]))}catch(e){return}
          setTimeout(pump,20);
        })();
      }
    });
    return Promise.resolve(new Response(st,{status:200,headers:{"Content-Type":"text/event-stream"}}));
  }
  if(u.indexOf("/rpc/")>-1){
    var fn=u.split("/rpc/")[1],out={};
    if(fn==="app_cfg_get")out={base_url:"https://api.uji/v1",api_key:"k",models:["auto","gpt-5.6"],pin_limit:1};
    else if(fn==="app_plan_get")out={plan:"best"};
    else if(fn==="app_pins_list")out=[];
    else if(fn==="app_tour_status")out={is_new:false};
    else out={username:"tester",is_admin:false,limit_auto:9,limit_other:9,used_auto:1,used_other:0,expires_at:new Date(Date.now()+86400000).toISOString()};
    return Promise.resolve(new Response(JSON.stringify(out),{status:200,headers:{"Content-Type":"application/json"}}));
  }
  return rf.apply(window,arguments);
};
<\/script>`;

const test = `<script>
window.__log=[];function log(o){window.__log.push(o)}
function done(){document.title="HASIL "+window.__log.join(" | ")}
window.addEventListener("error",function(e){log("JS-ERROR:"+e.message)});
var feed=document.getElementById("feed"),sf=document.getElementById("stopFloat");
function sisa(){return Math.round(feed.scrollHeight-feed.scrollTop-feed.clientHeight)}
function mulai(teks){document.getElementById("input").value=teks;document.getElementById("send").click()}
var sampel=[],sfSaatStream=[];
setTimeout(function(){
  mulai("uji scroll");
  var t=setInterval(function(){
    sampel.push(sisa());
    sfSaatStream.push(sf.classList.contains("show")?1:0);
    if(window.__req.length&&!document.getElementById("send").getAttribute("aria-label").match(/Hentikan/)){
      clearInterval(t);
      log("sisa-jarak-terjauh="+Math.max.apply(null,sampel));
      log("sisa-jarak-akhir="+sampel[sampel.length-1]);
      log("tombol-silang-muncul="+(sfSaatStream.indexOf(1)>-1));
      log("tombol-silang-setelah-selesai="+sf.classList.contains("show"));
      log("balasan-panjang="+(document.querySelectorAll(".msg.bot .bubble").length>0));
      // ---- uji 2: hentikan di tengah stream ----
      setTimeout(function(){
        mulai("uji hentikan");
        setTimeout(function(){
          var aktif=sf.classList.contains("show");
          log("silang-muncul-saat-stream="+aktif);
          sf.click();
          setTimeout(function(){
            log("setelah-klik-silang: tombol-tersembunyi="+!sf.classList.contains("show")+" permintaan="+window.__req.length+" dihentikan="+(window.__stop.length>0));
            // ---- uji 3: Escape ----
            mulai("uji escape");
            setTimeout(function(){
              document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
              setTimeout(function(){
                log("escape-menghentikan="+!sf.classList.contains("show"));
                log("errors="+(window.__log.filter(function(x){return /JS-ERROR/.test(x)}).length?window.__log.join(";"):"tidak ada"));
                done();
              },400);
            },700);
          },500);
        },700);
      },400);
    }
  },60);
  setTimeout(function(){clearInterval(t);log("timeout-uji");done()},20000);
},1200);
<\/script>`;

let out = src.replace('<canvas id="pfx"', head + '\n<canvas id="pfx"');
out = out.replace('</body>', test + '\n</body>');
fs.writeFileSync('D:\\!Web ai\\_dev\\uji-scroll.html', out, 'utf8');
console.log('uji-scroll.html dibuat');
