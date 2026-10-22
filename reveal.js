/* ============================================================
   Animasi landing Xozen AI — reveal saat scroll, stagger, angka
   statistik yang naik, kartu demo melayang. Ringan & hormati
   prefers-reduced-motion. Dipakai bersama CSS "landing animasi"
   di site.css. Tanpa dependensi.
   ============================================================ */
(function () {
  'use strict';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (!('IntersectionObserver' in window) || reduce) return;   /* tanpa IO / reduce-motion: tampilkan langsung */

  document.documentElement.classList.add('has-reveal');

  var items = [];   /* [el, delayMs] */
  function add(el, delay) {
    if (!el || el._rv || !document.documentElement.contains(el)) return;
    el._rv = true;
    items.push([el, delay]);
  }
  function forEach(sel, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), fn);
  }

  /* 1) Hero: urutan eksplisit — judul → lead → CTA → catatan → kartu demo */
  var H = ['.hero h1', '.hero p.lead', '.hero .hero-cta', '.hero .hero-note', '.hero .code-demo'];
  H.forEach(function (sel, i) {
    add(document.querySelector(sel), 120 + i * 110);
  });

  /* 2) Pijakan layar pertama (chooser) */
  var order = 0;
  ['.chooser .eyebrow', '.chooser h1', '.chooser .chooser-lead', '.chooser .service-option'].forEach(function (sel) {
    forEach(sel, function (el) { add(el, 140 + (order++) * 95); });
  });

  /* 3) Sisa halaman: tiap section mendapat cascade sendiri */
  ['.sec-head', '.card', '.plan', '.post', 'details.faq'].forEach(function (sel) {
    forEach(sel, function (el) {
      var sec = el.closest('section') || document.body;
      if (!sec._rvi) sec._rvi = 0;
      add(el, 60 + Math.min(8, sec._rvi++) * 90);
    });
  });

  if (!items.length) return;

  /* tag + delay per elemen */
  items.forEach(function (p) {
    var el = p[0];
    el.setAttribute('data-rv', '');
    el.style.setProperty('--rd', p[1] + 'ms');
    el._rvDelay = p[1];
  });

  /* angka statistik: dihitung saat kartunya masuk */
  function countUp(node) {
    var raw = node.nodeValue || '';
    var m = raw.match(/[\d][\d.]*/);
    if (!m) return;
    var target = parseFloat(m[0].replace(/\./g, ""));
    if (!(target > 0)) return;
    var start = null, dur = 1000, trail = raw.slice(m.index + m[0].length);
    function tick(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / dur);
      var ease = 1 - Math.pow(1 - t, 3);
      var v = Math.round(target * ease);
      node.nodeValue = (v ? v.toLocaleString("id-ID") : "0") + trail;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      io.unobserve(el);
      el.classList.add('in');
      setTimeout(function () { el.classList.add('rv-done'); }, (el._rvDelay || 0) + 820);
      if (el.classList.contains('code-demo')) {
        setTimeout(function () { el.classList.add('floaty'); }, (el._rvDelay || 0) + 860);
      }
      Array.prototype.forEach.call(el.querySelectorAll('.stat .sprime, .stat'), function (st) {
        if (st._ct) return;
        st._ct = true;
        var n = firstNumberNode(st);
        if (n) setTimeout(function () { countUp(n); }, 220);
      });
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });

  function firstNumberNode(st) {
    for (var k = 0; k < st.childNodes.length; k++) {
      var n = st.childNodes[k];
      if (n.nodeType === 3 && /[\d]/.test(n.nodeValue)) return n;
    }
    return null;
  }

  items.forEach(function (p) { io.observe(p[0]); });
})();
