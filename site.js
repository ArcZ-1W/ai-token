/* Xozen AI — skrip kecil untuk situs (menu mobile, tahun, animasi ringan) */
(function () {
  'use strict';

  /* menu mobile */
  var t = document.querySelector('.nav-toggle');
  var nav = document.getElementById('nav');
  if (t && nav) {
    t.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      t.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('open'); t.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { nav.classList.remove('open'); t.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* tahun di footer */
  Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* hanya satu FAQ terbuka pada satu waktu */
  var faqs = document.querySelectorAll('details.faq');
  Array.prototype.forEach.call(faqs, function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      Array.prototype.forEach.call(faqs, function (o) { if (o !== d) o.open = false; });
    });
  });

  /* sorot tautan halaman aktif */
  var here = location.pathname.replace(/index\.html$/, '');
  Array.prototype.forEach.call(document.querySelectorAll('.nav a'), function (a) {
    try {
      var p = new URL(a.getAttribute('href'), location.href).pathname.replace(/index\.html$/, '');
      if (p === here) a.setAttribute('aria-current', 'page');
    } catch (e) {}
  });

  /* ======================================================================
     Demo ketik sendiri di hero: pengguna minta HTML, AI menuliskan kodenya.
     ====================================================================== */
  var cdBody = document.getElementById('cdBody');
  if (cdBody) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var CODE = ['<!DOCTYPE html>', '<html lang="id">', '<head>', '  <meta charset="UTF-8">',
      '  <title>Kopi Senja</title>', '  <link rel="stylesheet" href="style.css">', '</head>', '<body>',
      '  <header>', '    <h1>Kopi Senja</h1>', '    <p>Kopi hangat, teman kerja.</p>', '  </header>',
      '</body>', '</html>'];
    var SCRIPT = [
      { k: 'u', t: 'buatkan html landing page untuk kedai kopi, simpel & rapi' },
      { k: 'a', t: 'Baik, berikut HTML-nya:' },
      { k: 'c', lines: CODE }
    ];

    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function highlight(line) {
      return esc(line)
        .replace(/(&lt;\/?)([a-zA-Z0-9!-]+)/g, '$1<span class="tag">$2</span>')
        .replace(/([a-zA-Z-]+)=(&quot;[^&]*&quot;)/g, '<span class="attr">$1</span>=<span class="str">$2</span>');
    }
    var caret = null;
    function scrollLatest() { cdBody.scrollTop = cdBody.scrollHeight; }
    function putCaret(node) {
      if (caret && caret.parentNode) caret.parentNode.removeChild(caret);
      caret = el('span', 'cd-caret');
      caret.setAttribute('aria-hidden', 'true');
      node.appendChild(caret);
    }
    function clearAll() { cdBody.innerHTML = ''; caret = null; }

    /* render lengkap tanpa animasi (reduced motion / tangkapan layar) */
    function renderStatic() {
      clearAll();
      SCRIPT.forEach(function (st) {
        if (st.k === 'c') {
          var box = el('div', 'cd-msg code');
          box.appendChild(el('div', 'cd-code-head', 'index.html'));
          var pre = el('pre', 'cd-pre');
          st.lines.forEach(function (l) {
            var ln = el('span', 'ln');
            ln.innerHTML = highlight(l) || '&nbsp;';
            pre.appendChild(ln);
          });
          box.appendChild(pre);
          cdBody.appendChild(box);
        } else {
          cdBody.appendChild(el('div', 'cd-msg ' + st.k, st.t));
        }
      });
    }

    function typeSteps(i, done) {
      if (i >= SCRIPT.length) { done(); return; }
      var st = SCRIPT[i];
      if (st.k === 'c') {
        var box = el('div', 'cd-msg code');
        box.appendChild(el('div', 'cd-code-head', 'index.html'));
        var pre = el('pre', 'cd-pre');
        box.appendChild(pre);
        cdBody.appendChild(box);
        var li = 0;
        (function nextLine() {
          if (li >= st.lines.length) { done(); return; }
          var line = st.lines[li], ln = el('span', 'ln'), ci = 0;
          pre.appendChild(ln);
          putCaret(ln);
          (function typeChar() {
            if (ci >= line.length) {
              ln.innerHTML = highlight(line) || '&nbsp;';
              li++;
              setTimeout(nextLine, 90);
              return;
            }
            ln.textContent = line.slice(0, ++ci);
            ln.appendChild(caret);
            scrollLatest();
            setTimeout(typeChar, 9);
          })();
        })();
        return;
      }
      var msg = el('div', 'cd-msg ' + st.k);
      cdBody.appendChild(msg);
      putCaret(msg);
      var n = 0;
      (function typeChar() {
        if (n >= st.t.length) { setTimeout(function () { typeSteps(i + 1, done); }, st.k === 'u' ? 420 : 320); return; }
        msg.textContent = st.t.slice(0, ++n);
        msg.appendChild(caret);
        scrollLatest();
        setTimeout(typeChar, st.k === 'u' ? 34 : 18);
      })();
    }

    function loop() {
      if (document.hidden) { setTimeout(loop, 600); return; }
      clearAll();
      setTimeout(function () {
        typeSteps(0, function () {
          if (caret && caret.parentNode) caret.parentNode.removeChild(caret);
          setTimeout(loop, 3400);
        });
      }, 420);
    }

    if (reduce) renderStatic();
    else { renderStatic(); setTimeout(function () { clearAll(); loop(); }, 2600); }
  }
})();
