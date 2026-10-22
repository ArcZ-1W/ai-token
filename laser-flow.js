/* ============================================================
   LaserFlow — port vanilla (tanpa React) dari ReactBits
   Sumber: https://www.reactbits.dev/animations/laser-flow

   Satu pass WebGL2: berkas laser turun dari atas, jatuh dan
   "menyinari" permukaan (kotak ber-radius). Di laman ini
   permukaannya = .wrap dari section aktif, jadi saat pengguna
   geser struktur slide ke bawah, cahaya mengikuti section.

   Pemakaian:
     <div class="laser-bg" data-laser-flow data-color="#6f7bff"
          data-target="#wrap-id" data-intensity="1.8"></div>
   API:
     var api = el._laserFlow;  // setelah DOMContentLoaded
     api.setTarget(el)         // pindahkan permukaan (glide)
     api.hide()/show()         // visibilitas
   ============================================================ */
(function () {
  "use strict";
  if (typeof window === "undefined" || !("WebGL2RenderingContext" in window)) return;

  const MAX_RENDER_DIM = 2048;
  const INTRO_DROP = 1.25;
  const INTRO_END = 5;
  const BASE_SATURATION = 0.78;
  const TINTS = [
    [0, 1], [-11.5, 0.77], [9.5, 0.95], [-53.5, 0.79],
    [39.5, 0.77], [16, 0.81], [-16.3, 0.92], [13.3, 0.96],
    [3, 1.01], [1, 0.68], [1, 1.15], [142.5, 0.51],
    [113.6, 0.28], [-7.5, 0.13], [-2.7, 0.32], [7.5, 0.81]
  ];

  const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uDpr;
uniform float uScale;
uniform float uTime;
uniform float uBeamX;
uniform vec4 uSurface;
uniform float uRadius;
uniform vec3 uIntro;
uniform vec4 uPour;
uniform vec2 uRun;
uniform vec4 uLens;
uniform sampler2D uReveal;
uniform vec4 uRevealMap;
uniform vec2 uRevealInfo;
uniform float uAtmosphere;
uniform vec4 uAmount;
uniform vec4 uShape;
uniform vec4 uExtra;
uniform float uTheme;
uniform vec3 uTint[16];

#define BEAM uTint[0]
#define LEFT uTint[1]
#define RIGHT uTint[2]
#define CYAN uTint[3]
#define PINK uTint[4]
#define LILAC uTint[5]
#define SKY uTint[6]
#define PURPLE uTint[7]
#define DEEP uTint[8]
#define MIST uTint[9]
#define NAVY uTint[10]
#define WARM uTint[11]
#define EMBER uTint[12]
#define WHITE uTint[13]
#define HAZE uTint[14]
#define LAVENDER uTint[15]

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

float sq(float x) {
  return x * x;
}

float roundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec3 spill(float e, float fall, float strength, float front, float t, out vec3 glow) {
  glow = vec3(0.0);
  if (strength < 0.0005) return vec3(0.0);
  float f = max(fall, 0.0);
  float d = max(e, 0.0);
  float u = d / (6.0 + 0.28 * f);
  float start = smoothstep(-6.0, 12.0, fall);
  float fade = exp(-sq(max(f - 125.0, 0.0) / 40.0));
  float streak = 0.88 + 0.24 * noise(vec2(u * 6.0, f / 22.0 - t * 1.7));
  float bright = pow(strength, 1.5);
  float soft = sqrt(strength);
  float warmth = smoothstep(90.0, 130.0, f);
  vec3 coreK = mix(WHITE, WARM, warmth * exp(-d / 9.0));
  float core = mix(9.0, 2.6, warmth) * exp(-sq(d / (3.5 + 0.04 * f))) * exp(-sq(max(f - 130.0, 0.0) / 38.0));
  float wall = 24.0 * exp(-sq(d / 1.1)) * exp(-sq(max(f - 100.0, 0.0) / 30.0));
  float bandCenter = 0.7 - 0.3 * smoothstep(30.0, 110.0, f);
  float offset = u - bandCenter;
  float decay = (1.05 - bandCenter) / 1.31;
  float profile = offset < 0.0 ? exp(-sq(offset / 0.3)) : exp(-offset / decay);
  profile *= 1.0 - smoothstep(1.0, 1.4, u);
  vec3 bandA = mix(CYAN, PINK, smoothstep(50.0, 75.0, f));
  bandA = mix(bandA, LILAC, smoothstep(100.0, 125.0, f));
  vec3 bandB = mix(SKY, PURPLE, smoothstep(50.0, 75.0, f));
  vec3 fanK = mix(bandA, bandB, smoothstep(0.06, 0.18, offset));
  fanK = mix(fanK, DEEP, smoothstep(0.22, 0.42, offset));
  vec3 thread = WHITE * wall * bright + coreK * core * streak * bright;
  glow += fanK * 4.5 * profile * fade * streak * bright;
  glow += MIST * 0.7 * exp(-max(u - 1.0, 0.0) / 0.9) * smoothstep(0.7, 1.2, u) * fade * soft;
  glow += EMBER * 0.35 * exp(-sq((f - 165.0) / 22.0)) * exp(-d / 25.0) * bright;
  float lag = u * (6.0 + 0.28 * f) * 0.35;
  float reveal = 1.0 - smoothstep(front - 70.0, front + 8.0, f + lag);
  glow *= start * reveal;
  return thread * start * reveal;
}

vec3 easeLight(vec3 light, float amount) {
  return -log(max(1.0 - amount * (1.0 - exp(-light)), vec3(0.0001)));
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uResolution.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 p = frag / uScale;
  float t = uTime;
  float bx = uBeamX / uScale;
  float sl = uSurface.x / uScale;
  float sy = uSurface.y / uScale;
  float sr = uSurface.z / uScale;
  float sb = uSurface.w / uScale;
  float radius = uRadius / uScale;
  float dx = p.x - bx;
  float adx = abs(dx);
  float h = sy - p.y;
  float hp = max(h, 0.0);
  float above = smoothstep(-0.5, 0.5, h);
  float side = smoothstep(-24.0, 24.0, dx);
  vec3 sideK = mix(mix(LAVENDER, LEFT, smoothstep(40.0, 140.0, adx)), RIGHT, side);
  float beamWidth = uShape.x;
  float flare = uShape.y;
  float spread = 250.0 * uShape.z;
  float reachL = max(bx - sl, 1.0);
  float reachR = max(sr - bx, 1.0);
  float reach = dx < 0.0 ? reachL : reachR;
  float layerLen = clamp(0.29 * reach, 20.0, 100.0) * sqrt(uShape.z);
  float run = uRun.x;
  float runMask = 1.0 - smoothstep(run - 34.0, run + 6.0, adx);
  float bead = exp(-sq((adx - run + 16.0) / (18.0 + 0.04 * run))) * uRun.y;
  float flowMask = (1.0 - smoothstep(0.75 * spread, 1.1 * spread, adx)) * runMask;
  float edgeMask = (1.0 - smoothstep(0.8 * spread, 1.25 * spread, adx)) * runMask;
  float bloom = uIntro.y;
  vec2 center = vec2((sl + sr) * 0.5, (sy + sb) * 0.5);
  vec2 halfSize = vec2((sr - sl) * 0.5, (sb - sy) * 0.5);
  float sd = roundBox(p - center, halfSize, radius);
  float outline = max(sd, 0.0);
  float below = max(p.y - sy - radius, 0.0);
  float hug = smoothstep(-0.5, 0.5, sd) * exp(-sq(below / 14.0));
  float hugWide = smoothstep(-0.5, 0.5, sd) * exp(-sq(below / 40.0));

  vec3 col = vec3(0.0);

  float breathe = 1.0 + uExtra.x * (0.12 * sin(t * 1.5708) + 0.08 * (noise(vec2(t * 0.5, 3.0)) - 0.5));

  float front = uIntro.x / uScale;
  float drop = smoothstep(front + 10.0, front - 110.0, p.y);
  float falling = 1.0 - smoothstep(sy - 24.0, sy, front);
  float top = mix(0.3, 1.0, smoothstep(0.0, 0.3 * sy, p.y));
  float beamCore = 24.0 * exp(-adx / (2.0 * beamWidth));
  float beamHalo = 1.3 * exp(-adx / (6.0 * beamWidth)) + 0.3 * exp(-adx / (22.0 * beamWidth));
  vec3 haloK = mix(BEAM, sideK, exp(-hp / 80.0));
  col += (BEAM * beamCore + haloK * beamHalo) * top * above * drop;
  float head = exp(-sq((p.y - front) / 24.0)) * falling;
  col += mix(WHITE, BEAM, 0.35) * head * (7.0 * exp(-adx / (2.6 * beamWidth)) + 1.0 * exp(-adx / (14.0 * beamWidth)));

  float psi = adx * (outline + 1.0);
  float rise = max(hp - 17.9 * flare, 0.0);
  float skirtAmp = 16.6 * (exp(-sq(rise / (11.8 * flare))) + 0.3 * exp(-rise / (60.0 * flare)));
  float skirtSpread = mix(134.0, 155.0, side) * breathe * flare * flare * mix(0.35, 1.0, min(bloom, 1.0)) * max(bloom, 1.0);
  float skirt = skirtAmp * exp(-psi / skirtSpread) * exp(-sq(adx / (max(layerLen, 60.0 * sqrt(uShape.z)) * 1.48))) * hug;
  col += sideK * skirt * flowMask * min(bloom, 1.0);

  float layer = 12.0 * exp(-adx / layerLen) * exp(-outline / (0.19 * layerLen)) * (1.0 + 0.4 * bead);
  col += sideK * layer * hug * flowMask * min(bloom, 1.0);
  float washMask = smoothstep(sl - 60.0, sl + 6.0, p.x) * (1.0 - smoothstep(sr - 6.0, sr + 45.0, p.x));
  float wash = 1.4 * exp(-adx / 100.0) * exp(-outline / 30.0);
  col += mix(BEAM, sideK, 0.25) * wash * hugWide * washMask * flowMask * min(bloom, 1.0);
  float highWash = 0.7 * exp(-adx / 140.0) * exp(-outline / 60.0);
  col += mix(BEAM, NAVY, 0.5) * highWash * hugWide * washMask * runMask * min(bloom, 1.0);

  float sideSign = dx < 0.0 ? 0.0 : 1.0;
  float along = 0.5 * log((hp + 1.0) / (adx + 1.0));
  float lineScale = 6.0;
  float lp = log(max(psi, 1.0) / (120.0 * flare * flare)) * lineScale;
  float lineIndex = floor(lp) + sideSign * 97.0;
  float wobble = 0.22 * (noise(vec2(lineIndex * 3.7, t * 0.4 + along)) - 0.5);
  float lf = fract(lp + wobble) - 0.5;
  float gradient = lineScale * length(vec2(hp + 1.0, adx)) / max(psi, 1.0) / uScale;
  float halfWidth = max(0.35 * gradient, 0.0001);
  float drawWidth = max(halfWidth, 0.6 * gradient);
  float lineShape = exp(-lf * lf / (drawWidth * drawWidth)) * (halfWidth / drawWidth);
  float lineOn = step(0.3, hash(vec2(lineIndex, 1.3)));
  float lineFlow = smoothstep(0.25, 0.85, noise(vec2(lineIndex * 5.3 + 2.0, along * 3.0 + t * 1.1)));
  float flareArea = 120.0 * flare * flare;
  float lineEnvelope = smoothstep(0.85 * flareArea, 1.4 * flareArea, psi) * (1.0 - smoothstep(3.2 * flareArea, 7.5 * flareArea, psi));
  lineEnvelope *= exp(-adx / (layerLen * 1.5)) * hug * flowMask * (1.0 - smoothstep(35.0 * flare, 80.0 * flare, hp));
  float lineBright = mix(0.35, 1.0, hash(vec2(lineIndex, 4.0)));
  col += mix(sideK, WHITE, 0.6) * lineShape * lineOn * lineFlow * lineEnvelope * lineBright * 2.6 * uAmount.w * min(bloom, 1.0);

  float edgeGlow = 22.8 * exp(-sq(adx / (150.0 * uShape.z))) * edgeMask * (1.0 + 0.9 * bead);
  float onTop = 1.0 - smoothstep(sy + radius, sy + radius + 10.0, p.y);
  float edgeLine = (exp(-sq(max(sd, 0.0) / 0.9)) + 0.12 * exp(-max(sd, 0.0) / 3.0)) * edgeGlow * onTop;
  col += mix(sideK, WHITE, 0.6) * edgeLine * min(bloom, 1.0);

  float pour = uShape.w;
  float baseline = exp(-sq(130.0 / 150.0));
  float strengthR = exp(-sq(reachR / (150.0 * uShape.z))) * (1.0 - smoothstep(0.8 * spread, 1.25 * spread, reachR)) / baseline * pour;
  float strengthL = exp(-sq(reachL / (150.0 * uShape.z))) * (1.0 - smoothstep(0.8 * spread, 1.25 * spread, reachL)) / baseline * pour;
  float fallY = p.y - sy - 0.3 * radius;
  float rightHalf = smoothstep(center.x - 4.0, center.x + 4.0, p.x);
  float haloR = exp(-length(p - vec2(sr - 0.3 * radius, sy + 0.3 * radius)) / 40.0) * sqrt(strengthR);
  float haloL = exp(-length(p - vec2(sl + 0.3 * radius, sy + 0.3 * radius)) / 40.0) * sqrt(strengthL);
  vec3 glowR;
  vec3 glowL;
  col += spill(sd, fallY, strengthR, uPour.y, t, glowR) * rightHalf;
  col += spill(sd, fallY, strengthL, uPour.x, t, glowL) * (1.0 - rightHalf);
  col += easeLight(glowR * rightHalf + NAVY * 0.9 * haloR, uPour.w);
  col += easeLight(glowL * (1.0 - rightHalf) + NAVY * 0.9 * haloL, uPour.z);

  vec2 toLens = frag - uLens.xy;
  float lens = exp(-dot(toLens, toLens) / sq(uLens.z)) * uLens.w;
  col *= 1.0 + 0.35 * lens * hug;
  float fogAmount = uAmount.y * uAtmosphere;
  float near = exp(-adx / 150.0);
  float envelope = near * (0.3 + 0.4 * exp(-hp / 50.0) + 1.2 * exp(-p.y / 120.0));
  if (fogAmount > 0.001 && h > -2.0 && envelope * max(0.25, 6.0 * exp(-adx / 50.0)) > 0.002) {
    vec2 fq = vec2(dx / 1.7, h) / 85.0 + vec2(t * 0.012, -t * 0.03) + uExtra.zw;
    vec2 fw = vec2(fbm(fq * 1.3 + vec2(1.7, 9.2) + t * 0.03), fbm(fq * 1.3 + vec2(8.3, 2.8) - t * 0.025));
    float cloud = fbm(fq + 1.4 * fw);
    float density = smoothstep(0.5, 0.78, cloud);
    float lit = exp(-adx / 50.0);
    float fogMask = smoothstep(-2.0, 20.0, h);
    float reached = smoothstep(front + 80.0, front - 40.0, p.y);
    vec3 fog = (HAZE * 0.45 + BEAM * 6.0 * lit * reached) * density * envelope * fogMask;
    float surfaceLit = exp(-adx / (layerLen * 1.3)) * exp(-outline / 28.0) * hugWide * flowMask * washMask * min(bloom, 1.0);
    fog += sideK * 2.2 * surfaceLit * (smoothstep(0.38, 0.72, cloud) - 0.35) * fogMask;
    float smoke = smoothstep(0.3, 0.75, cloud);
    fog += BEAM * 0.35 * exp(-adx / (22.0 * beamWidth)) * (0.35 + 0.9 * smoke) * fogMask * top * drop;
    col += fog * fogAmount * (1.0 + 1.2 * lens) * mix(1.0, 0.45, uTheme);
  }

  if (uRevealInfo.y > 0.001 && uLens.w > 0.002) {
    vec2 toReveal = frag - uLens.xy;
    float reveal = exp(-dot(toReveal, toReveal) / sq(uRevealInfo.x)) * uLens.w;
    vec2 uv = frag * uRevealMap.xy + uRevealMap.zw;
    float onImage = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    vec4 ui = texture(uReveal, uv);
    float ink = max(ui.r, max(ui.g, ui.b)) * onImage;
    float lit = clamp(col.b * 0.9, 0.0, 1.0) * (1.0 - smoothstep(0.9, 2.2, col.b));
    float clearance = smoothstep(60.0 * sqrt(beamWidth), 150.0 * sqrt(beamWidth), adx);
    col += mix(BEAM, WHITE, 0.4) * ink * reveal * lit * clearance * uRevealInfo.y * 2.2;
  }

  float haze = col.b;
  float dotGrid = 1.0 - smoothstep(0.16, 0.32, length(fract(frag / 3.0) - 0.5));
  col += BEAM * dotGrid * clamp(haze, 0.0, 1.5) * (1.0 - smoothstep(1.5, 4.0, haze)) * (0.18 + 0.3 * lens) * uExtra.y;
  if (lens > 0.002) {
    vec2 drift = frag - vec2(0.0, t * 14.0);
    vec2 sparkCell = floor(drift / 7.0);
    vec2 sparkPos = (sparkCell + 0.2 + 0.6 * vec2(hash(sparkCell + 5.1), hash(sparkCell + 2.3))) * 7.0;
    float sparkDist = length(drift - sparkPos);
    float sparkOn = step(0.8, hash(sparkCell + 8.8));
    float sparkTwinkle = 0.5 + 0.5 * sin(t * 5.0 + hash(sparkCell + 3.7) * 6.283);
    col += WHITE * exp(-sparkDist * sparkDist / 0.35) * sparkOn * sparkTwinkle * lens * clamp(haze * 1.5, 0.0, 1.0) * 1.6 * uAmount.z;
  }

  float dustAmount = uAmount.z;
  if (dustAmount > 0.001) {
    float dustLp = log(max(psi, 1.0) / (120.0 * flare * flare)) * 2.2;
    vec2 flowCell = vec2(dustLp / 1.1, (along + t * 0.22) / 0.06);
    vec2 cellId = floor(flowCell) + vec2(sideSign * 131.0, 0.0);
    vec2 cellJitter = vec2(hash(cellId + 1.7), hash(cellId + 8.3));
    vec2 particleFlow = (floor(flowCell) + 0.1 + cellJitter * 0.8) * vec2(1.1, 0.06);
    float particlePsi = 120.0 * flare * flare * exp(particleFlow.x / 2.2);
    float particleAlong = particleFlow.y - t * 0.22;
    float particleX = sqrt(particlePsi * exp(-2.0 * particleAlong)) - 1.0;
    float particleH = sqrt(particlePsi * exp(2.0 * particleAlong)) - 1.0;
    float particleDist = length(vec2(adx - particleX, hp - particleH)) * uScale;
    float particleOn = step(0.62, hash(cellId + 3.1));
    float particleTwinkle = 0.5 + 0.5 * sin(t * 5.0 + hash(cellId + 9.2) * 6.283);
    float dustZone = exp(-sq(log(max(psi, 1.0) / (200.0 * flare * flare)) / 0.55)) * hug * flowMask * smoothstep(0.0, 6.0, outline);
    col += WHITE * exp(-particleDist * particleDist / 0.3) * particleOn * particleTwinkle * dustZone * 3.0 * dustAmount * min(bloom, 1.0);

    vec2 glitterCell = vec2(dx / 3.0, (p.y - t * 26.0) / 9.0);
    vec2 glitterId = floor(glitterCell);
    vec2 glitterJitter = vec2(hash(glitterId + 4.4), hash(glitterId + 2.9));
    vec2 glitterPos = (glitterId + 0.15 + glitterJitter * 0.7) * vec2(3.0, 9.0);
    float glitterDist = length(vec2(dx, p.y - t * 26.0) - glitterPos) * uScale;
    float glitterOn = step(0.7, hash(glitterId + 6.6));
    float glitterTwinkle = 0.5 + 0.5 * sin(t * 6.0 + hash(glitterId + 1.1) * 6.283);
    float glitterZone = exp(-adx / (5.0 * beamWidth)) * smoothstep(1.5, 4.0, adx / beamWidth) * above * smoothstep(25.0, 70.0, hp) * top * drop;
    col += WHITE * exp(-glitterDist * glitterDist / 0.25) * glitterOn * glitterTwinkle * glitterZone * 2.2 * dustAmount * uAtmosphere;
  }

  col *= uAmount.x * (1.0 + uIntro.z * 0.9 * exp(-length(vec2(dx, h * 1.6)) / 70.0));
  col *= smoothstep(-0.75, 0.25, sd * uScale);

  vec3 emit = 1.0 - exp(-col * mix(1.0, 0.6, uTheme));
  float peak = max(emit.r, max(emit.g, emit.b));
  if (uTheme > 0.5) {
    float low = min(emit.r, min(emit.g, emit.b));
    float chroma = peak - low;
    vec3 hue = (emit - low) / max(chroma, 0.0001);
    float alpha = clamp(pow(chroma, 1.35) * 1.3, 0.0, 1.0) * 0.9;
    outColor = vec4((hue * 0.82 + 0.06) * alpha, alpha);
  } else {
    outColor = vec4(emit, peak);
  }
}`;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const dnum = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };

  const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const spring = time => {
    const omega = 8, zeta = 0.62;
    const damped = omega * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * omega * time) * (Math.cos(damped * time) + ((zeta * omega) / damped) * Math.sin(damped * time));
  };

  const toHsv = rgb => {
    const max = Math.max(rgb[0], rgb[1], rgb[2]);
    const min = Math.min(rgb[0], rgb[1], rgb[2]);
    const delta = max - min;
    let hue = 0;
    if (delta > 0) {
      if (max === rgb[0]) hue = ((rgb[1] - rgb[2]) / delta) % 6;
      else if (max === rgb[1]) hue = (rgb[2] - rgb[0]) / delta + 2;
      else hue = (rgb[0] - rgb[1]) / delta + 4;
    }
    return [(hue * 60 + 360) % 360, max > 0 ? delta / max : 0];
  };

  const fromHsv = (hue, saturation) => {
    const h = (((hue % 360) + 360) % 360) / 60;
    const c = saturation;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = 1 - c;
    const rgb =
      h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
    return [rgb[0] + m, rgb[1] + m, rgb[2] + m];
  };

  const buildTints = rgb => {
    const t = toHsv(rgb);
    const hue = t[0], saturation = t[1];
    const strength = saturation / BASE_SATURATION;
    const data = new Float32Array(TINTS.length * 3);
    TINTS.forEach(function (pair, index) {
      data.set(fromHsv(hue + pair[0], clamp(BASE_SATURATION * pair[1] * strength, 0, 1)), index * 3);
    });
    return data;
  };

  function compile(gl, type, source) {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return sh;
    gl.deleteShader(sh);
    return null;
  }

  function link(gl) {
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null; }
    const names = ["uResolution", "uDpr", "uScale", "uTime", "uBeamX", "uSurface", "uRadius", "uIntro", "uPour", "uRun",
      "uLens", "uReveal", "uRevealMap", "uRevealInfo", "uAtmosphere", "uAmount", "uShape", "uExtra", "uTheme", "uTint"];
    const uniforms = {};
    for (let i = 0; i < names.length; i++) uniforms[names[i]] = gl.getUniformLocation(program, names[i]);
    return { program: program, uniforms: uniforms };
  }

  function readOptions(data) {
    var isPhone = window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches &&
      Math.min(window.screen.width || 9999, window.screen.height || 9999) <= 740;
    var o = {
      color: data.color || "#6f7bff",
      intensity: clamp(dnum(data.intensity, 1.8), 0, 4),
      beamWidth: clamp(dnum(data.beamWidth || data["beam-width"], 1.5), 0.2, 5),
      flare: clamp(dnum(data.flare, 1.5), 0.2, 4),
      spread: clamp(dnum(data.spread, 1.5), 0.1, 4),
      spill: clamp(dnum(data.spill, 1), 0, 4),
      fog: clamp(dnum(data.fog, 0.2), 0, 1),
      dust: clamp(dnum(data.dust, 1.6), 0, 3),
      streaks: clamp(dnum(data.streaks, 1.5), 0, 3),
      dots: clamp(dnum(data.dots, 1), 0, 2),
      pulse: clamp(dnum(data.pulse, 1.5), 0, 3),
      speed: Math.max(0, dnum(data.speed, 1.5)),
      seed: dnum(data.seed, 3),
      beamCenter: (data.beamCenter || data["beam-center"]) !== "false",
      beamPosition: clamp(dnum(data.beamPosition || data["beam-position"], 0.5), 0, 1),
      intro: (data.intro !== "false"),
      paused: (data.paused === "true"),
      light: (data.theme === "light"),
      targetSel: data.target || null
    };
    if (isPhone) {
      o.intensity *= 0.8;
      o.dust *= 0.6;
      o.fog *= 0.7;
      o.dpr = 1;
    }
    return o;
  }

  function LaserFlow(root, data) {
    if (!root || root._laserFlow) return;
    root._laserFlow = true;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    root.appendChild(canvas);
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) { canvas.remove(); root._laserFlow = null; return; }
    const core = link(gl);
    if (!core) { canvas.remove(); root._laserFlow = null; return; }
    const program = core.program, uniforms = core.uniforms;

    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const revealTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, revealTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const probe = document.createElement("canvas");
    probe.width = 1; probe.height = 1;
    const probeCtx = probe.getContext("2d", { willReadFrequently: true });

    const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const settings = readOptions(data || {});
    const state = {
      time: 0,
      introTime: settings.intro && !reduce ? 0 : INTRO_END,
      width: 1, height: 1, ratio: 1,
      colorKey: "", tints: buildTints([0.22, 0.28, 1]),
      target: null, targetSel: settings.targetSel,
      cur: null, tgt: null,
      pointer: { x: 0, y: 0, inside: false },
      lens: { x: 0, y: 0, vx: 0, vy: 0, strength: 0, placed: false }
    };
    let raf = 0, last = 0, visible = true, alive = true, hidden = false;

    function toRgb(value) {
      if (!probeCtx) return [0.22, 0.28, 1];
      probeCtx.clearRect(0, 0, 1, 1);
      probeCtx.fillStyle = "#3847ff";
      probeCtx.fillStyle = value;
      probeCtx.fillRect(0, 0, 1, 1);
      const px = probeCtx.getImageData(0, 0, 1, 1).data;
      return [px[0] / 255, px[1] / 255, px[2] / 255];
    }

    function resolveColor() {
      if (settings.color === state.colorKey) return;
      state.colorKey = settings.color;
      state.tints = buildTints(toRgb(settings.color));
    }

    /* ---- target / permukaan ---- */
    function targetRaw(w, h) {
      let el = state.target;
      if (!el && state.targetSel) { try { el = document.querySelector(state.targetSel); } catch (e) { el = null; } }
      if (!el) {
        /* tanpa target: garis horizon default (permukaan di bawah layar) */
        return { left: -w * 2, top: h, right: w * 3, bottom: h * 3, radius: 0, real: false };
      }
      const box = root.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return { left: -w * 2, top: h, right: w * 3, bottom: h * 3, radius: 0, real: false };
      }
      let radius = 0;
      try {
        const cs = getComputedStyle(el);
        radius = Math.max(parseFloat(cs.borderTopLeftRadius) || 0, parseFloat(cs.borderTopRightRadius) || 0);
        radius = Math.min(radius, rect.width / 2, rect.height / 2);
      } catch (e) { radius = 0; }
      return { left: rect.left - box.left, top: rect.top - box.top, right: rect.right - box.left, bottom: rect.bottom - box.top, radius: radius, real: true };
    }

    function setTarget(el) {
      if (state.target === el) return;
      state.target = el || null;
      wake();
    }
    function show() { hidden = false; wake(); }
    function hide() { hidden = true; wake(); }

    function resize() {
      const w = Math.max(1, root.clientWidth);
      const h = Math.max(1, root.clientHeight);
      const base = Math.min(settings.dpr || window.devicePixelRatio || 1, 2);
      const longest = Math.max(w, h) * base;
      const ratio = longest > MAX_RENDER_DIM ? (base * MAX_RENDER_DIM) / longest : base;
      const pw = Math.max(1, Math.round(w * ratio));
      const ph = Math.max(1, Math.round(h * ratio));
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      state.width = w; state.height = h; state.ratio = canvas.width / w;
      render();
    }

    function render() {
      resolveColor();
      const w = state.width, h = state.height;
      const scale = Math.max(0.2, Math.min(w / 585, h / 507));
      state.tgt = targetRaw(w, h);
      if (!state.cur) state.cur = { left: state.tgt.left, top: state.tgt.top, right: state.tgt.right, bottom: state.tgt.bottom, radius: state.tgt.radius };
      const surface = state.cur;
      let beamX = settings.beamCenter
        ? (surface.left + surface.right) / 2
        : settings.beamPosition * w;
      const margin = surface.radius + 6;
      if (surface.real) beamX = clamp(beamX, surface.left + margin, surface.right - margin);

      const startY = -0.15 * h;
      const span = surface.top - startY + 0.3 * h;
      const it = state.introTime;
      const settled = it >= INTRO_END;
      const front = settled ? surface.top + 0.3 * h : startY + span * Math.pow(clamp(it / INTRO_DROP, 0, 1), 1.3);
      const impact = INTRO_DROP * Math.pow(Math.max(0, surface.top - startY) / span, 1 / 1.3);
      const tau = it - impact;
      const bloom = settled ? 1 : tau <= 0 ? 0 : spring(tau);
      const flash = settled || tau <= 0 ? 0 : Math.exp(-tau / 0.35) * (1 - Math.exp(-tau / 0.05));
      const runRange = settings.spread * 250 * 1.3 + 80;
      const runFront = settled ? 100000 : tau <= 0 ? -40 : runRange * (1 - Math.exp(-1.15 * tau));
      const beadStrength = settled || tau <= 0 ? 0 : Math.exp(-1.15 * tau) * (1 - Math.exp(-tau / 0.08));
      const pour = reach => {
        if (settled) return [1000, 1];
        if (tau <= 0) return [-reach, 0];
        const target = Math.min(reach, runRange * 0.97);
        const arrival = -Math.log(1 - target / runRange) / 1.15;
        const elapsed = tau - arrival;
        const ease = clamp((elapsed + 0.15) / 0.8, 0, 1);
        const fill = ease * ease * ease * (ease * (ease * 6 - 15) + 10);
        if (elapsed <= 0) return [runFront - target, fill];
        const speed = 1.15 * (runRange - target);
        return [speed * elapsed + 260 * elapsed * elapsed, fill];
      };
      const pairL = pour((beamX - surface.left) / scale);
      const pairR = pour((surface.right - beamX) / scale);
      const atmosphere = settled ? 1 : tau <= 0 ? 0.3 * easeOut(it / INTRO_DROP) : 0.3 + 0.7 * (1 - Math.exp(-1.3 * tau));
      const seedValue = Number(settings.seed) || 0;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(uniforms.uResolution, w, h);
      gl.uniform1f(uniforms.uDpr, state.ratio);
      gl.uniform1f(uniforms.uScale, scale);
      gl.uniform1f(uniforms.uTime, state.time);
      gl.uniform1f(uniforms.uBeamX, beamX);
      gl.uniform4f(uniforms.uSurface, surface.left, surface.top, surface.right, surface.bottom);
      gl.uniform1f(uniforms.uRadius, surface.radius);
      gl.uniform3f(uniforms.uIntro, front, bloom, flash);
      gl.uniform4f(uniforms.uPour, pairL[0], pairR[0], pairL[1], pairR[1]);
      gl.uniform2f(uniforms.uRun, runFront, beadStrength);
      gl.uniform4f(uniforms.uLens, state.lens.x, state.lens.y, 95 * scale, state.lens.strength);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, revealTexture);
      gl.uniform1i(uniforms.uReveal, 0);
      gl.uniform4f(uniforms.uRevealMap, 1, 1, 0, 0);
      gl.uniform2f(uniforms.uRevealInfo, 200, 0);
      gl.uniform1f(uniforms.uAtmosphere, atmosphere);
      gl.uniform4f(uniforms.uAmount, settings.intensity, settings.fog, settings.dust, settings.streaks);
      gl.uniform4f(uniforms.uShape, settings.beamWidth, settings.flare, settings.spread, settings.spill);
      gl.uniform4f(uniforms.uExtra, settings.pulse, settings.dots, 34.34 + seedValue * 7.31, 11.58 + seedValue * 3.17);
      gl.uniform1f(uniforms.uTheme, settings.light ? 1 : 0);
      gl.uniform3fv(uniforms.uTint, state.tints);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    }

    function rectMoving() {
      if (!state.cur || !state.tgt) return false;
      const c = state.cur, t = state.tgt;
      return Math.abs(c.left - t.left) + Math.abs(c.top - t.top) + Math.abs(c.right - t.right) + Math.abs(c.bottom - t.bottom) > 1;
    }

    function frame(now) {
      raf = 0;
      if (!alive || !visible || document.hidden || hidden) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const moving = !settings.paused && !reduce;
      if (moving) state.time += dt * settings.speed;
      const introducing = state.introTime < INTRO_END;
      if (introducing) state.introTime = Math.min(INTRO_END, state.introTime + dt);
      /* pemicu cahaya: target permukaan mengikuti scrol (lerp) supaya "sejalan" */
      const k = 1 - Math.exp(-dt * 5.5);
      if (state.tgt) {
        const c = state.cur, t = state.tgt;
        c.left += (t.left - c.left) * k;
        c.top += (t.top - c.top) * k;
        c.right += (t.right - c.right) * k;
        c.bottom += (t.bottom - c.bottom) * k;
        c.radius += (t.radius - c.radius) * k;
      }
      const lens = state.lens;
      const active = !reduce && state.pointer.inside && !hidden;
      if (active && !lens.placed) { lens.x = state.pointer.x; lens.y = state.pointer.y; lens.vx = 0; lens.vy = 0; lens.placed = true; }
      const ax = 120 * (state.pointer.x - lens.x) - 19 * lens.vx;
      const ay = 120 * (state.pointer.y - lens.y) - 19 * lens.vy;
      lens.vx += ax * dt; lens.vy += ay * dt;
      lens.x += lens.vx * dt; lens.y += lens.vy * dt;
      const goal = active ? 1 : 0;
      lens.strength += (goal - lens.strength) * (1 - Math.exp(-dt / (goal > lens.strength ? 0.3 : 0.55)));
      if (lens.strength < 0.001 && !active) lens.placed = false;

      render();
      const settling =
        Math.abs(state.lens.strength - (state.pointer.inside ? 1 : 0)) > 0.002 ||
        Math.hypot(state.lens.vx, state.lens.vy) > 0.5 ||
        rectMoving();
      if (moving || introducing || settling) raf = requestAnimationFrame(frame);
      else last = 0;
    }

    function wake() {
      if (!raf && alive && visible && !document.hidden && !hidden) raf = requestAnimationFrame(frame);
    }

    function onPointerMove(e) {
      const rect = root.getBoundingClientRect();
      state.pointer.x = e.clientX - rect.left;
      state.pointer.y = e.clientY - rect.top;
      state.pointer.inside = state.pointer.x >= 0 && state.pointer.y >= 0 &&
        state.pointer.x <= rect.width && state.pointer.y <= rect.height;
      wake();
    }
    function onPointerLeave() { state.pointer.inside = false; wake(); }
    function onVisibility() { last = 0; wake(); }

    const ro = new ResizeObserver(resize);
    ro.observe(root);
    const io = new IntersectionObserver(function (entries) {
      visible = entries.some(function (entry) { return entry.isIntersecting; });
      if (visible) { last = 0; wake(); }
    });
    io.observe(root);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    wake();

    root._laserFlow = {
      setTarget: setTarget,
      show: show,
      hide: hide,
      resize: resize,
      wake: wake,
      destroy: function () {
        alive = false;
        if (raf) cancelAnimationFrame(raf);
        ro.disconnect(); io.disconnect();
        window.removeEventListener("pointermove", onPointerMove);
        document.documentElement.removeEventListener("pointerleave", onPointerLeave);
        document.removeEventListener("visibilitychange", onVisibility);
        gl.deleteTexture(revealTexture);
        gl.deleteBuffer(buffer);
        gl.deleteVertexArray(vao);
        gl.deleteProgram(program);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        root._laserFlow = null;
      }
    };
  }

  window.xozenLaserFlow = LaserFlow;

  function autoInit() {
    if (document.querySelectorAll) {
      Array.prototype.forEach.call(document.querySelectorAll("div[data-laser-flow]"), function (el) {
        if (el._laserFlow && el._laserFlow !== true) return;
        LaserFlow(el, el.dataset || {});
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
