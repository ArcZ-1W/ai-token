/* ============================================================
   app.js — Xozen Planner (Plan AI)
   Ubah ide fitur jadi rencana siap build. Menggunakan AKUN XOZEN AI
   (satu akun, login ada di /ai/ — bukan di halaman ini), dengan kuota
   Plan AI harian per paket (Pro 5.000 / Ultra Coder 15.000 token),
   reset tengah malam WIB. Data lokal di localStorage.
   ============================================================ */
'use strict';

/* ---------------- settings ---------------- */
/* Base URL / API key / model diambil server (app_cfg_get) setelah login;
   pengguna tetap bisa mengganti mandiri di UI (⚙). Default bawah hanya
   pengisi kosong — TIDAK menyimpan API key di kode ini. */
const SETTINGS_KEY  = 'xozen-plan:settings';
const STORE_KEY     = 'xozen-plan:chats';
const MAX_HISTORY   = 30;
const DEFAULTS = {
  baseUrl: '',
  apiKey:  '',
  model:   'combofree',
  temperature: 0.7
};

function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch (e) { s = {}; }
  let t = parseFloat(s.temperature);
  if (!isFinite(t)) t = DEFAULTS.temperature;
  t = Math.min(2, Math.max(0, t));
  return {
    baseUrl: String(s.baseUrl || '').trim() || DEFAULTS.baseUrl,
    apiKey: s.apiKey == null ? DEFAULTS.apiKey : String(s.apiKey),
    model: String(s.model || '').trim() || DEFAULTS.model,
    temperature: t
  };
}
let settings = loadSettings();
const persistSettings = () => {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* quota */ }
};
/* normalize: accept with or without the /v1 suffix */
function apiBase() {
  let b = String(settings.baseUrl || '').trim().replace(/\/+$/, '');
  if (!/\/v\d+$/i.test(b)) b += '/v1';
  return b;
}
const apiUrl    = () => apiBase() + '/chat/completions';
const modelsUrl = () => apiBase() + '/models';

/* ---------------- akun Xozen AI (login ada di /ai/, bukan di sini) ---------------- */
const SUPA_URL = 'https://beqlxnlhvarjhkuxndmr.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlcWx4bmxodmFyamhrdXhuZG1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMjQ4ODgsImV4cCI6MjEwNjcwMDg4OH0.FxPj-dfPf6OnfPotgQxFafd7Fx9yIM6oqMm25xMRslw';
let auth = null;                 /* {u,p,t,exp,...} — disimpan aplikasi Xozen AI di 'glassai.auth' */
let planValue = null;            /* 'pro' | 'ultra' | null */
let planai = { daily: 0, used: 0, remaining: 0 };

function loadAuth() {
  try {
    const s = JSON.parse(localStorage.getItem('glassai.auth'));
    if (!s || !s.u || !s.p) return null;
    if (s.exp && Date.now() >= s.exp) return null;
    return s;
  } catch (e) { return null; }
}

async function supaRpc(fn, args) {
  const r = await fetch(SUPA_URL.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args || {})
  });
  const txt = await r.text();
  let j = null;
  try { j = txt ? JSON.parse(txt) : null; } catch (e) { /* non-JSON */ }
  if (!r.ok) throw new Error((j && (j.message || j.error)) || ('HTTP ' + r.status));
  return j;
}

function hideBoot() {
  const b = document.getElementById('boot');
  if (!b || b.classList.contains('hide')) return;
  b.classList.add('hide');
  setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 380);
}

function showGate(kind) {
  hideBoot();
  document.getElementById('gate').hidden = false;
  const app = document.getElementById('appRoot');
  if (app) app.style.visibility = 'hidden';
  const t = document.getElementById('gateTitle');
  const x = document.getElementById('gateText');
  if (kind === 'quota' && t && x) {
    t.textContent = 'Plan AI untuk paket Pro & Ultra Coder';
    x.innerHTML = 'Paket akun Xozen AI Anda belum menyertakan kuota Plan AI. Upgrade ke <b>Pro</b> (5.000 token/hari) atau <b>Ultra Coder</b> (15.000 token/hari) untuk memakai Xozen Planner.';
  }
}

async function bootstrapAccount() {
  /* Admin: akses penuh — semua model Plan AI, kuota harian tidak berlaku */
  if (auth.admin) {
    planValue = 'admin';
    planai = { daily: 0, used: 0, remaining: 0, admin: true };
    try {
      const c = await supaRpc('app_cfg_get', { u: auth.u, p: auth.p, t: auth.t });
      if (c && c.base_url && !settings.baseUrl) settings.baseUrl = String(c.base_url);
      if (c && c.api_key && !settings.apiKey) settings.apiKey = String(c.api_key);
      persistSettings();
    } catch (e) { /* pengaturan lanjut manual */ }
    updatePlanaiPill();
    return;
  }
  try {
    const r = await supaRpc('app_plan_get', { u: auth.u, p: auth.p });
    planValue = (r && r.plan) ? String(r.plan) : null;
  } catch (e) { planValue = null; }
  if (planValue !== 'pro' && planValue !== 'ultra') { showGate('quota'); return; }
  try {
    const d = await supaRpc('app_planai_get', { u: auth.u, p: auth.p, t: auth.t });
    if (d && d.daily !== undefined) planai = { daily: +d.daily || 0, used: +d.used || 0, remaining: +d.remaining || 0 };
  } catch (e) { /* server belum menjalankan supabase-member-plan-v2.sql */ }
  try {
    const c = await supaRpc('app_cfg_get', { u: auth.u, p: auth.p, t: auth.t });
    if (c && c.base_url && !settings.baseUrl) settings.baseUrl = String(c.base_url);
    if (c && c.api_key && !settings.apiKey) settings.apiKey = String(c.api_key);
    if (c && c.base_url && settings.baseUrl === String(c.base_url)) { /* keep */ }
    persistSettings();
  } catch (e) { /* pengaturan lanjut manual */ }
  updatePlanaiPill();
}

const fmtTok = (n) => Math.round(+n || 0).toLocaleString('id-ID');
function updatePlanaiPill() {
  const pill = document.getElementById('planaiPill');
  if (!pill) return;
  if (planai && planai.daily > 0) {
    pill.hidden = false;
    pill.className = 'pill quota' + (planai.remaining <= 0 ? ' dead' : '');
    pill.textContent = '\u26A1Plan AI ' + fmtTok(planai.remaining) + '/' + fmtTok(planai.daily) + ' token hari ini';
  } else {
    pill.hidden = true;
  }
}
function canPlanai() { return !!(planai && planai.daily > 0 && planai.remaining > 0); }
/* randomizer: satu pemakaian Plan AI = ~1.000 token, jumlah per kali tampak acak (konsisten per akun per hari) */
function planaiAmount() {
  let h = 2166136261;
  const s = 'planai:' + auth.u + ':' + new Date().toISOString().slice(0, 10);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  let seed = h >>> 0;
  const rnd = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return 800 + Math.floor(rnd() * 400);   /* 800–1.199 token */
}
async function planaiSpend() {
  let spent = planaiAmount();
  try {
    const r = await supaRpc('app_planai_spend', { u: auth.u, p: auth.p, t: auth.t, n: spent });
    if (r && r.spent !== undefined) planai = { daily: +r.daily, used: +r.used, remaining: +r.remaining };
    else planai = Object.assign({}, planai, { remaining: Math.max(0, (planai.remaining || 0) - spent), used: (planai.used || 0) + spent });
  } catch (e) {
    planai = Object.assign({}, planai, { remaining: Math.max(0, (planai.remaining || 0) - spent), used: (planai.used || 0) + spent });
  }
  updatePlanaiPill();
}

/* ---------------- system prompt ---------------- */
const SYSTEM_PROMPT = [
  'You are "AI Planner" — an AI that turns a feature idea into a concrete, build-ready plan.',
  'Answer in the SAME LANGUAGE the user writes in.',
  '',
  'For every FEATURE REQUEST, structure the answer EXACTLY in this markdown shape:',
  '## Goal',
  '2-3 sentences: what is built, for whom, and the core value.',
  '## Requirements',
  '- Bullets: functional, UX and non-functional requirements.',
  '## Task breakdown',
  '1. Milestone one',
  '   - concrete, small tasks under each milestone',
  'Use 3-6 milestones total; every task must be testable on its own.',
  '## Tech choices',
  '- Files to create or modify (wrap paths in `backticks`).',
  '- Stack/libraries with one-line reasons. Assume plain HTML/CSS/JS unless the user says otherwise.',
  '## Risks / gotchas',
  '- Short bullets: pitfalls, edge cases, security notes.',
  '',
  'Then finish with EXACTLY ONE fenced block tagged `prompt`, and nothing after it. That block holds a single, self-contained prompt a coding AI agent can execute to build the whole feature: goal, requirements, file structure, tech constraints, step-by-step order and acceptance criteria. Example shape:',
  '```prompt',
  '<the complete build prompt text>',
  '```',
  'No other fenced code blocks longer than 10 lines — this is a plan, not an implementation.',
  '',
  'If the user asks to ADJUST the plan ("add dark mode", "make it shorter"), keep the same structure, changed concisely.',
  'If the user asks something unrelated to building a feature, answer briefly and normally — no structure and NO prompt block — then steer back to planning.'
].join('\n');

/* ---------------- dom ---------------- */
const $ = (id) => document.getElementById(id);
const chatScroll = $('chatScroll');
const messagesEl = $('messages');
const welcomeEl  = $('welcome');
const inputEl    = $('input');
const sendBtn    = $('btnSend');
const listEl     = $('chatList');
const crumb      = $('crumbTitle');
const toastEl    = $('toast');
const statusEl   = $('apiStatus');
const modalEl    = $('modal');
const settingsModal = $('settingsModal');
const modelPill  = $('modelPill');
const apiBadge   = $('apiBadge');

const STAR_SVG = '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 3.2l2 5.8 5.8 2-5.8 2-2 5.8-2-5.8-5.8-2 5.8-2z"/></svg>';
const PLANE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>';
const STOP_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>';

/* ---------------- state ---------------- */
let chats = [];
let activeId = null;
let streaming = false;
let controller = null;

const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = window.mdEscape;
const active = () => chats.find((c) => c.id === activeId) || null;

/* ---------------- storage ---------------- */
function loadChats() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch (e) { return []; }
}
function saveChats() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(chats)); } catch (e) { /* quota */ }
}

/* ---------------- tiny ui helpers ---------------- */
let toastTimer = null;
function toast(msg, kind) {
  toastEl.textContent = msg;
  toastEl.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 4200);
}

let modalResolve = null;
function confirmModal(title, text, yesLabel) {
  return new Promise((resolve) => {
    $('modalTitle').textContent = title;
    $('modalText').textContent = text;
    $('modalYes').textContent = yesLabel || 'Delete';
    modalResolve = resolve;
    modalEl.hidden = false;
  });
}
function finishModal(v) {
  modalEl.hidden = true;
  const r = modalResolve; modalResolve = null;
  if (r) r(v);
}
$('modalYes').addEventListener('click', () => finishModal(true));
$('modalNo').addEventListener('click', () => finishModal(false));
modalEl.addEventListener('click', (e) => { if (e.target === modalEl) finishModal(false); });

async function copyText(text, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; }
  catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.setSelectionRange(0, ta.value.length);
      ok = document.execCommand('copy');
      ta.remove();
      if (document.activeElement) document.activeElement.blur();
    } catch (e2) { ok = false; }
  }
  if (btn) {
    btn.className = 'copy-btn' + (ok ? ' ok' : ' err');
    btn.textContent = ok ? '✓ Copied' : '✕ Failed';
    setTimeout(() => { btn.className = 'copy-btn'; btn.textContent = '⧉\u00A0Copy'; }, 1600);
  }
  return ok;
}

/* ---------------- api ---------------- */
function splitPrompt(text) {
  /* tolerate 3+ backticks, tag variants, and models that never close the fence */
  const re = /`{3,}[ \t]*(?:build[- ]?prompt|the build prompt|prompt|build)[^\n`]*\n([\s\S]*?)(?:`{3,}|$)/i;
  const m = text.match(re);
  if (!m) return { main: text, prompt: null, closed: false };
  return {
    main: text.slice(0, m.index),
    prompt: m[1].replace(/\n+$/, ''),
    closed: /`{3,}[ \t]*$/.test(m[0])
  };
}

function planCardHtml(promptText, closed) {
  return '<div class="plan-card' + (closed ? '' : ' open') + '">' +
    '<div class="plan-head"><span class="plan-emoji">🧩</span>' +
    '<div class="plan-titles"><strong>Build prompt</strong>' +
    '<span>copy &rarr; paste into any coding agent</span></div>' +
    '<button class="copy-btn" type="button">⧉\u00A0Copy</button></div>' +
    '<pre class="plan-body">' + esc(promptText) + '</pre></div>';
}

function renderAiContent(box, text, live) {
  if (live && !text.trim()) {
    box.innerHTML = '<div class="dots"><i></i><i></i><i></i></div>';
    return;
  }
  const p = splitPrompt(text);
  let html = p.main.trim() ? window.mdToHtml(p.main) : '';
  if (p.prompt != null) html += planCardHtml(p.prompt, p.closed);
  if (!html) html = '<p class="dim">&mdash;</p>';
  box.innerHTML = html;
  if (live && !box.querySelector('.plan-card')) {
    box.insertAdjacentHTML('beforeend', '<span class="cursor"></span>');
  }
}

async function streamChat(payload, onDelta, signal) {
  const res = await fetch(apiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + settings.apiKey },
    body: JSON.stringify(payload),
    signal: signal
  });
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try {
      const j = await res.json();
      if (j && j.error) msg = j.error.message || j.error.type || msg;
    } catch (e) { /* keep default */ }
    const ra = res.headers.get('retry-after');
    if (ra) msg += ' (retry in ' + ra + 's)';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (!res.body) {
    const j = await res.json();
    onDelta((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '');
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const ev = /\r?\n\r?\n/;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buf += dec.decode(chunk.value, { stream: true });
    for (;;) {
      const m = ev.exec(buf);
      if (!m) break;
      const part = buf.slice(0, m.index);
      buf = buf.slice(m.index + m[0].length);
      const lines = part.split(/\r?\n/);
      for (const raw of lines) {
        const line = raw.trim();
        if (line.indexOf('data:') !== 0) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const j = JSON.parse(data);
          const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
          if (d) onDelta(d);
        } catch (e) { /* ignore keep-alives */ }
      }
    }
  }
}

async function checkStatus() {
  setStatus('connecting\u2026', 'wait');
  try {
    const r = await fetch(modelsUrl(), { headers: { 'Authorization': 'Bearer ' + settings.apiKey } });
    if (!r.ok) {
      setStatus(r.status === 401 ? 'bad key \u2014 click to fix' : 'error ' + r.status + ' \u2014 click to retry', 'err');
      return;
    }
    setStatus('connected', 'ok');
  } catch (e) {
    setStatus('offline \u2014 click to retry', 'err');
  }
}
function setStatus(label, cls) {
  statusEl.className = 'status ' + (cls || '');
  statusEl.querySelector('span').textContent = label;
}
statusEl.addEventListener('click', () => {
  if (statusEl.classList.contains('err')) openSettings();
  else checkStatus();
});

/* ---------------- message rendering ---------------- */
function relTime(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'now';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  const dd = Math.floor(h / 24);
  if (dd < 7) return dd + 'd';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function appendMsgEl(role, content, opts) {
  const art = document.createElement('article');
  art.className = 'msg ' + (role === 'user' ? 'user' : 'ai');

  if (role === 'user') {
    const b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = content;
    art.appendChild(b);
    messagesEl.appendChild(art);
    return { el: art, box: b };
  }

  const av = document.createElement('span');
  av.className = 'avatar';
  av.innerHTML = STAR_SVG;
  const inner = document.createElement('div');
  inner.className = 'ai-inner';
  const box = document.createElement('div');
  box.className = 'ai-content';
  inner.appendChild(box);
  art.appendChild(av);
  art.appendChild(inner);
  messagesEl.appendChild(art);
  renderAiContent(box, content, !!(opts && opts.live));
  return { el: art, box: box };
}

function renderMessages() {
  messagesEl.innerHTML = '';
  const c = active();
  if (!c) return;
  c.messages.forEach((m) => appendMsgEl(m.role, m.content, { live: false }));
}

function nearBottom() {
  return chatScroll.scrollHeight - chatScroll.scrollTop - chatScroll.clientHeight < 140;
}
function scrollToBottom(force) {
  if (force || nearBottom()) chatScroll.scrollTop = chatScroll.scrollHeight;
}

/* ---------------- sidebar ---------------- */
function renderSidebar() {
  listEl.innerHTML = '';
  if (!chats.length) {
    listEl.innerHTML = '<div class="list-empty">No chats yet.<br>Describe a feature to plan.</div>';
    return;
  }
  chats.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'chat-item' + (c.id === activeId ? ' active' : '');
    item.dataset.id = c.id;
    item.innerHTML =
      '<span class="pulse"></span>' +
      '<div class="ci-main" style="flex:1;min-width:0;display:flex;align-items:center;gap:8px">' +
      '<span class="ci-title"></span>' +
      (c.id === activeId ? '' : '<span class="ci-time"></span>') +
      '</div>' +
      '<div class="ci-actions">' +
      '<button class="mini" data-act="rename" title="Rename" type="button"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg></button>' +
      '<button class="mini del" data-act="del" title="Delete" type="button"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>' +
      '</div>';
    item.querySelector('.ci-title').textContent = c.title || 'New chat';
    const time = item.querySelector('.ci-time');
    if (time) time.textContent = relTime(c.updated);
    listEl.appendChild(item);
  });
}

function setHeader(c) {
  crumb.textContent = c ? (c.title || 'New chat') : 'AI Planner';
  document.title = (c && c.title ? c.title + ' \u2014 ' : '') + 'AI Planner';
}

function openChat(id) {
  if (activeId && id !== activeId) {
    const cur = active();
    if (cur && cur.messages.length === 0) {
      chats = chats.filter((x) => x.id !== activeId);
    }
  }
  activeId = id || null;
  const c = active();
  setHeader(c);
  renderSidebar();
  renderMessages();
  welcomeEl.hidden = !!(c && c.messages.length);
  scrollToBottom(true);
}

function newChat() {
  const c = { id: uid(), title: '', updated: Date.now(), messages: [] };
  chats.unshift(c);
  saveChats();
  openChat(c.id);
  document.body.classList.remove('drawer');
  inputEl.focus();
}

listEl.addEventListener('click', (e) => {
  const actBtn = e.target.closest('[data-act]');
  if (actBtn) {
    const item = actBtn.closest('.chat-item');
    if (!item) return;
    if (actBtn.dataset.act === 'del') requestDelete(item.dataset.id);
    else startRename(item, item.dataset.id);
    return;
  }
  const item = e.target.closest('.chat-item');
  if (item && !item.classList.contains('renaming')) {
    document.body.classList.remove('drawer');
    openChat(item.dataset.id);
  }
});

async function requestDelete(id) {
  const c = chats.find((x) => x.id === id);
  if (!c) return;
  const ok = await confirmModal('Delete this chat?',
    '\u201C' + (c.title || 'New chat') + '\u201D and its plan will be removed from this device. This cannot be undone.',
    'Delete');
  if (!ok) return;
  chats = chats.filter((x) => x.id !== id);
  saveChats();
  if (activeId === id) {
    activeId = null;
    openChat(chats.length ? chats[0].id : null);
  } else {
    renderSidebar();
  }
}

function startRename(item, id) {
  const c = chats.find((x) => x.id === id);
  if (!c) return;
  item.classList.add('renaming');
  const span = item.querySelector('.ci-title');
  const inp = document.createElement('input');
  inp.className = 'ci-edit';
  inp.value = c.title || '';
  inp.maxLength = 60;
  span.replaceWith(inp);
  inp.focus();
  inp.select();
  let done = false;
  const commit = (save) => {
    if (done) return;
    done = true;
    if (save && inp.value.trim()) c.title = inp.value.trim();
    saveChats();
    if (c.id === activeId) setHeader(c);
    renderSidebar();
  };
  inp.addEventListener('click', (e) => e.stopPropagation());
  inp.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); commit(true); }
    if (e.key === 'Escape') { e.preventDefault(); commit(false); }
  });
  inp.addEventListener('blur', () => commit(true));
}

/* ---------------- send / stream ---------------- */
function updateSendBtn() {
  const has = inputEl.value.trim().length > 0;
  if (streaming) {
    sendBtn.className = 'send stop';
    sendBtn.disabled = false;
    sendBtn.title = 'Stop generating';
    sendBtn.innerHTML = STOP_SVG;
  } else {
    sendBtn.className = 'send';
    sendBtn.title = 'Send';
    sendBtn.disabled = !has;
    sendBtn.innerHTML = PLANE_SVG;
  }
}

function fitInput() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 180) + 'px';
}

function setStreamUI(on) {
  streaming = on;
  updateSendBtn();
}

async function send() {
  if (streaming) return;
  if (auth && planai && planai.daily > 0 && !canPlanai()) { toast('Kuota Plan AI hari ini sudah habis. Reset otomatis tengah malam WIB.', 'err'); return; }
  if (!settings.baseUrl || !settings.apiKey) { toast('Pengaturan API belum terisi — buka ⚙ untuk mengatur, atau muat ulang setelah login.', 'err'); return; }
  const text = inputEl.value.trim();
  if (!text) return;

  let chat = active();
  if (!chat) { newChat(); chat = active(); }
  if (!chat) return;
  chat.messages.push({ role: 'user', content: text });
  if (!chat.title) {
    chat.title = text.length > 46 ? text.slice(0, 46).trimEnd() + '\u2026' : text;
    setHeader(chat);
  }
  welcomeEl.hidden = true;

  appendMsgEl('user', text);
  scrollToBottom(true);
  inputEl.value = '';
  fitInput();
  updateSendBtn();

  const aiMsg = { role: 'assistant', content: '' };
  const refs = appendMsgEl('assistant', '', { live: true });
  const box = refs.box;
  chat.messages.push(aiMsg);

  const history = chat.messages
    .filter((m) => m !== aiMsg && m.content && m.content.trim())
    .slice(-MAX_HISTORY);
  const payload = {
    model: settings.model,
    temperature: settings.temperature,
    stream: true,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }].concat(history)
  };

  let pending = false;
  const pump = () => {
    if (pending || !box.isConnected) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (!box.isConnected) return;
      const stick = nearBottom();
      renderAiContent(box, aiMsg.content, true);
      if (stick) chatScroll.scrollTop = chatScroll.scrollHeight;
    });
  };

  controller = new AbortController();
  setStreamUI(true);

  try {
    await streamChat(payload, (d) => { aiMsg.content += d; pump(); }, controller.signal);
  } catch (e) {
    if (e && e.name === 'AbortError') {
      if (aiMsg.content.trim()) aiMsg.content += '\n\n> *— stopped —*';
    } else {
      let note;
      if (e && e.status === 401) note = 'API key was rejected (401).';
      else if (e && (e.status === 429 || e.status === 503)) note = 'No provider is free right now — try again in a moment.';
      else if (e && e.status === 400) note = 'The request was rejected (400): ' + e.message;
      else note = 'Request failed: ' + ((e && e.message) || e);
      aiMsg.content += (aiMsg.content.trim() ? '\n\n' : '') + '> ⚠️ ' + note;
      toast(note, 'err');
    }
  } finally {
    setStreamUI(false);
    controller = null;
    chat.updated = Date.now();
    if (aiMsg.content.trim() && auth && planai && planai.daily > 0) planaiSpend();
    if (!aiMsg.content.trim()) {
      const i = chat.messages.indexOf(aiMsg);
      if (i > -1) chat.messages.splice(i, 1);
      if (box.isConnected) box.closest('.msg').remove();
      if (!chat.messages.length) {
        chats = chats.filter((x) => x.id !== chat.id);
        activeId = null;
        openChat(null);
      }
    } else if (box.isConnected) {
      renderAiContent(box, aiMsg.content, false);
    }
    chats.sort((a, b) => b.updated - a.updated);
    saveChats();
    renderSidebar();
  }
}

sendBtn.addEventListener('click', () => {
  if (streaming) { if (controller) controller.abort(); }
  else send();
});

inputEl.addEventListener('input', () => { fitInput(); updateSendBtn(); });
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

/* copy via event delegation (cards re-render while streaming) */
messagesEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.copy-btn');
  if (!btn) return;
  const card = btn.closest('.plan-card');
  const pre = card && card.querySelector('.plan-body');
  if (pre) copyText(pre.textContent, btn);
});

/* ---------------- drawer / chips ---------------- */
$('btnMenu').addEventListener('click', () => document.body.classList.toggle('drawer'));
$('btnNew').addEventListener('click', newChat);
$('scrim').addEventListener('click', () => document.body.classList.remove('drawer'));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.body.classList.remove('drawer');
    if (!settingsModal.hidden) { closeSettings(); return; }
    if (!modalEl.hidden) finishModal(false);
  }
});

/* kembali ke aplikasi Xozen AI memakai tautan "Buka Xozen AI" di sidebar */

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    inputEl.value = chip.dataset.q || chip.textContent;
    fitInput();
    updateSendBtn();
    send();
  });
});

/* ---------------- settings modal ---------------- */
function updateApiChrome() {
  modelPill.textContent = '\u26A1' + settings.model;
  let host = '';
  try { host = new URL(apiBase()).host; } catch (e) { host = apiBase(); }
  apiBadge.textContent = 'API \u00B7 ' + host;
}
function openSettings() {
  $('setBaseUrl').value = settings.baseUrl;
  $('setApiKey').value = settings.apiKey;
  $('setModel').value = settings.model;
  $('setTemp').value = settings.temperature;
  $('setTestOut').textContent = '';
  $('setTestOut').className = 'test-out';
  settingsModal.hidden = false;
}
function closeSettings() { settingsModal.hidden = true; }

$('btnSettings').addEventListener('click', openSettings);
$('setCancel').addEventListener('click', closeSettings);
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) closeSettings(); });

$('setEye').addEventListener('click', () => {
  const k = $('setApiKey');
  const show = k.type === 'password';
  k.type = show ? 'text' : 'password';
  $('setEye').innerHTML = show
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
});

/* probe whatever is currently typed in the fields (not the saved values) */
$('setTest').addEventListener('click', async () => {
  const out = $('setTestOut');
  let b = ($('setBaseUrl').value || '').trim().replace(/\/+$/, '');
  if (!/\/v\d+$/i.test(b)) b += '/v1';
  out.textContent = 'testing\u2026';
  out.className = 'test-out';
  try {
    const r = await fetch(b + '/models', { headers: { Authorization: 'Bearer ' + $('setApiKey').value } });
    if (!r.ok) {
      out.textContent = r.status === 401 ? '\u2715 Key rejected (401)' : '\u2715 ' + r.status;
      out.className = 'test-out err';
      return;
    }
    const j = await r.json();
    const n = (j && j.data && j.data.length) ? j.data.length : 0;
    out.textContent = '\u2713 Connected \u00B7 ' + n + ' models';
    out.className = 'test-out ok';
  } catch (e) {
    out.textContent = '\u2715 Could not reach ' + b;
    out.className = 'test-out err';
  }
});

$('setSave').addEventListener('click', () => {
  const b = ($('setBaseUrl').value || '').trim();
  if (!b) { toast('Base URL is required', 'err'); return; }
  let t = parseFloat($('setTemp').value);
  if (!isFinite(t)) t = DEFAULTS.temperature;
  settings = {
    baseUrl: b.replace(/\/+$/, ''),
    apiKey: ($('setApiKey').value || '').trim(),
    model: ($('setModel').value || '').trim() || DEFAULTS.model,
    temperature: Math.min(2, Math.max(0, t))
  };
  persistSettings();
  updateApiChrome();
  checkStatus();
  closeSettings();
  toast('Settings saved \u2014 used for your next messages');
});

$('setReset').addEventListener('click', async () => {
  const ok = await confirmModal('Reset settings?',
    'Base URL, API key, model and temperature return to the built-in defaults.',
    'Reset');
  if (!ok) return;
  settings = Object.assign({}, DEFAULTS);
  persistSettings();
  updateApiChrome();
  checkStatus();
  closeSettings();
  toast('Defaults restored');
});

/* ---------------- init ---------------- */
(async function init() {
  chats = loadChats()
    .filter((c) => c && Array.isArray(c.messages) && c.messages.length)
    .sort((a, b) => (b.updated || 0) - (a.updated || 0));
  if (chats.length) openChat(chats[0].id);
  else openChat(null);

  auth = loadAuth();
  if (!auth) { showGate('login'); return; }   /* tidak punya sesi Xozen AI → gate */

  await bootstrapAccount();                   /* plan + kuota Plan AI + cfg API */
  if (!auth || (planai.daily > 0 && planai.remaining <= 0)) updateSendBtn();

  updateApiChrome();
  updateSendBtn();
  fitInput();
  checkStatus();
  setInterval(checkStatus, 90000);
  hideBoot();
})();



