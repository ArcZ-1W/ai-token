/* ==========================================================================
   Xozen Admin Console — admin/admin.js
   Dashboard admin Xozen AI: ringkasan, kelola akun, RASUK ACCOUNT
   (paksa masuk ke akun member), model AI, wizard buat akun, pengaturan.

   Butuh di Supabase SQL Editor (sekali):
     supabase-member-plan.sql, supabase-member-plan-v2.sql,
     supabase-member-models.sql, supabase-face-admin.sql,
     supabase-rasuk-account.sql   <-- fitur rasuk
   ========================================================================== */
(function () {
"use strict";

/* ------------------------------------------------------------ konfigurasi */
var SUPA_URL = "https://beqlxnlhvarjhkuxndmr.supabase.co";
var SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlcWx4bmxodmFyamhrdXhuZG1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMjQ4ODgsImV4cCI6MjEwNjcwMDg4OH0.FxPj-dfPf6OnfPotgQxFafd7Fx9yIM6oqMm25xMRslw";

var AUTH_KEY = "glassai.auth";
var SET_KEY  = "glassai.settings";
var SESS_KEY = "xozadmin.session";     /* sesi dashboard (tanpa password disimpan) */

var TOK = 1000, TOK_MAX_USES = 999999, tokCache = {};
var THEMES = ["glasswhite", "glassold", "glass", "neu", "neulight"];

var BUILTIN_MODELS = ["auto", "minimumlite", "xozen-code", "xozen-low", "xozen-mini"];
var MODEL_MASK = { "xozen-code": "kimi-k2.7-code-highspeed", "xozen-low": "hy3", "xozen-mini": "glm-5.3-flash" };
var MASK_LABEL = { "xozen-code": "Xozen Code", "xozen-low": "XozenLow", "xozen-mini": "Xozen Mini" };
var LOCKED = BUILTIN_MODELS.slice();

var PLAN_MODELS = {
  basic: ["kimi-k2.5","kimi-k2.6","kimi-k2.7-code","mimo-v2.5-pro","hy3","hy4","glm-5.3","glm-5.2","deepseek-v4-pro"],
  best: ["deepseek-v4-flash","deepseek-v4-flash-0731","deepseek-v4-mod","deepseek-v4-pro","deepseek-v4-pro-0813","deepseek-v4.1-mod","glm-5.2","glm-5.2-mod","glm-5.3","glm-5.3-mod","hy3","hy4","kimi-k2.5","kimi-k2.6","kimi-k2.7-code","kimi-k2.7-code-highspeed","mimo-v2.5-pro","deepseek-v4-flash-vision-exp","deepseek-v4.1-flash","glm-5.3-flash","glm-5.3-flash-mod","glm-5.3-flashx","glm-5.3-flashx-mod","gpt-5.6","gpt-5.6-luna","gpt-5.6-luna-b","kimi-k2.8","kimi-k3-mod","mimo-v2.6-flash","mimo-v2.6-pro","step-5-preview"]
};
var NEW_PLANS = {
  free:  { tokens: 7,  price: "Gratis",    pins: 0, planai: 0,  tag: "Mulai gratis" },
  plus:  { tokens: 15, price: "Rp 5.000",  pins: 1, planai: 0,  tag: "Terlaris", best: true },
  pro:   { tokens: 30, price: "Rp 10.000", pins: 1, planai: 5,  tag: "Plan AI 5.000 token/hari" },
  ultra: { tokens: 50, price: "Rp 20.000", pins: 3, planai: 15, tag: "Semua model terbuka" }
};
var FREE_MODELS = ["auto", "minimumlite", "xozen-low"];
var PLUS_MODELS = FREE_MODELS.concat(["xozen-mini"], PLAN_MODELS.basic);
var PRO_MODELS  = FREE_MODELS.concat(["xozen-mini", "xozen-code"], PLAN_MODELS.best);

var WA_ADMIN = "6289523042979";
var APP_LINK = new URL("../ai/index.html", location.href).href;

/* ------------------------------------------------------------ util dasar */
function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function load(k, f) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function xozFmt(n) { return Math.round(+n || 0).toLocaleString("id-ID"); }
function isMaks(v) { return +v >= TOK_MAX_USES - 1; }
function limParse(v) {
  v = (v || "").trim().toLowerCase();
  if (v === "maks" || v === "unlimited" || v === "\u221e") return TOK_MAX_USES;
  var n = parseInt(v, 10);
  return !isNaN(n) && n >= 0 ? n : null;
}
function tokHash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function tokRng(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function tokParts(user, kind, limit) {
  limit = Math.max(0, Math.floor(+limit || 0));
  var key = user + "|" + kind + "|" + limit;
  if (tokCache[key]) return tokCache[key];
  var rnd = tokRng(tokHash("xoz:" + user + ":" + kind)), d = [], sum = 0, i;
  for (i = 0; i < limit; i++) { var v = (rnd() * 2 - 1) * 480; d.push(v); sum += v; }
  var mean = limit ? sum / limit : 0, out = [], tot = 0;
  for (i = 0; i < limit; i++) { out.push(Math.floor(TOK + d[i] - mean)); tot += out[i]; }
  var rem = limit * TOK - tot;
  for (i = 0; rem > 0 && i < limit; i++, rem--) out[i]++;
  tokCache[key] = out; return out;
}
function tokUsed(user, kind, limit, used) {
  var p = tokParts(user, kind, limit), n = Math.max(0, Math.min(p.length, Math.floor(+used || 0))), s = 0;
  for (var i = 0; i < n; i++) s += p[i];
  return s;
}
function fmtLeft(ms) {
  var s = Math.floor((ms - Date.now()) / 1000);
  if (s <= 0) return "kedaluwarsa";
  var u = [["y", 31536000], ["d", 86400], ["h", 3600], ["m", 60], ["s", 1]], o = [];
  for (var i = 0; i < u.length && o.length < 2; i++) { var v = Math.floor(s / u[i][1]); if (v > 0 || o.length) { o.push(v + u[i][0]); s -= v * u[i][1]; } }
  return o.join(" ");
}
var UNIT = { s: 1, m: 60, h: 3600, d: 86400, y: 31536000 };
function parseDur(t) {
  t = (t || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!/^(\d+[smhdy])+$/.test(t)) return null;
  var n = 0; t.replace(/(\d+)([smhdy])/g, function (_, x, u) { n += x * UNIT[u]; });
  return n > 0 ? n : null;
}
var DURERR = "Masa aktif tidak valid. Contoh: 30d, 12h, 1y, 1d12h.";

function isNewPlan(p) { return p === "free" || p === "plus" || p === "pro" || p === "ultra"; }
function planLabel(p) {
  return p === "free" ? "Basic" : p === "plus" ? "Plus" : p === "pro" ? "Pro"
    : p === "ultra" ? "Ultra Coder" : p === "best" ? "Best Value (lama)"
    : p === "basic" ? "Basic (lama)" : "belum diset";
}
function planModels(p) {
  if (p === "free") return FREE_MODELS.slice();
  if (p === "plus") return PLUS_MODELS.slice();
  if (p === "pro") return PRO_MODELS.slice();
  if (p === "ultra") return null;
  return PLAN_MODELS[p] || PLAN_MODELS.basic;
}
function planCount(p) {
  var m = planModels(p);
  if (!m) return MODELS.length;
  var n = 0;
  m.forEach(function (x) { if (MODEL_MASK[x] || !brandOfRaw(x)) n++; });
  return n;
}
function brandOfRaw(m) {
  if (MODEL_MASK[m]) return null;
  for (var k in MODEL_MASK) if (MODEL_MASK[k] === m) return k;
  return null;
}
var MODELS = BUILTIN_MODELS.slice();

/* ------------------------------------------------------------ toast/modal */
function toast(msg, kind, ms) {
  var box = $("toasts");
  var d = document.createElement("div");
  d.className = "toast " + (kind || "");
  d.textContent = msg;
  box.appendChild(d);
  setTimeout(function () { d.remove(); }, ms || 4200);
}
var modalEl = $("modal");
function modal(title, bodyNode, footNodes) {
  $("mTitle").textContent = title;
  var b = $("mBody"); b.innerHTML = "";
  if (typeof bodyNode === "string") b.innerHTML = bodyNode; else if (bodyNode) b.appendChild(bodyNode);
  var f = $("mFoot"); f.innerHTML = "";
  (footNodes || []).forEach(function (n) { f.appendChild(n); });
  modalEl.hidden = false;
  return { close: function () { modalEl.hidden = true; } };
}
function closeModal() { modalEl.hidden = true; }
$("mX").onclick = closeModal;
modalEl.addEventListener("click", function (e) { if (e.target === modalEl) closeModal(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modalEl.hidden) closeModal(); });

function mkBtn(label, cls, fn) {
  var b = document.createElement("button");
  b.type = "button"; b.className = "btn " + (cls || ""); b.textContent = label;
  b.onclick = fn; return b;
}
function copyText(txt) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt);
  var ta = document.createElement("textarea");
  ta.value = txt; document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  ta.remove(); return Promise.resolve();
}

/* ------------------------------------------------------------ supabase RPC */
function rpc(fn, args) {
  if (!SUPA_URL || !SUPA_KEY) return Promise.reject(new Error("Supabase belum dikonfigurasi."));
  return fetch(SUPA_URL.replace(/\/+$/, "") + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(args || {})
  }).then(function (r) {
    return r.text().then(function (t) {
      var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
      if (!r.ok) {
        var msg = (j && (j.message || j.hint)) || ("Error " + r.status);
        var err = new Error(msg); err.code = j && j.code; err.status = r.status; err.hint = j && j.hint;
        throw err;
      }
      return j;
    });
  });
}
function isMissingFn(e) {
  return !!(e && (e.status === 404 || e.code === "PGRST202" ||
    /could not find the function|does not exist|schema cache/i.test(e.message || "")));
}

var session = null;          /* {u,p,t,admin} */
function rpcAdmin(fn, args) { return rpc(fn, Object.assign({ au: session.u, ap: session.p }, args || {})); }
function rpcUser(fn, args)  { return rpc(fn, Object.assign({ u: session.u, p: session.p }, args || {})); }
function rpcTok(fn, args) {
  return rpc(fn, Object.assign({ u: session.u, p: session.p, t: session.t }, args || {})).catch(function (e) {
    if (isMissingFn(e) || /parameter/i.test(e.message || "")) {
      return rpc(fn, Object.assign({ u: session.u, p: session.p }, args || {}));
    }
    throw e;
  });
}

/* ------------------------------------------------------------ tema */
var settings = load(SET_KEY, {});
function applyTheme(t) {
  t = THEMES.indexOf(t) > -1 ? t : "glassold";
  document.documentElement.setAttribute("data-theme", t);
  Array.prototype.forEach.call(document.querySelectorAll("#themePick .tbtn"), function (b) {
    b.setAttribute("aria-checked", b.getAttribute("data-t") === t ? "true" : "false");
  });
}
function buildThemes() {
  var box = $("themePick"); box.innerHTML = "";
  [["glasswhite", "Glass UI White"], ["glassold", "Glass UI Old"], ["glass", "Glass"],
   ["neu", "Neu Gelap"], ["neulight", "Neu Terang"]].forEach(function (p) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "tbtn"; b.setAttribute("role", "radio");
    b.setAttribute("data-t", p[0]); b.setAttribute("aria-checked", "false");
    b.innerHTML = '<i class="sw sw-' + p[0] + '"></i><span>' + p[1] + "</span>";
    b.onclick = function () {
      settings.theme = p[0]; settings.themeV = 2;
      save(SET_KEY, settings); applyTheme(p[0]);
      toast("Tema: " + p[1], "ok", 1800);
    };
    box.appendChild(b);
  });
  applyTheme(settings.themeV === 2 ? settings.theme : "glassold");
}

/* ------------------------------------------------------------ login */
function showGate() { $("gate").hidden = false; $("shell").hidden = true; }
function showShell() { $("gate").hidden = true; $("shell").hidden = false; }

function setSession(a, p, token) {
  session = {
    u: a.username, p: p, t: token || null, admin: !!a.is_admin,
    la: +a.limit_auto || 0, lo: +a.limit_other || 0,
    ua: +a.used_auto || 0, uo: +a.used_other || 0,
    exp: a.expires_at ? Date.parse(a.expires_at) : null
  };
  save(SESS_KEY, session);
  /* teruskan sesi ke aplikasi AI supaya tombol "Buka aplikasi" tidak perlu login */
  save(AUTH_KEY, {
    u: session.u, p: session.p, t: session.t, admin: session.admin,
    la: session.la, lo: session.lo, ua: session.ua, uo: session.uo, exp: session.exp
  });
  $("whoName").textContent = session.u;
  $("whoRole").textContent = session.admin ? "admin" : "bukan admin";
}

$("gateForm").onsubmit = async function (e) {
  e.preventDefault();
  var u = $("gUser").value.trim().toLowerCase(), p = $("gPass").value;
  if (!u || !p) { $("gErr").textContent = "Isi username dan password."; return; }
  $("gErr").textContent = ""; $("gGo").disabled = true; $("gGo").textContent = "Memeriksa…";
  try {
    var a = await rpc("app_login", { u: u, p: p });
    if (!a) throw new Error("login gagal");
    if (a.expired) throw new Error("Masa aktif akun habis.");
    var acc = a.account || a;
    if (!acc.is_admin) throw new Error("Akun ini bukan admin. Dashboard ditolak.");
    setSession(acc, p, a.token);
    $("gPass").value = "";
    await boot();
  } catch (err) {
    $("gErr").textContent = err.message || "Gagal masuk.";
  } finally {
    $("gGo").disabled = false; $("gGo").textContent = "Masuk";
  }
};

function logout() {
  if (session && session.t) rpc("app_logout", { t: session.t }).catch(function () {});
  session = null;
  save(SESS_KEY, null);
  save(AUTH_KEY, null);
  showGate();
  $("gUser").value = ""; $("gPass").value = ""; $("gErr").textContent = "";
}
$("btnLogout").onclick = logout;
$("btnLogout2").onclick = logout;

/* ------------------------------------------------------------ state data */
var state = {
  accounts: [], extras: {}, plans: {}, customModels: {}, rasuk: {},
  planApiOk: true, customApiOk: true, rasukApiOk: true,
  planFilter: "", search: "", sort: "name"
};

async function loadAll(silent) {
  if (!silent) $("btnRefresh").disabled = true;
  var errs = [];
  try {
    var list = await rpcAdmin("app_admin_list");
    state.accounts = Array.isArray(list) ? list : [];
  } catch (e) { errs.push("daftar akun: " + e.message); state.accounts = []; }

  try {
    var ex = await rpcTok("app_admin_extra");
    var em = {}; (ex || []).forEach(function (x) { em[x.username] = x; });
    state.extras = em;
  } catch (e) { if (isMissingFn(e)) errs.push("app_admin_extra belum ada"); state.extras = {}; }

  try {
    var pl = await rpcUser("app_plan_list");
    var pm = {}; (pl || []).forEach(function (x) { pm[x.username] = { plan: x.plan, planai_daily: x.planai_daily }; });
    state.plans = pm; state.planApiOk = true;
  } catch (e) { state.plans = {}; state.planApiOk = false; }

  try {
    var cm = await rpcUser("app_member_models_list");
    var mm = {}; (cm || []).forEach(function (r) { mm[r.username] = Array.isArray(r.models) ? r.models : []; });
    state.customModels = mm; state.customApiOk = true;
  } catch (e) { state.customModels = {}; state.customApiOk = false; }

  try {
    var rs = await rpcAdmin("app_admin_rasuk_list");
    var rm = {}; (rs || []).forEach(function (x) { rm[x.username] = x; });
    state.rasuk = rm; state.rasukApiOk = true;
  } catch (e) { state.rasuk = {}; state.rasukApiOk = false; }

  await loadCfg(true);
  if (!silent) $("btnRefresh").disabled = false;
  return errs;
}

async function loadCfg(quiet) {
  try {
    var c = await rpcTok("app_cfg_get");
    settings.baseUrl = (c && c.base_url) || "";
    settings.apiKey = (c && c.api_key) || "";
    if (c && Array.isArray(c.models) && c.models.length) {
      MODELS = uniqueModelIds(BUILTIN_MODELS.concat(c.models));
    }
    if (!quiet) {
      $("cBase").value = settings.baseUrl;
      $("cKey").value = settings.apiKey;
    }
    return c;
  } catch (e) {
    if (!quiet && !isMissingFn(e)) toast("Gagal memuat konfigurasi: " + e.message, "bad");
    return null;
  }
}
function uniqueModelIds(ids) {
  var seen = {};
  return ids.map(function (id) { return typeof id === "string" ? id.trim() : ""; })
    .filter(function (id) { if (!id || seen[id]) return false; seen[id] = true; return true; });
}

/* ------------------------------------------------------------ navigasi */
var VIEW_TITLE = { ringkasan: "Ringkasan", akun: "Akun member", rasuk: "Rasuk account", model: "Model AI", buat: "Buat akun", set: "Pengaturan" };
var currentView = "ringkasan";
function go(view) {
  currentView = VIEW_TITLE[view] ? view : "ringkasan";
  Array.prototype.forEach.call(document.querySelectorAll(".view"), function (v) {
    v.hidden = v.id !== "v-" + currentView;
  });
  Array.prototype.forEach.call(document.querySelectorAll(".nav-btn[data-view]"), function (b) {
    b.classList.toggle("on", b.getAttribute("data-view") === currentView);
  });
  $("viewTitle").textContent = VIEW_TITLE[currentView];
  $("scroll").scrollTop = 0;
  closeNav();
  if (currentView === "ringkasan") renderSummary();
  if (currentView === "akun") renderAccounts();
  if (currentView === "rasuk") renderRasuk();
  if (currentView === "model") renderModels();
  if (currentView === "buat" && !wizPick) wizReset();
  if (currentView === "set") renderSettings();
}
Array.prototype.forEach.call(document.querySelectorAll(".nav-btn[data-view]"), function (b) {
  b.onclick = function () { go(b.getAttribute("data-view")); };
});
Array.prototype.forEach.call(document.querySelectorAll("[data-goto]"), function (b) {
  b.onclick = function () { go(b.getAttribute("data-goto")); };
});
function openNav() { $("nav").classList.add("open"); $("scrim").classList.add("on"); }
function closeNav() { $("nav").classList.remove("open"); $("scrim").classList.remove("on"); }
$("menuBtn").onclick = function () { $("nav").classList.contains("open") ? closeNav() : openNav(); };
$("scrim").onclick = closeNav;
$("btnRefresh").onclick = async function () {
  toast("Memuat ulang data…", "", 1400);
  var errs = await loadAll();
  go(currentView);
  if (errs.length) toast(errs[0], "warn", 6000);
  else toast("Data terbaru dimuat.", "ok", 1800);
};

/* ------------------------------------------------------------ RINGKASAN */
function statCard(label, value, sub) {
  return '<div class="stat"><small>' + esc(label) + "</small><b>" + value + "</b>" +
    (sub ? "<em>" + esc(sub) + "</em>" : "") + "</div>";
}
function renderSummary() {
  var accs = state.accounts.filter(function (a) { return !a.is_admin; });
  var admins = state.accounts.length - accs.length;
  var aktif = 0, expSoon = 0, noPlan = 0, usedTotal = 0, capTotal = 0;
  var now = Date.now(), week = 7 * 864e5;
  accs.forEach(function (a) {
    var exp = a.expires_at ? Date.parse(a.expires_at) : null;
    if (!exp || exp > now) aktif++;
    if (exp && exp > now && exp - now < week) expSoon++;
    var plan = (state.plans[a.username] || {}).plan;
    if (!plan) noPlan++;
    var lim = isMaks(a.limit_auto) || isMaks(a.limit_other) ? null : (+a.limit_auto || 0) + (+a.limit_other || 0);
    if (lim !== null) { capTotal += lim * TOK; usedTotal += tokUsed(a.username, "auto", +a.limit_auto || 0, +a.used_auto || 0); }
  });
  var rasukAktif = Object.keys(state.rasuk).length;

  $("stats").innerHTML =
    statCard("Total akun", accs.length, admins + " admin") +
    statCard("Aktif", aktif, expSoon + " habis < 7 hari") +
    statCard("Rasuk aktif", rasukAktif, rasukAktif ? "perlu dipulihkan" : "semua normal") +
    statCard("Token terpakai", xozFmt(usedTotal), capTotal ? "dari " + xozFmt(capTotal) : "tanpa batas") +
    statCard("Belum berpaket", noPlan, noPlan ? "set paketnya" : "semua berpaket");

  /* sebaran paket */
  var buckets = { free: 0, plus: 0, pro: 0, ultra: 0, basic: 0, best: 0, none: 0 };
  accs.forEach(function (a) {
    var p = (state.plans[a.username] || {}).plan;
    if (p && buckets[p] !== undefined) buckets[p]++; else buckets.none++;
  });
  var maxN = Math.max.apply(null, Object.keys(buckets).map(function (k) { return buckets[k]; }).concat([1]));
  var bars = $("planBars"); bars.innerHTML = "";
  Object.keys(buckets).forEach(function (k) {
    var n = buckets[k];
    var row = document.createElement("div"); row.className = "bar-row";
    row.innerHTML = '<div class="bar-top"><span>' + esc(k === "none" ? "Belum diset" : planLabel(k)) + "</span><span>" + n + " akun</span></div>" +
      '<div class="bar-track"><i class="bar-fill" style="width:' + Math.round(n / maxN * 100) + '%"></i></div>';
    bars.appendChild(row);
  });

  /* perhatian */
  var attn = [];
  Object.keys(state.rasuk).forEach(function (u) {
    attn.push({ t: u + " sedang dirasuk", s: "pulihkan", v: "rasuk" });
  });
  accs.forEach(function (a) {
    var exp = a.expires_at ? Date.parse(a.expires_at) : null;
    if (exp && exp < now) attn.push({ t: a.username + " kedaluwarsa", s: "hapus/aktifkan", v: "akun" });
    else if (exp && exp - now < week) attn.push({ t: a.username + " habis " + fmtLeft(exp) + " lagi", s: "perpanjang", v: "akun" });
    if (!(state.plans[a.username] || {}).plan) attn.push({ t: a.username + " belum berpaket", s: "set paket", v: "akun" });
    var lim = +a.limit_auto || 0;
    if (!isMaks(lim) && lim > 0 && (+a.used_auto || 0) >= lim) attn.push({ t: a.username + " saldo token habis", s: "isi ulang", v: "akun" });
  });
  var attnBox = $("attn");
  if (!attn.length) {
    attnBox.innerHTML = '<div class="note ok">Tidak ada yang perlu ditindaklanjuti. Semua akun dalam keadaan wajar.</div>';
  } else {
    attnBox.innerHTML = attn.slice(0, 9).map(function (x) {
      return '<div class="attn-item"><i class="dotw"></i><b>' + esc(x.t) + "</b><small>" + esc(x.s) + "</small></div>";
    }).join("");
  }

  /* akun terbaru — pakai urutan nama karena daftar tidak menyertakan tanggal daftar */
  var recent = accs.slice().sort(function (a, b) {
    var ea = a.expires_at ? Date.parse(a.expires_at) : 0, eb = b.expires_at ? Date.parse(b.expires_at) : 0;
    return eb - ea;
  }).slice(0, 6);
  $("recentList").innerHTML = recent.length
    ? recent.map(function (a) {
        var p = (state.plans[a.username] || {}).plan;
        return '<div class="mini-row"><b>' + esc(a.username) + "</b>" +
          '<span class="badge ' + (p || "none") + '">' + esc(p ? planLabel(p) : "belum diset") + "</span>" +
          "<small>" + (a.expires_at ? "aktif " + fmtLeft(Date.parse(a.expires_at)) + " lagi" : "tanpa batas") + "</small></div>";
      }).join("")
    : '<div class="empty">Belum ada akun member.</div>';

  /* status server */
  var sn = [];
  sn.push(state.planApiOk ? "✅ Paket per akun aktif." : "❌ Paket per akun belum aktif — jalankan supabase-member-plan.sql + supabase-member-plan-v2.sql.");
  sn.push(state.customApiOk ? "✅ Model custom per akun aktif." : "❌ Model custom belum aktif — jalankan supabase-member-models.sql.");
  sn.push(state.rasukApiOk ? "✅ Rasuk account siap." : "❌ Rasuk account belum aktif — jalankan supabase-rasuk-account.sql.");
  $("serverNote").innerHTML = sn.join("<br>");
  $("serverNote").className = "note " + (state.planApiOk && state.rasukApiOk ? "ok" : "bad");
  $("pillApi").textContent = state.planApiOk ? "server siap" : "server belum siap";
  $("pillApi").className = "pill " + (state.planApiOk ? "ok" : "bad");

  $("navCount").textContent = accs.length;
  var rn = $("navRasuk");
  rn.textContent = rasukAktif;
  rn.hidden = !rasukAktif;
}

/* ------------------------------------------------------------ AKUN */
function accountPlan(a) {
  if (!a) return "";
  if (typeof a === "string") a = { username: a };
  if (a.is_admin) return "admin";
  var row = state.plans[a.username];
  return (row && row.plan) || "";
}

function filteredAccounts() {
  var q = state.search.trim().toLowerCase();
  var pf = state.planFilter;
  var list = state.accounts.filter(function (a) {
    if (q && a.username.toLowerCase().indexOf(q) < 0) return false;
    if (pf) {
      var p = accountPlan(a);
      if (pf === "none" ? !!p : p !== pf) return false;
    }
    return true;
  });
  list.sort(function (a, b) {
    if (state.sort === "name") return a.username.localeCompare(b.username);
    if (state.sort === "name-desc") return b.username.localeCompare(a.username);
    if (state.sort === "exp") {
      var ea = a.expires_at ? Date.parse(a.expires_at) : Infinity;
      var eb = b.expires_at ? Date.parse(b.expires_at) : Infinity;
      return ea - eb;
    }
    if (state.sort === "use") return (+b.used_auto || 0) - (+a.used_auto || 0);
    return 0;
  });
  return list;
}

function renderAccounts() {
  var note = $("planNote");
  var msgs = [];
  if (!state.planApiOk) msgs.push("Penyimpanan paket per akun belum aktif — jalankan supabase-member-plan.sql lalu supabase-member-plan-v2.sql di Supabase SQL Editor.");
  if (!state.customApiOk) msgs.push("Penetapan model custom perlu supabase-member-models.sql.");
  if (!state.rasukApiOk) msgs.push("Rasuk account perlu supabase-rasuk-account.sql.");
  note.className = "adm-note" + (msgs.length ? " bad" : " ok");
  note.textContent = msgs.length ? msgs.join(" ") :
    "Semua fungsi server aktif. Paket: Basic gratis (7 pemakaian), Plus 15, Pro 30 + Plan AI 5.000/hari, Ultra 50 + Plan AI 15.000/hari.";

  var list = filteredAccounts();
  $("acCount").textContent = list.length + " dari " + state.accounts.length + " akun";
  var box = $("acctList"); box.innerHTML = "";
  $("acEmpty").hidden = list.length > 0;
  list.forEach(function (a) { box.appendChild(acctRow(a)); });
  $("navCount").textContent = state.accounts.filter(function (x) { return !x.is_admin; }).length;
}

function acctRow(a) {
  var e = state.extras[a.username] || {};
  var plim = (e.pin_limit === null || e.pin_limit === undefined) ? 1 : e.pin_limit;
  var plan = accountPlan(a);
  var planai = (state.plans[a.username] || {}).planai_daily;
  var hasFace = !!e.has_face;
  var exp = a.expires_at ? Date.parse(a.expires_at) : null;
  var rasuk = state.rasuk[a.username];
  var la = +a.limit_auto || 0, used = +a.used_auto || 0;
  var maks = isMaks(la) || isMaks(a.limit_other);
  var usedTok = tokUsed(a.username, "auto", la, used);
  var capTok = maks ? null : la * TOK;
  var pct = capTok ? Math.min(100, Math.round(usedTok / capTok * 100)) : 0;

  var row = document.createElement("div");
  row.className = "acct";
  row.innerHTML =
    '<div class="acct-head"><b>' + esc(a.username) + "</b>" +
      '<span class="badge ' + (plan || "none") + '">' + esc(a.is_admin ? "Admin" : (plan ? planLabel(plan) : "paket belum diset")) + "</span>" +
      (rasuk ? '<span class="badge none">sedang dirasuk</span>' : "") +
      (hasFace ? '<span class="badge">wajah ✓</span>' : '<span class="badge">wajah –</span>') +
      '<div class="acct-meta">' +
        "<small>Saldo token <b>" + xozFmt(usedTok) + "</b> / " + (maks ? "∞" : xozFmt(capTok)) +
          " &middot; " + used + "/" + (maks ? "∞" : la) + " pemakaian</small>" +
        (capTok ? '<div class="meter' + (pct > 85 ? " low" : "") + '"><i style="width:' + pct + '%"></i></div>' : "") +
        (plan && isNewPlan(plan)
          ? "<small>Plan AI: <b>" + (planai === -1 ? "tanpa batas" : planai ? xozFmt(planai) + " token/hari" : "tidak termasuk") + "</b></small>"
          : "") +
        "<small>" + (exp
          ? (exp > Date.now()
              ? "Aktif " + fmtLeft(exp) + " lagi \u00b7 " + esc(new Date(exp).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }))
              : "Kedaluwarsa \u00b7 " + esc(new Date(exp).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })))
          : "Tanpa batas waktu") + "</small>" +
        "<small>Pin " + (e.pins || 0) + "/" + plim + " &middot; Model custom " + ((state.customModels[a.username] || []).length) + "</small>" +
      "</div></div>";

  var ctl = document.createElement("div");
  ctl.className = "acct-ctl";
  function inp(v, cls, title, ph) {
    var i = document.createElement("input");
    i.type = "text"; i.value = v; i.className = cls || ""; i.placeholder = ph || "";
    if (title) i.title = title;
    i.setAttribute("aria-label", title || "nilai");
    ctl.appendChild(i); return i;
  }
  function btn(t, cls, fn) { var b = mkBtn(t, "mini " + (cls || ""), fn); ctl.appendChild(b); return b; }

  if (!a.is_admin) {
    var sel = document.createElement("select");
    sel.setAttribute("aria-label", "Paket " + a.username);
    [["", "— paket —"], ["free", "Basic (gratis)"], ["plus", "Plus"], ["pro", "Pro"], ["ultra", "Ultra Coder"],
     ["basic", "Basic (lama)"], ["best", "Best Value (lama)"]].forEach(function (o) {
      var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; sel.appendChild(op);
    });
    sel.value = plan || "";
    sel.onchange = function () { if (sel.value) setPlanFor(a.username, sel.value); };
    ctl.appendChild(sel);

    btn("Rasuk", "primary", function () { openRasuk(a.username); });
    if (rasuk) btn("Pulihkan", "danger", function () { restoreRasuk(rasuk.id, a.username); });

    btn("Model custom (" + (state.customModels[a.username] || []).length + ")", "", function () { editCustomModels(a.username); });

    var ia = inp(maks ? "maks" : String(la), "w92", "Limit saldo token (1 pemakaian = 1.000 xoz token). Ketik 'maks' untuk tanpa batas");
    var ip = inp(String(plim), "w60", "Limit pin");
    var it = inp("", "w92", "Ubah masa aktif, mis. 30d", "ubah: 30d");
    var ipi = (plan && isNewPlan(plan))
      ? inp(planai === null || planai === undefined ? "" : (planai < 0 ? "maks" : String(planai)), "w92", "Kuota Plan AI harian; 'maks' = tanpa batas", "Plan AI")
      : null;

    btn("Simpan", "", async function () {
      var x = limParse(ia.value), pl = parseInt(ip.value, 10), ns = null;
      if (x === null || !(pl >= 0)) { toast("Limit tidak valid. Angka atau 'maks'.", "bad"); return; }
      if (it.value.trim()) { ns = parseDur(it.value); if (!ns) { toast(DURERR, "bad"); return; } }
      if (ipi && ipi.value.trim()) {
        var iv = (ipi.value.trim().toLowerCase() === "maks" || ipi.value.trim() === "∞") ? -1 : parseInt(ipi.value, 10);
        if (isNaN(iv) || iv < -1) { toast("Kuota Plan AI: angka, 0, atau 'maks'.", "bad"); return; }
        try { await rpcAdmin("app_planai_set_daily", { nu: a.username, daily: iv }); }
        catch (e) { toast("Plan AI: " + e.message, "bad"); return; }
      }
      try {
        await rpcAdmin("app_admin_update", { nu: a.username, la: x, lo: 0, ns: ns, reset: false, np: null });
      } catch (e) { toast("Gagal menyimpan kuota: " + e.message, "bad"); return; }
      try { await rpcTok("app_admin_setpin", { nu: a.username, lim: pl }); }
      catch (e) { toast("Limit pin: " + e.message, "bad"); return; }
      toast("Akun " + a.username + " disimpan.", "ok");
      await refreshAccounts();
    });

    if (plan && isNewPlan(plan) && NEW_PLANS[plan] && NEW_PLANS[plan].planai > 0) {
      btn("Reset Plan AI", "", async function () {
        try { await rpcAdmin("app_planai_reset", { nu: a.username }); toast("Pakai Plan AI " + a.username + " direset.", "ok"); }
        catch (e) { toast(e.message, "bad"); }
        refreshAccounts();
      });
    }
    btn("Reset pakai", "", async function () {
      try {
        await rpcAdmin("app_admin_update", { nu: a.username, la: null, lo: null, ns: null, reset: true, np: null });
        toast("Pemakaian " + a.username + " direset.", "ok");
      } catch (e) { toast(e.message, "bad"); }
      refreshAccounts();
    });
    btn("Ganti pass", "", function () { changePass(a.username); });
  }

  btn("Reset wajah", "", async function () {
    if (!confirm("Reset wajah " + a.username + "? Akun wajib mendaftarkan wajah lagi saat login berikutnya.")) return;
    try { await rpcTok("app_admin_face_reset", { nu: a.username }); toast("Wajah " + a.username + " direset.", "ok"); }
    catch (e) { toast(e.message, "bad"); }
    refreshAccounts();
  });

  if (!a.is_admin) {
    btn("Hapus", "danger", async function () {
      if (!confirm("Hapus akun " + a.username + "? Tindakan ini permanen.")) return;
      try {
        await rpcAdmin("app_admin_delete", { nu: a.username });
        await rpcTok("app_admin_purge", { nu: a.username }).catch(function () {});
        toast("Akun " + a.username + " dihapus.", "ok");
      } catch (e) { toast(e.message, "bad"); }
      refreshAccounts();
    });
  }

  row.appendChild(ctl);
  return row;
}

async function refreshAccounts() {
  await loadAll(true);
  renderAccounts();
  renderSummary();
  renderRasuk();
}

async function setPlanFor(nu, plan) {
  try {
    await rpcUser("app_plan_set", { nu: nu, plan: plan });
  } catch (e) {
    var hint = "";
    if (isMissingFn(e)) hint = " — jalankan supabase-member-plan.sql + supabase-member-plan-v2.sql.";
    else if (/check constraint|violates/i.test(e.message)) hint = " — jalankan ulang supabase-member-plan-v2.sql agar paket baru diizinkan.";
    toast("Gagal menyimpan paket: " + e.message + hint, "bad", 7000);
    return;
  }
  if (isNewPlan(plan) && NEW_PLANS[plan]) {
    var def = NEW_PLANS[plan].tokens;
    try {
      await rpcAdmin("app_admin_update", { nu: nu, la: def, lo: 0, ns: null, reset: false, np: null });
      toast("Paket " + planLabel(plan) + " aktif untuk " + nu + " · " + xozFmt(def * TOK) + " xoz token.", "ok");
    } catch (e) {
      toast("Paket tersimpan, tapi kuota gagal disetel: " + e.message, "warn", 6000);
    }
  } else {
    toast("Paket " + planLabel(plan) + " disimpan untuk " + nu + ".", "ok");
  }
  await refreshAccounts();
}

function changePass(nu) {
  var input = document.createElement("input");
  input.type = "text"; input.className = "search"; input.placeholder = "Password baru";
  input.style.width = "100%";
  var m = modal("Ganti password · " + nu,
    '<div class="kv"><span>Password baru</span></div>', []);
  $("mBody").appendChild(input);
  $("mFoot").appendChild(mkBtn("Batal", "", closeModal));
  $("mFoot").appendChild(mkBtn("Simpan", "primary", async function () {
    var v = input.value.trim();
    if (!v) { toast("Password tidak boleh kosong.", "bad"); return; }
    try {
      await rpcAdmin("app_admin_update", { nu: nu, la: null, lo: null, ns: null, reset: false, np: v });
      toast("Password " + nu + " diganti.", "ok"); closeModal();
    } catch (e) { toast(e.message, "bad"); }
  }));
  setTimeout(function () { input.focus(); }, 60);
}

function memberAssignableModels() {
  return MODELS.filter(function (m) {
    return LOCKED.indexOf(m) < 0 && PLAN_MODELS.basic.indexOf(m) < 0 && PLAN_MODELS.best.indexOf(m) < 0;
  });
}
function editCustomModels(nu) {
  var available = memberAssignableModels();
  var cur = (state.customModels[nu] || []).join(", ");
  var ta = document.createElement("textarea");
  ta.rows = 3; ta.value = cur;
  ta.style.width = "100%"; ta.style.fontFamily = "var(--mono)"; ta.style.fontSize = "12.5px";
  ta.style.padding = "10px"; ta.style.borderRadius = "10px";
  ta.style.background = "var(--field)"; ta.style.border = "1px solid var(--edge)";
  ta.style.color = "var(--ink)";
  modal("Model custom · " + nu,
    '<p class="hint">Pisahkan dengan koma. Kosongkan untuk menghapus semua.</p>' +
    '<div class="note">Tersedia: ' + (esc(available.join(", ")) || "belum ada — tambahkan dulu di tab Model AI") + "</div>", []);
  $("mBody").appendChild(ta);
  $("mFoot").appendChild(mkBtn("Batal", "", closeModal));
  $("mFoot").appendChild(mkBtn("Simpan", "primary", async function () {
    var ids = uniqueModelIds(ta.value.split(/[;,\n]/));
    var bad = ids.filter(function (id) { return available.indexOf(id) < 0; });
    if (bad.length) { toast("Tambahkan dulu di tab Model AI: " + bad.join(", "), "bad", 6000); return; }
    try {
      var r = await rpcUser("app_member_models_set", { nu: nu, models: ids });
      state.customModels[nu] = (r && Array.isArray(r.models)) ? r.models : ids;
      toast("Model custom " + nu + " disimpan.", "ok"); closeModal(); renderAccounts();
    } catch (e) {
      toast("Gagal: " + e.message + (isMissingFn(e) ? " — jalankan supabase-member-models.sql." : ""), "bad", 6500);
    }
  }));
}

/* ------------------------------------------------------------ RASUK ACCOUNT */
async function openRasuk(nu) {
  if (!state.rasukApiOk) {
    modal("Rasuk belum siap",
      '<div class="danger-box">Fungsi database untuk rasuk belum ada. Jalankan <b>supabase-rasuk-account.sql</b> sekali di <b>Supabase → SQL Editor</b>, lalu tekan <b>Muat ulang</b> di dashboard.</div>', []);
    $("mFoot").appendChild(mkBtn("Tutup", "", closeModal));
    return;
  }
  var acc = state.accounts.filter(function (a) { return a.username === nu; })[0];
  if (!acc) { toast("Akun tidak ditemukan.", "bad"); return; }

  if (state.rasuk[nu]) {
    modal("Akun ini sedang dirasuk",
      '<div class="warn-box">Sesi rasuk untuk <b>' + esc(nu) + "</b> masih terbuka. Pulihkan dulu password aslinya sebelum membuka sesi baru.</div>", []);
    $("mFoot").appendChild(mkBtn("Tutup", "", closeModal));
    $("mFoot").appendChild(mkBtn("Pulihkan sekarang", "danger", function () {
      restoreRasuk(state.rasuk[nu].id, nu);
    }));
    return;
  }

  modal("Rasuk akun · " + nu,
    '<div class="danger-box"><b>Perhatian.</b> Password akun ini akan diganti sementara di server supaya Anda bisa masuk sebagai member. Password asli disimpan sebagai cadangan dan dikembalikan persis saat Anda menekan <b>Pulihkan</b>. Selesaikan rasuk lalu pulihkan — jangan biarkan menggantung.</div>' +
    '<div class="note">Buka aplikasi lewat tombol yang muncul setelah ini. Sesi Xozen AI di browser ini akan berganti menjadi akun member, jadi setelah selesai tekan <b>Pulihkan</b> lalu login admin lagi bila perlu.</div>' +
    '<div class="kv"><span>Paket</span><b>' + esc(planLabel(accountPlan(nu)) || "—") + "</b></div>" +
    '<div class="kv"><span>Masa aktif</span><b>' + (acc.expires_at ? esc(new Date(Date.parse(acc.expires_at)).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })) : "tanpa batas") + "</b></div>" +
    '<div class="kv"><span>Wajah</span><b>' + ((state.extras[nu] || {}).has_face ? "terdaftar" : "belum terdaftar") + "</b></div>", []);
  $("mFoot").appendChild(mkBtn("Batal", "", closeModal));
  $("mFoot").appendChild(mkBtn("Rasuk sekarang", "primary", function () { doRasuk(nu); }));
}

async function doRasuk(nu) {
  closeModal();
  toast("Membuka akses ke " + nu + "…", "", 1800);
  try {
    var r = await rpcAdmin("app_admin_rasuk", { nu: nu });
    if (!r || !r.ok) throw new Error("server menolak permintaan");
    state.rasuk[nu] = { id: r.id, username: nu, password: r.password, created_at: r.created_at };
    showRasukResult(nu, r.password, r.id, r.scheme);
    renderRasuk(); renderAccounts(); renderSummary();
  } catch (e) {
    var hint = "";
    if (isMissingFn(e)) hint = " — jalankan supabase-rasuk-account.sql di Supabase SQL Editor.";
    else if (/argon2/i.test(e.message)) hint = " — gunakan tombol Ganti pass biasa untuk akun ini.";
    else if (/tidak bisa dirasuk/i.test(e.message)) hint = " — akun admin memang dilindungi.";
    toast("Rasuk gagal: " + e.message + hint, "bad", 8000);
  }
}

function appLoginUrl(user, pass) {
  return APP_LINK + "?login=" + encodeURIComponent(pass + "," + user) + "&rasuk=1";
}

function showRasukResult(nu, pass, rid, scheme) {
  var url = appLoginUrl(nu, pass);
  modal("Rasuk aktif · " + nu,
    '<div class="warn-box">Akun ini sekarang memakai password sementara. Semua yang Anda lakukan di aplikasi tercatat sebagai <b>' + esc(nu) + "</b>.</div>" +
    '<div class="kv"><span>Username</span><b>' + esc(nu) + "</b></div>" +
    '<div class="kv"><span>Password sementara</span><b class="pw" style="display:inline-block">' + esc(pass) + "</b></div>" +
    '<div class="kv"><span>Format password asli</span><b>' + esc(scheme || "—") + "</b></div>" +
    '<div class="kv"><span>Tautan masuk</span><b style="font-family:var(--mono);font-size:11.5px;word-break:break-all">' + esc(url) + "</b></div>", []);
  $("mFoot").appendChild(mkBtn("Salin password", "", function () {
    copyText(pass).then(function () { toast("Password disalin.", "ok", 1600); });
  }));
  $("mFoot").appendChild(mkBtn("Buka aplikasi", "primary", function () {
    window.open(url, "_blank", "noopener");
  }));
  $("mFoot").appendChild(mkBtn("Pulihkan sekarang", "danger", function () { restoreRasuk(rid, nu); }));
  $("mFoot").appendChild(mkBtn("Tutup", "", closeModal));
}

async function restoreRasuk(rid, nu) {
  if (!confirm("Pulihkan password asli akun " + nu + "? Sesi rasuk akan ditutup.")) return;
  try {
    await rpcAdmin("app_admin_rasuk_restore", { rid: rid });
    delete state.rasuk[nu];
    toast("Password asli " + nu + " dipulihkan.", "ok");
    closeModal();
  } catch (e) { toast("Gagal memulihkan: " + e.message, "bad", 7000); }
  renderRasuk(); renderAccounts(); renderSummary();
}

async function restoreAll() {
  var n = Object.keys(state.rasuk).length;
  if (!n) { toast("Tidak ada sesi rasuk aktif.", "", 2200); return; }
  if (!confirm("Pulihkan password asli untuk " + n + " akun yang sedang dirasuk?")) return;
  try {
    var r = await rpcAdmin("app_admin_rasuk_restore_all");
    state.rasuk = {};
    toast("Dipulihkan: " + ((r && r.restored) || n) + " akun.", "ok");
  } catch (e) { toast("Gagal: " + e.message, "bad", 7000); }
  renderRasuk(); renderAccounts(); renderSummary();
}

function renderRasuk() {
  var keys = Object.keys(state.rasuk);
  $("rasukInstall").hidden = state.rasukApiOk;
  $("rasukCount").textContent = keys.length ? keys.length + " akun" : "";
  $("rasukEmpty").hidden = keys.length > 0;
  var box = $("rasukList"); box.innerHTML = "";
  keys.forEach(function (u) {
    var r = state.rasuk[u];
    var row = document.createElement("div"); row.className = "rasuk-row";
    row.innerHTML = '<div class="who"><b>' + esc(u) + "</b><small>dibuka " +
      esc(new Date(r.created_at || Date.now()).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })) + "</small></div>" +
      '<span class="pw">' + esc(r.password || "—") + "</span>";
    var acts = document.createElement("div"); acts.className = "acts";
    acts.appendChild(mkBtn("Buka aplikasi", "mini primary", function () {
      window.open(appLoginUrl(u, r.password), "_blank", "noopener");
    }));
    acts.appendChild(mkBtn("Salin", "mini", function () {
      copyText(r.password || "").then(function () { toast("Disalin.", "ok", 1500); });
    }));
    acts.appendChild(mkBtn("Pulihkan", "mini danger", function () { restoreRasuk(r.id, u); }));
    row.appendChild(acts);
    box.appendChild(row);
  });
  var rn = $("navRasuk");
  rn.textContent = keys.length; rn.hidden = !keys.length;
}

$("btnRestoreAll").onclick = restoreAll;
$("btnRasukPick").onclick = function () {
  var accs = state.accounts.filter(function (a) { return !a.is_admin; });
  if (!accs.length) { toast("Belum ada akun member.", "bad"); return; }
  var wrap = document.createElement("div");
  var search = document.createElement("input");
  search.type = "search"; search.className = "search"; search.placeholder = "Cari akun…";
  search.style.width = "100%";
  var list = document.createElement("div");
  list.style.cssText = "display:grid;gap:6px;max-height:44vh;overflow:auto;margin-top:10px";
  function paint() {
    var q = search.value.trim().toLowerCase();
    list.innerHTML = "";
    accs.filter(function (a) { return !q || a.username.indexOf(q) > -1; }).slice(0, 60).forEach(function (a) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "mini-row";
      b.style.cssText = "cursor:pointer;text-align:left;background:var(--codebg);border:1px solid var(--edge);border-radius:12px;padding:10px 12px;color:var(--ink);font:inherit";
      var p = accountPlan(a);
      b.innerHTML = "<b>" + esc(a.username) + '</b><span class="badge ' + (p || "none") + '">' +
        esc(p ? planLabel(p) : "belum diset") + "</span><small>" +
        (state.rasuk[a.username] ? "sedang dirasuk" : a.expires_at ? fmtLeft(Date.parse(a.expires_at)) + " lagi" : "tanpa batas") + "</small>";
      b.onclick = function () { closeModal(); openRasuk(a.username); };
      list.appendChild(b);
    });
    if (!list.children.length) list.innerHTML = '<div class="empty">Tidak ada akun yang cocok.</div>';
  }
  search.oninput = paint;
  wrap.appendChild(search); wrap.appendChild(list);
  modal("Pilih akun untuk dirasuk", wrap, []);
  $("mFoot").appendChild(mkBtn("Batal", "", closeModal));
  paint();
  setTimeout(function () { search.focus(); }, 60);
};

/* ------------------------------------------------------------ MODEL AI */
function mlabel(m) {
  return m === "auto" ? "Xozen AI" : m === "minimumlite" ? "MinimumLite (Gratis)" : (MASK_LABEL[m] || m);
}
function renderModels() {
  var box = $("mList"); box.innerHTML = "";
  MODELS.forEach(function (m) {
    var sp = document.createElement("span");
    sp.className = "chip" + (LOCKED.indexOf(m) > -1 ? " lock" : "");
    sp.appendChild(document.createTextNode(mlabel(m)));
    if (LOCKED.indexOf(m) > -1) {
      sp.title = "Model bawaan, tidak bisa dihapus";
    } else {
      var x = document.createElement("button");
      x.type = "button"; x.textContent = "×";
      x.setAttribute("aria-label", "Hapus model " + m);
      x.onclick = function () { saveModels(MODELS.filter(function (z) { return z !== m; })); };
      sp.appendChild(x);
    }
    box.appendChild(sp);
  });
  if (!MODELS.length) box.innerHTML = '<p class="hint">Daftar model kosong.</p>';
  $("cBase").value = settings.baseUrl || "";
  $("cKey").value = settings.apiKey || "";
}
async function saveModels(ids) {
  try {
    await rpcTok("app_set_models", { ids: ids });
    var c = await loadCfg(true);
    MODELS = uniqueModelIds(BUILTIN_MODELS.concat((c && Array.isArray(c.models)) ? c.models : ids));
    renderModels();
    toast("Daftar model disimpan.", "ok", 2000);
    return true;
  } catch (e) {
    toast("Gagal menyimpan model: " + e.message, "bad", 6000);
    return false;
  }
}
async function fetchApiModelIds() {
  if (!settings.baseUrl || !settings.apiKey) throw new Error("Isi Base URL dan API key dulu.");
  var r = await fetch(settings.baseUrl.replace(/\/+$/, "") + "/models", {
    headers: { Authorization: "Bearer " + settings.apiKey, Accept: "application/json" }
  });
  var body = await r.text(), j = null;
  try { j = body ? JSON.parse(body) : null; } catch (e) {}
  if (!r.ok) {
    var detail = j && (typeof j.error === "string" ? j.error : (j.error && j.error.message) || j.message);
    throw new Error(detail || ("Server mengembalikan error " + r.status));
  }
  var arr = Array.isArray(j) ? j : [];
  if (!arr.length && j && typeof j === "object") {
    [j.data, j.models, j.items, j.result].forEach(function (v) {
      if (arr.length) return;
      if (Array.isArray(v)) arr = v;
      else if (v && typeof v === "object") {
        if (Array.isArray(v.data)) arr = v.data;
        else if (Array.isArray(v.models)) arr = v.models;
      }
    });
  }
  var ids = uniqueModelIds(arr.map(function (x) {
    return typeof x === "string" ? x : (x && (x.id || x.name || x.model)) || "";
  }));
  if (!ids.length) throw new Error("API tidak mengembalikan daftar model.");
  return ids;
}
var apiModelChoices = [];
$("mOneFetch").onclick = async function () {
  var b = $("mOneFetch"), sel = $("mOneSelect");
  b.disabled = true; b.textContent = "Memuat…";
  try {
    apiModelChoices = await fetchApiModelIds();
    sel.innerHTML = "";
    var hint = document.createElement("option");
    hint.value = ""; hint.textContent = "Pilih satu model dari API"; sel.appendChild(hint);
    apiModelChoices.forEach(function (id) {
      var op = document.createElement("option");
      op.value = id; op.textContent = MODELS.indexOf(id) > -1 ? id + " (sudah ada)" : id;
      op.disabled = MODELS.indexOf(id) > -1;
      sel.appendChild(op);
    });
    sel.disabled = false;
    $("mOneAdd").disabled = !apiModelChoices.some(function (id) { return MODELS.indexOf(id) < 0; });
    toast(apiModelChoices.length + " model tersedia.", "ok", 2200);
  } catch (err) { toast(err.message || "Gagal mengambil daftar model.", "bad", 6000); }
  finally { b.disabled = false; b.textContent = "Muat daftar"; }
};
$("mOneAdd").onclick = async function () {
  var id = $("mOneSelect").value;
  if (!id) return;
  if (MODELS.indexOf(id) > -1) { toast("Model sudah ada.", "warn"); return; }
  if (await saveModels(MODELS.concat([id]))) toast("Model " + id + " ditambahkan.", "ok");
};
$("mClear").onclick = function () {
  if (!confirm("Hapus semua model kecuali model bawaan? Bisa dipulihkan dengan Ambil semua dari API.")) return;
  saveModels(LOCKED.slice());
};
$("mFetch").onclick = async function () {
  var b = $("mFetch");
  b.disabled = true; b.textContent = "Mengambil…";
  try {
    var ids = await fetchApiModelIds();
    if (await saveModels(uniqueModelIds(LOCKED.concat(ids)))) toast(ids.length + " model dari API disimpan.", "ok");
  } catch (err) { toast(err.message || "Gagal mengambil model dari API.", "bad", 6000); }
  finally { b.disabled = false; b.textContent = "Ambil semua dari API"; }
};
$("cSave").onclick = async function () {
  var b = $("cBase").value.trim(), k = $("cKey").value.trim();
  if (!b) { toast("Base URL wajib diisi.", "bad"); return; }
  try {
    await rpcTok("app_cfg_set", { b: b, k: k });
    settings.baseUrl = b; settings.apiKey = k;
    toast("Koneksi API disimpan di server.", "ok");
  } catch (e) { toast("Gagal: " + e.message, "bad", 6000); }
};

/* ------------------------------------------------------------ WIZARD BUAT AKUN */
var wizStep = 1, wizPick = null, wizBusy = false, wizCreated = null;
function wizPane(n) {
  wizStep = n;
  Array.prototype.forEach.call(document.querySelectorAll("#v-buat .wiz-pane"), function (p) {
    p.hidden = +p.getAttribute("data-pane") !== n;
  });
  Array.prototype.forEach.call(document.querySelectorAll("#wizSteps li"), function (li) {
    var k = +li.getAttribute("data-s");
    li.className = k === n ? "on" : (k < n ? "done" : "");
  });
  $("wizBack").disabled = (n === 1 || n === 4);
  $("wizNext").textContent = n === 1 ? "Lanjut" : n === 2 ? "Lihat ringkasan" : n === 3 ? "Buat akun sekarang" : "Selesai";
  if (n === 3) wizSummary();
}
function wizReset() {
  wizPick = null; wizCreated = null; wizBusy = false;
  $("wU").value = ""; $("wP").value = ""; $("wT").value = "30d"; $("wPin").value = "1";
  $("wizWarn").hidden = true; $("wizMsg").value = "";
  $("wizPlanInfo").textContent = ""; $("wizErr").textContent = "";
  wizBuildPlans(); wizBuildDur(); wizPane(1);
}
function wizBuildDur() {
  var box = $("wDur"); box.innerHTML = "";
  [["7d", "7 hari"], ["30d", "30 hari"], ["90d", "90 hari"], ["180d", "6 bulan"], ["1y", "1 tahun"]].forEach(function (p) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "btn mini"; b.textContent = p[1];
    b.onclick = function () { $("wT").value = p[0]; };
    box.appendChild(b);
  });
}
function wizBuildPlans() {
  var box = $("wizPlans"); box.innerHTML = "";
  Object.keys(NEW_PLANS).forEach(function (pv) {
    var p = NEW_PLANS[pv];
    var d = document.createElement("div");
    d.className = "pcard" + (p.best ? " best" : "");
    var meta = xozFmt(p.tokens * TOK) + " xoz token · satu saldo token · " +
      (pv === "ultra" ? "semua model" : planCount(pv) + " model") +
      (p.planai ? " · Plan AI " + xozFmt(p.planai) + "/hari" : "") + " · " + (p.pins ? p.pins + " pin" : "tanpa pin");
    d.innerHTML = (p.tag ? '<span class="ptag">' + esc(p.tag) + "</span>" : "") +
      '<div class="pname">' + esc(planLabel(pv)) + "</div>" +
      '<div class="pmeta">' + esc(meta) + "</div>" +
      '<div class="pprice">' + esc(p.price) + "<small>/ akun</small></div>" +
      '<button type="button" class="btn pbuy">Pilih paket ini</button>';
    d.querySelector("button").onclick = function () { wizChoose({ newplan: pv }); wizPane(2); $("wU").focus(); };
    box.appendChild(d);
  });
  var c = document.createElement("div");
  c.className = "pcard wide";
  c.innerHTML = '<div class="pname">Custom (paket lama)</div><div class="pmeta">Atur kuota sendiri (satu saldo token untuk semua model)</div>' +
    '<div class="row"><input type="text" id="wcX" value="15" aria-label="Kuota saldo token" style="width:110px;padding:8px 10px;border-radius:10px;background:var(--field);border:1px solid var(--edge);color:var(--ink)">' +
    '<select id="wcPlan" class="sel" aria-label="Paket akses model"><option value="basic">Basic lama (9 model)</option><option value="best">Best Value lama (31 model)</option></select></div>' +
    '<button type="button" class="btn pbuy" id="wcGo">Pakai custom</button>';
  box.appendChild(c);
  c.querySelector("#wcGo").onclick = function () {
    var x = parseInt($("wcX").value, 10);
    if (!(x >= 0)) { toast("Kuota custom tidak valid.", "bad"); return; }
    wizChoose({ plan: $("wcPlan").value, x: x, price: "custom", custom: true });
    wizPane(2); $("wU").focus();
  };
}
function wizChoose(t) {
  wizPick = t;
  if (t && t.newplan) {
    var p = NEW_PLANS[t.newplan];
    $("wizPlanInfo").innerHTML = "Dipilih: <b>" + esc(planLabel(t.newplan)) + "</b> · " +
      esc(xozFmt(p.tokens * TOK)) + " xoz token (satu saldo token; 1.000 token = 1 pemakaian) · terbuka <b>" +
      (t.newplan === "ultra" ? "semua model" : planCount(t.newplan) + " model") + "</b>" +
      (p.planai ? " · Plan AI " + xozFmt(p.planai) + " token/hari" : "") + " · " + (p.pins ? p.pins + " pin" : "tanpa pin");
    $("wPin").value = String(p.pins);
  } else {
    $("wizPlanInfo").innerHTML = "Dipilih: <b>" + planLabel(t.plan) + "</b> · " + xozFmt(t.x * TOK) +
      " xoz token" + (t.custom ? " · kuota custom" : " · " + esc(t.price)) + " · terbuka <b>" + planCount(t.plan) + " model</b>.";
  }
}
function wizSummary() {
  var u = $("wU").value.trim().toLowerCase(), ns = parseDur($("wT").value);
  var box = $("wizSum"); box.innerHTML = "";
  function r(k, v) {
    var d = document.createElement("div"); d.className = "r";
    var a = document.createElement("span"); a.textContent = k;
    var b = document.createElement("b"); b.innerHTML = v;
    d.appendChild(a); d.appendChild(b); box.appendChild(d);
  }
  var pKey = wizPick.newplan || wizPick.plan;
  var wl = planModels(pKey);
  r("Paket", esc(planLabel(pKey)) + (wizPick.custom ? " (custom)" : ""));
  r("Kuota", wizPick.newplan ? esc(xozFmt(NEW_PLANS[pKey].tokens * TOK)) + " xoz token" : esc(xozFmt(wizPick.x * TOK)) + " xoz token");
  r("Harga", esc(wizPick.newplan ? NEW_PLANS[pKey].price : (wizPick.custom ? "diatur manual" : wizPick.price)));
  r("Akses model", wl ? (wl.length + " model · " + wl.slice(0, 3).map(esc).join(", ") + ", …") : ("Semua model (" + MODELS.length + ")"));
  if (wizPick.newplan && NEW_PLANS[pKey].planai) r("Plan AI", xozFmt(NEW_PLANS[pKey].planai) + " token/hari");
  r("Username", esc(u));
  r("Password", esc($("wP").value));
  r("Masa aktif", ns ? esc($("wT").value.trim() + " (sampai " + new Date(Date.now() + ns * 1000).toLocaleDateString("id-ID", { dateStyle: "long" }) + ")") : "tidak valid");
  r("Limit pin", esc($("wPin").value));
  var w = $("wizWarn");
  if (!state.planApiOk) {
    w.hidden = false;
    w.textContent = "Penyimpanan paket per akun belum aktif di server — jalankan supabase-member-plan.sql lalu supabase-member-plan-v2.sql, kemudian set ulang paket akun ini.";
  } else w.hidden = true;
}
function wizFriendly(m) {
  m = String(m || "");
  if (/duplicate|already|exists|unique|sudah/i.test(m)) return "Username “" + $("wU").value.trim().toLowerCase() + "” sudah dipakai.";
  if (isMissingFn({ message: m })) return "Fungsi database belum ada (app_admin_create). Jalankan file SQL akun/admin dulu.";
  if (/not allowed|forbidden|unauthor|denied|bukan admin|not admin/i.test(m)) return "Akses ditolak: sesi admin tidak valid. Keluar lalu login ulang.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Tidak bisa terhubung ke server.";
  return m;
}
async function wizCreate() {
  if (wizBusy) return;
  var u = $("wU").value.trim().toLowerCase(), p = $("wP").value, ns = parseDur($("wT").value), pin = parseInt($("wPin").value, 10);
  if (!/^[a-z0-9._-]+$/.test(u)) { $("wizErr").textContent = "Username wajib: huruf kecil, angka, titik, garis bawah, atau strip."; return; }
  if (!p) { $("wizErr").textContent = "Password wajib diisi."; return; }
  if (!ns) { $("wizErr").textContent = DURERR; return; }
  if (!(pin >= 0)) { $("wizErr").textContent = "Limit pin tidak valid."; return; }
  if (!wizPick) { $("wizErr").textContent = "Pilih template paket dulu."; wizPane(1); return; }
  wizBusy = true; $("wizNext").disabled = true; $("wizNext").textContent = "Membuat…"; $("wizErr").textContent = "";
  var la, lo, pKey;
  if (wizPick.newplan) { la = NEW_PLANS[wizPick.newplan].tokens; lo = 0; pKey = wizPick.newplan; }
  else { la = wizPick.x; lo = 0; pKey = wizPick.plan; }
  try {
    try { await rpcAdmin("app_admin_create", { nu: u, np: p, ns: ns, la: la, lo: lo }); }
    catch (e) {
      $("wizErr").textContent = "Gagal membuat akun: " + wizFriendly(e.message);
      wizBusy = false; $("wizNext").disabled = false; $("wizNext").textContent = "Buat akun sekarang";
      return;
    }
    var pinOk = true;
    try { await rpcTok("app_admin_setpin", { nu: u, lim: pin }); } catch (e) { pinOk = false; }
    var planOk = true;
    try {
      await rpcUser("app_plan_set", { nu: u, plan: pKey });
      if (isNewPlan(pKey) && NEW_PLANS[pKey]) {
        await rpcAdmin("app_admin_update", { nu: u, la: NEW_PLANS[pKey].tokens, lo: 0, ns: null, reset: false, np: null });
      }
    } catch (e) { planOk = false; }

    var expTxt = new Date(Date.now() + ns * 1000).toLocaleDateString("id-ID", { dateStyle: "long" });
    wizCreated = { u: u, p: p, plan: pKey, ns: ns, expTxt: expTxt, pin: pin, x: la };
    $("wizDone").innerHTML = "<b>Akun " + esc(u) + " berhasil dibuat.</b><br>Paket " + esc(planLabel(pKey)) +
      " · " + esc(xozFmt(la * TOK)) + " xoz token · aktif sampai " + esc(expTxt) + "." +
      (pinOk ? "" : "<br><b>Limit pin belum tersimpan</b> — atur dari daftar akun.") +
      (planOk ? "" : "<br><b>Akses model belum tersimpan di server</b> — jalankan file SQL paket.");
    $("wizMsg").value = wizMessage();
    $("wizWa").href = "https://wa.me/?text=" + encodeURIComponent($("wizMsg").value);
    $("wizErr").textContent = "";
    wizPane(4);
    await refreshAccounts();
  } finally {
    wizBusy = false; $("wizNext").disabled = false;
    if (wizStep === 4) $("wizNext").textContent = "Selesai";
  }
}
function wizMessage() {
  var c = wizCreated, t = wizPick;
  var np = c.plan && isNewPlan(c.plan);
  return "Akun Xozen AI Anda sudah aktif 🎉\n\n" +
    "Paket      : " + planLabel(c.plan) + (t.custom ? " (custom)" : "") + "\n" +
    "Kuota      : " + xozFmt(c.x * TOK) + " xoz token (satu saldo token, 1.000 token = 1 pemakaian)\n" +
    (np ? "Harga      : " + NEW_PLANS[c.plan].price + "\n" : "") +
    (np && NEW_PLANS[c.plan].planai ? "Plan AI    : " + xozFmt(NEW_PLANS[c.plan].planai) + " token/hari di halaman Xozen Planner\n" : "") +
    "Masa aktif : " + (c.ns / 86400) + " hari (sampai " + c.expTxt + ")\n" +
    "Username   : " + c.u + "\n" +
    "Password   : " + c.p + "\n\n" +
    "Model yang terbuka: " + planCount(c.plan) + " model.\n" +
    "Cara masuk:\n1. Buka " + APP_LINK + "\n2. Login dengan username & password di atas\n" +
    "3. Verifikasi wajah diminta sekali, diproses langsung di perangkat Anda\n\n" +
    "Simpan pesan ini dan jangan bagikan akun Anda ke orang lain. Terima kasih!";
}
function wizGo() {
  if (wizStep === 1) {
    if (!wizPick) { $("wizErr").textContent = "Pilih salah satu template paket dulu."; return; }
    wizPane(2); $("wU").focus(); return;
  }
  if (wizStep === 2) {
    var u = $("wU").value.trim().toLowerCase(), p = $("wP").value;
    if (!/^[a-z0-9._-]+$/.test(u)) { $("wizErr").textContent = "Username wajib: huruf kecil, angka, titik, garis bawah, atau strip."; return; }
    if (!p) { $("wizErr").textContent = "Password wajib diisi."; return; }
    if (!parseDur($("wT").value)) { $("wizErr").textContent = DURERR; return; }
    $("wizErr").textContent = ""; wizPane(3); return;
  }
  if (wizStep === 3) { wizCreate(); return; }
  wizReset();
}
$("wizNext").onclick = wizGo;
$("wizBack").onclick = function () { if (wizStep > 1 && wizStep < 4) wizPane(wizStep - 1); };
$("wizAgain").onclick = function () { wizReset(); };
$("wizCopy").onclick = function () {
  copyText($("wizMsg").value).then(function () { toast("Pesan disalin.", "ok", 1600); });
};
$("wGen").onclick = function () {
  var a = "abcdefghijkmnpqrstuvwxyz", b = "ABCDEFGHJKLMNPQRSTUVWXYZ", c = "23456789", s = "";
  for (var i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
  for (var j = 0; j < 2; j++) s += b[Math.floor(Math.random() * b.length)];
  for (var k = 0; k < 2; k++) s += c[Math.floor(Math.random() * c.length)];
  $("wP").value = s.split("").sort(function () { return Math.random() - .5; }).join("");
};

/* ------------------------------------------------------------ PENGATURAN */
function renderSettings() {
  $("sSys").value = settings.system || "";
  $("sTemp").value = settings.temp != null ? settings.temp : 0.7;
  $("tempVal").textContent = $("sTemp").value;
  $("sessNote").innerHTML = "Masuk sebagai <b>" + esc(session ? session.u : "—") + "</b>" +
    (session && session.exp ? " · sesi berlaku sampai " + esc(new Date(session.exp).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })) : " · tanpa batas waktu") +
    "<br>Sesi dashboard disimpan di perangkat ini. Menekan Keluar akan menghapusnya.";
}
$("sTemp").oninput = function () { $("tempVal").textContent = this.value; };
$("sSave").onclick = function () {
  settings.system = $("sSys").value;
  settings.temp = parseFloat($("sTemp").value);
  settings.themeV = 2;
  save(SET_KEY, settings);
  toast("Pengaturan disimpan di perangkat ini.", "ok");
};

/* ------------------------------------------------------------ boot */
async function boot() {
  showShell();
  buildThemes();
  renderSettings();
  var errs = await loadAll();
  go("ringkasan");
  if (errs.length) toast(errs[0], "warn", 7000);
}

(function init() {
  buildThemes();
  var s = load(SESS_KEY, null);
  if (s && s.u && s.p && s.admin) {
    session = s;
    $("whoName").textContent = s.u;
    $("whoRole").textContent = "admin";
    save(AUTH_KEY, s);
    boot();
  } else {
    showGate();
    setTimeout(function () { $("gUser").focus(); }, 80);
  }
  /* muat daftar model untuk label paket walau belum login */
  MODELS = BUILTIN_MODELS.slice();
})();

})();
