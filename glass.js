/* ==========================================================================
   GlassSurface — port React Bits ke JavaScript vanilla
   Sumber: https://www.reactbits.dev/components/glass-surface
   (component aslinya React + Tailwind; situs ini HTML/CSS/JS biasa, jadi
    efek "liquid glass" dibangun ulang tanpa dependensi apa pun)

   Yang direproduksi:
   - peta simpangan (displacement map) SVG -> feDisplacementMap
   - pemisahan kanal RGB + feBlend "screen" -> efek optik seperti optik kamera
   - backdrop-filter: url(#filter) -> latar BELOKUNG di tepi panel
   - fallback frosted (blur + saturate) untuk Safari/Firefox & browser lama

   Cara pakai di HTML:
     <div class="card" data-glass="refract"> ... </div>   -> efek penuh
     <div class="card" data-glass> ... </div>              -> frosted saja
     <div class="card"> ... </div>                          -> frosted (CSS)

   Opsi per elemen (opsional):
     data-glass-radius="20"        border radius peta simpangan
     data-glass-blur="11"           stdDeviation feGaussianBlur
     data-glass-distortion="-180"   kekuatan pembelokan tepi
     data-glass-saturation="1.6"    saturate() pada backdrop-filter
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- konfigurasi */
  var OPT = {
    blur: 11,              /* stdDeviation feGaussianBlur peta simpangan */
    borderRadius: 20,      /* rx kotak peta simpangan (ditimpa dari CSS) */
    borderWidth: 0.07,     /* lebar "tepi"-area dalam peta simpangan */
    brightness: 50,        /* kecerahan area dalam peta */
    opacity: 0.93,
    saturation: 1.6,       /* saturate() pada backdrop-filter */
    distortionScale: -180, /* skala feDisplacementMap */
    redOffset: 0,
    greenOffset: 10,
    blueOffset: 20,
    xChannel: 'R',
    yChannel: 'G',
    mixBlendMode: 'difference',
    displace: 0            /* stdDeviation feGaussianBlur akhir */
  };

  var NS_SVG = 'http://www.w3.org/2000/svg';
  var uid = 0;
  var instances = [];
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------------------------------------------------------------- deteksi dukungan */
  function supportsRefraction() {
    var ua = navigator.userAgent || '';
    var isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua);
    var isFirefox = /Firefox/i.test(ua);
    /* Safari & Firefox tidak bisa backdrop-filter: url(#svgFilter) -> pakai frosted */
    if (isSafari || isFirefox) return false;
    if (window.CSS && CSS.supports) {
      try {
        return CSS.supports('backdrop-filter', 'url(#x)') ||
          CSS.supports('-webkit-backdrop-filter', 'url(#x)');
      } catch (e) { /* diabaikan */ }
    }
    return true;
  }

  var CAN_REFRACT = supportsRefraction();

  /* ---------------------------------------------------------------- peta simpangan */
  /* Peta ini yang bikin tepi panel "membelok" isi di belakangnya.
     Dibuat per-ukuran elemen, makanya dibuat ulang saat elemen berubah ukuran. */
  function buildMap(w, h, o) {
    var edge = Math.min(w, h) * (o.borderWidth * 0.5);
    var r = o.borderRadius;
    var innerW = Math.max(0, w - edge * 2);
    var innerH = Math.max(0, h - edge * 2);
    var svg =
      '<svg xmlns="' + NS_SVG + '" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
        '<defs>' +
          '<linearGradient id="rg" x1="100%" y1="0%" x2="0%" y2="0%">' +
            '<stop offset="0%" stop-color="#0000"/>' +
            '<stop offset="100%" stop-color="red"/>' +
          '</linearGradient>' +
          '<linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">' +
            '<stop offset="0%" stop-color="#0000"/>' +
            '<stop offset="100%" stop-color="blue"/>' +
          '</linearGradient>' +
          '<filter id="soft" filterUnits="userSpaceOnUse" x="0" y="0" width="' + w + '" height="' + h + '" color-interpolation-filters="sRGB">' +
            '<feGaussianBlur stdDeviation="' + o.blur + '"/>' +
          '</filter>' +
        '</defs>' +
        '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="black"/>' +
        '<rect x="0" y="0" width="' + w + '" height="' + h + '" rx="' + r + '" fill="url(#rg)"/>' +
        '<rect x="0" y="0" width="' + w + '" height="' + h + '" rx="' + r + '" fill="url(#bg)" style="mix-blend-mode:' + o.mixBlendMode + '"/>' +
        '<rect x="' + edge + '" y="' + edge + '" width="' + innerW + '" height="' + innerH + '" rx="' + r + '" fill="hsl(0 0% ' + o.brightness + '% / ' + o.opacity + ')" filter="url(#soft)"/>' +
      '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  /* ---------------------------------------------------------------- filter refraction */
  function buildFilterMarkup(o) {
    function channel(result, matrix) {
      return '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + o.distortionScale +
        '" xChannelSelector="' + o.xChannel + '" yChannelSelector="' + o.yChannel +
        '" result="' + result + '"/>' +
        '<feColorMatrix in="' + result + '" type="matrix" values="' + matrix + '" result="' + result + 'c"/>';
    }
    return (
      '<feImage x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"/>' +
      channel('dispRed', '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0') +
      channel('dispGreen', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0') +
      channel('dispBlue', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0') +
      '<feBlend in="dispRedc" in2="dispGreenc" mode="screen" result="rg"/>' +
      '<feBlend in="rg" in2="dispBluec" mode="screen" result="output"/>' +
      '<feGaussianBlur in="output" stdDeviation="' + o.displace + '"/>'
    );
  }

  /* ---------------------------------------------------------------- kelas GlassSurface */
  function GlassSurface(el, options) {
    this.el = el;
    this.o = merge(OPT, options || {});
    this.id = 'glass-filter-' + (++uid);
    this.mapUrl = '';
    this.raf = 0;
    this.ro = null;
    this.build();
  }

  function merge(base, extra) {
    var out = {}, k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k) && extra[k] !== null && extra[k] !== undefined) out[k] = extra[k];
    return out;
  }

  GlassSurface.prototype.build = function () {
    var el = this.el;
    var self = this;

    el.classList.add('glass-surface');

    if (!CAN_REFRACT) {
      /* Safari / Firefox / browser tanpa dukungan -> frosted glass saja */
      el.classList.add('glass-surface--fallback');
      return;
    }

    el.classList.add('glass-surface--svg');
    el.style.setProperty('--filter-id', 'url(#' + this.id + ')');
    el.style.setProperty('--glass-saturation', String(this.o.saturation));

    var svg = document.createElementNS(NS_SVG, 'svg');
    svg.setAttribute('class', 'glass-surface__filter');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    var defs = document.createElementNS(NS_SVG, 'defs');
    var filter = document.createElementNS(NS_SVG, 'filter');
    filter.setAttribute('id', this.id);
    filter.setAttribute('colorInterpolationFilters', 'sRGB');
    filter.setAttribute('x', '0%');
    filter.setAttribute('y', '0%');
    filter.setAttribute('width', '100%');
    filter.setAttribute('height', '100%');
    filter.innerHTML = buildFilterMarkup(this.o);

    defs.appendChild(filter);
    svg.appendChild(defs);
    el.appendChild(svg);

    this.svg = svg;
    this.filter = filter;
    this.feImage = filter.querySelector('feImage');

    this.sync();

    /* regenerate peta ketika ukuran panel berubah */
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(function () { self.scheduleSync(); });
      this.ro.observe(el);
    } else {
      window.addEventListener('resize', function () { self.scheduleSync(); });
    }

    /* panel yang awalnya tersembunyi (display:none) punya ukuran 0 -> peta
       belum bisa dibuat. Sinkron ulang begitu panel masuk layar. */
    if (window.IntersectionObserver) {
      this.io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) { self.sync(); self.io.disconnect(); }
        }
      }, { rootMargin: '200px' });
      this.io.observe(el);
    }

    /* pantulan cahaya yang mengikuti kursor (memberi kesan "cair") */
    if (!reduceMotion && window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        el.style.setProperty('--glass-light-x', (((e.clientX - r.left) / r.width) * 100).toFixed(2) + '%');
        el.style.setProperty('--glass-light-y', (((e.clientY - r.top) / r.height) * 100).toFixed(2) + '%');
      });
      el.addEventListener('pointerleave', function () {
        el.style.setProperty('--glass-light-x', '50%');
        el.style.setProperty('--glass-light-y', '-10%');
      });
    }
  };

  GlassSurface.prototype.scheduleSync = function () {
    if (this.raf) return;
    var self = this;
    this.raf = window.requestAnimationFrame(function () {
      self.raf = 0;
      self.sync();
    });
  };

  GlassSurface.prototype.sync = function () {
    if (!this.feImage) return;
    var rect = this.el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));

    /* radius mengikuti CSS elemen supaya simpangan tidak keluar panel */
    var radius = this.o.borderRadius;
    try {
      var cs = getComputedStyle(this.el);
      var r = parseFloat(cs.borderTopLeftRadius) || parseFloat(cs.borderRadius);
      if (isFinite(r) && r > 0) radius = r;
    } catch (e) { /* abaikan */ }

    var url = buildMap(w, h, merge(this.o, { borderRadius: radius }));
    if (url === this.mapUrl) return;
    this.mapUrl = url;
    this.feImage.setAttribute('href', url);
  };

  /* ---------------------------------------------------------------- inisialisasi */
  function readOptions(el) {
    var o = {};
    var map = {
      'data-glass-radius': 'borderRadius',
      'data-glass-blur': 'blur',
      'data-glass-distortion': 'distortionScale',
      'data-glass-saturation': 'saturation',
      'data-glass-displace': 'displace'
    };
    for (var attr in map) {
      if (!Object.prototype.hasOwnProperty.call(map, attr)) continue;
      var raw = el.getAttribute(attr);
      if (raw === null || raw === '') continue;
      var num = parseFloat(raw);
      if (isFinite(num)) o[map[attr]] = num;
    }
    return o;
  }

  function init() {
    var nodes = document.querySelectorAll('[data-glass]');
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.__glassSurface) return;
      var mode = (el.getAttribute('data-glass') || '').toLowerCase();
      /* "frost" / "off" -> frosted saja, tanpa filter SVG */
      if (mode === 'off' || mode === 'none' || mode === 'frost' || mode === 'frosted') {
        el.classList.add('glass-surface', 'glass-surface--fallback');
        el.__glassSurface = true;
        return;
      }
      var surface = new GlassSurface(el, readOptions(el));
      el.__glassSurface = surface;
      instances.push(surface);
    });

    /* jaring pengaman: sinkron ulang setelah semua layout selesai */
    var resync = function () {
      for (var i = 0; i < instances.length; i++) instances[i].scheduleSync();
    };
    if (document.readyState === 'complete') resync();
    else window.addEventListener('load', resync);
    window.setTimeout(resync, 120);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* API kecil untuk pemanggilan manual */
  window.GlassSurface = {
    init: init,
    refraction: CAN_REFRACT,
    instances: instances
  };
})();
