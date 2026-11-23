/* ============================================================
   Iridescence — port vanilla (tanpa React) dari komponen WebGL2
   ReactBits: https://www.reactbits.dev/backgrounds/iridescence
   Pemakaian di landing Xozen:
     <div class="irid" data-iridescence data-color="#8f7bff" data-speed="1"
          data-amplitude="0.12" data-scale="1.15" data-brightness="1.25"
          data-click-swirl="false" data-resolution="0.8" aria-hidden="true"></div>
   Atribut lain (semua opsional): data-detail, data-warp, data-rotation,
   data-hue-shift, data-saturation, data-contrast, data-stir, data-sheen,
   data-grain, data-fade, data-opacity, data-paused, data-mouse-react
   ============================================================ */
(function () {
  "use strict";
  if (typeof window === "undefined" || !("WebGL2RenderingContext" in window)) return;

  const VERTEX = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColor;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uScale;
uniform float uRotation;
uniform int uDetail;
uniform float uWarp;
uniform float uHue;
uniform float uSaturation;
uniform float uBrightness;
uniform float uContrast;
uniform float uGrain;
uniform float uSeed;
uniform float uFade;
uniform float uOpacity;
uniform sampler2D uField;
uniform float uStir;
uniform vec3 uPointer;
uniform float uSheen;
uniform vec4 uSwirls[6];
in vec2 vUv;
out vec4 outColor;

vec3 hueRotate(vec3 c, float angle) {
  const vec3 k = vec3(0.57735027);
  float ca = cos(angle);
  return c * ca + cross(k, c) * sin(angle) + k * dot(k, c) * (1.0 - ca);
}

float smootherstep(float edge, float x) {
  float t = clamp(x / edge, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 aspect = uResolution / mr;
  vec2 st = vUv - texture(uField, vUv).rg * uStir;

  for (int k = 0; k < 6; k++) {
    vec4 swirl = uSwirls[k];
    if (swirl.w == 0.0) continue;
    vec2 delta = (st - swirl.xy) * aspect;
    float angle = swirl.w * exp(-dot(delta, delta) / (swirl.z * swirl.z));
    float ca = cos(angle);
    float sa = sin(angle);
    st = swirl.xy + vec2(ca * delta.x - sa * delta.y, sa * delta.x + ca * delta.y) / aspect;
  }

  vec2 uv = (st * 2.0 - 1.0) * aspect;
  float c = cos(uRotation);
  float s = sin(uRotation);
  uv = mat2(c, -s, s, c) * uv / uScale;
  uv += (uMouse - vec2(0.5)) * uAmplitude;

  float d = -uTime * 0.5;
  float a = 0.0;
  for (int i = 0; i < 24; i++) {
    if (i >= uDetail) break;
    float fi = float(i);
    a += cos(fi - d - a * uv.x * uWarp);
    d += sin(uv.y * fi + a);
  }
  d += uTime * 0.5;
  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;

  vec2 toPointer = (vUv - uPointer.xy) * aspect;
  col += col * uPointer.z * uSheen * 0.8 * exp(-dot(toPointer, toPointer) / 0.09);

  col = hueRotate(col, uHue);
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, uSaturation);
  col = (col - 0.5) * uContrast + 0.5;
  col *= uBrightness;
  col += (hash(gl_FragCoord.xy + uSeed) - 0.5) * uGrain * 0.12;
  col = clamp(col, 0.0, 1.0);

  float alpha = uOpacity;
  if (uFade > 0.0) {
    vec2 px = vUv * uResolution;
    float edge = uFade * mr * 0.5;
    alpha *= smootherstep(edge, px.x) * smootherstep(edge, uResolution.x - px.x);
    alpha *= smootherstep(edge, px.y) * smootherstep(edge, uResolution.y - px.y);
  }
  outColor = vec4(col * alpha, alpha);
}`;

  const FIELD_COLUMNS = 48;
  const MAX_SWIRLS = 6;
  const SWIRL_LIFE = 3.2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const num = (v, d) => { var n = parseFloat(v); return isNaN(n) ? d : n; };

  function compileShader(gl, type, source) {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return sh;
    gl.deleteShader(sh);
    return null;
  }

  function Iridescence(root, data) {
    if (!root || root._iridescence) return;
    root._iridescence = true;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    root.appendChild(canvas);
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) { canvas.remove(); root._iridescence = false; return; }

    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniformNames = [
      "uResolution", "uTime", "uColor", "uMouse", "uAmplitude", "uScale",
      "uRotation", "uDetail", "uWarp", "uHue", "uSaturation", "uBrightness",
      "uContrast", "uGrain", "uSeed", "uFade", "uOpacity", "uField",
      "uStir", "uPointer", "uSheen", "uSwirls"
    ];
    const uniforms = {};
    uniformNames.forEach(function (name) { uniforms[name] = gl.getUniformLocation(program, name); });

    const fieldTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fieldTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(uniforms.uField, 0);

    const probe = document.createElement("canvas");
    probe.width = 1; probe.height = 1;
    const probeCtx = probe.getContext("2d", { willReadFrequently: true });
    const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    const settings = {
      colorKey: String((data && data.color) || ""),
      color: (data && data.color) || "",
      speed: num(data && data.speed, 1),
      amplitude: num(data && data.amplitude, 0.1),
      mouseReact: !((data && data.mouseReact) === "false" || (data && data["mouse-react"]) === "false"),
      scale: Math.max(0.05, num(data && data.scale, 1)),
      detail: clamp(Math.round(num(data && data.detail, 8)), 1, 24),
      rotation: num(data && data.rotation, 0),
      warp: num(data && data.warp, 1),
      hueShift: num(data && data["hueShift"] || (data && data["hue-shift"]), 0),
      saturation: Math.max(0, num(data && data.saturation, 1)),
      brightness: Math.max(0, num(data && data.brightness, 1.5)),
      contrast: Math.max(0, num(data && data.contrast, 1)),
      stir: Math.max(0, num(data && data.stir, 0.5)),
      sheen: Math.max(0, num(data && data.sheen, 0.3)),
      clickSwirl: !((data && data.clickSwirl) === "false" || (data && data["click-swirl"]) === "false"),
      grain: clamp(num(data && data.grain, 0), 0, 1),
      fade: clamp(num(data && data.fade, 0), 0, 1),
      opacity: clamp(num(data && data.opacity, 1), 0, 1),
      resolution: clamp(num(data && data.resolution, 1), 0.1, 2),
      paused: (data && data.paused) === "true"
    };

    const pointer = { x: 0.5, y: 0.5, px: 0, py: 0, inside: false, tracked: false };
    const state = {
      width: 1, height: 1, phase: 0, mouse: [0.5, 0.5], presence: 0,
      color: [1, 1, 1], colorKey: "", cols: 0, rows: 0,
      field: new Float32Array(0), scratch: new Float32Array(0),
      fieldActive: false, swirls: [], seed: 0
    };
    const swirlData = new Float32Array(MAX_SWIRLS * 4);
    let raf = 0, last = 0, visible = true;

    function resolveColor() {
      if (settings.colorKey === state.colorKey) return;
      state.colorKey = settings.colorKey;
      if (Array.isArray(settings.color)) {
        state.color = [0, 1, 2].map(function (i) { return clamp(Number((settings.color[i] === undefined ? 1 : settings.color[i])), 0, 1); });
        return;
      }
      if (!probeCtx) return;
      probeCtx.clearRect(0, 0, 1, 1);
      probeCtx.fillStyle = "#ffffff";
      probeCtx.fillStyle = String(settings.color || "#ffffff");
      probeCtx.fillRect(0, 0, 1, 1);
      const px = probeCtx.getImageData(0, 0, 1, 1).data;
      state.color = [px[0] / 255, px[1] / 255, px[2] / 255];
    }

    function layoutField() {
      const cols = FIELD_COLUMNS;
      const rows = clamp(Math.round((cols * state.height) / state.width), 6, 96);
      if (cols === state.cols && rows === state.rows) return;
      state.cols = cols; state.rows = rows;
      state.field = new Float32Array(cols * rows * 2);
      state.scratch = new Float32Array(cols * rows * 2);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, cols, rows, 0, gl.RG, gl.FLOAT, state.field);
    }

    function brush(x, y, dx, dy) {
      const cols = state.cols, rows = state.rows, field = state.field;
      const radius = 0.22, aspect = state.width / state.height;
      const fromCol = Math.max(0, Math.floor((x - radius / aspect) * cols));
      const toCol = Math.min(cols - 1, Math.ceil((x + radius / aspect) * cols));
      const fromRow = Math.max(0, Math.floor((y - radius) * rows));
      const toRow = Math.min(rows - 1, Math.ceil((y + radius) * rows));
      for (let row = fromRow; row <= toRow; row++) {
        for (let col = fromCol; col <= toCol; col++) {
          const ox = ((col + 0.5) / cols - x) * aspect;
          const oy = (row + 0.5) / rows - y;
          const t = 1 - (ox * ox + oy * oy) / (radius * radius);
          if (t <= 0) continue;
          const i = (row * cols + col) * 2;
          const fx = field[i] + dx * t * t * 3.2;
          const fy = field[i + 1] + dy * t * t * 3.2;
          const length = Math.hypot(fx, fy);
          const limit = 0.4;
          const k = length > 0 ? (limit * Math.tanh(length / limit)) / length : 0;
          field[i] = fx * k;
          field[i + 1] = fy * k;
        }
      }
      state.fieldActive = true;
    }

    function relaxField(dt) {
      const cols = state.cols, rows = state.rows, field = state.field, scratch = state.scratch;
      const decay = Math.exp(-dt * 1.4);
      let peak = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const i = (row * cols + col) * 2;
          const l = (row * cols + Math.max(0, col - 1)) * 2;
          const r = (row * cols + Math.min(cols - 1, col + 1)) * 2;
          const u = (Math.max(0, row - 1) * cols + col) * 2;
          const b = (Math.min(rows - 1, row + 1) * cols + col) * 2;
          for (let c = 0; c < 2; c++) {
            const value = (field[i + c] * 12 + field[l + c] + field[r + c] + field[u + c] + field[b + c]) / 16;
            scratch[i + c] = value * decay;
            peak = Math.max(peak, Math.abs(scratch[i + c]));
          }
        }
      }
      field.set(scratch);
      if (peak < 0.0004) { field.fill(0); state.fieldActive = false; }
    }

    function render() {
      resolveColor();
      layoutField();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTexture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, state.cols, state.rows, gl.RG, gl.FLOAT, state.field);
      swirlData.fill(0);
      state.swirls.forEach(function (swirl, k) {
        const radius = 0.21 * (1 + 0.4 * swirl.age);
        const ease = Math.exp(-swirl.age * 1.35) - Math.exp(-swirl.age * 10);
        const fade = Math.min(1, (SWIRL_LIFE - swirl.age) / 0.8);
        swirlData.set([swirl.x, swirl.y, radius, 3 * ease * fade * ((0.21 / radius) ** 2)], k * 4);
      });
      gl.uniform2f(uniforms.uResolution, state.width, state.height);
      gl.uniform1f(uniforms.uTime, state.phase);
      gl.uniform3f(uniforms.uColor, state.color[0], state.color[1], state.color[2]);
      gl.uniform2f(uniforms.uMouse, state.mouse[0], state.mouse[1]);
      gl.uniform1f(uniforms.uAmplitude, settings.amplitude);
      gl.uniform1f(uniforms.uScale, settings.scale);
      gl.uniform1f(uniforms.uRotation, (settings.rotation * Math.PI) / 180);
      gl.uniform1i(uniforms.uDetail, settings.detail);
      gl.uniform1f(uniforms.uWarp, settings.warp);
      gl.uniform1f(uniforms.uHue, (settings.hueShift * Math.PI) / 180);
      gl.uniform1f(uniforms.uSaturation, settings.saturation);
      gl.uniform1f(uniforms.uBrightness, settings.brightness);
      gl.uniform1f(uniforms.uContrast, settings.contrast);
      gl.uniform1f(uniforms.uGrain, settings.grain);
      gl.uniform1f(uniforms.uSeed, state.seed);
      gl.uniform1f(uniforms.uFade, settings.fade);
      gl.uniform1f(uniforms.uOpacity, settings.opacity);
      gl.uniform1f(uniforms.uStir, settings.mouseReact ? settings.stir : 0);
      gl.uniform3f(uniforms.uPointer, pointer.x, pointer.y, settings.mouseReact ? state.presence : 0);
      gl.uniform1f(uniforms.uSheen, settings.sheen);
      gl.uniform4fv(uniforms.uSwirls, swirlData);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(now) {
      raf = 0;
      if (!visible) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const moving = !settings.paused && !reduce;
      if (moving) state.phase += dt * settings.speed;
      const target = (settings.mouseReact && pointer.tracked) ? [pointer.x, pointer.y] : [0.5, 0.5];
      const follow = 1 - Math.exp(-dt * 5);
      state.mouse[0] += (target[0] - state.mouse[0]) * follow;
      state.mouse[1] += (target[1] - state.mouse[1]) * follow;
      state.presence += ((pointer.inside ? 1 : 0) - state.presence) * (1 - Math.exp(-dt * 4));
      if (state.fieldActive) relaxField(dt);
      state.swirls = state.swirls.filter(function (swirl) { return (swirl.age += dt) < SWIRL_LIFE; });
      if (settings.grain > 0 && moving) state.seed = Math.floor(now / 42) % 997;
      render();
      const settling =
        Math.abs(target[0] - state.mouse[0]) > 0.0005 ||
        Math.abs(target[1] - state.mouse[1]) > 0.0005 ||
        Math.abs((pointer.inside ? 1 : 0) - state.presence) > 0.002;
      if (moving || settling || state.fieldActive || state.swirls.length) raf = requestAnimationFrame(frame);
      else last = 0;
    }

    function wake() {
      if (raf || !visible) return;
      raf = requestAnimationFrame(frame);
    }

    function locate(event) {
      const rect = root.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / Math.max(1, rect.width),
        y: 1 - (event.clientY - rect.top) / Math.max(1, rect.height)
      };
    }

    function onPointerMove(event) {
      const p = locate(event);
      const inside = p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
      if (inside && settings.mouseReact && !reduce && pointer.inside && settings.stir > 0) {
        brush(p.x, p.y, p.x - pointer.x, p.y - pointer.y);
      }
      pointer.x = p.x; pointer.y = p.y;
      pointer.px = p.x; pointer.py = p.y;
      pointer.inside = inside;
      if (inside) pointer.tracked = true;
      wake();
    }

    function onPointerLeave() { pointer.inside = false; wake(); }

    function onPointerDown(event) {
      if (!settings.clickSwirl || reduce) return;
      const p = locate(event);
      if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return;
      if (state.swirls.length >= MAX_SWIRLS) {
        if (state.swirls[0].age < SWIRL_LIFE - 0.4) return;
        state.swirls.shift();
      }
      state.swirls.push({ x: p.x, y: p.y, age: 0 });
      wake();
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * settings.resolution;
      state.width = Math.max(1, root.clientWidth);
      state.height = Math.max(1, root.clientHeight);
      canvas.width = Math.max(1, Math.round(state.width * dpr));
      canvas.height = Math.max(1, Math.round(state.height * dpr));
      render();
      wake();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    const visibility = new IntersectionObserver(function (entries) {
      visible = entries.some(function (entry) { return entry.isIntersecting; });
      if (visible) { last = 0; wake(); }
    });
    visibility.observe(root);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    resize();

    return {
      destroy: function () {
        visible = false;
        if (raf) cancelAnimationFrame(raf); raf = 0;
        resizeObserver.disconnect();
        visibility.disconnect();
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerdown", onPointerDown);
        document.documentElement.removeEventListener("pointerleave", onPointerLeave);
        gl.deleteTexture(fieldTexture);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        root._iridescence = false;
      }
    };
  }

  window.xozenIridescence = Iridescence;

  function autoInit() {
    if (!window.CSS || !CSS.supports || !CSS.supports("backdrop-filter", "blur(1px)")) { /* tetap jalan */ }
    if (document.querySelectorAll) {
      Array.prototype.forEach.call(document.querySelectorAll("div[data-iridescence]"), function (el) {
        Iridescence(el, el.dataset || {});
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
