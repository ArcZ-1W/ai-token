const fs = require('fs');
const src = fs.readFileSync('D:\\!Web ai\\ai\\index.html', 'utf8');

/* Stub sama seperti uji, tetapi stream sengaja TIDAK ditutup supaya tombol silang tetap tampil
   untuk keperluan tangkapan layar. */
const head = `<script>
localStorage.clear();
localStorage.setItem("glassai.auth",JSON.stringify({u:"tester",p:"pw",t:"tok",admin:false,la:9,lo:9,ua:0,uo:0,exp:Date.now()+86400000}));
var rf=window.fetch;
window.fetch=function(u,o){
  u=String(u);
  if(u.indexOf("/chat/completions")>-1){
    var enc=new TextEncoder(),isi=[];
    var isiBalasan=[
      "Berikut contoh struktur folder proyek Anda:","",
      "1. index.html — kerangka halaman",
      "2. style.css — semua warna, jarak, dan tipografi",
      "3. app.js — logika interaksi dan pemanggilan API",
      "4. assets/ — gambar, ikon, dan font lokal",
      "",
      "Kalau proyeknya masih kecil, tiga berkas pertama sudah cukup.",
      "Pisahkan berkas hanya ketika satu berkas mulai sulit dibaca.",
      "",
      "Langkah berikutnya yang saya sarankan:"
    ];
    isiBalasan.forEach(function(t){isi.push("data: "+JSON.stringify({choices:[{delta:{content:t+"\\n"}}]})+"\\n\\n")});
    var st=new ReadableStream({start:function(c){
      var n=0;
      (function pump(){
        if(n>=isi.length){return}          /* berhenti di sini: stream tetap terbuka */
        try{c.enqueue(enc.encode(isi[n++]))}catch(e){return}
        setTimeout(pump,25);
      })();
    }});
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
setTimeout(function(){                      /* isi percakapan contoh */
  var i=document.getElementById("input");
  i.value="bagaimana struktur folder proyek yang rapi?";
  document.getElementById("send").click();
},700);
<\/script>`;

let out = src.replace('<canvas id="pfx"', head + '\n<canvas id="pfx"');
fs.writeFileSync('D:\\!Web ai\\_dev\\uji-stop-shot.html', out, 'utf8');
console.log('uji-stop-shot.html dibuat');
