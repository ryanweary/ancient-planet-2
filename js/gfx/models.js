// Detailed procedural models: towers, enemies, temple base, decoration
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { glbEnemy } from './assets.js';

export const MAT = {};
let T = null;
const gcache = {};
const geoC = (key, fn) => gcache[key] || (gcache[key] = fn());

export function initModels(textures) {
  T = textures;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  MAT.metal = std({ map: T.metal.color, normalMap: T.metal.normal, color: 0x9aa2ac, metalness: 0.8, roughness: 0.38 });
  MAT.dark = std({ map: T.metal.color, normalMap: T.metal.normal, color: 0x40464e, metalness: 0.75, roughness: 0.48 });
  MAT.black = std({ color: 0x1a1c20, metalness: 0.6, roughness: 0.5 });
  MAT.stripes = std({ map: T.stripes, metalness: 0.3, roughness: 0.5 });
  MAT.rock = std({ map: T.rock.d, normalMap: T.rock.n, color: 0xb0a090, roughness: 0.92, flatShading: true });
  MAT.stone = std({ map: T.slabs.color, normalMap: T.slabs.normal, color: 0x8a8e94, roughness: 0.85 });
  MAT.stoneDark = std({ map: T.slabs.color, normalMap: T.slabs.normal, color: 0x55595f, roughness: 0.85 });
  MAT.gold = std({ map: T.armor.color, normalMap: T.armor.normal, color: 0xe09a22, metalness: 0.65, roughness: 0.35 });
  MAT.dome = std({ map: T.dome, emissiveMap: T.dome, emissive: 0x30e8d0, emissiveIntensity: 0.75, color: 0x40c8c0, metalness: 0.2, roughness: 0.08, transparent: true, opacity: 0.88 });
  MAT.domeCore = std({ color: 0xb8ffff, emissive: 0x40f0ff, emissiveIntensity: 2.2, roughness: 0.1, flatShading: true });
  MAT.greenLight = std({ color: 0x80ff60, emissive: 0x50ff30, emissiveIntensity: 1.6 });
  MAT.redLight = std({ color: 0xff6040, emissive: 0xff3010, emissiveIntensity: 1.8 });
  MAT.blueLight = std({ color: 0x80e0ff, emissive: 0x30b0ff, emissiveIntensity: 1.8 });
  MAT.column = new THREE.MeshBasicMaterial({ color: 0xfff6e0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  MAT.shadow = new THREE.MeshBasicMaterial({ map: T.soft, color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false });
}
const armorC = {};
export function armor(color) { return armorC[color] || (armorC[color] = new THREE.MeshStandardMaterial({ map: T.armor.color, normalMap: T.armor.normal, color, metalness: 0.4, roughness: 0.42 })); }
const glowC = {};
export function glow(color, i = 1.5) { const k = color + ':' + i; return glowC[k] || (glowC[k] = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.3 })); }
const crysC = {};
export function crystalMat(color, emiss, i = 0.9) { const k = color + ':' + emiss + ':' + i; return crysC[k] || (crysC[k] = new THREE.MeshStandardMaterial({ color, emissive: emiss, emissiveIntensity: i, metalness: 0.1, roughness: 0.12, flatShading: true, transparent: true, opacity: 0.93 })); }

// ---------- geometry helpers ----------
const rbox = (w, h, d, r = 0.02) => geoC(`rb${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1)));
const cyl = (rt, rb, h, s = 16, open = false) => geoC(`cy${rt},${rb},${h},${s},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, open));
const sph = (r, ws = 20, hs = 14) => geoC(`sp${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
const tor = (r, t, rs = 8, ts = 32) => geoC(`to${r},${t},${rs},${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts));
const cone = (r, h, s = 8) => geoC(`co${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
export function crystalGeo(r, h, sides = 6, key = '') {
  return geoC(`cr${r},${h},${sides},${key}`, () => { const g = new THREE.LatheGeometry([new THREE.Vector2(0, -h * 0.28), new THREE.Vector2(r, 0), new THREE.Vector2(r * 0.82, h * 0.62), new THREE.Vector2(0, h)], sides); return g; });
}
function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
export function rockGeo(seed, detail = 1, rough = 0.28) {
  return geoC(`rk${seed},${detail},${rough}`, () => {
    const g = new THREE.IcosahedronGeometry(1, detail); const p = g.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + (hash3(Math.round(v.x * 100) + seed, Math.round(v.y * 100), Math.round(v.z * 100)) - 0.5) * rough * 2; v.multiplyScalar(k); if (v.y < -0.2) v.y = -0.2 - (v.y + 0.2) * 0.2; p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g;
  });
}
function M(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.castShadow = true; o.receiveShadow = true; return o;
}

// ---------- towers ----------
const LV = [0xd89a1e, 0xe0661c, 0xcc2a1a, 0xc8202e, 0x7a34c8]; // pad colours by level / branch
function lvColor(t) { return t.lvl < 3 ? LV[t.lvl] : (t.branch === 0 ? LV[3] : LV[4]); }
function pad(t, ringCol, opts = {}) {
  const g = new THREE.Group(); const c = ringCol ?? lvColor(t); const A = armor(c);
  g.add(M(cyl(0.45, 0.49, 0.12, 8), MAT.dark, 0, 0.06, 0, 0, Math.PI / 8));
  g.add(M(cyl(0.38, 0.42, 0.07, 8), MAT.metal, 0, 0.155, 0, 0, Math.PI / 8));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const p = M(rbox(0.3, 0.13, 0.1, 0.025), A, Math.sin(a) * 0.43, 0.115, Math.cos(a) * 0.43, -0.25, a, 0); g.add(p);
    const l = M(rbox(0.07, 0.035, 0.06, 0.01), MAT.greenLight, Math.sin(a + Math.PI / 4) * 0.44, 0.17, Math.cos(a + Math.PI / 4) * 0.44, 0, a + Math.PI / 4, 0); l.castShadow = false; g.add(l);
  }
  // bevelled detail: bolts, side vents with light strips
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; const bo = M(cyl(0.022, 0.022, 0.03, 6), MAT.metal, Math.sin(a) * 0.34, 0.205, Math.cos(a) * 0.34); bo.castShadow = false; g.add(bo); }
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const v = M(rbox(0.16, 0.07, 0.05, 0.015), MAT.black, Math.sin(a) * 0.47, 0.07, Math.cos(a) * 0.47, 0, a, 0); g.add(v); const st = M(rbox(0.12, 0.016, 0.02, 0.005), glow(c, 1.4), Math.sin(a) * 0.49, 0.08, Math.cos(a) * 0.49, 0, a, 0); st.castShadow = false; g.add(st); }
  // coloured ring that grows with level
  const ringW = 0.025 + t.lvl * 0.008;
  const ring = M(tor(0.3, ringW, 6, 32), glow(c, 0.35 + t.lvl * 0.15), 0, 0.195, 0, Math.PI / 2); g.add(ring);
  if (t.lvl >= 2) for (let i = 0; i < t.lvl - 1; i++) { const s = M(rbox(0.06, 0.06, 0.06, 0.01), glow(c, 1.2), Math.sin(i * 1.3) * 0.22, 0.2, Math.cos(i * 1.3) * 0.22); s.castShadow = false; g.add(s); }
  return g;
}
export function towerMesh(t) {
  const grp = new THREE.Group(); const L = t.lvl, B = t.branch;
  const anim = { head: null, spin: [], noAim: false, float: false, muzzles: [], beamY: 0.8 };
  const head = new THREE.Group(); anim.head = head;
  const k = t.kind;
  if (k === 'gun') {
    grp.add(pad(t)); head.position.y = 0.2; grp.add(head);
    head.add(M(cyl(0.16, 0.2, 0.12, 12), MAT.dark, 0, 0.06, 0));
    const hc = L >= 3 && B === 1 ? 0x5a6470 : [0xd84a1a, 0xd0401a, 0xc8301a, 0xd03418][Math.min(L, 3)];
    const H = armor(hc);
    head.add(M(rbox(0.38, 0.24, 0.36, 0.05), H, 0, 0.24, -0.04));
    head.add(M(rbox(0.3, 0.06, 0.3, 0.02), MAT.dark, 0, 0.38, -0.06));
    head.add(M(rbox(0.12, 0.1, 0.14, 0.02), MAT.black, 0, 0.3, -0.24)); // sensor
    const eye = M(sph(0.025, 8, 6), MAT.redLight, 0.08, 0.33, 0.15); eye.castShadow = false; head.add(eye);
    if (L >= 3 && B === 0) { // Gatling: two rotary clusters
      for (const sx of [-0.13, 0.13]) {
        const cl = new THREE.Group(); cl.position.set(sx, 0.24, 0.16); head.add(cl);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cl.add(M(cyl(0.022, 0.022, 0.5 + (L - 3) * 0.08, 8), MAT.metal, Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0.25, Math.PI / 2)); }
        cl.add(M(cyl(0.085, 0.085, 0.06, 12), MAT.dark, 0, 0, 0.05, Math.PI / 2)); cl.add(M(cyl(0.085, 0.085, 0.04, 12), MAT.dark, 0, 0, 0.42, Math.PI / 2));
        anim.spin.push(cl); anim.muzzles.push([sx, 0.24, 0.72]);
      }
      head.add(M(rbox(0.16, 0.16, 0.2, 0.02), MAT.stripes, 0.27, 0.22, -0.02));
    } else if (L >= 3 && B === 1) { // Rail piercer
      const len = 0.7 + (L - 3) * 0.12;
      for (const sx of [-0.06, 0.06]) head.add(M(rbox(0.04, 0.1, len, 0.01), MAT.metal, sx, 0.26, 0.15 + len / 2 - 0.1));
      for (let i = 0; i < 4; i++) { const c = M(tor(0.075, 0.016, 6, 16), MAT.blueLight, 0, 0.26, 0.2 + i * len / 5); c.castShadow = false; head.add(c); }
      anim.muzzles.push([0, 0.26, 0.2 + len]);
    } else { // base levels: twin barrels that grow
      const len = 0.26 + L * 0.09, r = 0.034 + L * 0.006;
      for (const sx of [-0.09, 0.09]) {
        head.add(M(cyl(r, r, len, 10), MAT.metal, sx, 0.24, 0.14 + len / 2, Math.PI / 2));
        head.add(M(cyl(r * 1.5, r * 1.5, 0.07, 10), MAT.dark, sx, 0.24, 0.14 + len - 0.02, Math.PI / 2));
        if (L >= 1) head.add(M(cyl(r * 1.25, r * 1.25, 0.05, 10), MAT.dark, sx, 0.24, 0.2, Math.PI / 2));
        anim.muzzles.push([sx, 0.24, 0.16 + len]);
      }
      if (L >= 2) head.add(M(rbox(0.14, 0.15, 0.2, 0.02), MAT.stripes, 0.27, 0.22, -0.04));
      if (L >= 1) head.add(M(rbox(0.06, 0.08, 0.3, 0.01), MAT.dark, -0.22, 0.28, -0.02));
    }
  } else if (k === 'energy') {
    grp.add(pad(t));
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const arm = M(rbox(0.06, 0.3, 0.07, 0.015), MAT.metal, Math.sin(a) * 0.24, 0.32, Math.cos(a) * 0.24, Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35); grp.add(arm); const tip = M(sph(0.03, 8, 6), MAT.greenLight, Math.sin(a) * 0.19, 0.48, Math.cos(a) * 0.19); tip.castShadow = false; grp.add(tip); }
    grp.add(M(cyl(0.12, 0.16, 0.08, 8), MAT.dark, 0, 0.22, 0));
    const cg = new THREE.Group(); cg.position.y = 0.62; grp.add(cg); anim.spin.push(cg); anim.float = 0.62; anim.noAim = true;
    const big = L >= 3 && B === 1; const n = L >= 3 && B === 0 ? 2 : 1;
    const s = 0.85 + Math.min(L, 2) * 0.13 + (big ? 0.35 : L >= 3 ? 0.15 : 0);
    const CM = crystalMat(0x7dff70, 0x22e040, 1.0 + L * 0.15);
    for (let j = 0; j < n; j++) {
      const ox = n === 2 ? (j - 0.5) * 0.2 : 0;
      cg.add(M(crystalGeo(0.11 * s, 0.42 * s, 6), CM, ox, -0.08, 0, 0, j, n === 2 ? (j - 0.5) * 0.3 : 0));
      cg.add(M(crystalGeo(0.05 * s, 0.2 * s, 5, 'a'), CM, ox + 0.09 * s, -0.12, 0.03, 0, 0, -0.5));
      cg.add(M(crystalGeo(0.04 * s, 0.16 * s, 5, 'b'), CM, ox - 0.08 * s, -0.12, -0.04, 0.3, 0, 0.55));
    }
    if (big) for (let i = 0; i < 2; i++) { const r = M(tor(0.24 + i * 0.06, 0.012, 6, 40), glow(0x80ff60, 1.4), 0, 0.05, 0, Math.PI / 2 + i * 0.6, 0, i * 0.4); r.castShadow = false; cg.add(r); }
    anim.beamY = 0.75;
  } else if (k === 'cryo') {
    grp.add(pad(t, L >= 3 ? (B === 0 ? 0x2a7ad8 : 0x30b0e0) : undefined));
    grp.add(M(cyl(0.27, 0.22, 0.1, 16), MAT.dark, 0, 0.24, 0));
    grp.add(M(tor(0.26, 0.03, 8, 32), MAT.metal, 0, 0.29, 0, Math.PI / 2));
    const liq = M(cyl(0.24, 0.24, 0.02, 24), glow(0x40d0ff, 0.9), 0, 0.29, 0); liq.castShadow = false; grp.add(liq);
    const og = new THREE.Group(); og.position.y = 0.62; grp.add(og); anim.spin.push(og); anim.float = 0.62; anim.noAim = true;
    const s = 0.9 + Math.min(L, 2) * 0.12 + (L >= 3 ? 0.15 : 0);
    const IM = crystalMat(0xe8f8ff, 0x50b8ff, 0.7 + L * 0.1);
    og.add(M(rockGeo(3, 1, 0.22), IM, 0, 0, 0, 0, 0, 0, 0.15 * s, 0.17 * s, 0.15 * s));
    const spikes = L >= 3 && B === 0 ? 10 : 6;
    for (let i = 0; i < spikes; i++) { const a = i / spikes * Math.PI * 2, e = (i % 2 ? 0.4 : -0.3); const sp = M(crystalGeo(0.035 * s, 0.16 * s * (L >= 3 && B === 0 ? 1.5 : 1), 5), IM, Math.cos(a) * 0.12 * s, e * 0.12, Math.sin(a) * 0.12 * s); sp.lookAt(Math.cos(a) * 2, e * 2 + 0.6, Math.sin(a) * 2); sp.rotateX(Math.PI / 2); og.add(sp); }
    if (L >= 3 && B === 1) for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; og.add(M(crystalGeo(0.04, 0.16, 5), IM, Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3)); }
    anim.beamY = 0.62;
  } else if (k === 'missile') {
    grp.add(pad(t)); head.position.y = 0.2; grp.add(head);
    head.add(M(cyl(0.18, 0.22, 0.14, 12), MAT.dark, 0, 0.07, 0));
    const A = armor(0xc83a1c);
    const big = L >= 3 && B === 1;
    const cols = big ? 1 : L >= 3 ? 3 : [2, 2, 3][L], rows = big ? 1 : L >= 3 ? 2 : [1, 2, 2][L];
    const pods = L >= 3 && B === 0 ? 2 : 1;
    for (let p = 0; p < pods; p++) {
      const px = pods === 2 ? (p - 0.5) * 0.36 : 0;
      const w = big ? 0.34 : 0.1 * cols + 0.1, h = big ? 0.26 : 0.1 * rows + 0.08;
      head.add(M(rbox(w, h, 0.36, 0.04), A, px, 0.3, 0, -0.25));
      if (big) for (const sx of [-0.08, 0.08]) { head.add(M(cyl(0.065, 0.065, 0.2, 12), MAT.dark, px + sx, 0.33, 0.12, Math.PI / 2 - 0.25)); head.add(M(cone(0.06, 0.12, 12), MAT.redLight, px + sx, 0.36, 0.24, Math.PI / 2 - 0.25)); anim.muzzles.push([px + sx, 0.36, 0.26]); }
      else for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const x = px + (i - (cols - 1) / 2) * 0.1, y = 0.3 + (j - (rows - 1) / 2) * 0.1;
        head.add(M(cyl(0.036, 0.036, 0.06, 10), MAT.black, x, y + 0.04, 0.18, Math.PI / 2 - 0.25));
        const tip = M(cone(0.026, 0.05, 8), MAT.redLight, x, y + 0.05, 0.21, Math.PI / 2 - 0.25); tip.castShadow = false; head.add(tip);
        anim.muzzles.push([x, y + 0.05, 0.22]);
      }
    }
    head.add(M(rbox(0.08, 0.14, 0.12, 0.02), MAT.stripes, 0, 0.24, -0.22));
  } else if (k === 'naval') {
    grp.add(M(cyl(0.44, 0.38, 0.16, 8), MAT.dark, 0, 0.0, 0, 0, Math.PI / 8));
    grp.add(M(cyl(0.4, 0.44, 0.06, 8), armor(lvColor(t)), 0, 0.1, 0, 0, Math.PI / 8));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; grp.add(M(sph(0.08, 10, 8), MAT.stripes, Math.sin(a) * 0.42, 0.02, Math.cos(a) * 0.42, 0, 0, 0, 1, 0.6, 1)); }
    head.position.y = 0.12; grp.add(head);
    head.add(M(cyl(0.2, 0.24, 0.1, 12), MAT.metal, 0, 0.05, 0));
    head.add(M(rbox(0.36, 0.2, 0.4, 0.06), armor(0x4a6a8a), 0, 0.2, -0.04));
    const nb = L >= 3 && B === 0 ? 3 : 1, big = L >= 3 && B === 1;
    const len = 0.42 + Math.min(L, 2) * 0.08 + (big ? 0.18 : 0), r = big ? 0.08 : 0.05 + L * 0.006;
    for (let i = 0; i < nb; i++) { const x = (i - (nb - 1) / 2) * 0.11; head.add(M(cyl(r, r * 1.1, len, 12), MAT.dark, x, 0.22, 0.14 + len / 2, Math.PI / 2)); head.add(M(cyl(r * 1.35, r * 1.35, 0.06, 12), MAT.metal, x, 0.22, 0.12 + len, Math.PI / 2)); anim.muzzles.push([x, 0.22, 0.15 + len]); }
  } else if (k === 'reaper') {
    grp.add(pad(t, L >= 3 ? 0x7a2ad0 : 0x6a2ab0));
    grp.add(M(cyl(0.1, 0.2, 0.5, 6), MAT.dark, 0, 0.42, 0));
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; grp.add(M(rbox(0.05, 0.42, 0.08, 0.015), MAT.metal, Math.sin(a) * 0.16, 0.42, Math.cos(a) * 0.16, -Math.cos(a) * 0.18, a, 0)); const rn = M(rbox(0.02, 0.24, 0.02, 0.005), glow(0xc070ff, 1.8), Math.sin(a) * 0.12, 0.42, Math.cos(a) * 0.12); rn.castShadow = false; grp.add(rn); }
    for (let i = 0; i < 3; i++) grp.add(M(tor(0.12 - i * 0.02, 0.014, 6, 24), MAT.metal, 0, 0.55 + i * 0.07, 0, Math.PI / 2));
    const og = new THREE.Group(); og.position.y = 0.92; grp.add(og); anim.spin.push(og); anim.float = 0.92; anim.noAim = true;
    const n = L >= 3 && B === 0 ? 3 : 1, s = 1 + Math.min(L, 2) * 0.12;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = n > 1 ? 0.14 : 0; const o = M(sph(0.1 * s, 16, 12), crystalMat(0xe0b0ff, 0xa040ff, 1.6), Math.cos(a) * rr, 0, Math.sin(a) * rr); o.castShadow = false; og.add(o); }
    if (L >= 3 && B === 1) for (let i = 0; i < 2; i++) og.add(M(rbox(0.36, 0.02, 0.06, 0.005), MAT.metal, 0, 0, 0, 0, i * Math.PI / 2 + 0.4));
    anim.beamY = 0.92;
  } else if (k === 'destroyer') {
    grp.add(pad(t)); head.position.y = 0.2; grp.add(head);
    head.add(M(cyl(0.2, 0.24, 0.12, 12), MAT.dark, 0, 0.06, 0));
    head.add(M(rbox(0.4, 0.26, 0.44, 0.05), MAT.dark, 0, 0.25, -0.06));
    head.add(M(rbox(0.42, 0.08, 0.3, 0.02), armor(0xb82418), 0, 0.36, -0.04));
    const siege = L >= 3 && B === 1; const len = 0.4 + Math.min(L, 2) * 0.08 + (siege ? 0.3 : 0.06 * (L >= 3));
    head.add(M(rbox(0.13, 0.13, len, 0.03), MAT.metal, 0, 0.25, 0.16 + len / 2));
    head.add(M(rbox(0.17, 0.17, 0.1, 0.03), MAT.dark, 0, 0.25, 0.14 + len));
    const lens = M(cyl(0.045, 0.045, 0.02, 12), MAT.redLight, 0, 0.25, 0.2 + len, Math.PI / 2); lens.castShadow = false; head.add(lens);
    if (siege) for (const sx of [-0.11, 0.11]) head.add(M(rbox(0.03, 0.06, len * 0.9, 0.01), MAT.stripes, sx, 0.25, 0.16 + len / 2));
    if (L >= 3 && B === 0) head.add(M(cyl(0.12, 0.12, 0.12, 14), MAT.stripes, 0.26, 0.26, -0.06, 0, 0, Math.PI / 2));
    anim.muzzles.push([0, 0.25, 0.22 + len]);
  } else if (k === 'support') {
    grp.add(pad(t, L >= 3 ? (B === 0 ? 0xe07a1a : 0x2a8ae0) : 0x8a3ad8));
    grp.add(M(cyl(0.06, 0.12, 0.32, 8), MAT.metal, 0, 0.34, 0));
    grp.add(M(tor(0.18, 0.02, 6, 32), MAT.dark, 0, 0.36, 0, Math.PI / 2));
    const og = new THREE.Group(); og.position.y = 0.66; grp.add(og); anim.spin.push(og); anim.float = 0.66; anim.noAim = true;
    const col = L >= 3 ? (B === 0 ? 0xffa040 : 0x60c0ff) : 0xc070ff;
    const OM = crystalMat(0xf0d0ff, col, 1.5);
    const core = M(sph(0.09 + L * 0.01, 18, 14), OM); core.castShadow = false; og.add(core);
    for (let i = 0; i < L + 1; i++) { const a = i / (L + 1) * Math.PI * 2; const o = M(sph(0.045, 12, 10), OM, Math.cos(a) * 0.2, Math.sin(i * 2) * 0.04, Math.sin(a) * 0.2); o.castShadow = false; og.add(o); }
  } else if (k === 'factory') {
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; grp.add(M(rockGeo(10 + i, 1, 0.3), MAT.rock, Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3, 0, a, 0, 0.16, 0.12 + (i % 2) * 0.06, 0.14)); }
    grp.add(M(cyl(0.28, 0.34, 0.12, 8), MAT.dark, 0, 0.06, 0));
    const A = armor([0xd8a020, 0xe08a1a, 0xe06a18][L] || 0xe06a18);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; grp.add(M(rbox(0.07, 0.38 + L * 0.06, 0.07, 0.015), A, Math.sin(a) * 0.2, 0.2 + L * 0.03, Math.cos(a) * 0.2, -Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12)); }
    grp.add(M(tor(0.17, 0.03, 6, 24), MAT.metal, 0, 0.38 + L * 0.06, 0, Math.PI / 2));
    grp.add(M(rbox(0.12, 0.1, 0.12, 0.02), MAT.stripes, 0.26, 0.17, 0.1));
    if (L >= 1) grp.add(M(cyl(0.05, 0.05, 0.22, 10), MAT.metal, -0.26, 0.16, 0.06));
    if (L >= 2) grp.add(M(cyl(0.06, 0.06, 0.16, 10), A, 0.06, 0.12, -0.3, Math.PI / 2));
    const glowDisk = M(cyl(0.16, 0.16, 0.02, 20), glow(0xfff0b0, 1.6), 0, 0.13, 0); glowDisk.castShadow = false; grp.add(glowDisk);
    const col = new THREE.Mesh(cyl(0.12, 0.15, 1.2, 20, true), MAT.column.clone()); col.position.y = 0.72; grp.add(col); anim.column = col;
    anim.noAim = true;
  }
  grp.userData.anim = anim;
  return grp;
}

// ---------- enemies ----------
export const RUST = { body: 0xb8501e, dark: 0x3a3430, acc: 0xffa030 }, GLIM = { body: 0x22b89a, dark: 0x174a48, acc: 0xb8ff50 };
function legPivot(parent, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }
function enemyHud(grp, type, hbY, shadowR) {
  const sh = new THREE.Mesh(geoC('shq', () => new THREE.PlaneGeometry(1, 1)), MAT.shadow); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; sh.scale.setScalar(shadowR * (type === 'flyer' ? 2.2 : 2.4)); sh.renderOrder = 1; grp.add(sh);
  const hb = new THREE.Group();
  const bg = new THREE.Mesh(geoC('hbbg', () => new THREE.PlaneGeometry(0.46, 0.075)), new THREE.MeshBasicMaterial({ color: 0x101010, depthTest: false, transparent: true, opacity: 0.85 }));
  const fg = new THREE.Mesh(geoC('hbfg', () => new THREE.PlaneGeometry(0.44, 0.05)), new THREE.MeshBasicMaterial({ color: 0x40ff40, depthTest: false, transparent: true }));
  fg.position.z = 0.001; bg.renderOrder = 10; fg.renderOrder = 11; hb.add(bg); hb.add(fg);
  hb.position.y = hbY; if (type === 'boss') hb.scale.set(2.2, 1.6, 1);
  hb.visible = false; grp.add(hb);
  return { sh, hb, fg };
}
// skinned, animated glTF enemy (Quaternius CC0) with the same userData contract as the procedural ones
function glbEnemyMesh(type, race, P) {
  const G = glbEnemy(type, race, P); if (!G) return null;
  const grp = new THREE.Group(); const inner = new THREE.Group(); grp.add(inner); inner.add(G.model);
  const air = type === 'flyer'; if (air) inner.position.y = 0.95;
  const hbY = { grunt: 0.95, swarm: 0.6, tank: 1.0, flyer: 1.45, brute: 1.5, boss: 2.5 }[type] || 1;
  const shadowR = { grunt: 0.22, swarm: 0.16, tank: 0.36, flyer: 0.22, brute: 0.42, boss: 0.8 }[type] || 0.25;
  const { sh, hb, fg } = enemyHud(grp, type, hbY, shadowR);
  const body = G.mats.find(m => !m.emissiveMap && m.emissiveIntensity < 1.2) || G.mats[0];
  const flash = G.mats.filter(m => m.emissiveIntensity < 1.2).map(m => ({ m, em: m.emissive.clone(), ei: m.emissiveIntensity }));
  grp.userData = { inner, legs: [], spin: [], body, hb, fg, baseEm: body.emissive.clone(), baseEI: body.emissiveIntensity, air, sh, mixer: G.mixer, act: G.act, death: G.death, flash, glb: true };
  return grp;
}
export function enemyMesh(type, race) {
  const R = race === 'rust', P = R ? RUST : GLIM;
  const gm = glbEnemyMesh(type, race, P); if (gm) return gm;
  const body = R ? new THREE.MeshStandardMaterial({ map: T.armor.color, normalMap: T.armor.normal, color: P.body, metalness: 0.45, roughness: 0.45 })
    : new THREE.MeshStandardMaterial({ color: P.body, emissive: 0x0a5a48, emissiveIntensity: 0.5, metalness: 0.1, roughness: 0.18, flatShading: true });
  const dark = R ? MAT.dark : crystalMat(P.dark, 0x082a28, 0.3);
  const acc = glow(P.acc, R ? 1.6 : 1.3);
  const grp = new THREE.Group(); const inner = new THREE.Group(); grp.add(inner);
  const legs = []; const spin = [];
  let hbY = 0.75, shadowR = 0.25;
  const L = (piv, len, w, mat, phase, amp = 0.6) => { piv.add(M(rbox(w, len, w, w / 3), mat, 0, -len / 2, 0)); legs.push({ p: piv, phase, amp }); };
  if (type === 'grunt') {
    if (R) { // bipedal scout mech
      inner.add(M(rbox(0.22, 0.16, 0.2, 0.04), body, 0, 0.33, 0));
      inner.add(M(rbox(0.12, 0.08, 0.1, 0.02), dark, 0, 0.44, 0.03));
      const e = M(sph(0.022, 8, 6), acc, 0, 0.44, 0.085); e.castShadow = false; inner.add(e);
      inner.add(M(cyl(0.018, 0.018, 0.16, 6), MAT.metal, 0.14, 0.33, 0.08, Math.PI / 2));
      for (const s of [-1, 1]) { const p = legPivot(inner, s * 0.07, 0.26, 0); L(p, 0.24, 0.055, dark, s > 0 ? 0 : Math.PI); }
    } else { // crystal beetle, 6 legs
      inner.add(M(sph(0.15, 12, 10), body, 0, 0.2, 0, 0, 0, 0, 1, 0.65, 1.3));
      for (let i = 0; i < 3; i++) inner.add(M(crystalGeo(0.035, 0.14, 5), body, (i - 1) * 0.06, 0.27, -0.03 + (i % 2) * 0.05, -0.3));
      const e = M(sph(0.03, 8, 6), acc, 0, 0.21, 0.18); e.castShadow = false; inner.add(e);
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const p = legPivot(inner, s * 0.11, 0.2, (i - 1) * 0.09); p.rotation.z = s * 0.9; L(p, 0.18, 0.025, dark, i * 2 + (s > 0 ? Math.PI : 0), 0.5); }
    }
    hbY = 0.62;
  } else if (type === 'swarm') {
    inner.add(M(R ? rbox(0.14, 0.08, 0.16, 0.03) : sph(0.08, 10, 8), body, 0, 0.13, 0, 0, 0, 0, 1, R ? 1 : 0.8, R ? 1 : 1.2));
    const e = M(sph(0.018, 6, 4), acc, 0, 0.15, 0.08); e.castShadow = false; inner.add(e);
    for (let i = 0; i < 2; i++) for (const s of [-1, 1]) { const p = legPivot(inner, s * 0.06, 0.13, (i - 0.5) * 0.08); p.rotation.z = s * 0.8; L(p, 0.13, 0.02, dark, i * Math.PI + (s > 0 ? Math.PI / 2 : 0), 0.7); }
    hbY = 0.4; shadowR = 0.16;
  } else if (type === 'tank') {
    if (R) {
      for (const s of [-1, 1]) { inner.add(M(rbox(0.12, 0.13, 0.52, 0.05), MAT.black, s * 0.2, 0.08, 0)); inner.add(M(rbox(0.13, 0.04, 0.5, 0.01), MAT.stripes, s * 0.2, 0.15, 0)); }
      inner.add(M(rbox(0.34, 0.14, 0.44, 0.04), body, 0, 0.18, 0));
      inner.add(M(rbox(0.22, 0.1, 0.22, 0.04), body, 0, 0.29, -0.02));
      inner.add(M(cyl(0.03, 0.03, 0.3, 8), MAT.metal, 0, 0.29, 0.22, Math.PI / 2));
      const e = M(sph(0.02, 6, 4), acc, 0.08, 0.31, 0.09); e.castShadow = false; inner.add(e);
    } else {
      inner.add(M(rockGeo(5, 1, 0.15), body, 0, 0.2, 0, 0, 0, 0, 0.28, 0.17, 0.32));
      for (let i = 0; i < 5; i++) inner.add(M(crystalGeo(0.05, 0.2, 5), body, Math.sin(i * 1.7) * 0.12, 0.3, Math.cos(i * 1.9) * 0.12, Math.sin(i) * 0.4, 0, Math.cos(i) * 0.4));
      inner.add(M(sph(0.08, 10, 8), dark, 0, 0.16, 0.28));
      const e = M(sph(0.022, 6, 4), acc, 0, 0.18, 0.35); e.castShadow = false; inner.add(e);
      for (let i = 0; i < 2; i++) for (const s of [-1, 1]) { const p = legPivot(inner, s * 0.22, 0.13, (i - 0.5) * 0.3); L(p, 0.12, 0.06, dark, i * Math.PI + (s > 0 ? Math.PI : 0), 0.4); }
    }
    hbY = 0.6; shadowR = 0.38;
  } else if (type === 'flyer') {
    if (R) {
      inner.add(M(rbox(0.2, 0.08, 0.26, 0.03), body, 0, 0, 0));
      inner.add(M(rbox(0.1, 0.06, 0.1, 0.02), dark, 0, -0.06, 0.04));
      for (const s of [-1, 1]) { inner.add(M(rbox(0.18, 0.025, 0.05, 0.01), dark, s * 0.18, 0, 0)); const rot = new THREE.Group(); rot.position.set(s * 0.27, 0.03, 0); inner.add(rot); rot.add(M(cyl(0.11, 0.11, 0.01, 16), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.35, depthWrite: false }))); rot.add(M(rbox(0.22, 0.008, 0.025, 0.003), MAT.dark)); spin.push(rot); }
      const e = M(sph(0.025, 6, 4), acc, 0, -0.02, 0.14); e.castShadow = false; inner.add(e);
    } else {
      inner.add(M(crystalGeo(0.06, 0.22, 6), body, 0, 0, -0.05, Math.PI / 2));
      for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.04, 0.02, 0); inner.add(w); const wing = M(new THREE.CircleGeometry(0.18, 6), crystalMat(0x80ffe0, 0x20c0a0, 0.8), s * 0.16, 0, 0, -Math.PI / 2, 0, 0, 1, 0.6, 1); wing.material.side = THREE.DoubleSide; w.add(wing); legs.push({ p: w, phase: s > 0 ? 0 : Math.PI, amp: 0.7, flap: s }); }
      const e = M(sph(0.025, 6, 4), acc, 0, 0.01, 0.13); e.castShadow = false; inner.add(e);
    }
    inner.position.y = 0.95; hbY = 1.2; shadowR = 0.22;
  } else if (type === 'brute' || type === 'boss') {
    const s = type === 'boss' ? 1.9 : 1.15;
    if (R) {
      inner.add(M(rbox(0.36 * s, 0.3 * s, 0.28 * s, 0.05 * s), body, 0, 0.58 * s, 0));
      inner.add(M(rbox(0.18 * s, 0.12 * s, 0.16 * s, 0.03 * s), dark, 0, 0.78 * s, 0.04 * s));
      const e = M(rbox(0.12 * s, 0.025 * s, 0.02 * s, 0.005), acc, 0, 0.79 * s, 0.125 * s); e.castShadow = false; inner.add(e);
      for (const sx of [-1, 1]) {
        inner.add(M(rbox(0.16 * s, 0.14 * s, 0.2 * s, 0.03 * s), body, sx * 0.27 * s, 0.68 * s, 0));
        inner.add(M(rbox(0.09 * s, 0.24 * s, 0.09 * s, 0.02 * s), dark, sx * 0.27 * s, 0.5 * s, 0.03 * s));
        if (type === 'boss') { inner.add(M(cyl(0.05 * s, 0.05 * s, 0.32 * s, 10), MAT.metal, sx * 0.27 * s, 0.8 * s, 0.1 * s, Math.PI / 2)); inner.add(M(cone(0.04 * s, 0.14 * s, 6), acc, sx * 0.27 * s, 0.84 * s, -0.08 * s)); }
        const p = legPivot(inner, sx * 0.11 * s, 0.44 * s, 0); L(p, 0.42 * s, 0.11 * s, dark, sx > 0 ? 0 : Math.PI, 0.45);
      }
    } else {
      inner.add(M(rockGeo(8, 1, 0.2), body, 0, 0.6 * s, 0, 0, 0, 0, 0.24 * s, 0.24 * s, 0.2 * s));
      inner.add(M(rockGeo(9, 1, 0.2), body, 0, 0.88 * s, 0.04 * s, 0, 0, 0, 0.12 * s, 0.11 * s, 0.11 * s));
      const e = M(sph(0.035 * s, 8, 6), acc, 0, 0.9 * s, 0.14 * s); e.castShadow = false; inner.add(e);
      for (const sx of [-1, 1]) {
        inner.add(M(crystalGeo(0.08 * s, 0.32 * s, 5), body, sx * 0.26 * s, 0.72 * s, 0, 0, 0, -sx * 0.5));
        inner.add(M(rbox(0.1 * s, 0.32 * s, 0.1 * s, 0.03 * s), dark, sx * 0.28 * s, 0.48 * s, 0.02 * s));
        const p = legPivot(inner, sx * 0.11 * s, 0.42 * s, 0); L(p, 0.4 * s, 0.12 * s, dark, sx > 0 ? 0 : Math.PI, 0.45);
      }
      if (type === 'boss') for (let i = 0; i < 5; i++) inner.add(M(crystalGeo(0.05 * s, 0.26 * s, 5), crystalMat(0xd0ffa0, 0x80ff40, 1.4), (i - 2) * 0.07 * s, 1.0 * s, 0, 0, 0, (i - 2) * 0.25));
    }
    hbY = type === 'boss' ? 2.1 : 1.3; shadowR = type === 'boss' ? 0.8 : 0.45;
  }
  // blob shadow (fliers, plus soft contact shadow for all)
  const sh = new THREE.Mesh(geoC('shq', () => new THREE.PlaneGeometry(1, 1)), MAT.shadow); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; sh.scale.setScalar(shadowR * (type === 'flyer' ? 2.2 : 2.4)); sh.renderOrder = 1; grp.add(sh);
  // hp bar
  const hb = new THREE.Group();
  const bg = new THREE.Mesh(geoC('hbbg', () => new THREE.PlaneGeometry(0.46, 0.075)), new THREE.MeshBasicMaterial({ color: 0x101010, depthTest: false, transparent: true, opacity: 0.85 }));
  const fg = new THREE.Mesh(geoC('hbfg', () => new THREE.PlaneGeometry(0.44, 0.05)), new THREE.MeshBasicMaterial({ color: 0x40ff40, depthTest: false, transparent: true }));
  fg.position.z = 0.001; bg.renderOrder = 10; fg.renderOrder = 11; hb.add(bg); hb.add(fg);
  hb.position.y = hbY; if (type === 'boss') hb.scale.set(2.2, 1.6, 1);
  hb.visible = false; grp.add(hb);
  grp.traverse(o => { if (o.isMesh && o !== sh && o.parent !== hb) o.castShadow = type !== 'flyer'; });
  grp.userData = { inner, legs, spin, body, hb, fg, baseEm: body.emissive.clone(), baseEI: body.emissiveIntensity, debris: R ? P.body : P.body, air: type === 'flyer', sh };
  return grp;
}

// ---------- temple base ----------
export function baseMesh(B, hasGun) {
  const g = new THREE.Group(); const parts = {};
  g.add(M(rbox(3.1, 0.34, 2.2, 0.06), MAT.stone, 0, 0.17, -0.1));
  g.add(M(rbox(2.6, 0.12, 1.8, 0.04), MAT.stoneDark, 0, 0.4, -0.15));
  // rear block wall
  g.add(M(rbox(2.4, 0.9, 0.6, 0.08), MAT.stone, 0, 0.85, -0.75));
  for (const sx of [-1, 1]) {
    g.add(M(rbox(0.55, 1.2, 0.7, 0.08), MAT.stone, sx * 1.22, 0.9, -0.55));
    g.add(M(rbox(0.6, 0.12, 0.75, 0.03), MAT.gold, sx * 1.22, 1.55, -0.55));
    for (let i = 0; i < 3; i++) g.add(M(rbox(0.12, 0.22, 0.04, 0.02), MAT.gold, sx * 1.22 + (i - 1) * 0.16, 1.05, -0.18, 0, 0, sx * 0.6));
    const lamp = M(cyl(0.07, 0.07, 0.25, 8), MAT.domeCore, sx * 1.22, 1.75, -0.55); lamp.castShadow = false; g.add(lamp);
    // small side domes
    const sd = M(geoC('sdome', () => new THREE.SphereGeometry(0.34, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2)), MAT.dome, sx * 1.0, 0.46, 0.45); sd.castShadow = false; g.add(sd);
    g.add(M(tor(0.34, 0.04, 8, 32), MAT.gold, sx * 1.0, 0.47, 0.45, Math.PI / 2));
  }
  // main generator dome
  g.add(M(cyl(0.98, 1.05, 0.22, 32), MAT.dark, 0, 0.55, 0.05));
  g.add(M(tor(0.97, 0.06, 8, 48), MAT.gold, 0, 0.67, 0.05, Math.PI / 2));
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(M(rbox(0.16, 0.3, 0.12, 0.03), MAT.gold, Math.sin(a) * 1.0, 0.6, 0.05 + Math.cos(a) * 1.0, 0, a, 0)); }
  const dome = M(geoC('mdome', () => new THREE.SphereGeometry(0.94, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2)), MAT.dome, 0, 0.66, 0.05); dome.castShadow = false; g.add(dome); parts.dome = dome;
  g.add(M(cyl(0.2, 0.26, 0.1, 12), MAT.dark, 0, 1.6, 0.05));
  const cr = M(crystalGeo(0.16, 0.5, 6), MAT.domeCore, 0, 1.68, 0.05); cr.castShadow = false; g.add(cr); parts.crystal = cr;
  // door
  g.add(M(rbox(0.6, 0.6, 0.18, 0.04), MAT.stoneDark, 0, 0.62, 0.98));
  g.add(M(rbox(0.36, 0.42, 0.04, 0.02), MAT.black, 0, 0.58, 1.07));
  const dl = M(rbox(0.04, 0.32, 0.02, 0.01), MAT.domeCore, 0, 0.58, 1.09); dl.castShadow = false; g.add(dl);
  // energy shield (meta)
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.75, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x60e8ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  shield.visible = false; g.add(shield); parts.shield = shield;
  if (hasGun) { const tg = new THREE.Group(); tg.position.set(0, 1.25, 0.65); tg.add(M(rbox(0.3, 0.18, 0.3, 0.04), armor(0xd8a020))); tg.add(M(cyl(0.04, 0.04, 0.4, 8), MAT.metal, 0, 0, 0.25, Math.PI / 2)); g.add(tg); parts.gun = tg; }
  g.userData = parts; return g;
}

// ---------- decoration ----------
export function decoMesh(kind, B, r, scale = 1) {
  const g = new THREE.Group();
  const rockMat = B.rockMat || MAT.rock;
  switch (kind) {
    case 'pine': {
      const n = 1 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++) {
        const x = (r() - 0.5) * 0.4, z = (r() - 0.5) * 0.4, h = 0.9 + r() * 0.7;
        g.add(M(cyl(0.035, 0.05, h * 0.3, 6), B.trunkMat, x, h * 0.15, z));
        for (let i = 0; i < 4; i++) { const y = h * (0.25 + i * 0.19), rr = 0.3 * (1 - i * 0.2) * (0.9 + r() * 0.2); g.add(M(cone(rr, h * 0.34, 7), B.leafMat, x, y + h * 0.12, z, 0, r() * 3)); }
      }
      if (r() < 0.6) g.add(M(rockGeo(Math.floor(r() * 50), 1), rockMat, 0.25, 0.04, 0.2, 0, 0, 0, 0.12, 0.09, 0.1));
      break;
    }
    case 'ruin': {
      const h = 0.4 + r() * 0.7; g.add(M(cyl(0.16, 0.18, h, 10), MAT.stone, 0, h / 2, 0)); g.add(M(rbox(0.42, 0.1, 0.42, 0.03), MAT.stone, 0, 0.05, 0));
      if (r() < 0.6) g.add(M(rbox(0.34, 0.16, 0.18, 0.03), MAT.stone, 0.3, 0.08, 0.15, 0, r() * 3, 0.2));
      break;
    }
    case 'crystal': {
      const CM = crystalMat(B.crystalCol, B.crystalCol, 0.9);
      for (let i = 0; i < 4; i++) g.add(M(crystalGeo(0.07, 0.38, 6), CM, (r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3, (r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8, 1, 0.6 + r(), 1));
      g.add(M(rockGeo(Math.floor(r() * 50), 1), rockMat, 0, 0.02, 0, 0, 0, 0, 0.22, 0.1, 0.2));
      break;
    }
    case 'coral': {
      const cols = [0xff7a8a, 0xffa060, 0xc070ff];
      for (let i = 0; i < 4; i++) { const c = new THREE.MeshStandardMaterial({ color: cols[i % 3], roughness: 0.6, emissive: cols[i % 3], emissiveIntensity: 0.1 }); g.add(M(cone(0.06, 0.3 + r() * 0.3, 6), c, (r() - 0.5) * 0.4, 0.15, (r() - 0.5) * 0.4, (r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6)); }
      g.add(M(rockGeo(Math.floor(r() * 50), 1), rockMat, 0, 0.03, 0, 0, 0, 0, 0.25, 0.12, 0.22));
      break;
    }
    case 'ice': {
      const IM = crystalMat(0xd8f0ff, 0x6ab8f0, 0.35);
      for (let i = 0; i < 4; i++) g.add(M(crystalGeo(0.08, 0.5 + r() * 0.4, 5), IM, (r() - 0.5) * 0.35, 0, (r() - 0.5) * 0.35, (r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5));
      g.add(M(rockGeo(Math.floor(r() * 50), 1), rockMat, 0, 0.03, 0, 0, 0, 0, 0.26, 0.12, 0.24));
      break;
    }
    case 'fungus': {
      const cap = new THREE.MeshStandardMaterial({ color: 0x5aa08a, emissive: 0x30c0a0, emissiveIntensity: 0.25, roughness: 0.5 });
      for (let i = 0; i < 3; i++) { const h = 0.2 + r() * 0.4, x = (r() - 0.5) * 0.5, z = (r() - 0.5) * 0.5; g.add(M(cyl(0.03, 0.045, h, 6), B.trunkMat, x, h / 2, z)); g.add(M(sph(0.15, 12, 8), cap, x, h, z, 0, 0, 0, 1, 0.45, 1)); }
      if (r() < 0.5) g.add(M(cyl(0.05, 0.07, 0.9, 6), B.trunkMat, 0.15, 0.45, 0.1, 0.1, 0, 0.15));
      break;
    }
    case 'basalt': {
      const lava = glow(0xff6a20, 1.5);
      for (let i = 0; i < 4; i++) { const h = 0.2 + r() * 0.6; g.add(M(cyl(0.12, 0.13, h, 6), rockMat, (r() - 0.5) * 0.4, h / 2, (r() - 0.5) * 0.4)); }
      if (r() < 0.5) { const l = M(cyl(0.12, 0.12, 0.02, 10), lava, 0.2, 0.02, -0.15); l.castShadow = false; g.add(l); }
      break;
    }
    case 'column': {
      const marble = MAT.stone;
      const h = 0.5 + r() * 0.9; g.add(M(cyl(0.13, 0.14, h, 12), marble, 0, h / 2, 0)); g.add(M(rbox(0.36, 0.08, 0.36, 0.02), marble, 0, 0.04, 0));
      if (r() < 0.5) g.add(M(rbox(0.36, 0.08, 0.36, 0.02), marble, 0, h + 0.04, 0));
      break;
    }
    case 'shard': {
      const SM = crystalMat(0xc89aff, 0x8040e0, 0.8);
      for (let i = 0; i < 3; i++) g.add(M(crystalGeo(0.07, 0.4 + r() * 0.4, 5), SM, (r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3, (r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6));
      g.add(M(rockGeo(Math.floor(r() * 50), 1), rockMat, 0, 0.04, 0, 0, 0, 0, 0.28, 0.15, 0.25));
      break;
    }
    case 'tower': {
      const h = 0.5 + r() * 1.2;
      g.add(M(rbox(0.7, h, 0.7, 0.05), B.bldMat, 0, h / 2, 0));
      g.add(M(rbox(0.5, 0.15, 0.5, 0.03), MAT.dark, 0, h + 0.07, 0));
      for (let i = 0; i < 3; i++) { const w = M(rbox(0.72, 0.035, 0.18, 0.005), glow(0x40e0ff, 1.2), 0, h * (0.3 + i * 0.22), 0.1); w.castShadow = false; g.add(w); }
      break;
    }
    default: { // rock pile like the original's brown boulder heaps
      const n = 2 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) { const s = 0.12 + r() * 0.2; g.add(M(rockGeo(Math.floor(r() * 60), 1, 0.32), rockMat, (r() - 0.5) * 0.55, s * 0.5, (r() - 0.5) * 0.55, r(), r() * 3, r(), s * (1 + r() * 0.5), s, s * (1 + r() * 0.4))); }
    }
  }
  g.scale.setScalar(scale);
  return g;
}
export function rockPile(r, mat, n = 4, spread = 0.5, big = 0.22) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const s = big * (0.5 + r() * 0.8); g.add(M(rockGeo(Math.floor(r() * 60), 1, 0.32), mat, (r() - 0.5) * spread, s * 0.45, (r() - 0.5) * spread, r(), r() * 3, r(), s * (1 + r() * 0.5), s * (0.8 + r() * 0.4), s * (1 + r() * 0.4))); }
  return g;
}
