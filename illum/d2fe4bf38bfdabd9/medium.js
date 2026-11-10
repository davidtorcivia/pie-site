// The medium: paper that keeps what is done to it, and a pen that behaves like one.
// The pen has mass. It follows the hand through a damped spring, as a held pen and a wrist do, so a stroke is a true
// curve (with a real hand's small lag and overshoot) and a corner is only a corner when the hand makes one. The ink is
// laid by the nib's edge as it sweeps: each step is exactly the area the edge passes over, with an analytic anti-aliased
// edge, so a broad nib makes its thick and thin by its angle and nothing is stamped. Ink flows per unit of time, so it
// lands heavier where the pen slows (touch-down, a turn, a stop) and runs finer in a quick stroke. Pressure spreads a
// flexible nib. As the charge runs down, the ink catches only the tooth's high points and the line breaks dry.
// Within one stroke the ink is one deposit (wet into wet: overlaps don't double); crossing an earlier stroke lays ink
// on ink, darker. WebGL2, half-float targets.

const VS = `#version 300 es
in vec2 aPos; out vec2 vUV; uniform vec4 uRect; uniform vec2 uRes;
void main(){ vec2 p = uRect.xy + aPos * uRect.zw; vUV = p / uRes; gl_Position = vec4(vUV * 2. - 1., 0, 1); }`;
const NOISE = `
float hash(vec2 p){ uvec2 v = uvec2(ivec2(floor(p)) + 32768); v = v * 1664525u + 1013904223u; v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u; v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> 16u; return float(v.x >> 8u) / 16777215.; }   // (24 bits, exact in a float. The hash needs 32-bit uints: every shader here says precision highp int, since a fragment shader's default is mediump, which Adreno keeps at 16 bits, and the paper came out flat)
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }`;
// how a stroke's ink takes on the paper: a dry pen catches only the tooth's peaks; the fibre roughens every edge a little
const LAY = `
float lay(vec4 s, vec4 pap) {
  float catchK = smoothstep(.15 + .7 * s.b, .35 + .7 * s.b, pap.r + .25);
  float edgeK = smoothstep(0., .9, s.g + (pap.g - .5) * .35);
  return s.r * catchK * edgeK * (.9 + .2 * pap.r);
}`;

// paper: R tooth height, G fibre
const PAPER_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D; in vec2 vUV; out vec4 o; uniform vec2 uRes, uOff; uniform float uSeed, uPx, uRough;
${NOISE}
// a cell c CSS px across, never finer than 2.5 device px (a texture sampled below its own grid is only sparkle)
float N(vec2 q, vec2 c, float s){ return vn(q / max(c / uPx, vec2(2.5)) + s); }
void main(){
  vec2 q = vUV * uRes + uOff;                                     // uOff: where this window sits on the page
  float t = .5 * N(q, vec2(1.9, 1.5), uSeed) + .3 * N(q, vec2(.8), uSeed * 2.) + .2 * N(q, vec2(4.5), uSeed * 3.);
  vec2 f = mat2(.94, .34, -.34, .94) * q;                         // the fibres lie long, a little off the horizontal
  float fib = .6 * N(f, vec2(3.4, .9), 71. + uSeed) + .4 * N(f, vec2(9., 2.4), 113. + uSeed);
  o = vec4(mix(.5, t, uRough), fib, 0, 0);
}`;

// one step of the nib's sweep: the quad [A0, A1, B1, B0] its edge passes over. The sides are anti-aliased; the two
// ends (the edge at a and at b) are pushed out half a pixel so consecutive steps join with no seam.
// R ink, G coverage, B dryness; MAX-blended into the stroke.
// The sweep steps are batched: each is an instance (its quad, its start and end, its ink and dryness) drawn over its
// own bounding box, all of a batch in one draw call (MAX blending is order-free, so the result is the same as one by one).
const SWEEP_VS = `#version 300 es
in vec2 aPos; in vec4 iQ01, iQ23, iAB, iInk; uniform vec2 uRes;
out vec2 vP; flat out vec2 Q0, Q1, Q2, Q3, A, B; flat out vec3 K;
void main(){
  vec2 lo = min(min(iQ01.xy, iQ01.zw), min(iQ23.xy, iQ23.zw)), hi = max(max(iQ01.xy, iQ01.zw), max(iQ23.xy, iQ23.zw));
  vec2 o = floor(lo - 2.), sz = ceil(hi - lo + 4.);
  vP = o + aPos * sz; gl_Position = vec4(vP / uRes * 2. - 1., 0, 1);
  Q0 = iQ01.xy; Q1 = iQ01.zw; Q2 = iQ23.xy; Q3 = iQ23.zw; A = iAB.xy; B = iAB.zw; K = iInk.xyz;
}`;
const SWEEP_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D; in vec2 vP; out vec4 o; flat in vec2 Q0, Q1, Q2, Q3, A, B; flat in vec3 K; uniform float uRim;
float edge(vec2 p, vec2 a, vec2 b){ vec2 e = b - a; return dot(p - a, normalize(vec2(e.y, -e.x))); }
void main(){
  vec2 uQ[4] = vec2[4](Q0, Q1, Q2, Q3), uA = A, uB = B; float uInk0 = K.x, uInk1 = K.y, uDry = K.z;
  vec2 p = vP;
  vec2 u = uQ[1] - uQ[0], v = uQ[3] - uQ[0]; float s = u.x * v.y - u.y * v.x < 0. ? 1. : -1.;
  float ds = min(s * edge(p, uQ[1], uQ[2]), s * edge(p, uQ[3], uQ[0]));
  float de = min(s * edge(p, uQ[0], uQ[1]), s * edge(p, uQ[2], uQ[3]));
  float cov = clamp(ds + .5, 0., 1.) * clamp(de + 1., 0., 1.); if (cov <= 0.) discard;
  vec2 ab = uB - uA; float t = clamp(dot(p - uA, ab) / max(dot(ab, ab), 1e-6), 0., 1.);
  // the ink is drawn to the stroke's two borders (the nib's corners drag it there), a little lighter between them
  float wide = distance(uQ[0], uQ[1]), rim = 1. + uRim * smoothstep(5., 14., wide) * (1.4 * exp(-max(ds, 0.) / 2.2) - .3);
  o = vec4(mix(uInk0, uInk1, t) * rim * cov, cov, uDry * cov, 0);
}`;

// The ink as a liquid. Each frame: the pen's fresh ink pours into the wet layer (wet into wet merges: an overlap is a
// little fuller, never a second coat); the wet ink levels between neighbouring pixels, and creeps a pixel or two past
// its edge, unevenly along the paper's fibres (the contact line held by surface tension, so it rounds the starts and
// ends of strokes and fills the inside corners where they meet); as the water goes, it stops moving and settles into
// the dry layer. Wet: R volume, G mobility. Dry: R volume.
const FLOW_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D; in vec2 vUV; layout(location = 0) out vec4 oWet; layout(location = 1) out vec4 oDry;
uniform sampler2D uWet, uDry, uStroke, uPaper; uniform vec2 uTexel; uniform float uDecay, uLevel, uCreep, uPour;
${LAY}
vec2 at(vec2 uv) { vec4 w = texture(uWet, uv), s = texture(uStroke, uv); float f = lay(s, texture(uPaper, uv)) * uPour;
  return vec2(max(w.r, f) + .3 * min(w.r, f), max(w.g, s.g * uPour)); }
void main(){
  vec2 c = at(vUV); float V = c.x, M = min(c.y, 1.), dV = 0., Mn = 0.;
  float perm = .7 + .6 * texture(uPaper, vUV).g;                       // fibre: the paper drinks unevenly
  for (int k = 0; k < 8; k++) {
    vec2 off = vec2(k < 4 ? (k == 0 ? 1. : k == 1 ? -1. : 0.) : (k == 4 || k == 6 ? 1. : -1.), k < 4 ? (k == 2 ? 1. : k == 3 ? -1. : 0.) : (k < 6 ? 1. : -1.));
    vec2 n = at(vUV + off * uTexel); float nM = min(n.y, 1.), wgt = k < 4 ? 1. : .5;
    dV += uLevel * wgt * perm * .5 * (M + nM) * (n.x - V);
    Mn = max(Mn, nM);
  }
  V = max(0., V + dV);
  // mobility: what was poured, drying away; at the edge a little is lent outward (each ring a third of the last)
  float M2 = max(M, uCreep * Mn) * uDecay;
  // it settles as the water goes (all of it once the sheet is dry); a still edge holds its ink rather than drying first,
  // or the edge would pump the stroke into a hard ring
  float settle = uDecay <= 0. ? V : V * (1. - uDecay) * .6;
  oWet = vec4(V - settle, M2 < .01 ? 0. : M2, 0, 0);
  oDry = texture(uDry, vUV) + vec4(settle, 0, 0, 0);
}`;

// what shows is the ink that lies in each pixel: a pixel the edge crosses is part-dark, a hairline is a thinner coat,
// and a full coat saturates. The darkness is the mass until then, not a level set of it (a threshold throws away the
// sweep's sub-pixel coverage and turns every edge back into a stair). Deeper ink is a little darker.
// pour: a deposit given as a picture rather than a sweep (a letter's coverage, say), drawn into the stroke layer as the
// sweep would lay it. Its texel holds R coverage, G ink (0..2 stored as 0..1), B dryness.
const POUR_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D; in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec4 uDst; uniform vec2 uRes;
void main(){ vec2 t = (vUV * uRes - uDst.xy) / uDst.zw; vec4 m = texture(uSrc, t); if (m.r <= 0.) discard; o = vec4(m.g * 2. * m.r, m.r, m.b * m.r, 0); }`;

const RENDER_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D; in vec2 vUV; out vec4 o; uniform sampler2D uDry, uWet, uPaper; uniform vec3 uPaperRGB, uK, uInk; uniform float uBase, uOver;
void main(){
  vec2 uv = vec2(vUV.x, 1. - vUV.y);                 // the simulation runs y down, the screen's framebuffer y up
  float V = texture(uDry, uv).r + texture(uWet, uv).r, f = texture(uPaper, uv).g;
  float cov = min(1., V * (.85 + .3 * f) / .55);     // the fibre moves the edge a fraction of a pixel either way
  float d = cov * (uBase + .45 * min(V, 1.5));
  // multiply: the sheet as it looks, to lay over a light page by multiplying; over: the ink alone, its colour with an
  // opacity, to lay over any ground (a dark page above all, where subtracting from the paper would show nothing)
  o = uOver > .5 ? vec4(uInk * exp(-uK * max(0., d - 1.)), 1. - exp(-3. * d)) : vec4(uPaperRGB * exp(-uK * d), 1);
}`;

export function createMedium(canvas, { dpr = Math.min(2, devicePixelRatio || 1), seed = 7, paper = [243, 237, 225], ink = [30, 21, 15], rough = .6 } = {}) {
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
  // (its targets are RGBA16F: renderable with EXT_color_buffer_float, or on many phones' GPUs only EXT_color_buffer_half_float)
  if (!gl || !(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))) throw new Error('This needs WebGL2 with float render targets.');
  gl.getExtension('EXT_float_blend');
  let W = canvas.width, H = canvas.height;
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = (fs, vs = VS) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const U = {}; return { p, u: n => U[n] ??= gl.getUniformLocation(p, n) }; };
  const P = { paper: prog(PAPER_FS), sweep: prog(SWEEP_FS, SWEEP_VS), flow: prog(FLOW_FS), render: prog(RENDER_FS), pour: prog(POUR_FS) };
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, W, H, 0, gl.RGBA, gl.HALF_FLOAT, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
  const fbo = (...ts) => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); ts.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
    gl.drawBuffers(ts.map((_, i) => gl.COLOR_ATTACHMENT0 + i)); return f; };
  let T, F; const alloc = () => { T = { paper: tex(), stroke: tex(), dry: [tex(), tex()], wet: [tex(), tex()] };
    F = { paper: fbo(T.paper), stroke: fbo(T.stroke), flow: [fbo(T.wet[1], T.dry[1]), fbo(T.wet[0], T.dry[0])] }; };
  alloc();
  let cur = 0, wetting = 0;
  const run = (pr, rect = [0, 0, W, H]) => { gl.useProgram(pr.p); const a = gl.getAttribLocation(pr.p, 'aPos'); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); gl.uniform4f(pr.u('uRect'), ...rect); gl.uniform2f(pr.u('uRes'), W, H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  const bind = (pr, name, unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(pr.u(name), unit); };
  const clearT = f => { gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
  const S = { rough, ink, paper, rim: 0, density: 1, base: .62, drying: 500 };

  // sc: only this rect [x, y, w, h] (device px, y down) of the sheet, where a window wants it
  function makePaper(off = [0, 0], sc = null) { gl.viewport(0, 0, W, H); if (sc) { gl.enable(gl.SCISSOR_TEST); gl.scissor(sc[0], sc[1], sc[2], sc[3]); } gl.bindFramebuffer(gl.FRAMEBUFFER, F.paper); gl.disable(gl.BLEND); gl.useProgram(P.paper.p);
    gl.uniform2f(P.paper.u('uOff'), off[0], off[1]);
    gl.uniform1f(P.paper.u('uSeed'), seed % 97); gl.uniform1f(P.paper.u('uPx'), 1 / dpr); gl.uniform1f(P.paper.u('uRough'), S.rough); run(P.paper); gl.disable(gl.SCISSOR_TEST); }
  function clear() { nb = 0; for (const t of [...T.dry, ...T.wet, T.stroke]) { const f = fbo(t); clearT(f); gl.deleteFramebuffer(f); } wetting = 0; area = null; }
  // where there is ink: the union of everything swept since the last clear (outside it every layer is empty in both
  // ping-pong buffers, so the flow need only run inside it)
  let area = null, batch = new Float32Array(16 * 1024), nb = 0;
  makePaper(); clear();

  // one sweep step: quad q (four device-px points), ink at its start and end, the pen's dryness
  // the sweep steps wait in a batch (16 floats each) and are drawn together before anything reads the stroke layer
  const inst = gl.createBuffer(), vao = gl.createVertexArray();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  { const a = gl.getAttribLocation(P.sweep.p, 'aPos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); }
  gl.bindBuffer(gl.ARRAY_BUFFER, inst);
  ['iQ01', 'iQ23', 'iAB', 'iInk'].forEach((n, k) => { const a = gl.getAttribLocation(P.sweep.p, n); gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 4, gl.FLOAT, false, 64, k * 16); gl.vertexAttribDivisor(a, 1); });
  gl.bindVertexArray(null);
  function drawBatch() {
    if (!nb) return;
    gl.viewport(0, 0, W, H); gl.bindFramebuffer(gl.FRAMEBUFFER, F.stroke); gl.enable(gl.BLEND); gl.blendEquation(gl.MAX);
    const pr = P.sweep; gl.useProgram(pr.p); gl.uniform2f(pr.u('uRes'), W, H); gl.uniform1f(pr.u('uRim'), S.rim);
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, inst); gl.bufferData(gl.ARRAY_BUFFER, batch.subarray(0, nb * 16), gl.STREAM_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nb); gl.bindVertexArray(null);
    gl.blendEquation(gl.FUNC_ADD); gl.disable(gl.BLEND); nb = 0;
  }
  function sweep(q, a, b, ink0, ink1, dry) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of q) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (nb * 16 >= batch.length) { const g = new Float32Array(batch.length * 2); g.set(batch); batch = g; }
    batch.set([q[0][0], q[0][1], q[1][0], q[1][1], q[2][0], q[2][1], q[3][0], q[3][1], a[0], a[1], b[0], b[1], ink0, ink1, dry, 0], nb++ * 16);
    pour();
    const m = 12; area = area ? [Math.min(area[0], x0 - m), Math.min(area[1], y0 - m), Math.max(area[2], x1 + m), Math.max(area[3], y1 + m)] : [x0 - m, y0 - m, x1 + m, y1 + m];
  }
  // pour a deposit given as RGBA8 data (w x h texels: R coverage, G ink/2, B dryness) over the device-px rect [x, y, w, h]
  let srcT = null;
  function pourImage(data, w, h, rect) {
    drawBatch();
    if (!srcT) { srcT = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, srcT);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, srcT); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.viewport(0, 0, W, H); gl.bindFramebuffer(gl.FRAMEBUFFER, F.stroke); gl.enable(gl.BLEND); gl.blendEquation(gl.MAX);
    const pr = P.pour; gl.useProgram(pr.p); gl.uniform1i(pr.u('uSrc'), 0); gl.uniform4f(pr.u('uDst'), ...rect);   // (not uRect: the vertex shader's quad already has that name)
    run(pr, [Math.floor(rect[0]), Math.floor(rect[1]), Math.ceil(rect[2]) + 1, Math.ceil(rect[3]) + 1]);
    gl.blendEquation(gl.FUNC_ADD); gl.disable(gl.BLEND); pour();
    const m = 12; area = area ? [Math.min(area[0], rect[0] - m), Math.min(area[1], rect[1] - m), Math.max(area[2], rect[0] + rect[2] + m), Math.max(area[3], rect[1] + rect[3] + m)]
      : [rect[0] - m, rect[1] - m, rect[0] + rect[2] + m, rect[1] + rect[3] + m];
  }
  // the ink moves: pour the pen's fresh ink in, level it, let it dry. Three small steps a frame while anything is wet.
  function step(ms) {
    drawBatch(); if (wetting <= 0 || !area) return; wetting -= ms;
    gl.viewport(0, 0, W, H); gl.disable(gl.BLEND); const pr = P.flow;
    const x0 = Math.max(0, Math.floor(area[0])), y0 = Math.max(0, Math.floor(area[1])), rect = [x0, y0, Math.min(W, Math.ceil(area[2])) - x0, Math.min(H, Math.ceil(area[3])) - y0];
    for (let k = 0; k < 3; k++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, F.flow[cur]); gl.useProgram(pr.p);
      bind(pr, 'uWet', 0, T.wet[cur]); bind(pr, 'uDry', 1, T.dry[cur]); bind(pr, 'uStroke', 2, T.stroke); bind(pr, 'uPaper', 3, T.paper);
      gl.uniform2f(pr.u('uTexel'), 1 / W, 1 / H); gl.uniform1f(pr.u('uDecay'), wetting <= 0 ? 0 : .5 ** (ms / 3 / S.drying));
      gl.uniform1f(pr.u('uLevel'), S.level); gl.uniform1f(pr.u('uCreep'), S.creep); gl.uniform1f(pr.u('uPour'), k === 0 ? 1 : 0); run(pr, rect); cur = 1 - cur;
    }
    clearT(F.stroke);
  }
  const pour = () => { wetting = Math.max(wetting, 12000); };
  // dry it all now: one step with the water gone settles every bit of wet ink where it lies
  function finish() { if (wetting > 0) { wetting = 1; step(1); } }
  function render(sc = null) {
    drawBatch(); if (sc) { gl.enable(gl.SCISSOR_TEST); gl.scissor(sc[0], H - sc[1] - sc[3], sc[2], sc[3]); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); const pr = P.render; gl.useProgram(pr.p);
    bind(pr, 'uDry', 0, T.dry[cur]); bind(pr, 'uWet', 1, T.wet[cur]); bind(pr, 'uPaper', 2, T.paper);
    gl.uniform3f(pr.u('uPaperRGB'), ...S.paper.map(c => c / 255)); gl.uniform1f(pr.u('uBase'), S.base); gl.uniform3f(pr.u('uInk'), ...S.ink.map(c => c / 255)); gl.uniform1f(pr.u('uOver'), S.over ? 1 : 0);
    gl.uniform3f(pr.u('uK'), ...S.ink.map((c, i) => -Math.log(Math.max(.02, c / S.paper[i])) / S.density)); run(pr); gl.disable(gl.SCISSOR_TEST);
  }
  // how wet the ink is, 0 (a dry, quick ink: barely moves) .. 1 (a wet, slow ink: merges, softens, creeps).
  // The pigment hardly travels on sized paper: the level is kept small, or a hairline is spread over three pixels
  // and reads grey, and a broad stroke grows a halo wider than its own anti-aliasing
  function wetness(w) { S.creep = .03 + .2 * w; S.level = .002 + .02 * w; S.drying = 250 + 1600 * w * w; }
  wetness(.25);
  // the sheet made again at another size, as a new medium of that size would be, but in the same context with its
  // programs already compiled (making a context and compiling its shaders costs tens of ms; a sheet, a few)
  function resize(w, h) {
    for (const t of [T.paper, T.stroke, ...T.dry, ...T.wet]) gl.deleteTexture(t); for (const f of [F.paper, F.stroke, ...F.flow]) gl.deleteFramebuffer(f);
    canvas.width = W = w; canvas.height = H = h; alloc(); cur = 0;
    for (const k in S) delete S[k]; Object.assign(S, { rough, ink, paper, rim: 0, density: 1, base: .62, drying: 500 }); wetness(.25);
    makePaper(); clear();
  }
  // (diagnostics: a layer read back as floats, [x, y, w, h] in device px of the sheet; site/diag.html uses it to see what
  // a device's GPU actually holds)
  function peek(name, x, y, w, h) { const t = name === 'paper' ? T.paper : name === 'stroke' ? T.stroke : name === 'dry' ? T.dry[cur] : T.wet[cur], f = fbo(t), o = new Float32Array(w * h * 4);
    gl.readPixels(x, y, w, h, gl.RGBA, gl.FLOAT, o); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(f); return o; }
  return { wetness, gl, get W() { return W; }, get H() { return H; }, dpr, settings: S, sweep, pour: pourImage, step, finish, render, clear, makePaper, resize, peek, commit() {} };
}

// A pen in a hand. The hand gives targets (page px, pressure, time in ms); the pen follows through a damped spring
// (natural frequency `stiffness` Hz, damping ratio `damping`) and its broad edge sweeps ink onto the sheet.
// angle: the nib edge's angle above the writing line (radians). use: how quickly a dip runs out.
export class Pen {
  constructor(medium, { width = 3.2, angle = .62, flex = .8, hairline = .32, use = 1, stiffness = 24, damping = .9, exact = false } = {}) {
    Object.assign(this, { m: medium, width, angle, flex, hairline, use, stiffness, damping, exact, charge: 1 });
    this.reset();
  }
  reset() { this.pos = null; this.vel = [0, 0]; this.last = null; this.target = null; this.prev = null; this.tt = 0; this.pres = .5; this.wm = 1; this.sp = 0; this.queue = []; }
  dip() { this.charge = 1; }
  // wm: a width multiplier at this point (a designed swell: the shade of a copperplate downstroke, a whiplash's belly)
  hand(x, y, p, t, wm = 1) { this.queue.push({ x, y, p, t, wm }); }
  // advance to time `now`: the target holds the hand's last known place until the next sample arrives
  update(now) {
    while (this.queue.length && this.queue[0].t <= now) {
      const h = this.queue.shift();
      if (!this.pos) { this.pos = [h.x, h.y]; this.tt = h.t; this.pres = h.p; this.wm = h.wm ?? 1; this.target = h; this.emit(0); continue; }
      this.prev = this.target; this.target = h; this.advance(h.t);
    }
    if (this.pos) this.advance(now);
  }
  advance(until) {
    const w = 2 * Math.PI * this.stiffness, z = this.damping, A = this.prev ?? this.target, B = this.target, span = B.t - A.t;
    while (this.tt < until) {
      const dt = Math.min(1, until - this.tt) / 1000, f = span > 0 ? Math.min(1, Math.max(0, (this.tt - A.t) / span)) : 1;
      const h = { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f, p: A.p + (B.p - A.p) * f }; this.wm = (A.wm ?? 1) + ((B.wm ?? 1) - (A.wm ?? 1)) * f;
      // exact: a path already designed is traced as it is (the hand's mass is for a live hand, where it makes the curve)
      if (this.exact) { this.vel = [(h.x - this.pos[0]) / dt, (h.y - this.pos[1]) / dt]; this.pos = [h.x, h.y]; }
      else {
        this.vel[0] += (w * w * (h.x - this.pos[0]) - 2 * z * w * this.vel[0]) * dt;
        this.vel[1] += (w * w * (h.y - this.pos[1]) - 2 * z * w * this.vel[1]) * dt;
        this.pos[0] += this.vel[0] * dt; this.pos[1] += this.vel[1] * dt;
      }
      this.pres += (h.p - this.pres) * Math.min(1, dt * 30); this.tt += dt * 1000; this.emit(dt);
    }
  }
  // lift: the pen settles onto where the hand stopped, then the stroke is committed
  lift() { if (this.pos) { this.update(this.tt); this.advance(this.tt + 30); } this.m.commit(); this.reset(); }
  emit(dt) {
    const d = this.m.dpr, p = this.pos;
    this.sp += (Math.hypot(this.vel[0], this.vel[1]) / 1000 - this.sp) * Math.min(1, dt * 25); const sp = this.sp;   // CSS px per ms, smoothed over ~40 ms
    if (this.last && Math.hypot(p[0] - this.last.p[0], p[1] - this.last.p[1]) * d < .35) { this.last.dwell += dt; return; }
    // the nib: a broad edge rising to the right at its angle, spread a little by pressure if it is flexible
    const halfW = this.width * this.wm * (1 + this.flex * .9 * Math.max(0, this.pres - .35)) / 2, n = [Math.cos(this.angle), -Math.sin(this.angle)];
    // ink flows per unit time, so it lands heavier where the pen is slow; less as the charge runs down
    const flow = (.8 + .75 * Math.exp(-sp * 2.5)) * (.5 + .5 * Math.min(1, this.charge * 2.5)) * (this.last ? 1 : 1.3);
    const cur = { p: [p[0], p[1]], halfW, n, ink: flow, dwell: 0 };
    if (this.last) {
      const a = this.last, b = cur, D = q => [q[0] * d, q[1] * d], dry = Math.max(0, .4 - this.charge) / .4;
      const inkA = a.ink * (1 + Math.min(1, a.dwell * 8));                   // where the pen rested, a pool
      const e = (c, s) => [[c.p[0] - c.n[0] * c.halfW, c.p[1] - c.n[1] * c.halfW], [c.p[0] + c.n[0] * c.halfW, c.p[1] + c.n[1] * c.halfW]][s];
      this.m.sweep([e(a, 0), e(a, 1), e(b, 1), e(b, 0)].map(D), D(a.p), D(b.p), inkA, b.ink, dry);
      // the nib's own thickness: what remains when the stroke runs along the edge
      // the nib's thickness swells and thins with a designed press too (a pointed pen spreads and closes)
      const t = [b.p[0] - a.p[0], b.p[1] - a.p[1]], tl = Math.hypot(...t), hw = this.hairline * this.wm / 2, hn = [-t[1] / tl * hw, t[0] / tl * hw];
      this.m.sweep([[a.p[0] - hn[0], a.p[1] - hn[1]], [a.p[0] + hn[0], a.p[1] + hn[1]], [b.p[0] + hn[0], b.p[1] + hn[1]], [b.p[0] - hn[0], b.p[1] - hn[1]]].map(D), D(a.p), D(b.p), inkA, b.ink, dry);
      this.charge = Math.max(0, this.charge - tl * Math.sqrt(halfW) * .00035 * this.use);
    }
    this.last = cur;
  }
}
