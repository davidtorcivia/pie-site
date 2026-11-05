// The painterly pass, deterministic per position: every stroke's jitter, length and opacity come from a hash of its
// place on the page, not from a running random stream, so a stroke is the same in every frame of a growth animation
// and the brushwork does not shimmer as the garden grows. Thin parts (stars, sparkles, tendrils, hairlines) keep the
// crisp drawing. Loaded into the build's headless page (tools/build_growth.mjs).
window.paintPass = function (c, SC) {
  const g = c.getContext('2d'), W = c.width, H = c.height;
  const src = g.getImageData(0, 0, W, H), d = src.data;
  const lum = new Float32Array(W * H), A = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { A[i] = d[i * 4 + 3] / 255; lum[i] = (d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11) / 255 * A[i] + (1 - A[i]); }
  const J = [new Float32Array(W * H), new Float32Array(W * H), new Float32Array(W * H)];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x, gx = lum[i + 1] - lum[i - 1], gy = lum[i + W] - lum[i - W]; J[0][i] = gx * gx; J[1][i] = gx * gy; J[2][i] = gy * gy; }
  const box = (M, R) => { const T = new Float32Array(W * H);
    for (let y = 0; y < H; y++) { let s = 0; for (let x = -R; x < W; x++) { if (x + R < W) s += M[y * W + x + R]; if (x - R - 1 >= 0) s -= M[y * W + x - R - 1]; if (x >= 0) T[y * W + x] = s; } }
    for (let x = 0; x < W; x++) { let s = 0; for (let y = -R; y < H; y++) { if (y + R < H) s += T[(y + R) * W + x]; if (y - R - 1 >= 0) s -= T[(y - R - 1) * W + x]; if (y >= 0) M[y * W + x] = s; } } };
  J.forEach(M => { box(M, 3); box(M, 3); });
  const ang = i => .5 * Math.atan2(2 * J[1][i], J[0][i] - J[2][i]) + Math.PI / 2;
  const hash = (a, b, k) => { let h = (a * 374761393 + b * 668265263 + k * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const out = document.createElement('canvas'); out.width = W; out.height = H; const o = out.getContext('2d');
  o.globalAlpha = .6; o.drawImage(c, 0, 0); o.globalAlpha = 1; o.lineCap = 'round';
  [[3.2 * SC, 7 * SC, 1.2, 1], [1.8 * SC, 4 * SC, .8, 2]].forEach(([sp, L, wmul, pass]) => {
    for (let gy = 0, y = 0; y < H; y += sp, gy++) for (let gx = 0, x = 0; x < W; x += sp, gx++) {
      const px = Math.min(W - 1, Math.round(x + (hash(gx, gy, pass) - .5) * sp)), py = Math.min(H - 1, Math.round(y + (hash(gx, gy, pass + 10) - .5) * sp)), i = py * W + px;
      if (A[i] < .25) continue;
      const a = ang(i), len = L * (.5 + hash(gx, gy, pass + 20) * .8), dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
      o.strokeStyle = `rgba(${d[i * 4]},${d[i * 4 + 1]},${d[i * 4 + 2]},${(.55 + hash(gx, gy, pass + 30) * .4) * A[i]})`;
      o.lineWidth = sp * wmul * (.6 + hash(gx, gy, pass + 40) * .6);
      o.beginPath(); o.moveTo(px - dx, py - dy); o.quadraticCurveTo(px + Math.sin(a) * len * .08, py - Math.cos(a) * len * .08, px + dx, py + dy); o.stroke();
    }
  });
  const R2 = 2, er = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let mn = 1; for (let dy = -R2; dy <= R2 && mn > 0; dy++) for (let dx = -R2; dx <= R2; dx++) { const yy = y + dy, xx = x + dx; const a = yy < 0 || xx < 0 || yy >= H || xx >= W ? 0 : A[yy * W + xx]; if (a < mn) mn = a; } er[y * W + x] = mn; }
  const po = o.getImageData(0, 0, W, H), pd = po.data;
  for (let i = 0; i < W * H; i++) if (A[i] > .2 && er[i] < .2) { const k = i * 4; pd[k] = d[k]; pd[k + 1] = d[k + 1]; pd[k + 2] = d[k + 2]; pd[k + 3] = Math.max(pd[k + 3], d[k + 3]); }
  o.putImageData(po, 0, 0);
  g.clearRect(0, 0, W, H); g.drawImage(out, 0, 0);
};
