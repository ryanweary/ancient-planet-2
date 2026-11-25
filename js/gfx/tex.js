// Texture library: CC0 Poly Haven photo textures + procedural canvas textures
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = {};
export const TEX = {};
let maxAniso = 4;
export function setAniso(n) { maxAniso = n; }

export function loadTex(name, srgb = true) {
  if (cache[name]) return cache[name];
  cache[name] = loader.loadAsync('assets/tex/' + name + '.jpg').then(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return t;
  }).catch(e => { console.warn('tex', name, e); return null; });
  return cache[name];
}
export async function loadLayer(name) {
  const [d, n] = await Promise.all([loadTex(name + '_diff'), loadTex(name + '_nor', false)]);
  return { d, n };
}

// ---------- tileable noise ----------
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x, y, per, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (a) => ((a % per) + per) % per;
  const a = hash(m(xi), m(yi), s), b = hash(m(xi + 1), m(yi), s), c = hash(m(xi), m(yi + 1), s), d = hash(m(xi + 1), m(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, per, oct = 4, s = 0) { let t = 0, amp = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { t += vnoise(x * f, y * f, per * f, s + i) * amp; n += amp; amp *= 0.5; f *= 2; } return t / n; }

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function toTex(c, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
// height canvas (grayscale) -> tangent-space normal map
export function normalFromHeight(hc, strength = 2) {
  const w = hc.width, h = hc.height; const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h); const ctx = out.getContext('2d'); const img = ctx.createImageData(w, h); const d = img.data;
  const H = (x, y) => src[((((y + h) % h) * w + ((x + w) % w)) << 2)] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) << 2; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return out;
}

// ---------- carved stone path slabs (2x2 cells per tile) ----------
function glyph(g, x, y, s, kind) {
  // carved meander / spiral motif inside a square
  g.beginPath();
  const k = s / 10;
  if (kind === 0) { // square spiral
    let px = x + k, py = y + k, len = s - 2 * k, dir = 0; g.moveTo(px, py);
    for (let i = 0; i < 7 && len > k; i++) { const dx = [1, 0, -1, 0][dir], dy = [0, 1, 0, -1][dir]; px += dx * len; py += dy * len; g.lineTo(px, py); if (i % 2 === 1) len -= 2 * k; dir = (dir + 1) % 4; }
  } else if (kind === 1) { // meander key
    g.moveTo(x + k, y + s - k); g.lineTo(x + k, y + k); g.lineTo(x + s - k, y + k); g.lineTo(x + s - k, y + s - 3 * k); g.lineTo(x + 3 * k, y + s - 3 * k); g.lineTo(x + 3 * k, y + 3 * k); g.lineTo(x + s - 3 * k, y + 3 * k); g.lineTo(x + s - 3 * k, y + 5 * k); g.lineTo(x + 5 * k, y + 5 * k);
  } else { // concentric squares
    for (let i = 1; i < 4; i++) g.rect(x + i * 1.5 * k, y + i * 1.5 * k, s - i * 3 * k, s - i * 3 * k);
  }
  g.stroke();
}
export function makePathSlabs(photo, seed = 1) {
  const S = 1024; const col = canvas(S), hc = canvas(S);
  const g = col.getContext('2d'), hg = hc.getContext('2d');
  if (photo && photo.image) { g.drawImage(photo.image, 0, 0, S, S); } else { g.fillStyle = '#888'; g.fillRect(0, 0, S, S); }
  // desaturate photo & even out
  g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(150,150,150,0.35)'; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#000'; hg.fillRect(0, 0, S, S);
  let r = seed * 9301 + 49297; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const C = S / 2; // one cell = 512px
  const slabs = [];
  for (let cy = 0; cy < 2; cy++) for (let cx = 0; cx < 2; cx++) {
    const split = rnd();
    const x0 = cx * C, y0 = cy * C;
    if (split < 0.35) slabs.push([x0, y0, C, C, true]);
    else if (split < 0.7) { const a = C * (0.4 + rnd() * 0.2); slabs.push([x0, y0, C, a, rnd() < 0.5], [x0, y0 + a, C / 2, C - a, false], [x0 + C / 2, y0 + a, C / 2, C - a, false]); }
    else { slabs.push([x0, y0, C / 2, C / 2, rnd() < 0.4], [x0 + C / 2, y0, C / 2, C / 2, false], [x0, y0 + C / 2, C / 2, C / 2, false], [x0 + C / 2, y0 + C / 2, C / 2, C / 2, rnd() < 0.4]); }
  }
  const gap = 10;
  for (const [x, y, w, h, gl] of slabs) {
    const sx = x + gap / 2, sy = y + gap / 2, sw = w - gap, sh = h - gap;
    // height: raised slab with bevel
    const grd = hg.createLinearGradient(sx, sy, sx + sw, sy + sh);
    const base = 150 + rnd() * 60;
    for (let b = 0; b < 8; b++) { const v = Math.round(base * (0.5 + b / 16)); hg.fillStyle = `rgb(${v},${v},${v})`; hg.fillRect(sx + b, sy + b, sw - 2 * b, sh - 2 * b); }
    // color variation per slab
    const tone = rnd(); g.fillStyle = tone < 0.5 ? `rgba(40,35,30,${0.1 + rnd() * 0.15})` : `rgba(255,250,235,${0.05 + rnd() * 0.12})`; g.fillRect(sx, sy, sw, sh);
    // bevel highlight/shadow
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(sx, sy, sw, 5); g.fillRect(sx, sy, 5, sh);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(sx, sy + sh - 6, sw, 6); g.fillRect(sx + sw - 6, sy, 6, sh);
    if (gl && Math.min(sw, sh) > 180) {
      const s = Math.min(sw, sh) * 0.62, gx = sx + (sw - s) / 2, gy = sy + (sh - s) / 2, kind = Math.floor(rnd() * 3);
      g.lineCap = hg.lineCap = 'square'; g.lineJoin = hg.lineJoin = 'miter';
      g.strokeStyle = 'rgba(30,26,22,0.55)'; g.lineWidth = s / 13; glyph(g, gx, gy, s, kind);
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = s / 40; glyph(g, gx + 3, gy + 3, s, kind);
      hg.strokeStyle = `rgb(${Math.round(base * 0.45)},${Math.round(base * 0.45)},${Math.round(base * 0.45)})`; hg.lineWidth = s / 13; glyph(hg, gx, gy, s, kind);
    }
    // cracks
    const nc = Math.floor(rnd() * 3);
    for (let c = 0; c < nc; c++) {
      let px = sx + rnd() * sw, py = sy + rnd() * sh; g.beginPath(); hg.beginPath(); g.moveTo(px, py); hg.moveTo(px, py);
      for (let i = 0; i < 6; i++) { px += (rnd() - 0.5) * 70; py += (rnd() - 0.5) * 70; px = Math.max(sx, Math.min(sx + sw, px)); py = Math.max(sy, Math.min(sy + sh, py)); g.lineTo(px, py); hg.lineTo(px, py); }
      g.strokeStyle = 'rgba(20,16,12,0.6)'; g.lineWidth = 2.5; g.stroke(); hg.strokeStyle = '#303030'; hg.lineWidth = 3; hg.stroke();
    }
    // chipped corners
    if (rnd() < 0.5) { const cx = rnd() < 0.5 ? sx : sx + sw, cy = rnd() < 0.5 ? sy : sy + sh, rr = 18 + rnd() * 30; g.fillStyle = 'rgba(30,25,20,0.55)'; g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.fill(); hg.fillStyle = '#202020'; hg.beginPath(); hg.arc(cx, cy, rr, 0, 7); hg.fill(); }
  }
  // seams: dark gritty
  g.globalCompositeOperation = 'multiply';
  const gc = canvas(S); const gg = gc.getContext('2d'); gg.drawImage(hc, 0, 0);
  gg.globalCompositeOperation = 'source-in';
  g.globalCompositeOperation = 'source-over';
  // dirt AO in seams from height map
  const hd = hg.getImageData(0, 0, S, S).data; const cd = g.getImageData(0, 0, S, S); const c = cd.data;
  for (let i = 0; i < c.length; i += 4) { const hv = hd[i] / 255; const ao = hv < 0.05 ? 0.42 : 0.82 + 0.18 * Math.min(1, hv * 1.4); c[i] *= ao; c[i + 1] *= ao; c[i + 2] *= ao; }
  g.putImageData(cd, 0, 0);
  // soften height slightly for normals
  const hb = canvas(S); const hbg = hb.getContext('2d'); hbg.filter = 'blur(2px)'; hbg.drawImage(hc, 0, 0);
  return { color: toTex(col), normal: toTex(normalFromHeight(hb, 3.5), false), height: hc };
}

// ---------- metal panels ----------
export function makeMetal(seed = 3) {
  const S = 512; const c = canvas(S), hc = canvas(S); const g = c.getContext('2d'), hg = hc.getContext('2d');
  const img = g.createImageData(S, S); const d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = fbm(x / 64, y / 64, 8, 4, seed) * 0.6 + fbm(x / 8, y / 256, 64, 2, seed + 7) * 0.4;
    const v = 150 + n * 70; const i = (y * S + x) * 4; d[i] = v; d[i + 1] = v; d[i + 2] = v * 1.02; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  hg.fillStyle = '#b0b0b0'; hg.fillRect(0, 0, S, S);
  let r = seed * 77; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  // panel lines
  const rects = [[0, 0, 256, 256], [256, 0, 256, 128], [256, 128, 256, 128], [0, 256, 170, 256], [170, 256, 342, 256]];
  for (const [x, y, w, h] of rects) {
    g.strokeStyle = 'rgba(20,20,22,0.85)'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, w - 4, h - 4);
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; g.strokeRect(x + 6, y + 6, w - 12, h - 12);
    hg.strokeStyle = '#303030'; hg.lineWidth = 5; hg.strokeRect(x + 2, y + 2, w - 4, h - 4);
    for (const [px, py] of [[x + 14, y + 14], [x + w - 14, y + 14], [x + 14, y + h - 14], [x + w - 14, y + h - 14]]) {
      g.fillStyle = 'rgba(40,40,40,0.8)'; g.beginPath(); g.arc(px, py, 5, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(px - 1, py - 1, 2.5, 0, 7); g.fill();
      const rg = hg.createRadialGradient(px, py, 0, px, py, 6); rg.addColorStop(0, '#fff'); rg.addColorStop(1, '#b0b0b0'); hg.fillStyle = rg; hg.beginPath(); hg.arc(px, py, 6, 0, 7); hg.fill();
    }
  }
  // scratches & grime
  for (let i = 0; i < 160; i++) { const x = rnd() * S, y = rnd() * S, a = rnd() * 6.28, l = 6 + rnd() * 30; g.strokeStyle = `rgba(255,255,255,${0.05 + rnd() * 0.15})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  for (let i = 0; i < 40; i++) { const x = rnd() * S, y = rnd() * S, rr = 10 + rnd() * 40; const rg = g.createRadialGradient(x, y, 0, x, y, rr); rg.addColorStop(0, 'rgba(40,30,20,0.25)'); rg.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = rg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  return { color: toTex(c), normal: toTex(normalFromHeight(hc, 2.5), false) };
}
// painted armor: mostly flat with edge wear and panel seams (multiplied by material colour)
export function makeArmor(seed = 5) {
  const S = 512; const c = canvas(S), hc = canvas(S); const g = c.getContext('2d'), hg = hc.getContext('2d');
  const img = g.createImageData(S, S); const d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = fbm(x / 48, y / 48, 10.666, 4, seed); const chip = fbm(x / 12, y / 12, 42.666, 3, seed + 3);
    let v = 215 + n * 40; const i = (y * S + x) * 4;
    if (chip > 0.68) { d[i] = 90; d[i + 1] = 90; d[i + 2] = 92; } else { d[i] = v; d[i + 1] = v; d[i + 2] = v; }
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); hg.fillStyle = '#a0a0a0'; hg.fillRect(0, 0, S, S);
  for (let k = 0; k < 4; k++) { const y = k * 128 + 64; g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, S, 3); hg.fillStyle = '#404040'; hg.fillRect(0, y, S, 4); }
  for (let k = 0; k < 3; k++) { const x = 90 + k * 170; g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, 0, 3, S); hg.fillStyle = '#404040'; hg.fillRect(x, 0, 4, S); }
  return { color: toTex(c), normal: toTex(normalFromHeight(hc, 2), false) };
}
export function makeStripes() {
  const c = canvas(128); const g = c.getContext('2d'); g.fillStyle = '#e8b020'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#1a1a1a'; for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64 + 32, 0); g.lineTo(i * 64 + 160, 128); g.lineTo(i * 64 + 128, 128); g.fill(); }
  return toTex(c);
}
// cracked-crystal dome (voronoi edges) — emissive
export function makeDome() {
  const S = 512; const c = canvas(S); const g = c.getContext('2d'); const img = g.createImageData(S, S); const d = img.data;
  const pts = []; let r = 17; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 46; i++) pts.push([rnd() * S, rnd() * S]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let d1 = 1e9, d2 = 1e9;
    for (const [px, py] of pts) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { const dd = (x - px - ox * S) ** 2 + (y - py - oy * S) ** 2; if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd; }
    const e = Math.sqrt(d2) - Math.sqrt(d1); const line = Math.max(0, 1 - e / 3.5); const inner = Math.max(0, 1 - e / 22) * 0.35;
    const n = fbm(x / 64, y / 64, 8, 3, 9);
    const i = (y * S + x) * 4;
    d[i] = 30 + line * 200 + inner * 60; d[i + 1] = 150 + line * 105 + inner * 80 + n * 40; d[i + 2] = 160 + line * 95 + inner * 70 + n * 40; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return toTex(c);
}
// painted grass tuft card (alpha)
export function makeTuft(hue = 'verdant') {
  const c = canvas(256); const g = c.getContext('2d');
  const pal = { verdant: ['#2f6a12', '#4f9a1c', '#7cc828', '#a8e040'], mire: ['#1c3a18', '#2e5a22', '#4a7a2c', '#7aa040'], reef: ['#4a8a3a', '#6aaa4a', '#9ac860', '#c8e080'], frost: ['#8aa0b8', '#b0c4d8', '#dfeaf4', '#ffffff'], forge: ['#3a2a20', '#5a3a28', '#8a4a20', '#c06020'], sky: ['#6a8a3a', '#8aaa4a', '#b0c860', '#d8e890'], storm: ['#3a4a3a', '#4a5e48', '#6a7a60', '#8a9a80'], city: ['#2a3a2a', '#3a4a38', '#5a6a50', '#7a8a6a'] }[hue] || ['#2f6a12', '#4f9a1c', '#7cc828', '#a8e040'];
  for (let i = 0; i < 70; i++) {
    const x = 40 + Math.random() * 176, h = 90 + Math.random() * 150, lean = (Math.random() - 0.5) * 70, w = 5 + Math.random() * 7;
    const grd = g.createLinearGradient(0, 256, 0, 256 - h); grd.addColorStop(0, pal[0]); grd.addColorStop(0.5, pal[1 + (i % 2)]); grd.addColorStop(1, pal[3]);
    g.fillStyle = grd; g.beginPath(); g.moveTo(x - w, 256); g.quadraticCurveTo(x + lean * 0.3, 256 - h * 0.6, x + lean, 256 - h); g.quadraticCurveTo(x + lean * 0.3 + w * 0.5, 256 - h * 0.5, x + w, 256); g.fill();
  }
  return toTex(c, true, false);
}
export function makeSoft() { const c = canvas(64); const g = c.getContext('2d'); const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.4, 'rgba(255,255,255,0.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64); return toTex(c, true, false); }
export function makeFlare() {
  const c = canvas(128); const g = c.getContext('2d'); g.translate(64, 64);
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, 64); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.15, 'rgba(255,240,200,0.9)'); rg.addColorStop(0.5, 'rgba(255,180,80,0.25)'); rg.addColorStop(1, 'rgba(255,120,0,0)'); g.fillStyle = rg; g.fillRect(-64, -64, 128, 128);
  g.fillStyle = 'rgba(255,255,230,0.9)'; for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(-4, 0); g.lineTo(0, -60 + (i % 2) * 25); g.lineTo(4, 0); g.fill(); }
  return toTex(c, true, false);
}
export function makeSmokeSprite() {
  const c = canvas(128); const g = c.getContext('2d'); const img = g.createImageData(128, 128); const d = img.data;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const dx = (x - 64) / 64, dy = (y - 64) / 64, r = Math.hypot(dx, dy); const n = fbm(x / 20, y / 20, 6.4, 4, 3); const a = Math.max(0, 1 - r * (1.1 - n * 0.5)) ** 1.5; const i = (y * 128 + x) * 4; d[i] = d[i + 1] = d[i + 2] = 200 + n * 55; d[i + 3] = a * 255; }
  g.putImageData(img, 0, 0); return toTex(c, true, false);
}
export function makeWaterNormal() {
  const S = 256; const hc = canvas(S); const g = hc.getContext('2d'); const img = g.createImageData(S, S); const d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = fbm(x / 32, y / 32, 8, 4, 21) * 255; const i = (y * S + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  g.putImageData(img, 0, 0); return toTex(normalFromHeight(hc, 4), false);
}
export function makeMacro(seed = 1) {
  const S = 256; const c = canvas(S); const g = c.getContext('2d'); const img = g.createImageData(S, S); const d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4; d[i] = fbm(x / 64, y / 64, 4, 5, seed) * 255; d[i + 1] = fbm(x / 32, y / 32, 8, 4, seed + 5) * 255; d[i + 2] = fbm(x / 16, y / 16, 16, 3, seed + 9) * 255; d[i + 3] = 255; }
  g.putImageData(img, 0, 0); return toTex(c, false);
}
export function makeGlyphStone(photo) {
  // stone blocks with carved motifs for the temple walls
  const s = makePathSlabs(photo, 7); return s;
}
