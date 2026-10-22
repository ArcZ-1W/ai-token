/* ============================================================
   LightPillar — port vanilla (tanpa React) dari ReactBits
   Sumber: https://www.reactbits.dev/backgrounds/light-pillar

   Dua pass WebGL2:
     1) MARCH     — raymarch kolom cahaya ber-tenaga ke FBO
     2) COMPOSITE — bloom mipmap + pulse klik + noise + mask
   Kanvas berblend "screen" hitam->tembus (dipakai sebagai latar).

   Pemakaian:
     <div class="pillar-bg" data-light-pillar
          data-top-color="#6f7bff" data-bottom-color="#35d6ff"></div>
   API:
     var api = el._lightPillar;  // setelah init
     api.show()/api.hide()/api.destroy()
   ============================================================ */
(function () {
  "use strict";
  if (typeof window === "undefined" || !("WebGL2RenderingContext" in window)) return;

  var QUALITY = { low: 0.35, medium: 0.5, high: 0.6 };
  var INTRO_SECONDS = 2.1;
  var PULSE_LIFE = 1.4;
  var MIN_SCALE = 0.25;

  var VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  var MARCH = `#version 300 es
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uTarget;
uniform vec2 uRot;
uniform vec2 uPillarRot;
uniform vec2 uWave;
uniform float uShift;
uniform float uPillarWidth;
uniform float uPillarHeight;
uniform int uDetail;
uniform vec3 uTopColor;
uniform vec3 uBottomColor;
uniform float uGlowAmount;
uniform float uWidthNorm;
out vec4 outColor;

void main() {
  vec2 vUv = gl_FragCoord.xy / uTarget;
  vec2 uv = (vUv * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
  uv.x -= uShift;
  uv = vec2(uPillarRot.x * uv.x - uPillarRot.y * uv.y, uPillarRot.y * uv.x + uPillarRot.x * uv.y);

  vec3 ro = vec3(0.0, 0.0, -10.0);
  vec3 rd = normalize(vec3(uv, 1.0));
  vec3 origin = vec3(uRot.x * ro.x - uRot.y * ro.z, ro.y, uRot.y * ro.x + uRot.x * ro.z);
  vec3 dir = vec3(uRot.x * rd.x - uRot.y * rd.z, rd.y, uRot.y * rd.x + uRot.x * rd.z);

  float glow = 0.0;
  float lift = 0.0;
  float t = 0.1;
  for (int i = 0; i < 80; i++) {
    vec3 p = origin + dir * t;
    vec3 q = p;
    q.y = p.y * uPillarHeight + uTime;

    float freq = 1.0;
    float amp = 1.0;
    for (int j = 0; j < 6; j++) {
      if (j >= uDetail) break;
      q.xz = vec2(uWave.y * q.x - uWave.x * q.z, uWave.x * q.x + uWave.y * q.z);
      q += cos(q.zxy * freq - uTime * float(j) * 2.0) * amp;
      freq *= 2.0;
      amp *= 0.5;
    }

    float d = length(cos(q.xz)) - 0.2;
    float bound = length(p.xz) - uPillarWidth;
    float h = max(4.0 - abs(d - bound), 0.0);
    d = max(d, bound) + h * h * 0.015625;
    d = abs(d) * 0.15 + 0.01;

    float weight = 1.0 / d;
    glow += weight;
    lift += clamp((15.0 - p.y) / 30.0, 0.0, 1.0) * weight;

    t += d;
    if (t > 50.0) break;
  }

  vec3 col = tanh((uBottomColor * glow + (uTopColor - uBottomColor) * lift) * uGlowAmount / uWidthNorm);
  float peak = max(col.r, max(col.g, col.b));
  outColor = vec4(col, smoothstep(0.62, 1.0, peak));
}`;

  var COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform vec2 uFieldSize;
uniform vec2 uView;
uniform vec2 uAspect;
uniform vec2 uPillarRot;
uniform float uShift;
uniform float uIntensity;
uniform float uNoiseIntensity;
uniform float uLightMode;
uniform float uNeutral;
uniform float uBloom;
uniform float uFade;
uniform float uReveal;
uniform float uFlare;
uniform vec4 uPulses[3];
out vec4 outColor;

vec3 tap(vec2 uv) {
  return textureLod(uField, uv, 0.0).rgb;
}

vec3 bicubic(vec2 uv) {
  vec2 position = uv * uFieldSize;
  vec2 center = floor(position - 0.5) + 0.5;
  vec2 f = position - center;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 t0 = (center - 1.0) / uFieldSize;
  vec2 t3 = (center + 2.0) / uFieldSize;
  vec2 t12 = (center + w2 / w12) / uFieldSize;
  vec3 result = vec3(0.0);
  result += tap(vec2(t0.x, t0.y)) * w0.x * w0.y;
  result += tap(vec2(t12.x, t0.y)) * w12.x * w0.y;
  result += tap(vec2(t3.x, t0.y)) * w3.x * w0.y;
  result += tap(vec2(t0.x, t12.y)) * w0.x * w12.y;
  result += tap(vec2(t12.x, t12.y)) * w12.x * w12.y;
  result += tap(vec2(t3.x, t12.y)) * w3.x * w12.y;
  result += tap(vec2(t0.x, t3.y)) * w0.x * w3.y;
  result += tap(vec2(t12.x, t3.y)) * w12.x * w3.y;
  result += tap(vec2(t3.x, t3.y)) * w3.x * w3.y;
  return max(result, 0.0);
}

float smootherstep01(float t) {
  t = clamp(t, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uView;
  vec3 col = bicubic(uv);

  if (uBloom > 0.0) {
    vec4 l3 = textureLod(uField, uv, 3.0);
    vec4 l4 = textureLod(uField, uv, 4.0);
    vec4 l5 = textureLod(uField, uv, 5.0);
    vec4 l6 = textureLod(uField, uv, 6.0);
    float halo = l3.a * 0.3 + l4.a * 0.3 + l5.a * 0.25 + l6.a * 0.15;
    vec3 tint = l4.rgb + l5.rgb;
    tint /= max(max(tint.r, max(tint.g, tint.b)), 0.001);
    vec3 glow = clamp(tint * halo * uBloom * 1.1, 0.0, 1.0);
    col = 1.0 - (1.0 - clamp(col, 0.0, 1.0)) * (1.0 - glow);
  }

  vec2 p = (uv * 2.0 - 1.0) * uAspect;
  p.x -= uShift;
  float axis = uPillarRot.y * p.x + uPillarRot.x * p.y;

  float boost = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 pulse = uPulses[i];
    if (pulse.y <= 0.0) continue;
    float offset = (axis - pulse.x) / 0.24;
    boost += exp(-offset * offset) * pulse.y;
  }
  float head = (axis - uReveal + 0.35) / 0.3;
  boost += exp(-head * head) * uFlare;
  float lum = max(col.r, max(col.g, col.b));
  col += mix(col, vec3(lum), 0.45) * boost * 1.8;

  col -= fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) / 15.0 * uNoiseIntensity;
  vec3 result = clamp(col * uIntensity, 0.0, 1.0);

  float mask = smoothstep(uReveal, uReveal - 0.9, axis);
  float edge = uFade * 0.5;
  if (edge > 0.0) {
    mask *= smootherstep01(uv.x / edge) * smootherstep01((1.0 - uv.x) / edge);
    mask *= smootherstep01(uv.y / edge) * smootherstep01((1.0 - uv.y) / edge);
  }

  if (uLightMode > 0.5) {
    float energy = max(result.r, max(result.g, result.b));
    vec3 hue = result / max(energy, 0.001);
    float coverage = smoothstep(0.025, 0.95, energy);
    hue = pow(clamp(hue, 0.0, 1.0), vec3(1.25));
    vec3 tinted = mix(vec3(1.0), hue, coverage * 0.94 * mask);
    vec3 ink = vec3(1.0) - pow(result, vec3(1.6)) * 0.85 * mask;
    result = mix(tinted, ink, uNeutral);
  } else {
    result *= mask;
  }
  outColor = vec4(result, 1.0);
}`;

  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var ease = function (t) { return t * t * t * (t * (t * 6 - 15) + 10); };

  function compile(gl, type, source) {
    var sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return sh;
    gl.deleteShader(sh);
    return null;
  }

  function link(gl, fragmentSource) {
    var vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    var fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    var program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      if (program) gl.deleteProgram(program);
      return null;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, "aPosition");
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null; }
    var uniforms = {};
    var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) {
      var info = gl.getActiveUniform(program, i);
      if (info) uniforms[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(program, info.name);
    }
    return { program: program, uniforms: uniforms };
  }

  function dnum(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
  function pickOpt(data, camel, dashed, fallback, option) {
    var v = camel in data ? data[camel] : (dashed in data ? data[dashed] : undefined);
    if (v === undefined || v === null || v === "") return fallback;
    if (option === "bool") return String(v) !== "false";
    if (option === "num") { var n = parseFloat(v); return isNaN(n) ? fallback : n; }
    return String(v);
  }

  function readOptions(data) {
    var isPhone = window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches &&
      Math.min(window.screen.width || 9999, window.screen.height || 9999) <= 740;
    var quality = data.quality || (isPhone ? "medium" : "high");
    var o = {
      topColor: pickOpt(data, "topColor", "top-color", "#5227FF"),
      bottomColor: pickOpt(data, "bottomColor", "bottom-color", "#FF9FFC"),
      intensity: clamp(pickOpt(data, "intensity", "intensity", 1, "num"), 0, 6),
      rotationSpeed: pickOpt(data, "rotationSpeed", "rotation-speed", 0.3, "num"),
      flow: clamp(pickOpt(data, "flow", "flow", 1, "num"), -4, 4),
      interactive: pickOpt(data, "interactive", "interactive", true, "bool"),
      clickPulse: pickOpt(data, "clickPulse", "click-pulse", true, "bool"),
      glowAmount: clamp(pickOpt(data, "glowAmount", "glow-amount", 0.002, "num"), 0, 0.05),
      bloom: clamp(pickOpt(data, "bloom", "bloom", 0.5, "num"), 0, 2),
      pillarWidth: clamp(pickOpt(data, "pillarWidth", "pillar-width", 3, "num"), 0.05, 10),
      pillarHeight: clamp(pickOpt(data, "pillarHeight", "pillar-height", 0.4, "num"), 0.01, 3),
      pillarRotation: clamp(pickOpt(data, "pillarRotation", "pillar-rotation", 25, "num"), 0, 80),
      twist: clamp(pickOpt(data, "twist", "twist", 0.4, "num"), 0, 3),
      detail: Math.round(clamp(pickOpt(data, "detail", "detail", 4, "num"), 1, 6)),
      noiseIntensity: clamp(pickOpt(data, "noiseIntensity", "noise-intensity", 0.5, "num"), 0, 2),
      fade: clamp(pickOpt(data, "fade", "fade", 0, "num"), 0, 1),
      intro: pickOpt(data, "intro", "intro", true, "bool"),
      lightMode: pickOpt(data, "lightMode", "light-mode", false, "bool"),
      paused: pickOpt(data, "paused", "paused", false, "bool"),
      scale: clamp(pickOpt(data, "scale", "scale", QUALITY[quality] != null ? QUALITY[quality] : QUALITY.high, "num"), MIN_SCALE, 2)
    };
    if (isPhone) { o.intensity *= 0.9; o.bloom *= 0.8; o.rotationSpeed *= 0.8; }
    return o;
  }

  function LightPillar(root, data) {
    if (!root || root._lightPillar) return;
    root._lightPillar = true;
    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    root.appendChild(canvas);
    var gl = canvas.getContext("webgl2", {
      alpha: true, premultipliedAlpha: true, antialias: false,
      depth: false, stencil: false, powerPreference: "high-performance"
    });
    if (!gl) { canvas.remove(); root._lightPillar = null; return; }

    var floatOK = !!gl.getExtension("EXT_color_buffer_float");
    var march = link(gl, MARCH);
    var composite = link(gl, COMPOSITE);
    if (!march || !composite) {
      if (march) gl.deleteProgram(march.program);
      if (composite) gl.deleteProgram(composite.program);
      canvas.remove();
      root._lightPillar = null;
      return;
    }

    var buffer = gl.createBuffer();
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    var texture = null;
    var framebuffer = gl.createFramebuffer();
    var target = { width: 0, height: 0 };
    function sizeTarget(width, height) {
      if (target.width === width && target.height === height) return;
      target.width = width;
      target.height = height;
      if (texture) gl.deleteTexture(texture);
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      var levels = Math.floor(Math.log2(Math.max(width, height))) + 1;
      gl.texStorage2D(gl.TEXTURE_2D, levels, floatOK ? gl.RGBA16F : gl.RGBA8, width, height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    var probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    var colorCache = {};
    function toRgb(value) {
      if (colorCache[value]) return colorCache[value];
      var rgb = [1, 1, 1];
      if (probe) {
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = "#ffffff";
        probe.fillStyle = value;
        probe.fillRect(0, 0, 1, 1);
        var px = probe.getImageData(0, 0, 1, 1).data;
        rgb = [px[0] / 255, px[1] / 255, px[2] / 255];
      }
      colorCache[value] = rgb;
      return rgb;
    }

    var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var settings = readOptions(data || {});
    var view = { width: 1, height: 1, ratio: 1 };
    var pointer = { x: 0, y: 0, inside: false };
    var pulses = [];
    var pulseData = new Float32Array(12);
    var state = {
      clock: 0,
      intro: settings.intro && !reduce ? 0 : 1,
      touch: 0, spin: 0, lean: 0, shift: 0,
      governor: 1, slow: 0, quick: 0
    };
    var raf = 0, last = 0, visible = true, hidden = false, alive = true;

    function axisAt(x, y, angle) {
      var aspect = view.width / view.height;
      var px = ((x / view.width) * 2 - 1) * aspect - state.shift;
      var py = 1 - (y / view.height) * 2;
      return Math.sin(angle) * px + Math.cos(angle) * py;
    }

    function render() {
      var s = settings;
      var scale = Math.max(MIN_SCALE, s.scale * state.governor);
      var fieldWidth = Math.max(1, Math.round(view.width * scale));
      var fieldHeight = Math.max(1, Math.round(view.height * scale));
      sizeTarget(fieldWidth, fieldHeight);

      var grow = ease(state.intro);
      var rise = easeOut(state.intro);
      var tilt = ((s.pillarRotation + state.lean) * Math.PI) / 180;
      var angle = state.clock * 0.3 + state.spin;
      var width = s.pillarWidth * (0.3 + 0.7 * grow);

      gl.bindVertexArray(vao);
      var m = march.uniforms;
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, target.width, target.height);
      gl.useProgram(march.program);
      gl.uniform1f(m.uTime, state.clock * s.flow);
      gl.uniform2f(m.uResolution, view.width, view.height);
      gl.uniform2f(m.uTarget, target.width, target.height);
      gl.uniform2f(m.uRot, Math.cos(angle), Math.sin(angle));
      gl.uniform2f(m.uPillarRot, Math.cos(tilt), Math.sin(tilt));
      gl.uniform2f(m.uWave, Math.sin(s.twist), Math.cos(s.twist));
      gl.uniform1f(m.uShift, state.shift);
      gl.uniform1f(m.uPillarWidth, width);
      gl.uniform1f(m.uPillarHeight, s.pillarHeight);
      gl.uniform1i(m.uDetail, s.detail);
      gl.uniform3fv(m.uTopColor, toRgb(s.topColor));
      gl.uniform3fv(m.uBottomColor, toRgb(s.bottomColor));
      gl.uniform1f(m.uGlowAmount, s.glowAmount);
      gl.uniform1f(m.uWidthNorm, width / 3);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (s.bloom > 0) gl.generateMipmap(gl.TEXTURE_2D);

      pulseData.fill(0);
      pulses.forEach(function (pulse, index) {
        pulseData.set([pulse.axis + pulse.age * 1.7, Math.exp(-pulse.age / (PULSE_LIFE * 0.45)), 0, 0], index * 4);
      });

      var c = composite.uniforms;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(composite.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(c.uField, 0);
      gl.uniform2f(c.uFieldSize, target.width, target.height);
      gl.uniform2f(c.uView, canvas.width, canvas.height);
      gl.uniform2f(c.uAspect, view.width / view.height, 1);
      gl.uniform2f(c.uPillarRot, Math.cos(tilt), Math.sin(tilt));
      gl.uniform1f(c.uShift, state.shift);
      gl.uniform1f(c.uIntensity, s.intensity * (0.15 + 0.85 * rise) * (1 + 0.12 * state.touch));
      gl.uniform1f(c.uNoiseIntensity, s.noiseIntensity);
      gl.uniform1f(c.uLightMode, s.lightMode ? 1 : 0);
      var chroma = function (rgb) { return Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]); };
      var vivid = Math.max(chroma(toRgb(s.topColor)), chroma(toRgb(s.bottomColor)));
      gl.uniform1f(c.uNeutral, 1 - clamp((vivid - 0.08) / 0.12, 0, 1));
      gl.uniform1f(c.uBloom, s.bloom);
      gl.uniform1f(c.uFade, s.fade);
      var span = view.width / view.height + 1.2;
      gl.uniform1f(c.uReveal, state.intro >= 1 ? 1e4 : -span + rise * (span * 2 + 1.2));
      gl.uniform1f(c.uFlare, state.intro >= 1 ? 0 : (1 - rise) * 1.3 * Math.min(1, state.intro * 8));
      gl.uniform4fv(c.uPulses, pulseData);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    }

    function tune(dt) {
      if (dt > 1 / 40) { state.slow += 1; state.quick = 0; }
      else if (dt < 1 / 55) { state.quick += 1; state.slow = 0; }
      if (state.slow > 20) { state.governor = Math.max(0.5, state.governor * 0.85); state.slow = 0; }
      else if (state.quick > 180 && state.governor < 1) { state.governor = Math.min(1, state.governor * 1.1); state.quick = 0; }
    }

    function frame(now) {
      raf = 0;
      if (!alive || !visible || document.hidden || hidden) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      if (last) tune((now - last) / 1000);
      last = now;
      var running = !settings.paused && !reduce && settings.rotationSpeed !== 0;
      if (running) state.clock += dt * 0.96 * settings.rotationSpeed;
      if (!settings.intro || reduce) state.intro = 1;
      else if (state.intro < 1) state.intro = Math.min(1, state.intro + dt / INTRO_SECONDS);

      var engaged = settings.interactive && pointer.inside && !reduce;
      var aim = engaged ? pointer.x / view.width - 0.5 : 0;
      var follow = 1 - Math.exp(-dt * 2.4);
      state.spin += (aim * 1.4 - state.spin) * follow;
      state.lean += (aim * 9 - state.lean) * follow;
      state.shift += (aim * 0.35 * (view.width / view.height) - state.shift) * follow;
      state.touch += ((engaged ? 1 : 0) - state.touch) * (1 - Math.exp(-dt * 3));

      for (var i = pulses.length - 1; i >= 0; i--) {
        pulses[i].age += dt;
        if (pulses[i].age > PULSE_LIFE * 2.2) pulses.splice(i, 1);
      }

      render();

      var settling =
        state.intro < 1 ||
        pulses.length > 0 ||
        Math.abs(aim * 1.4 - state.spin) > 0.0005 ||
        Math.abs((engaged ? 1 : 0) - state.touch) > 0.002;
      if (running || settling) raf = requestAnimationFrame(frame);
      else last = 0;
    }

    function wake() {
      if (!raf && alive && visible && !document.hidden && !hidden) raf = requestAnimationFrame(frame);
    }
    function show() { hidden = false; wake(); }
    function hide() { hidden = true; if (raf) { cancelAnimationFrame(raf); raf = 0; last = 0; } }

    function resize() {
      var width = Math.max(1, root.clientWidth);
      var height = Math.max(1, root.clientHeight);
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      view.width = width;
      view.height = height;
      view.ratio = ratio;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      if (!raf) render();
      wake();
    }

    function locate(event) {
      var rect = root.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var y = event.clientY - rect.top;
      return { x: x, y: y, inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height };
    }
    function onPointerMove(event) {
      var point = locate(event);
      pointer.x = point.x; pointer.y = point.y; pointer.inside = point.inside;
      wake();
    }
    function onPointerDown(event) {
      if (!settings.clickPulse || reduce) return;
      var point = locate(event);
      if (!point.inside) return;
      var tilt = ((settings.pillarRotation + state.lean) * Math.PI) / 180;
      pulses.push({ axis: axisAt(point.x, point.y, tilt), age: 0 });
      if (pulses.length > 3) pulses.shift();
      wake();
    }
    function onPointerLeave() { pointer.inside = false; wake(); }
    function onVisibility() { last = 0; wake(); }

    var ro = new ResizeObserver(resize);
    ro.observe(root);
    var io = new IntersectionObserver(function (entries) {
      visible = entries.some(function (entry) { return entry.isIntersecting; });
      if (visible) { last = 0; wake(); }
    });
    io.observe(root);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    wake();

    root._lightPillar = {
      show: show,
      hide: hide,
      resize: resize,
      wake: wake,
      destroy: function () {
        alive = false;
        if (raf) cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerdown", onPointerDown);
        document.documentElement.removeEventListener("pointerleave", onPointerLeave);
        document.removeEventListener("visibilitychange", onVisibility);
        if (texture) gl.deleteTexture(texture);
        gl.deleteFramebuffer(framebuffer);
        gl.deleteProgram(march.program);
        gl.deleteProgram(composite.program);
        gl.deleteBuffer(buffer);
        gl.deleteVertexArray(vao);
        if (!gl.isContextLost()) {
          var lose = gl.getExtension("WEBGL_lose_context");
          if (lose && lose.loseContext) lose.loseContext();
        }
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        root._lightPillar = null;
      }
    };
  }

  window.xozenLightPillar = LightPillar;

  function autoInit() {
    if (document.querySelectorAll) {
      Array.prototype.forEach.call(document.querySelectorAll("div[data-light-pillar]"), function (el) {
        if (el._lightPillar && el._lightPillar !== true) return;
        LightPillar(el, el.dataset || {});
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
