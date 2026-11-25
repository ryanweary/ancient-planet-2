import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GW, GH, TOWERS, ENEMIES } from './data.js';
import { C, rng } from './levels.js';
import { cellX, cellZ } from './core.js';

const M = 3; // margin cells
const PX = 64;
export const BIOMES = {
  verdant: { g1: '#5c9a2c', g2: '#80c03c', path: '#8c6e40', edge: '#3a2c18', slab: '#a08458', water: '#46bccc', haz: null, sky: 0x9fd7ff, fog: 0x8fc6e8, deco: 'pine', light: 0xfff2d6, amb: 0x8fb0d0, crystal: 0x4ff0ff },
  reef:    { g1: '#c8b88a', g2: '#dccb9c', path: '#e8dcbc', edge: '#9c8a64', slab: '#f2e8cc', water: '#22b8c0', haz: null, sky: 0xbff0ff, fog: 0xa8e0e8, deco: 'coral', light: 0xfff4e0, amb: 0x90c8d0, crystal: 0xff70d0 },
  frost:   { g1: '#dfe8f0', g2: '#f4f8fc', path: '#a8bccf', edge: '#6e86a0', slab: '#c4d4e2', water: '#4a9ad0', haz: null, sky: 0xd8ecff, fog: 0xc8dcf0, deco: 'ice', light: 0xf4f8ff, amb: 0xa0b8d8, crystal: 0x9fe8ff },
  mire:    { g1: '#2e4a28', g2: '#41622f', path: '#4c3f2a', edge: '#1c160e', slab: '#5e5038', water: '#3a6a48', haz: null, sky: 0x506a50, fog: 0x3c5844, deco: 'fungus', light: 0xd8f0c8, amb: 0x5a7a60, crystal: 0x60ffb0 },
  forge:   { g1: '#3a302c', g2: '#4c3c34', path: '#6a5a4e', edge: '#1a1310', slab: '#7c6a5c', water: null, haz: '#ff5a14', sky: 0x3a2018, fog: 0x2c1810, deco: 'basalt', light: 0xffd8b0, amb: 0x806050, crystal: 0xffa040 },
  sky:     { g1: '#d2b080', g2: '#e4c696', path: '#b49c7c', edge: '#7a6448', slab: '#c8b090', water: null, haz: '#d8eeff', sky: 0xbfe4ff, fog: 0xd8eeff, deco: 'column', light: 0xfff4dc, amb: 0xb0c8e0, crystal: 0x7fd8ff },
  storm:   { g1: '#56526c', g2: '#68647e', path: '#8a849a', edge: '#33304a', slab: '#9a94aa', water: '#4466a0', haz: null, sky: 0x403c58, fog: 0x3a3650, deco: 'shard', light: 0xe0d8ff, amb: 0x6a6490, crystal: 0xc080ff },
  city:    { g1: '#5c6676', g2: '#6c7686', path: '#30353e', edge: '#12151a', slab: '#30353f', water: '#2690a8', haz: null, sky: 0x1a2030, fog: 0x161c2a, deco: 'tower', light: 0xd8e8ff, amb: 0x8a9ac0, crystal: 0x40f0ff },
};

const mats = {};
function mat(key, opts) { return mats[key] || (mats[key] = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.75, metalness: 0.15, ...opts })); }
const geo = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12), hex: new THREE.CylinderGeometry(0.5, 0.56, 1, 6),
  sph: new THREE.SphereGeometry(0.5, 14, 10), oct: new THREE.OctahedronGeometry(0.5, 0), ico: new THREE.IcosahedronGeometry(0.5, 0),
  cone: new THREE.ConeGeometry(0.5, 1, 7), dod: new THREE.DodecahedronGeometry(0.5, 0), tor: new THREE.TorusGeometry(0.5, 0.06, 6, 24),
};
function mesh(g, m, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo[g] || g, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; }

function paintGround(L, B) {
  const W = (GW + 2 * M) * PX, H = (GH + 2 * M) * PX;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const r = rng(L.seed + 5);
  const toPx = (cx, cy) => [(cx + M + 0.5) * PX, (cy + M + 0.5) * PX];
  g.fillStyle = B.g1; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { g.globalAlpha = 0.08 + r() * 0.12; g.fillStyle = r() < 0.5 ? B.g2 : B.g1; const x = r() * W, y = r() * H, s = 10 + r() * 60; g.beginPath(); g.ellipse(x, y, s, s * 0.7, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 2500; i++) { g.globalAlpha = 0.12 + r() * 0.2; g.fillStyle = r() < 0.5 ? '#000' : '#fff'; g.fillRect(r() * W, r() * H, 2, 2 + r() * 3); }
  g.globalAlpha = 1;
  // water/hazard cells
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const v = L.grid[y * GW + x];
    if (v === C.WATER || v === C.HAZARD) {
      const [px, py] = toPx(x, y);
      g.fillStyle = B.edge; g.globalAlpha = 0.5; g.beginPath(); g.roundRect(px - PX * 0.56, py - PX * 0.56, PX * 1.12, PX * 1.12, 14); g.fill();
      g.globalAlpha = 1; g.fillStyle = v === C.WATER ? B.water : B.haz; g.beginPath(); g.roundRect(px - PX * 0.5, py - PX * 0.5, PX, PX, 12); g.fill();
    }
  }
  // paths
  const strokePath = (pts, w, color, alpha = 1) => {
    g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = w * PX; g.lineCap = 'square'; g.lineJoin = 'miter';
    g.beginPath();
    const ext = pts.slice(); const a = ext[0], b = ext[1];
    const dx = Math.sign(a[0] - b[0]), dy = Math.sign(a[1] - b[1]);
    ext[0] = [a[0] + dx * 4, a[1] + dy * 4];
    ext.forEach(([x, y], i) => { const [px, py] = toPx(x, y); i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.stroke(); g.globalAlpha = 1;
  };
  for (const p of L.paths) strokePath(p, 1.12, B.edge, 0.85);
  for (const p of L.paths) strokePath(p, 0.94, B.path);
  for (const p of L.paths) strokePath(p, 0.5, B.slab, 0.35);
  // slab glyph tiles on path cells
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (L.grid[y * GW + x] !== C.PATH) continue;
    const [px, py] = toPx(x, y);
    g.strokeStyle = B.edge; g.globalAlpha = 0.28; g.lineWidth = 2;
    g.strokeRect(px - PX * 0.4, py - PX * 0.4, PX * 0.8, PX * 0.8);
    if (r() < 0.55) { // meander / spiral glyph
      g.beginPath(); const s = PX * 0.22;
      g.moveTo(px - s, py + s); g.lineTo(px - s, py - s); g.lineTo(px + s, py - s); g.lineTo(px + s, py + s * 0.4); g.lineTo(px - s * 0.4, py + s * 0.4); g.lineTo(px - s * 0.4, py - s * 0.3); g.lineTo(px + s * 0.3, py - s * 0.3);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  // deposits
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (L.grid[y * GW + x] !== C.DEPOSIT) continue;
    const [px, py] = toPx(x, y);
    const grd = g.createRadialGradient(px, py, 2, px, py, PX * 0.55);
    grd.addColorStop(0, 'rgba(255,255,220,0.95)'); grd.addColorStop(0.35, 'rgba(255,220,120,0.6)'); grd.addColorStop(1, 'rgba(60,40,20,0)');
    g.fillStyle = '#2a2420'; g.globalAlpha = 0.7; g.beginPath(); g.arc(px, py, PX * 0.42, 0, 7); g.fill();
    g.globalAlpha = 1; g.fillStyle = grd; g.beginPath(); g.arc(px, py, PX * 0.55, 0, 7); g.fill();
  }
  // base plaza
  const [bx] = L.base;
  const [px0, py0] = toPx(bx - 1.5, -0.5);
  g.fillStyle = B.slab; g.globalAlpha = 0.85; g.fillRect(px0 - PX * 0.2, py0 - PX * 2, PX * 3.4, PX * 4.2); g.globalAlpha = 1;
  g.strokeStyle = B.edge; g.lineWidth = 3; for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) g.strokeRect(px0 - PX * 0.2 + i * PX * 0.85, py0 - PX * 2 + j * PX * 0.7, PX * 0.85, PX * 0.7);
  // vignette edges outside grid
  const vg = g.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(0,0,0,0.35)'); vg.addColorStop(0.12, 'rgba(0,0,0,0)'); vg.addColorStop(0.88, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

function decoMesh(kind, B, r, scale = 1) {
  const grp = new THREE.Group();
  const s = scale * (0.8 + r() * 0.4);
  switch (kind) {
    case 'pine': {
      const trunk = mat('trunk', { color: 0x5a3a20 }), leaf = mat('pine', { color: 0x2f6a2a });
      grp.add(mesh('cyl', trunk, 0.1, 0.3, 0.1, 0, 0.15, 0));
      for (let i = 0; i < 3; i++) grp.add(mesh('cone', leaf, 0.7 - i * 0.18, 0.5, 0.7 - i * 0.18, 0, 0.45 + i * 0.28, 0));
      if (r() < 0.4) { grp.children.length = 0; grp.add(mesh('dod', mat('rockv', { color: 0x8a8a7a }), 0.6, 0.45, 0.55, 0, 0.18, 0)); }
      break;
    }
    case 'coral': {
      const c1 = mat('coral' + B.crystal, { color: B.crystal, emissive: B.crystal, emissiveIntensity: 0.35 });
      for (let i = 0; i < 4; i++) { const m = mesh('oct', c1, 0.18, 0.6 + r() * 0.5, 0.18, (r() - 0.5) * 0.4, 0.3, (r() - 0.5) * 0.4); m.rotation.z = (r() - 0.5) * 0.6; grp.add(m); }
      grp.add(mesh('dod', mat('rockr', { color: 0xa89878 }), 0.5, 0.25, 0.5, 0, 0.08, 0));
      break;
    }
    case 'ice': {
      const ice = mat('ice', { color: 0xbfe6ff, emissive: 0x3070a0, emissiveIntensity: 0.25, roughness: 0.2, metalness: 0.1 });
      for (let i = 0; i < 3; i++) { const m = mesh('cone', ice, 0.3, 0.6 + r() * 0.6, 0.3, (r() - 0.5) * 0.4, 0.35, (r() - 0.5) * 0.4); grp.add(m); }
      break;
    }
    case 'fungus': {
      const st = mat('stem', { color: 0x8a8470 }), cap = mat('cap', { color: 0x2a8a70, emissive: 0x20a070, emissiveIntensity: 0.35 });
      for (let i = 0; i < 3; i++) { const h = 0.2 + r() * 0.4, x = (r() - 0.5) * 0.5, z = (r() - 0.5) * 0.5; grp.add(mesh('cyl', st, 0.07, h, 0.07, x, h / 2, z)); grp.add(mesh('sph', cap, 0.3, 0.14, 0.3, x, h, z)); }
      if (r() < 0.5) { const tr = mat('deadtree', { color: 0x3a3020 }); grp.add(mesh('cyl', tr, 0.12, 0.9, 0.12, 0.15, 0.45, 0.1)); }
      break;
    }
    case 'basalt': {
      const b = mat('basalt', { color: 0x2a2220 });
      for (let i = 0; i < 4; i++) { const h = 0.3 + r() * 0.7; grp.add(mesh('hex', b, 0.28, h, 0.28, (r() - 0.5) * 0.45, h / 2, (r() - 0.5) * 0.45)); }
      break;
    }
    case 'column': {
      const st = mat('sand', { color: 0xe0c8a0 });
      const h = 0.4 + r() * 0.8; grp.add(mesh('cyl', st, 0.26, h, 0.26, 0, h / 2, 0)); grp.add(mesh('box', st, 0.4, 0.1, 0.4, 0, h, 0));
      if (r() < 0.5) grp.add(mesh('box', st, 0.3, 0.15, 0.5, 0.25, 0.08, 0.2));
      break;
    }
    case 'shard': {
      const sh = mat('shard', { color: 0x9a70d8, emissive: 0x6030b0, emissiveIntensity: 0.5 });
      for (let i = 0; i < 3; i++) { const m = mesh('oct', sh, 0.22, 0.7 + r() * 0.6, 0.22, (r() - 0.5) * 0.4, 0.35, (r() - 0.5) * 0.4); m.rotation.x = (r() - 0.5) * 0.5; grp.add(m); }
      grp.add(mesh('dod', mat('rocks', { color: 0x4a4660 }), 0.5, 0.3, 0.5, 0, 0.1, 0));
      break;
    }
    case 'tower': {
      const w = mat('bld', { color: 0x5a6478, metalness: 0.2, roughness: 0.5 }), lit = mat('win', { color: 0x40e0ff, emissive: 0x40e0ff, emissiveIntensity: 1.2 });
      const h = 0.5 + r() * 1.2; grp.add(mesh('box', w, 0.7, h, 0.7, 0, h / 2, 0));
      for (let i = 0; i < 3; i++) grp.add(mesh('box', lit, 0.72, 0.04, 0.2, 0, h * (0.3 + i * 0.22), 0.1));
      break;
    }
  }
  grp.scale.setScalar(s); grp.rotation.y = r() * 6.28;
  return grp;
}

// ---------------- towers ----------------
function towerMesh(t, B) {
  const grp = new THREE.Group();
  const dark = mat('tdark', { color: 0x3a3f46, metalness: 0.5, roughness: 0.5 });
  const mid = mat('tmid', { color: 0x6a7078, metalness: 0.5, roughness: 0.45 });
  const lvlCol = [0xf0c020, 0xf0c020, 0xf0a020, 0xe04030, 0xe02040][t.lvl];
  const ring = mat('ring' + lvlCol, { color: lvlCol, emissive: lvlCol, emissiveIntensity: 0.25 });
  const pad = mesh('hex', dark, 0.78, 0.16, 0.78, 0, 0.08, 0); grp.add(pad);
  grp.add(mesh('hex', ring, 0.82, 0.05, 0.82, 0, 0.13, 0));
  grp.add(mesh('hex', mid, 0.6, 0.1, 0.6, 0, 0.2, 0));
  for (let i = 0; i < t.lvl; i++) grp.add(mesh('box', ring, 0.06, 0.05, 0.14, -0.3 + i * 0.1, 0.18, 0.36));
  const head = new THREE.Group(); head.position.y = 0.25; grp.add(head);
  const anim = { head, spin: [] };
  const k = t.kind, L = t.lvl, br = t.branch;
  if (k === 'gun') {
    head.add(mesh('box', mid, 0.36, 0.24, 0.36, 0, 0.14, -0.02));
    head.add(mesh('box', ring, 0.38, 0.06, 0.2, 0, 0.27, -0.06));
    const bar = mat('barrel', { color: 0x22262a, metalness: 0.7, roughness: 0.3 });
    if (br === 0) { const g = new THREE.Group(); g.position.set(0, 0.14, 0.2); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; const b = mesh('cyl', bar, 0.05, 0.5, 0.05, Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0.2); b.rotation.x = Math.PI / 2; g.add(b); } head.add(g); anim.spin.push(g); }
    else if (br === 1) { const b = mesh('cyl', bar, 0.09, 0.75, 0.09, 0, 0.15, 0.4); b.rotation.x = Math.PI / 2; head.add(b); head.add(mesh('box', ring, 0.14, 0.14, 0.12, 0, 0.15, 0.72)); }
    else { const n = L === 0 ? 1 : 2; for (let i = 0; i < n; i++) { const b = mesh('cyl', bar, 0.06, 0.4 + L * 0.06, 0.06, n === 1 ? 0 : (i - 0.5) * 0.14, 0.14, 0.32); b.rotation.x = Math.PI / 2; head.add(b); } }
  } else if (k === 'energy') {
    const crys = mat('ecrys', { color: 0x70ff70, emissive: 0x30ff40, emissiveIntensity: 1.1, roughness: 0.3, transparent: true, opacity: 0.92 });
    head.add(mesh('cyl', mid, 0.22, 0.25, 0.22, 0, 0.12, 0));
    const n = br === 0 ? 2 : 1, sz = br === 1 ? 0.5 : 0.32 + L * 0.03;
    for (let i = 0; i < n; i++) { const c = mesh('oct', crys, sz * 0.7, sz * 1.5, sz * 0.7, n === 1 ? 0 : (i - 0.5) * 0.28, 0.55 + L * 0.03, 0); c.castShadow = false; head.add(c); anim.spin.push(c); }
    anim.float = true;
  } else if (k === 'cryo') {
    const orb = mat('corb', { color: 0xbfefff, emissive: 0x60c8ff, emissiveIntensity: 1.2, roughness: 0.2 });
    head.add(mesh('cyl', mid, 0.18, 0.3, 0.18, 0, 0.15, 0));
    const o = mesh('sph', orb, 0.28 + L * 0.02, 0.28 + L * 0.02, 0.28 + L * 0.02, 0, 0.45, 0); o.castShadow = false; head.add(o);
    const rg = mesh('tor', mat('cring', { color: 0x80d8ff, emissive: 0x2080c0, emissiveIntensity: 0.6 }), 0.55, 0.55, 0.55, 0, 0.45, 0); rg.rotation.x = Math.PI / 2; head.add(rg); anim.spin.push(rg);
    anim.muzzleY = 0.7;
  } else if (k === 'missile') {
    const body = new THREE.Group(); body.position.y = 0.2; body.rotation.x = -0.35; head.add(body);
    body.add(mesh('box', mid, 0.46, 0.3, 0.42, 0, 0, 0));
    const n = (br === 0 ? 3 : 2) + (L >= 2 ? 1 : 0);
    const tube = mat('tube', { color: 0xd04020, emissive: 0x401000 });
    for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { const c = mesh('cyl', tube, 0.08, 0.1, 0.08, (i - (n - 1) / 2) * 0.12, (j - 0.5) * 0.14, 0.21); c.rotation.x = Math.PI / 2; body.add(c); }
  } else if (k === 'naval') {
    grp.children[0].visible = false; grp.children[1].visible = false; grp.children[2].visible = false;
    const hull = mat('hull', { color: 0x50606e, metalness: 0.4 });
    grp.add(mesh('box', hull, 0.55, 0.16, 0.82, 0, 0.05, 0)); grp.add(mesh('box', ring, 0.57, 0.04, 0.84, 0, 0.12, 0));
    head.add(mesh('cyl', mid, 0.36, 0.2, 0.36, 0, 0.05, 0));
    const bar = mat('barrel', { color: 0x22262a, metalness: 0.7 });
    const n = br === 0 ? 3 : 1, th = br === 1 ? 0.16 : 0.1;
    for (let i = 0; i < n; i++) { const b = mesh('cyl', bar, th, 0.6, th, n === 1 ? 0 : (i - 1) * 0.12, 0.08, 0.35); b.rotation.x = Math.PI / 2; head.add(b); }
    anim.bob = true;
  } else if (k === 'reaper') {
    const pur = mat('reap', { color: 0x9050e0, emissive: 0x6020c0, emissiveIntensity: 0.9 });
    head.add(mesh('cone', dark, 0.3, 0.8, 0.3, 0, 0.4, 0));
    const o = mesh('ico', pur, 0.26, 0.26, 0.26, 0, 0.85, 0); o.castShadow = false; head.add(o); anim.spin.push(o);
    const rg = mesh('tor', pur, 0.5 + L * 0.03, 0.5 + L * 0.03, 0.5, 0, 0.6, 0); rg.rotation.x = Math.PI / 2; head.add(rg); anim.spin.push(rg);
    anim.muzzleY = 0.85; anim.noAim = true;
  } else if (k === 'destroyer') {
    head.add(mesh('box', dark, 0.44, 0.3, 0.5, 0, 0.16, 0));
    head.add(mesh('box', mat('dred', { color: 0xc02020, emissive: 0x600000 }), 0.46, 0.06, 0.3, 0, 0.32, 0));
    const bar = mat('barrel', { color: 0x22262a, metalness: 0.7 });
    const th = br === 1 ? 0.15 : 0.11;
    const b = mesh('cyl', bar, th, 0.7, th, 0, 0.18, 0.45); b.rotation.x = Math.PI / 2; head.add(b);
    head.add(mesh('box', mat('dred', { color: 0xc02020 }), th * 1.6, th * 1.6, 0.1, 0, 0.18, 0.8));
  } else if (k === 'support') {
    const pur = mat('supp', { color: 0xc070ff, emissive: 0x8030ff, emissiveIntensity: 1.0, transparent: true, opacity: 0.9 });
    grp.children[1].material = mat('ringp', { color: 0x9040e0, emissive: 0x6020b0, emissiveIntensity: 0.6 });
    head.add(mesh('cyl', mid, 0.16, 0.35, 0.16, 0, 0.18, 0));
    const orbit = new THREE.Group(); orbit.position.y = 0.48; head.add(orbit);
    for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28; const o = mesh('sph', pur, 0.17, 0.17, 0.17, Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22); o.castShadow = false; orbit.add(o); }
    anim.spin.push(orbit); anim.noAim = true;
  } else if (k === 'factory') {
    grp.children[1].material = ring;
    const v = mat('volc', { color: 0x4a3c30 });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.38, 0.4, 8), v); cone.position.y = 0.2; cone.castShadow = true; head.add(cone);
    head.add(mesh('cyl', mat('glowtop', { color: 0xffffff, emissive: 0xfff0c0, emissiveIntensity: 1.5 }), 0.24, 0.04, 0.24, 0, 0.41, 0));
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.9, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    col.position.y = 0.85; head.add(col); anim.column = col; anim.noAim = true;
  }
  grp.userData.anim = anim;
  return grp;
}

// ---------------- enemies ----------------
function enemyMesh(type, race) {
  const R = race === 'rust';
  const body = new THREE.MeshStandardMaterial({ flatShading: true, color: R ? 0xb84a28 : 0x2ec8a8, emissive: R ? 0x000000 : 0x0a5040, roughness: R ? 0.6 : 0.3, metalness: R ? 0.4 : 0.1 });
  const acc = new THREE.MeshStandardMaterial({ flatShading: true, color: R ? 0xffb030 : 0xb8ff60, emissive: R ? 0x804000 : 0x60c020, emissiveIntensity: 0.9 });
  const dark = mat('edark', { color: R ? 0x2a2420 : 0x1a3a40, metalness: 0.4 });
  const grp = new THREE.Group(); const inner = new THREE.Group(); grp.add(inner);
  const legs = [];
  if (type === 'grunt') {
    inner.add(mesh(R ? 'box' : 'oct', body, 0.26, 0.3, 0.2, 0, 0.32, 0));
    inner.add(mesh(R ? 'sph' : 'oct', body, 0.18, 0.18, 0.18, 0, 0.55, 0));
    inner.add(mesh('box', acc, 0.14, 0.05, 0.05, 0, 0.56, 0.08));
    for (let i = 0; i < 2; i++) { const l = mesh('box', dark, 0.08, 0.2, 0.08, (i - 0.5) * 0.12, 0.1, 0); inner.add(l); legs.push(l); }
    if (R) inner.add(mesh('cyl', dark, 0.04, 0.3, 0.04, 0.16, 0.36, 0.08));
  } else if (type === 'swarm') {
    inner.add(mesh(R ? 'dod' : 'oct', body, 0.22, 0.16, 0.26, 0, 0.14, 0));
    inner.add(mesh('sph', acc, 0.08, 0.08, 0.08, 0, 0.18, 0.12));
    for (let i = 0; i < 4; i++) { const l = mesh('box', dark, 0.3, 0.03, 0.03, 0, 0.08, (i - 1.5) * 0.06); inner.add(l); legs.push(l); }
  } else if (type === 'tank') {
    if (R) {
      inner.add(mesh('box', dark, 0.14, 0.14, 0.6, -0.2, 0.08, 0)); inner.add(mesh('box', dark, 0.14, 0.14, 0.6, 0.2, 0.08, 0));
      inner.add(mesh('box', body, 0.38, 0.18, 0.5, 0, 0.2, 0));
      inner.add(mesh('cyl', body, 0.26, 0.12, 0.26, 0, 0.34, 0));
      const b = mesh('cyl', dark, 0.06, 0.35, 0.06, 0, 0.34, 0.25); b.rotation.x = Math.PI / 2; inner.add(b);
    } else {
      inner.add(mesh('cyl', dark, 0.5, 0.08, 0.5, 0, 0.08, 0));
      for (let i = 0; i < 5; i++) { const c = mesh('oct', body, 0.2, 0.5, 0.2, Math.cos(i * 1.26) * 0.15, 0.35, Math.sin(i * 1.26) * 0.15); c.rotation.z = Math.cos(i) * 0.4; inner.add(c); }
      inner.add(mesh('sph', acc, 0.16, 0.16, 0.16, 0, 0.35, 0));
    }
  } else if (type === 'flyer') {
    inner.add(mesh(R ? 'cyl' : 'oct', body, 0.32, 0.1, 0.32, 0, 0, 0));
    inner.add(mesh('sph', acc, 0.12, 0.08, 0.12, 0, 0.05, 0.05));
    const w1 = mesh('box', R ? dark : body, 0.55, 0.02, 0.16, 0, 0, -0.05); inner.add(w1); legs.push(w1);
    inner.position.y = 0.95;
  } else if (type === 'brute' || type === 'boss') {
    const s = type === 'boss' ? 1.7 : 1;
    inner.add(mesh(R ? 'box' : 'ico', body, 0.5 * s, 0.45 * s, 0.38 * s, 0, 0.55 * s, 0));
    inner.add(mesh(R ? 'box' : 'oct', body, 0.2 * s, 0.2 * s, 0.2 * s, 0, 0.88 * s, 0.04));
    inner.add(mesh('box', acc, 0.16 * s, 0.05 * s, 0.05 * s, 0, 0.9 * s, 0.13 * s));
    inner.add(mesh('sph', acc, 0.16 * s, 0.16 * s, 0.1 * s, 0, 0.56 * s, 0.2 * s));
    for (let i = 0; i < 2; i++) { inner.add(mesh('box', dark, 0.16 * s, 0.3 * s, 0.16 * s, (i - 0.5) * 0.66 * s, 0.6 * s, 0)); const l = mesh('box', dark, 0.15 * s, 0.32 * s, 0.15 * s, (i - 0.5) * 0.24 * s, 0.16 * s, 0); inner.add(l); legs.push(l); }
    if (type === 'boss') for (let i = 0; i < 3; i++) inner.add(mesh('cone', acc, 0.08 * s, 0.25 * s, 0.08 * s, (i - 1) * 0.12 * s, 1.05 * s, 0));
  }
  // hp bar
  const hb = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.07), new THREE.MeshBasicMaterial({ color: 0x220000, depthTest: false, transparent: true, opacity: 0.8 }));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.05), new THREE.MeshBasicMaterial({ color: 0x40ff40, depthTest: false }));
  fg.position.z = 0.001; bg.renderOrder = 10; fg.renderOrder = 11; hb.add(bg); hb.add(fg);
  const E = ENEMIES[type];
  hb.position.y = type === 'flyer' ? 1.25 : type === 'boss' ? 2.0 : type === 'brute' ? 1.2 : type === 'tank' ? 0.65 : 0.85;
  if (type === 'boss') hb.scale.set(2, 1.5, 1);
  hb.visible = false; grp.add(hb);
  grp.userData = { inner, legs, body, hb, fg, baseEm: body.emissive.clone() };
  return grp;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    try { const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.45; } catch (e) { }
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
    this.quality = 3;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a3a20, 1.1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d0, 2.2); this.sun.position.set(-6, 14, 5); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024); const sc = this.sun.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 40; this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.level = new THREE.Group(); this.scene.add(this.level);
    this.dyn = new THREE.Group(); this.scene.add(this.dyn);
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.tmap = new Map(); this.emap = new Map(); this.pmap = new Map(); this.cmap = new Map(); this.omap = new Map(); this.bmap = new Map(); this.mmap = new Map();
    this.effects = [];
    this.time = 0;
    this.initParticles();
    this.fpsAcc = 0; this.fpsN = 0; this.fpsT = 0; this.lowCount = 0;
    this.resize();
    this.buildMenuScene();
  }
  setQuality(q) {
    this.quality = q;
    const dpr = Math.min(window.devicePixelRatio || 1, q >= 3 ? 2 : q === 2 ? 1.5 : 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = q >= 2; this.sun.castShadow = q >= 2;
    this.resize();
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false); this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
    if (this.inBattle) this.fit(); else if (this.menu && this.ships) this.menuCam();
  }
  fit() {
    // pitch camera and pull back until whole grid fits between HUD insets
    const pitch = 58 * Math.PI / 180;
    const insTop = 58, insBot = 64;
    const corners = [[-GW / 2, 0, -GH / 2 - 0.4], [GW / 2, 0, -GH / 2 - 0.4], [-GW / 2, 0, GH / 2], [GW / 2, 0, GH / 2], [0, 1.6, -GH / 2 + 0.6]];
    const v = new THREE.Vector3();
    let lo = 5, hi = 80, zc = 0;
    for (let iter = 0; iter < 2; iter++) {
      lo = 5; hi = 80;
      for (let k = 0; k < 30; k++) {
        const d = (lo + hi) / 2;
        this.camera.position.set(0, Math.sin(pitch) * d, zc + Math.cos(pitch) * d); this.camera.lookAt(0, 0, zc); this.camera.updateMatrixWorld();
        let ok = true, minY = 1e9, maxY = -1e9;
        for (const c of corners) { v.set(...c).project(this.camera); const sx = (v.x + 1) / 2 * this.w, sy = (1 - v.y) / 2 * this.h; if (sx < -2 || sx > this.w + 2 || sy < insTop || sy > this.h - insBot) ok = false; minY = Math.min(minY, sy); maxY = Math.max(maxY, sy); }
        if (ok) hi = d; else lo = d;
      }
      // recenter vertically
      const d = hi;
      this.camera.position.set(0, Math.sin(pitch) * d, zc + Math.cos(pitch) * d); this.camera.lookAt(0, 0, zc); this.camera.updateMatrixWorld();
      let minY = 1e9, maxY = -1e9; for (const c of corners) { v.set(...c).project(this.camera); const sy = (1 - v.y) / 2 * this.h; minY = Math.min(minY, sy); maxY = Math.max(maxY, sy); }
      const mid = (minY + maxY) / 2, want = (insTop + this.h - insBot) / 2;
      zc += (mid - want) / this.h * GH * 0.9;
    }
    this.camDist = hi;
  }
  pick(clientX, clientY) {
    const v = new THREE.Vector2(clientX / this.w * 2 - 1, -(clientY / this.h) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const p = new THREE.Vector3(); if (!this.ray.ray.intersectPlane(this.plane, p)) return null;
    const cx = Math.round(p.x + (GW - 1) / 2), cy = Math.round(p.z + (GH - 1) / 2);
    return { x: p.x, z: p.z, cx, cy, inGrid: cx >= 0 && cy >= 0 && cx < GW && cy < GH };
  }
  toScreen(x, y, z) { const v = new THREE.Vector3(x, y, z).project(this.camera); return [(v.x + 1) / 2 * this.w, (1 - v.y) / 2 * this.h]; }

  // ---------------- menu / planet scene ----------------
  buildMenuScene() {
    const g = new THREE.Group(); this.menu = g;
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const c = cv.getContext('2d');
    const r = rng(42);
    c.fillStyle = '#1d4a6a'; c.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 60; i++) { c.fillStyle = ['#3c7a3a', '#5a8a3c', '#9a8a5a', '#2e6a4a', '#c8b88a'][Math.floor(r() * 5)]; c.globalAlpha = 0.8; c.beginPath(); const x = r() * 1024, y = 80 + r() * 352; for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28, rr = 20 + r() * 50; c.lineTo(x + Math.cos(a) * rr * 1.5, y + Math.sin(a) * rr); } c.fill(); }
    c.globalAlpha = 0.9; c.fillStyle = '#e8f0f8'; c.fillRect(0, 0, 1024, 30); c.fillRect(0, 482, 1024, 30);
    for (let i = 0; i < 200; i++) { c.globalAlpha = 0.15; c.fillStyle = '#fff'; c.beginPath(); c.ellipse(r() * 1024, r() * 512, 30 + r() * 60, 4 + r() * 6, 0, 0, 7); c.fill(); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const planet = new THREE.Mesh(new THREE.SphereGeometry(3, 64, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    planet.position.set(1.8, -1.2, 0); g.add(planet); this.planet = planet;
    const atm = new THREE.Mesh(new THREE.SphereGeometry(3.25, 48, 32), new THREE.MeshBasicMaterial({ color: 0x60e0ff, transparent: true, opacity: 0.18, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
    atm.position.copy(planet.position); g.add(atm);
    const sp = new Float32Array(1800 * 3); for (let i = 0; i < 1800; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + Math.random() * 40); sp.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, sizeAttenuation: true })));
    this.ships = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Group(); const m = mat('ship', { color: 0xa0a8b4, metalness: 0.5, roughness: 0.4 });
      s.add(mesh('box', m, 0.9, 0.12, 0.3)); s.add(mesh('box', m, 0.3, 0.2, 0.2, -0.1, 0.12, 0)); s.add(mesh('sph', mat('engine', { color: 0x60e0ff, emissive: 0x60e0ff, emissiveIntensity: 2 }), 0.1, 0.1, 0.1, -0.48, 0, 0));
      s.position.set(-2 + i * 1.6, 1.5 - i * 1.4, 1 + i); s.scale.setScalar(0.6 + i * 0.2); g.add(s); this.ships.push(s);
    }
  }
  showMenu() {
    this.inBattle = false; this.level.visible = false; this.dyn.visible = false;
    if (!this.menu.parent) this.scene.add(this.menu);
    this.scene.background = new THREE.Color(0x050a12); this.scene.fog = null;
    this.menuCam();
    this.sun.position.set(-6, 4, 8);
  }
  menuCam() {
    const a = this.w / this.h, port = a < 1;
    const d = port ? 7.2 / a : 9;
    this.camera.position.set(0, 0, d); this.camera.lookAt(0, 0, 0);
    if (this.planet) { const py = port ? -d * 0.2 : -1.2; this.planet.position.set(port ? 0.6 : 1.8, py, 0); this.planet.parent.children[1].position.copy(this.planet.position); }
    this.ships.forEach((s, i) => { s.position.y = (port ? d * 0.26 : 1.5) - i * (port ? d * 0.06 : 1.4); s.userData.y0 = s.position.y; });
  }

  // ---------------- level ----------------
  setLevel(game) {
    this.g = game; this.inBattle = true;
    if (this.menu.parent) this.scene.remove(this.menu);
    this.level.visible = true; this.dyn.visible = true;
    const L = game.L, B = BIOMES[L.biome]; this.B = B;
    for (const m of [this.tmap, this.emap, this.pmap, this.cmap, this.omap, this.bmap, this.mmap]) { for (const o of m.values()) this.dyn.remove(o); m.clear(); }
    this.level.clear(); this.dyn.clear(); this.effects = [];
    this.dyn.add(this.points); this.dyn.add(this.points2);
    this.scene.background = new THREE.Color(B.sky);
    this.scene.fog = new THREE.Fog(B.fog, 30, 70);
    this.hemi.color.set(B.amb); this.sun.color.set(B.light);
    this.sun.position.set(-6, 14, 5);
    const tex = paintGround(L, B);
    const gw = GW + 2 * M, gh = GH + 2 * M;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.level.add(ground);
    // skirt cliff for depth
    const cliff = new THREE.Mesh(new THREE.BoxGeometry(gw, 3, gh), mat('cliff' + L.biome, { color: new THREE.Color(B.edge) }));
    cliff.position.y = -1.51; this.level.add(cliff);
    const r = rng(L.seed + 9);
    // water/hazard planes
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const v = L.grid[y * GW + x];
      if (v === C.WATER || v === C.HAZARD) {
        const col = v === C.WATER ? new THREE.Color(B.water) : new THREE.Color(B.haz);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: v === C.HAZARD ? (L.biome === 'forge' ? 1.4 : 0.5) : 0.25, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85 }));
        m.rotation.x = -Math.PI / 2; m.position.set(cellX(x), 0.02, cellZ(y)); m.userData.water = true; this.level.add(m);
      } else if (v === C.ROCK) {
        const d = decoMesh(B.deco, B, r); d.position.set(cellX(x), 0, cellZ(y)); this.level.add(d);
      } else if (v === C.DEPOSIT) {
        const cr = mesh('oct', mat('dep', { color: 0xfff0b0, emissive: 0xffd070, emissiveIntensity: 1.2 }), 0.14, 0.26, 0.14, cellX(x) + 0.25, 0.13, cellZ(y) - 0.22); this.level.add(cr);
      }
    }
    // margin decoration
    for (let i = 0; i < 70; i++) {
      const x = -GW / 2 - M + r() * (GW + 2 * M), z = -GH / 2 - M + r() * (GH + 2 * M);
      if (x > -GW / 2 - 0.2 && x < GW / 2 + 0.2 && z > -GH / 2 - 0.2 && z < GH / 2 + 0.2) continue;
      const d = decoMesh(B.deco, B, r, 1.2); d.position.set(x, 0, z); this.level.add(d);
    }
    this.buildBase(L, B);
    this.fit();
    // selection helpers
    this.rangeRing = new THREE.Group();
    const rr = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), new THREE.MeshBasicMaterial({ color: 0x80ff60, transparent: true, opacity: 0.9, depthWrite: false }));
    const rf = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: 0x60ff40, transparent: true, opacity: 0.16, depthWrite: false }));
    rr.rotation.x = rf.rotation.x = -Math.PI / 2; this.rangeRing.add(rr); this.rangeRing.add(rf); this.rangeRing.position.y = 0.04; this.rangeRing.visible = false; this.level.add(this.rangeRing);
    this.cellHL = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), new THREE.MeshBasicMaterial({ color: 0xffe060, transparent: true, opacity: 0.45, depthWrite: false }));
    this.cellHL.rotation.x = -Math.PI / 2; this.cellHL.position.y = 0.05; this.cellHL.visible = false; this.level.add(this.cellHL);
    this.validHL = new THREE.Group(); this.level.add(this.validHL);
    this.pathHL = new THREE.Group(); this.level.add(this.pathHL);
  }
  buildBase(L, B) {
    const g = new THREE.Group();
    const stone = mat('bstone', { color: 0x585c62, metalness: 0.3 }), gold = mat('bgold', { color: 0xe0a020, emissive: 0x603000, metalness: 0.6, roughness: 0.4 });
    const glow = mat('bglow', { color: 0x60f0ff, emissive: 0x30d0ff, emissiveIntensity: 1.3, roughness: 0.2 });
    g.add(mesh('box', stone, 2.9, 0.3, 1.9, 0, 0.15, 0));
    g.add(mesh('box', stone, 1.3, 0.9, 1.2, 0, 0.75, -0.2));
    g.add(mesh('box', gold, 1.34, 0.08, 1.24, 0, 0.6, -0.2));
    g.add(mesh('box', mat('bdoor', { color: 0x1a1c20 }), 0.5, 0.6, 0.1, 0, 0.6, 0.42));
    for (const sx of [-1, 1]) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x70f4ff, emissive: 0x20b0e0, emissiveIntensity: 0.45, transparent: true, opacity: 0.85, roughness: 0.1 }));
      dome.position.set(sx * 0.95, 0.3, -0.1); g.add(dome);
      g.add(mesh('cyl', stone, 0.9, 0.12, 0.9, sx * 0.95, 0.3, -0.1));
      g.add(mesh('box', gold, 0.1, 0.5, 0.1, sx * 0.6, 0.55, 0.45));
    }
    const top = mesh('oct', glow, 0.3, 0.6, 0.3, 0, 1.55, -0.2); top.castShadow = false; g.add(top); this.baseCrystal = top;
    for (let i = 0; i < 4; i++) { const c = mesh('oct', glow, 0.12, 0.35, 0.12, -0.55 + (i % 2) * 1.1, 1.25, -0.7 + Math.floor(i / 2) * 0.95); c.castShadow = false; g.add(c); }
    // energy dome (meta)
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1.7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x60e0ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    shield.visible = false; g.add(shield); this.shield = shield;
    if (this.g.bgun) {
      const tg = new THREE.Group(); tg.position.set(0, 1.2, 0.3);
      tg.add(mesh('box', stone, 0.3, 0.2, 0.3)); const b = mesh('cyl', mat('barrel', { color: 0x22262a }), 0.06, 0.4, 0.06, 0, 0, 0.25); b.rotation.x = Math.PI / 2; tg.add(b);
      g.add(tg); this.baseGun = tg;
    } else this.baseGun = null;
    g.position.set(cellX(L.base[0]), 0, cellZ(0.5));
    this.level.add(g); this.baseGroup = g;
  }
  showRange(x, z, r) { if (r == null) { this.rangeRing.visible = false; return; } this.rangeRing.visible = true; this.rangeRing.position.set(x, 0.04, z); this.rangeRing.scale.set(r, 1, r); }
  showCell(cx, cy, color = 0xffe060) { if (cx == null) { this.cellHL.visible = false; return; } this.cellHL.visible = true; this.cellHL.material.color.set(color); this.cellHL.position.set(cellX(cx), 0.05, cellZ(cy)); }
  showValid(cells, color = 0x80ff80) {
    this.validHL.clear();
    if (!cells) return;
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false });
    for (const [cx, cy] of cells) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), m); p.rotation.x = -Math.PI / 2; p.position.set(cellX(cx), 0.045, cellZ(cy)); this.validHL.add(p); }
  }
  showPathHL(on) {
    this.pathHL.clear(); if (!on) return;
    const m = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.25, depthWrite: false });
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (this.g.grid[y * GW + x] === C.PATH) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), m); p.rotation.x = -Math.PI / 2; p.position.set(cellX(x), 0.045, cellZ(y)); this.pathHL.add(p); }
  }

  // ---------------- particles ----------------
  initParticles() {
    const mk = (N, additive) => {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N);
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('size', new THREE.BufferAttribute(size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { scale: { value: 300 } },
        vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/(-mv.z); gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard; float a=smoothstep(0.5,0.1,r)*vA; gl_FragColor=vec4(vC,a); }',
      });
      const p = new THREE.Points(g, m); p.frustumCulled = false;
      return { p, N, pos, col, size, alpha, v: new Float32Array(N * 3), life: new Float32Array(N), max: new Float32Array(N), s0: new Float32Array(N), grow: new Float32Array(N), grav: new Float32Array(N), next: 0 };
    };
    this.P1 = mk(900, true); this.P2 = mk(400, false);
    this.points = this.P1.p; this.points2 = this.P2.p;
  }
  emit(P, x, y, z, vx, vy, vz, color, size, life, grow = 0, grav = 0) {
    const i = P.next; P.next = (P.next + 1) % P.N;
    P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z;
    P.v[i * 3] = vx; P.v[i * 3 + 1] = vy; P.v[i * 3 + 2] = vz;
    const c = new THREE.Color(color); P.col[i * 3] = c.r; P.col[i * 3 + 1] = c.g; P.col[i * 3 + 2] = c.b;
    P.life[i] = life; P.max[i] = life; P.s0[i] = size; P.grow[i] = grow; P.grav[i] = grav;
  }
  burst(x, y, z, color, n, speed, size, life, opts = {}) {
    const q = this.quality >= 2 ? 1 : 0.5;
    for (let i = 0; i < n * q; i++) {
      const a = Math.random() * 6.28, u = Math.random() * 2 - 1, s = speed * (0.4 + Math.random() * 0.6);
      const k = Math.sqrt(1 - u * u);
      this.emit(this.P1, x, y, z, Math.cos(a) * k * s, Math.abs(u) * s * (opts.up ?? 1), Math.sin(a) * k * s, color, size * (0.6 + Math.random() * 0.6), life * (0.6 + Math.random() * 0.6), opts.grow || 0, opts.grav ?? 4);
    }
  }
  smoke(x, y, z, n, color = 0x2a2a2a, size = 0.5) {
    for (let i = 0; i < n; i++) this.emit(this.P2, x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6, color, size, 0.9 + Math.random() * 0.6, 0.8, -0.2);
  }
  stepParticles(dt) {
    for (const P of [this.P1, this.P2]) {
      for (let i = 0; i < P.N; i++) {
        if (P.life[i] <= 0) { P.alpha[i] = 0; continue; }
        P.life[i] -= dt;
        const k = Math.max(0, P.life[i] / P.max[i]);
        P.v[i * 3 + 1] -= P.grav[i] * dt;
        P.pos[i * 3] += P.v[i * 3] * dt; P.pos[i * 3 + 1] += P.v[i * 3 + 1] * dt; P.pos[i * 3 + 2] += P.v[i * 3 + 2] * dt;
        if (P.pos[i * 3 + 1] < 0.02) { P.pos[i * 3 + 1] = 0.02; P.v[i * 3 + 1] *= -0.3; }
        P.size[i] = P.s0[i] * (1 + P.grow[i] * (1 - k));
        P.alpha[i] = P === this.P2 ? k * 0.55 : k;
      }
      const g = P.p.geometry;
      g.attributes.position.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.alpha.needsUpdate = true; g.attributes.color.needsUpdate = true;
    }
    const s = this.h / (2 * Math.tan(this.camera.fov * Math.PI / 360));
    this.P1.p.material.uniforms.scale.value = s * 0.5; this.P2.p.material.uniforms.scale.value = s * 0.5;
  }
  ring(x, z, r, color, life = 0.45, y = 0.08) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); this.dyn.add(m);
    this.effects.push({ o: m, t: 0, life, upd: (e, k) => { const s = r * (0.3 + 0.7 * Math.sqrt(k)); m.scale.set(s, s, s); m.material.opacity = 0.9 * (1 - k); } });
  }
  beamFx(pts, color, life, width = 0.05, jitter = 0) {
    const positions = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay, az] = pts[i], [bx, by, bz] = pts[i + 1];
      const segs = jitter ? 6 : 1;
      let px = ax, py = ay, pz = az;
      for (let s = 1; s <= segs; s++) {
        const k = s / segs; let nx = ax + (bx - ax) * k, ny = ay + (by - ay) * k, nz = az + (bz - az) * k;
        if (s < segs && jitter) { nx += (Math.random() - 0.5) * jitter; ny += (Math.random() - 0.5) * jitter; nz += (Math.random() - 0.5) * jitter; }
        positions.push(px, py, pz, nx, ny, nz); px = nx; py = ny; pz = nz;
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.dyn.add(l);
    this.effects.push({ o: l, t: 0, life, upd: (e, k) => { l.material.opacity = 1 - k; } });
  }
  pillar(x, z, color, life, radius = 0.25, height = 14) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, height / 2, z); this.dyn.add(m);
    this.effects.push({ o: m, t: 0, life, upd: (e, k) => { m.material.opacity = 0.9 * (1 - k); m.scale.set(1 + k, 1, 1 + k); } });
  }
  consumeFx(game, ui) {
    for (const f of game.fx) {
      switch (f.t) {
        case 'muzzle': {
          const col = { gun: 0xffd060, missile: 0xff8040, naval: 0xffc080, destroyer: 0xff4040, energy: 0x80ff80 }[f.k] || 0xffe080;
          const y = f.k === 'energy' ? 0.9 : 0.42;
          this.burst(f.x + Math.sin(f.a) * 0.25, y + (f.base ? 0.6 : 0), f.z + Math.cos(f.a) * 0.25, col, f.k === 'gun' ? 3 : 6, 1.5, f.k === 'gun' ? 0.18 : 0.3, 0.12, { grav: 0 });
          if (f.k === 'naval' || f.k === 'destroyer' || f.k === 'missile') this.smoke(f.x, 0.5, f.z, 2, 0x555555, 0.35);
          const tm = this.tmap.get(f.tid); if (tm) tm.userData.recoil = 1;
          break;
        }
        case 'boom': {
          const col = f.c ?? 0xffa040;
          this.burst(f.x, 0.3, f.z, col, 10 + f.r * 14, 2.5 + f.r * 2, 0.35 + f.r * 0.2, 0.45, { grav: 3 });
          this.ring(f.x, f.z, f.r * 1.1, col, 0.4);
          if (f.k !== 'lob') this.smoke(f.x, 0.3, f.z, 3 + Math.round(f.r * 3), 0x333333, 0.5);
          break;
        }
        case 'hit': this.burst(f.x, 0.4, f.z, f.k === 'bolt' ? 0xff5050 : 0xffe080, 3, 1.5, 0.15, 0.2, { grav: 2 }); break;
        case 'die': {
          const c = f.race === 'rust' ? 0xff8040 : 0x60ffd0;
          const big = f.type === 'boss' ? 3 : f.type === 'brute' || f.type === 'tank' ? 1.6 : 1;
          this.burst(f.x, f.air ? 0.95 : 0.35, f.z, c, 10 * big, 2.5 * big, 0.3 * big, 0.5, { grav: 5 });
          this.smoke(f.x, 0.3, f.z, Math.round(2 * big), f.race === 'rust' ? 0x2a2420 : 0x4a8a80, 0.4 * big);
          if (big > 1) this.ring(f.x, f.z, 1.2 * big, c, 0.5);
          if (ui) ui.floatText(f.x, 0.8, f.z, '+' + f.g, 'gold');
          break;
        }
        case 'bossdie': this.ring(f.x, f.z, 4, 0xffffff, 0.8); this.shake = 0.6; break;
        case 'dmg': if (ui) ui.floatText(f.x, 1.0, f.z, f.v, f.crit ? 'crit' : 'dmg'); break;
        case 'chain': this.beamFx(f.pts.map(([x, z], i) => [x, i === 0 ? 1.1 : 0.45, z]), 0xc080ff, 0.16, 0.05, 0.35); this.beamFx(f.pts.map(([x, z], i) => [x, i === 0 ? 1.1 : 0.45, z]), 0xffffff, 0.1, 0.05, 0.2); for (const [x, z] of f.pts.slice(1)) this.burst(x, 0.45, z, 0xc080ff, 3, 1.2, 0.2, 0.2, { grav: 0 }); break;
        case 'strike': this.pillar(f.x, f.z, 0xff6040, 0.7, 0.5); this.pillar(f.x, f.z, 0xffffff, 0.4, 0.2); this.ring(f.x, f.z, f.r * 1.3, 0xff8040, 0.7); this.burst(f.x, 0.3, f.z, 0xffa040, 50, 5, 0.5, 0.7); this.smoke(f.x, 0.3, f.z, 10, 0x333333, 0.8); this.shake = 0.5; break;
        case 'strikeMark': { const m = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.7, 40), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(f.x, 0.06, f.z); this.dyn.add(m); this.effects.push({ o: m, t: 0, life: 1.1, upd: (e, k) => { m.material.opacity = 0.5 + 0.5 * Math.sin(k * 30); m.rotation.z = k * 4; } }); this.pillar(f.x, f.z, 0xff4020, 1.1, 0.04); break; }
        case 'freeze': for (const e of game.enemies) this.burst(e.x, 0.5, e.z, 0xa0e8ff, 6, 1.5, 0.25, 0.6, { grav: 0 }); this.flash = { c: '#9fe8ff', a: 0.35 }; break;
        case 'build': this.ring(f.x, f.z, 0.8, 0xffe080, 0.4); this.smoke(f.x, 0.1, f.z, 5, 0x8a7a60, 0.4); break;
        case 'upgrade': this.ring(f.x, f.z, 0.9, 0x80ff80, 0.5); this.burst(f.x, 0.4, f.z, 0x80ff80, 14, 2, 0.2, 0.5, { grav: -1 }); break;
        case 'sell': this.smoke(f.x, 0.2, f.z, 6, 0x8a7a60, 0.5); if (ui) ui.floatText(f.x, 0.8, f.z, '+' + f.v, 'gold'); break;
        case 'coin': this.burst(f.x, 0.5, f.z, 0xffd040, 8, 1.6, 0.2, 0.4, { grav: 2 }); if (ui) ui.floatText(f.x, 0.9, f.z, '+' + f.v, 'gold'); break;
        case 'coinSpawn': this.burst(f.x, 0.9, f.z, 0xfff0a0, 6, 1.2, 0.2, 0.4, { grav: 3 }); break;
        case 'cleared': this.burst(f.x, 0.4, f.z, 0xffa040, 24, 3, 0.35, 0.6); this.smoke(f.x, 0.3, f.z, 8, 0x5a4a3a, 0.6); if (ui) ui.floatText(f.x, 1.0, f.z, `+${f.g} +1◆`, 'gold'); break;
        case 'leak': this.shake = 0.25; this.flash = { c: '#ff2020', a: 0.25 }; if (this.baseGroup) this.burst(this.baseGroup.position.x, 0.8, this.baseGroup.position.z, 0xff4030, 12, 2.5, 0.3, 0.5); break;
        case 'dome': this.ring(this.baseGroup.position.x, this.baseGroup.position.z, 2, 0x60e0ff, 0.6); break;
      }
    }
  }

  // ---------------- per-frame sync ----------------
  frame(dt, game, ui, sel) {
    this.time += dt;
    if (!this.inBattle) {
      if (this.planet) this.planet.rotation.y += dt * 0.05;
      this.ships.forEach((s, i) => { s.position.x += dt * (0.25 + i * 0.1); if (s.position.x > 6) s.position.x = -6; s.position.y += Math.sin(this.time + i) * 0.002; });
      this.render(dt); return;
    }
    const g = game;
    this.consumeFx(g, ui);
    // towers
    const seen = new Set();
    for (const t of g.towers) {
      seen.add(t.id);
      let m = this.tmap.get(t.id);
      const key = t.lvl + ':' + t.branch;
      if (!m || m.userData.key !== key) {
        if (m) this.dyn.remove(m);
        m = towerMesh(t, this.B); m.userData.key = key; m.position.set(t.x, 0, t.z); this.dyn.add(m); this.tmap.set(t.id, m);
        if (!m.userData.born) { m.userData.born = this.time; }
      }
      const a = m.userData.anim;
      const age = this.time - m.userData.born; const sc = age < 0.25 ? 0.4 + age / 0.25 * 0.6 : 1; m.scale.setScalar(sc);
      if (!a.noAim) a.head.rotation.y += ((t.aim - a.head.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 15);
      const firing = t.target != null;
      for (const s of a.spin) { if (s.isGroup && t.kind === 'gun') s.rotation.z += dt * (firing ? 30 : 2); else s.rotation.y += dt * (firing ? 3 : 1); }
      if (a.float) for (const s of a.spin) s.position.y = 0.6 + Math.sin(this.time * 2 + t.id) * 0.05;
      if (a.bob) m.position.y = Math.sin(this.time * 1.5 + t.id) * 0.03;
      if (a.column) { a.column.material.opacity = 0.18 + 0.2 * (1 - (t.coinT || 0) / 14); a.column.scale.y = 0.6 + 0.6 * (1 - (t.coinT || 0) / 14); }
      if (m.userData.recoil) { m.userData.recoil = Math.max(0, m.userData.recoil - dt * 8); a.head.position.z = -Math.cos(0) * 0.05 * m.userData.recoil; }
      // cryo beams
      if (t.kind === 'cryo' && t.beams.length) {
        let last = [t.x, 0.95, t.z];
        for (const id of t.beams) { const e = g.enemies.find(o => o.id === id); if (!e) continue; const p = [e.x, e.air ? 0.95 : 0.4, e.z]; this.beamFx([last, p], 0x80e0ff, 0.05); if (Math.random() < 0.3) this.burst(p[0], p[1], p[2], 0xc0f0ff, 1, 0.8, 0.18, 0.3, { grav: 0 }); last = p; }
      }
    }
    for (const [id, m] of this.tmap) if (!seen.has(id)) { this.dyn.remove(m); this.tmap.delete(id); }
    // enemies
    const es = new Set();
    for (const e of g.enemies) {
      es.add(e.id);
      let m = this.emap.get(e.id);
      if (!m) { m = enemyMesh(e.type, e.race); this.dyn.add(m); this.emap.set(e.id, m); }
      m.position.set(e.x, 0, e.z); m.rotation.y = e.rot;
      const u = m.userData;
      const moving = !e.blocked && g.freezeT <= 0;
      const ph = this.time * (e.type === 'swarm' ? 22 : 10) * (1 - e.slow) + e.id;
      u.legs.forEach((l, i) => { if (e.type === 'flyer') l.rotation.z = Math.sin(this.time * 14 + e.id) * 0.3; else if (moving) l.rotation.x = Math.sin(ph + i * Math.PI) * 0.6; });
      if (e.type === 'flyer') u.inner.position.y = 0.95 + Math.sin(this.time * 3 + e.id) * 0.08;
      else u.inner.position.y = moving ? Math.abs(Math.sin(ph)) * 0.03 : 0;
      if (e.hitT > 0) u.body.emissive.setRGB(0.9, 0.9, 0.9); else if (e.slow > 0 || g.freezeT > 0) u.body.emissive.setRGB(0.15, 0.35, 0.6); else u.body.emissive.copy(u.baseEm);
      const f = Math.max(0, e.hp / e.maxHp);
      u.hb.visible = f < 0.999; if (u.hb.visible) { u.fg.scale.x = Math.max(0.01, f); u.fg.position.x = -0.24 * (1 - f); u.fg.material.color.setHSL(f * 0.33, 0.9, 0.5); u.hb.quaternion.copy(this.camera.quaternion); u.hb.rotation.y -= 0; }
      if (u.hb.visible) { u.hb.parent === m && (u.hb.quaternion.copy(m.quaternion.clone().invert().multiply(this.camera.quaternion))); }
      if (e.hasted && Math.random() < 0.1) this.burst(e.x, 0.3, e.z, 0xff3030, 1, 0.5, 0.15, 0.3, { grav: -1 });
    }
    for (const [id, m] of this.emap) if (!es.has(id)) { this.dyn.remove(m); this.emap.delete(id); }
    // projectiles
    const ps = new Set();
    for (const p of g.proj) {
      ps.add(p.id);
      let m = this.pmap.get(p.id);
      if (!m) {
        const def = { bullet: [0.07, 0xffe070, 'sph'], lob: [0.22, 0x70ff70, 'ico'], missile: [0.09, 0xff7030, 'cyl'], shell: [0.14, 0xffc080, 'sph'], bolt: [0.1, 0xff4040, 'box'] }[p.kind];
        m = mesh(def[2], new THREE.MeshBasicMaterial({ color: def[1] }), def[0], def[0], p.kind === 'bolt' ? 0.5 : p.kind === 'bullet' ? def[0] * 3 : def[0]);
        if (p.kind === 'missile') m.scale.set(0.07, 0.3, 0.07);
        m.castShadow = false; this.dyn.add(m); this.pmap.set(p.id, m);
      }
      const y = p.y ?? 0.5;
      const prev = m.position.clone();
      m.position.set(p.x, y, p.z);
      if (p.kind === 'bullet' || p.kind === 'bolt') m.lookAt(p.tx, y, p.tz);
      if (p.kind === 'missile') { m.lookAt(prev); m.rotateX(Math.PI / 2); if (this.quality >= 2 || Math.random() < 0.5) { this.emit(this.P2, p.x, y, p.z, 0, 0.2, 0, 0x777777, 0.22, 0.6, 1.5, -0.2); this.emit(this.P1, p.x, y, p.z, 0, 0, 0, 0xffa040, 0.18, 0.15, 0, 0); } }
      if (p.kind === 'lob') { m.rotation.x += dt * 8; if (Math.random() < 0.6) this.emit(this.P1, p.x, y, p.z, 0, 0, 0, 0x60ff60, 0.25, 0.25, 0, 0); }
    }
    for (const [id, m] of this.pmap) if (!ps.has(id)) { this.dyn.remove(m); this.pmap.delete(id); }
    // coins
    const cs = new Set();
    for (const c of g.coins) {
      cs.add(c.id);
      let m = this.cmap.get(c.id);
      if (!m) {
        m = new THREE.Group();
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), mat('coin', { color: 0xffc020, emissive: 0xc08000, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.3 }));
        coin.rotation.x = Math.PI / 2; m.add(coin);
        const glow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.rotation.x = -Math.PI / 2; glow.position.y = -0.5; m.add(glow);
        this.dyn.add(m); this.cmap.set(c.id, m);
      }
      m.position.set(c.x, 0.65 + Math.sin(this.time * 4 + c.id) * 0.08, c.z); m.children[0].rotation.z = this.time * 3;
      const fade = c.life - c.t < 3 ? (Math.sin(this.time * 20) > 0 ? 1 : 0.3) : 1; m.visible = fade > 0.5 || c.life - c.t > 3;
    }
    for (const [id, m] of this.cmap) if (!cs.has(id)) { this.dyn.remove(m); this.cmap.delete(id); }
    // objects (targets/beacons)
    const os = new Set();
    for (const o of g.objects) {
      os.add(o.id);
      let m = this.omap.get(o.id);
      if (!m) {
        m = new THREE.Group();
        if (o.kind === 'target') {
          m.add(mesh('dod', mat('relic', { color: 0x6a5a48 }), 0.8, 0.6, 0.7, 0, 0.28, 0));
          m.add(mesh('dod', mat('relic', { color: 0x6a5a48 }), 0.45, 0.4, 0.4, 0.25, 0.5, -0.1));
          m.add(mesh('box', mat('rune', { color: 0x60e0ff, emissive: 0x30c0ff, emissiveIntensity: 1 }), 0.3, 0.05, 0.05, 0, 0.45, 0.33));
        } else {
          m.add(mesh('cyl', mat('totem', { color: 0x3a2a2a }), 0.22, 1.0, 0.22, 0, 0.5, 0));
          m.add(mesh('box', mat('totem', { color: 0x3a2a2a }), 0.6, 0.08, 0.12, 0, 0.8, 0));
          const orb = mesh('sph', mat('beaconorb', { color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 1.5 }), 0.25, 0.25, 0.25, 0, 1.15, 0); orb.castShadow = false; m.add(orb); m.userData.orb = orb;
          const aura = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.2, 48), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.25, depthWrite: false })); aura.rotation.x = -Math.PI / 2; aura.position.y = 0.04; m.add(aura); m.userData.aura = aura;
        }
        // crosshair
        const ch = new THREE.Group();
        const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false });
        const ringm = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.27, 32), cm); ch.add(ringm);
        for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.16), cm); const a = i * Math.PI / 2; b.position.set(Math.sin(a) * 0.33, Math.cos(a) * 0.33, 0); b.rotation.z = -a; ch.add(b); }
        ch.position.y = o.kind === 'beacon' ? 1.6 : 1.0; ch.renderOrder = 20; ch.children.forEach(c => c.renderOrder = 20); m.add(ch); m.userData.ch = ch;
        m.position.set(o.x, 0, o.z); this.dyn.add(m); this.omap.set(o.id, m);
      }
      m.userData.ch.quaternion.copy(this.camera.quaternion); m.userData.ch.scale.setScalar(1 + Math.sin(this.time * 4) * 0.08);
      if (m.userData.orb) { m.userData.orb.position.y = 1.15 + Math.sin(this.time * 3) * 0.08; m.userData.aura.material.opacity = 0.15 + 0.12 * Math.sin(this.time * 4); }
    }
    for (const [id, m] of this.omap) if (!os.has(id)) { this.dyn.remove(m); this.omap.delete(id); }
    for (const L of g.lasers) if (!L.fxd) { L.fxd = true; this.pillar(L.x, L.z, 0xffa030, L.dur + 0.2, 0.08); this.pillar(L.x, L.z, 0xffffff, L.dur, 0.03); }
    for (const L of g.lasers) if (L.t < L.dur) this.burst(L.x, 0.4, L.z, 0xffc060, 2, 2, 0.2, 0.25);
    // blocks & mines
    const bs = new Set();
    for (const b of g.blocks) { bs.add(b.id); let m = this.bmap.get(b.id); if (!m) { m = new THREE.Group(); m.add(mesh('box', mat('concrete', { color: 0x9a9a94 }), 0.85, 0.5, 0.85, 0, 0.25, 0)); m.add(mesh('box', mat('stripe', { color: 0xf0c020 }), 0.87, 0.08, 0.87, 0, 0.42, 0)); m.position.set(b.x, 0, b.z); this.dyn.add(m); this.bmap.set(b.id, m); this.smoke(b.x, 0.1, b.z, 6, 0x9a9a94, 0.5); } m.scale.y = 0.4 + 0.6 * b.hp / b.maxHp; }
    for (const [id, m] of this.bmap) if (!bs.has(id)) { this.dyn.remove(m); this.bmap.delete(id); }
    const ms = new Set();
    for (const mi of g.mines) { ms.add(mi.id); let m = this.mmap.get(mi.id); if (!m) { m = new THREE.Group(); m.add(mesh('cyl', mat('mine', { color: 0x3a3a30 }), 0.3, 0.08, 0.3, 0, 0.04, 0)); const l = mesh('sph', mat('minel', { color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 }), 0.07, 0.07, 0.07, 0, 0.1, 0); m.add(l); m.userData.l = l; m.position.set(mi.x, 0, mi.z); this.dyn.add(m); this.mmap.set(mi.id, m); } m.userData.l.visible = Math.sin(this.time * 8 + mi.id) > 0; }
    for (const [id, m] of this.mmap) if (!ms.has(id)) { this.dyn.remove(m); this.mmap.delete(id); }
    // base
    if (this.baseCrystal) { this.baseCrystal.rotation.y += dt; this.baseCrystal.position.y = 1.55 + Math.sin(this.time * 2) * 0.06; }
    if (this.shield) { this.shield.visible = g.dome > 0; this.shield.material.opacity = 0.08 + 0.05 * Math.sin(this.time * 3); }
    if (this.baseGun && g.bgun) this.baseGun.rotation.y = g.bgun.aim;
    // water shimmer
    for (const c of this.level.children) if (c.userData.water) c.material.emissiveIntensity = (this.g.L.biome === 'forge' ? 1.2 : 0.22) + Math.sin(this.time * 2 + c.position.x * 2 + c.position.z) * (this.g.L.biome === 'forge' ? 0.4 : 0.08);
    // effects
    for (const e of this.effects) { e.t += dt; e.upd(e, Math.min(1, e.t / e.life)); if (e.t >= e.life) { this.dyn.remove(e.o); e.o.geometry && e.o.geometry.dispose(); e.dead = true; } }
    this.effects = this.effects.filter(e => !e.dead);
    this.stepParticles(dt);
    // screen shake
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt); const s = this.shake * 0.15; this.camera.position.x = (Math.random() - 0.5) * s; } else this.camera.position.x = 0;
    this.render(dt);
  }
  render(dt) {
    // adaptive quality
    this.fpsT += dt; this.fpsN++;
    if (this.fpsT > 2) {
      const fps = this.fpsN / this.fpsT; this.fpsT = 0; this.fpsN = 0;
      if (this.autoQ !== false) {
        if (fps < 38 && this.quality > 1) { this.lowCount++; if (this.lowCount >= 2) { this.setQuality(this.quality - 1); this.lowCount = 0; } } else this.lowCount = 0;
      }
      this.lastFps = fps;
    }
    if (this.quality >= 2) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
  }
}

// ---------------- portrait icons (rendered once at boot) ----------------
export function makeIcons(towerKinds, enemyTypes) {
  const S = 112;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  let r;
  try { r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true, alpha: false }); } catch (e) { return {}; }
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.setPixelRatio(1); r.setSize(S, S, false);
  const sc = new THREE.Scene();
  try { const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; sc.environmentIntensity = 0.8; } catch (e) { }
  r.toneMappingExposure = 1.25;
  sc.add(new THREE.HemisphereLight(0xdfe8ff, 0x403020, 2.2));
  const dl = new THREE.DirectionalLight(0xffffff, 3); dl.position.set(-2, 4, 3); sc.add(dl);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const out = {};
  const shot = (obj, bg, h, dist) => {
    sc.background = new THREE.Color(bg);
    sc.add(obj);
    cam.position.set(dist * 0.55, h + dist * 0.55, dist * 0.8); cam.lookAt(0, h * 0.55, 0);
    r.render(sc, cam);
    const url = cv.toDataURL('image/png');
    sc.remove(obj);
    return url;
  };
  const B = BIOMES.verdant;
  for (const k of towerKinds) {
    const lv = k === 'factory' ? 1 : 0;
    const m = towerMesh({ kind: k, lvl: lv, branch: -1, id: 1, x: 0, z: 0, coinT: 0, beams: [] }, B);
    m.rotation.y = -0.5;
    out['t_' + k] = shot(m, 0x3a4a58, 0.7, 2.2);
  }
  for (const [type, race] of enemyTypes) {
    const m = enemyMesh(type, race);
    if (m.userData.hb) m.userData.hb.visible = false;
    if (m.userData.fg) m.userData.fg.visible = false;
    m.rotation.y = 0.6;
    const big = type === 'boss' ? 2.4 : type === 'brute' ? 1.6 : type === 'tank' ? 1.3 : 1;
    const bg = race === 'rust' ? 0x3a2418 : 0x123a36;
    out['e_' + type + '_' + race] = shot(m, bg, (ENEMIES[type].air ? 0.9 : 0.35) * Math.min(big, 1.6), 1.6 * big);
  }
  r.dispose(); try { r.forceContextLoss(); } catch (e) { }
  return out;
}
