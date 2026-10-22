/* ============================================================
   md.js — tiny dependency-free markdown renderer (XSS-safe).
   Escapes all HTML first, so no injected markup can survive.
   Exposes: window.mdToHtml(text), window.mdEscape(text)
   ============================================================ */
(function () {
  'use strict';

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function inline(s) {
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/~~([^~]+?)~~/g, '<del>$1</del>');
    s = s.replace(/(^|[\s(\[«"“'])([_*])([^*_\n]+)\2(?=[\s).,;:!?'"”»)\]]|$)/g,
      '$1<em>$3</em>');
    return s;
  }

  function cbHtml(b) {
    var lang = b && b.lang ? String(b.lang).replace(/[^a-zA-Z0-9_-]/g, '') : '';
    return '<pre class="md-code"' + (lang ? ' data-lang="' + lang + '"' : '') +
      '><code>' + (b ? b.code : '') + '</code></pre>';
  }

  function parse(src) {
    src = String(src == null ? '' : src).replace(/\r\n?/g, '\n').trim();
    if (!src) return '';
    src = esc(src);

    /* fenced code blocks -> placeholders (supports an UNCLOSED fence,
       so the build-prompt and code render fine while streaming) */
    var blocks = [];
    src = src.replace(/`{3,}([^\n`]*)\n?([\s\S]*?)(?:`{3,}|$)/g, function (_, lang, code) {
      blocks.push({ lang: (lang || '').trim(), code: code.replace(/\n$/, '') });
      return '\u0000CB' + (blocks.length - 1) + '\u0000';
    });

    var lines = src.split('\n');
    var out = '', i = 0, list = null, para = [];

    function flushPara() {
      if (!para.length) return;
      out += '<p>' + para.map(inline).join('<br>') + '</p>';
      para = [];
    }
    function flushList() {
      if (!list) return;
      var tag = list.type, top = [], cur = null;
      for (var k = 0; k < list.items.length; k++) {
        var it = list.items[k];
        if (it.depth === 0 || !cur) { cur = { html: it.html, kids: [] }; top.push(cur); }
        else cur.kids.push(it.html);
      }
      var html = '';

      for (var k = 0; k < top.length; k++) {
        var t2 = top[k];
        html += '<li>' + t2.html +
          (t2.kids.length ? '<' + tag + '>' + t2.kids.map(function (kk) { return '<li>' + kk + '</li>'; }).join('') + '</' + tag + '>' : '') +
          '</li>';
      }
      out += '<' + tag + '>' + html + '</' + tag + '>';
      list = null;
    }
    function flushAll() { flushPara(); flushList(); }
    for (i = 0; i < lines.length; i++) {
      var line = lines[i], t = line.trim(), m;

      if (/^\u0000CB\d+\u0000\s*$/.test(t)) {
        flushAll(); out += cbHtml(blocks[+t.match(/\d+/)[0]]); continue;
      }

      if (!t) { flushAll(); continue; }

      m = t.match(/^(#{1,5})\s+(.+)$/);
      if (m) {
        flushAll();
        var lvl = Math.min(m[1].length + 1, 5);
        out += '<h' + lvl + '>' + inline(m[2]) + '</h' + lvl + '>';
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flushAll(); out += '<hr>'; continue; }

      if (t.indexOf('&gt;') === 0) {
        flushAll();
        m = [];
        while (i < lines.length && lines[i].trim().indexOf('&gt;') === 0) {
          m.push(lines[i].trim().replace(/^&gt;\s?/, ''));
          i++;
        }
        i--;
        out += '<blockquote><p>' + m.map(inline).join('<br>') + '</p></blockquote>';
        continue;
      }

      if (t.indexOf('|') === 0 && i + 1 < lines.length &&
          lines[i + 1].indexOf('|') !== -1 &&
          /^[\s|:\-]+$/.test(lines[i + 1].trim()) && /-{3,}/.test(lines[i + 1])) {
        flushAll();
        var rows = [];
        while (i < lines.length && lines[i].trim().indexOf('|') === 0) { rows.push(lines[i].trim()); i++; }
        i--;
        var cellsOf = function (r) {
          var s = r.replace(/^\|/, '').replace(/\|$/, '');
          return s.split('|').map(function (c) { return c.trim(); });
        };
        var tbl = '<table><thead><tr>' + cellsOf(rows[0]).map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        for (var r = 2; r < rows.length; r++) {
          tbl += '<tr>' + cellsOf(rows[r]).map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
        }
        out += tbl + '</tbody></table>';
        continue;
      }

      m = t.match(/^([-*+])\s+(.+)$/);
      var ol = t.match(/^\d{1,3}[.)]\s+(.+)$/);
      if (m || ol) {
        flushPara();
        var type = m ? 'ul' : 'ol';
        var depth = /^[\t ]{2,}/.test(line) ? 1 : 0;
        if (!list) {
          list = { type: type, items: [] };
        } else if (list.type !== type) {
          if (depth === 1 && list.items.length) {
            list.items.push({ depth: 1, html: inline((m ? m[2] : ol[1]).trim()) });
            continue;
          }
          flushList();
          list = { type: type, items: [] };
        }
        list.items.push({ depth: depth, html: inline((m ? m[2] : ol[1]).trim()) });
        continue;
      }

      flushList();
      para.push(t);
    }
    flushAll();

    out = out.replace(/\u0000CB(\d+)\u0000/g, function (_, n) { return cbHtml(blocks[+n]); });
    return out;
  }

  if (typeof window !== 'undefined') {
    window.mdToHtml = parse;
    window.mdEscape = esc;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mdToHtml: parse, mdEscape: esc };
  }
})();


