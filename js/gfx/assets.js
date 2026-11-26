// Licensed glTF assets (see CREDITS.md): Poly Haven photoscans (CC0), Quaternius animated enemies (CC0),
// tree impostors baked from Poly Haven trees. Geometry is meshopt-compressed, colour/ORM maps are KTX2 (Basis), normals WebP.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// name -> approx bytes (progress weighting only)
const DECO = {
  rock_07: 176, rock_09: 173, stone_01: 230, namaqualand_boulder_04: 204, namaqualand_boulder_05: 232, rock_moss_set_01: 167,
  moon_rock_01: 155, moon_rock_03: 131, moon_rock_05: 133, tree_stump_01: 272, dead_tree_trunk: 229, shrub_03: 212, fern_02: 150,
  quiver_tree_02: 258, dead_quiver_trunk: 178, old_military_crate: 179, barrel_03: 156, coast_rocks_01: 176,
};
const ENEMY = { e_rust_grunt: 103, e_rust_tank: 126, e_rust_flyer: 74, e_rust_brute: 95, e_spider: 131, e_glim_tank: 62, e_glim_brute: 159, e_glim_boss: 139, e_glim_flyer: 69 };

export const A = { ready: false, deco: {}, enemy: {}, trees: null };

function floatify(geo) {
  // KHR_mesh_quantization -> plain float attributes so instancing/merging/raycasts behave
  for (const k of Object.keys(geo.attributes)) {
    const a = geo.attributes[k];
    if (a.isInterleavedBufferAttribute || !(a.array instanceof Float32Array)) {
      const n = a.count, s = a.itemSize, out = new Float32Array(n * s);
      for (let i = 0; i < n; i++) for (let c = 0; c < s; c++) out[i * s + c] = a.getComponent ? a.getComponent(i, c) : [a.getX, a.getY, a.getZ, a.getW][c].call(a, i);
      geo.setAttribute(k, new THREE.BufferAttribute(out, s, false));
    }
  }
  return geo;
}

// deco model -> parts with geometry normalised to: centred in x/z, base at y=0, max horizontal extent = 1
function prepDeco(gltf) {
  const root = gltf.scene; root.updateMatrixWorld(true);
  const parts = []; const box = new THREE.Box3();
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = floatify(o.geometry.clone()); g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.computeBoundingBox(); box.union(g.boundingBox);
    const m = o.material; m.envMapIntensity = 0.9; m.vertexColors = false;
    for (const t of [m.map, m.normalMap, m.roughnessMap, m.aoMap]) if (t) t.anisotropy = 4;
    parts.push({ geo: g, mat: m });
  });
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()); const k = 1 / Math.max(s.x, s.z, 1e-3);
  for (const p of parts) { p.geo.translate(-c.x, -box.min.y, -c.z); p.geo.scale(k, k, k); p.geo.computeBoundingSphere(); }
  return { parts, h: s.y * k };
}

function prepEnemy(gltf) {
  const o = gltf.scene; o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o); const s = b.getSize(new THREE.Vector3());
  o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
  return { scene: o, clips: gltf.animations, size: s, minY: b.min.y };
}

export async function loadAssets(renderer, onProgress) {
  const ktx2 = new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/basis/').detectSupport(renderer);
  A.ktx2 = ktx2;
  const L = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2);
  const jobs = [...Object.entries(DECO).map(([n, kb]) => ['deco', n, kb]), ...Object.entries(ENEMY).map(([n, kb]) => ['enemy', n, kb]), ['trees', 'trees', 180]];
  const total = jobs.reduce((s, j) => s + j[2], 0); const got = {};
  const tick = () => onProgress && onProgress(Math.min(1, Object.values(got).reduce((s, v) => s + v, 0) / total));
  const one = async ([kind, name, kb]) => {
    try {
      if (kind === 'trees') {
        const [tex, meta] = await Promise.all([new THREE.TextureLoader().loadAsync('assets/trees/trees.webp'), fetch('assets/trees/trees.json').then(r => r.json())]);
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; A.trees = { tex, meta };
      } else {
        const g = await L.loadAsync(`assets/models/${name}.glb`, e => { if (e.total) { got[name] = kb * e.loaded / e.total; tick(); } });
        if (kind === 'deco') A.deco[name] = prepDeco(g); else A.enemy[name] = prepEnemy(g);
      }
    } catch (e) { console.warn('asset', name, e); }
    got[name] = kb; tick();
  };
  // a few at a time keeps mobile connections responsive
  const q = jobs.slice(); const workers = Array.from({ length: 4 }, async () => { while (q.length) await one(q.shift()); });
  await Promise.all(workers);
  A.ready = Object.keys(A.deco).length > 0;
  return A;
}

// ---------- instanced deco batches ----------
const tintC = new Map();
function tinted(mat, tint) {
  if (tint == null) return mat;
  const k = mat.uuid + ':' + tint; let m = tintC.get(k);
  if (!m) { m = mat.clone(); m.color = new THREE.Color(tint); tintC.set(k, m); }
  return m;
}
// spatial chunking: one InstancedMesh per CHUNK-sized tile, so frustum culling (camera and shadow camera) drops everything off screen
const CHUNK = 5;
const NOCAST = new Set(['fern_02', 'shrub_03', 'tree_stump_01', 'moon_rock_03', 'barrel_03']);
function chunked(list, posOf) {
  const m = new Map();
  for (const it of list) { const [x, z] = posOf(it); const k = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK); let a = m.get(k); if (!a) m.set(k, a = []); a.push(it); }
  return [...m.values()];
}
export class DecoBatch {
  constructor() { this.items = new Map(); }
  add(name, x, y, z, rotY, scale, tint = null, sy = 1) {
    if (!A.deco[name]) return false;
    const cast = !NOCAST.has(name) && scale * Math.max(1, sy) >= 0.5;
    const key = name + '|' + tint + '|' + cast; if (!this.items.has(key)) this.items.set(key, { name, tint, cast, list: [] });
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(scale, scale * sy, scale));
    this.items.get(key).list.push(m); return true;
  }
  build(parent, shadows = true) {
    const out = [];
    for (const { name, tint, cast, list: all } of this.items.values()) {
      for (const list of chunked(all, m => [m.elements[12], m.elements[14]])) {
        for (const p of A.deco[name].parts) {
          const im = new THREE.InstancedMesh(p.geo, tinted(p.mat, tint), list.length); im.name = 'deco:' + name;
          list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = shadows && cast; im.receiveShadow = true; im.computeBoundingSphere();
          parent.add(im); out.push(im);
        }
      }
    }
    return out;
  }
}
export const decoHeight = (name) => A.deco[name] ? A.deco[name].h : 0;

// ---------- tree impostors: camera-yaw is fixed, so a vertical card baked at the game's 48deg pitch reads as a full 3D tree ----------
let treeMat = null, treeDepth = null;
export function treeMaterials(uTime) {
  if (treeMat) return { treeMat, treeDepth };
  const tex = A.trees.tex;
  treeMat = new THREE.MeshStandardMaterial({ map: tex, color: new THREE.Color(0.66, 0.78, 0.5), alphaTest: 0.5, roughness: 1, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0 });
  const sway = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
#ifdef USE_INSTANCING
vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
#else
vec4 ip = vec4(0.0);
#endif
float hk = max(0.0, uv.y - 0.25); transformed.x += sin(uTime * 1.3 + ip.x * 0.7 + ip.z * 0.4) * 0.025 * hk * hk;`);
  };
  treeMat.onBeforeCompile = (sh) => {
    sway(sh);
    // flat card: light it like an up-facing surface (the bake already carries the self-shading)
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize((viewMatrix * vec4(0.15, 1.0, 0.35, 0.0)).xyz);');
  };
  treeDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  treeDepth.onBeforeCompile = sway;
  return { treeMat, treeDepth };
}
const cardGeo = new Map();
function treeCard(i) {
  if (cardGeo.has(i)) return cardGeo.get(i);
  const e = A.trees.meta[i];
  const g = new THREE.PlaneGeometry(e.w, e.h); g.translate(0, e.h / 2 - e.base * e.h, 0);
  const uv = g.attributes.uv; const u0 = e.col / e.cols, v0 = 1 - (e.row + 1) / e.rows;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) / e.cols, v0 + uv.getY(k) / e.rows);
  // normalise so the tree is 1 unit tall
  const s = 1 / e.H; g.scale(s, s, s);
  cardGeo.set(i, g); return g;
}
export const TREES = { pine: [0, 1, 2], fir: [3, 4, 5], broad: [6, 8], bush: [7], palm: [10] };
export class TreeBatch {
  constructor() { this.by = new Map(); }
  add(i, x, y, z, height, flip = false) {
    if (!A.trees) return false;
    if (!this.by.has(i)) this.by.set(i, []);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(flip ? -height : height, height, height));
    this.by.get(i).push(m); return true;
  }
  build(parent, uTime, shadows = true, tint = 0xffffff) {
    if (!A.trees) return;
    const tc = new THREE.Color(tint), c = new THREE.Color();
    const { treeMat, treeDepth } = treeMaterials(uTime);
    for (const [i, all] of this.by) {
      for (const list of chunked(all, m => [m.elements[12], m.elements[14]])) {
        const im = new THREE.InstancedMesh(treeCard(i), treeMat, list.length); im.customDepthMaterial = treeDepth; im.name = 'tree';
        list.forEach((m, k) => { im.setMatrixAt(k, m); im.setColorAt(k, c.copy(tc).multiplyScalar(0.85 + ((k * 7919) % 100) / 100 * 0.25)); });
        im.castShadow = shadows; im.receiveShadow = false; im.computeBoundingSphere();
        parent.add(im);
      }
    }
  }
}

// ---------- animated enemies ----------
const MAP = {
  rust: { grunt: 'e_rust_grunt', swarm: 'e_spider', tank: 'e_rust_tank', flyer: 'e_rust_flyer', brute: 'e_rust_brute', boss: 'e_rust_tank' },
  glim: { grunt: 'e_spider', swarm: 'e_spider', tank: 'e_glim_tank', flyer: 'e_glim_flyer', brute: 'e_glim_brute', boss: 'e_glim_boss' },
};
// target size in world units (before the renderer's global 1.35 enemy scale)
const SIZE = { grunt: 0.52, swarm: 0.3, tank: 0.62, flyer: 0.5, brute: 0.85, boss: 1.55 };
const CLIP = { ground: ['Walk', 'Run', 'Spider_Walk'], swarm: ['Run', 'Spider_Walk', 'Walk'], air: ['Fast_Flying', 'Flying_Idle', 'Run', 'Walk', 'Idle'] };
export const hasEnemyGLB = (type, race) => !!A.enemy[MAP[race === 'rust' ? 'rust' : 'glim'][type]];

function rimify(m, rim, k = 1) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: new THREE.Color(rim) }; sh.uniforms.uRimK = { value: k };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRim; uniform float uRimK;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float f = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.0); totalEmissiveRadiance += uRim * f * uRimK; }');
  };
  m.customProgramCacheKey = () => 'rim';
}
function enemyMats(src, race, type, P) {
  const R = race === 'rust';
  const n = (src.name || '').toLowerCase();
  const m = new THREE.MeshStandardMaterial({ color: src.color ? src.color.clone() : new THREE.Color(0xffffff), roughness: 0.4, metalness: 0.3, envMapIntensity: 1.0, map: src.map || null });
  const eye = n.includes('eye') && !n.includes('white') || n === 'eye';
  if (eye || n.includes('eye_white')) { m.color.set(P.acc); m.emissive = new THREE.Color(P.acc); m.emissiveIntensity = eye ? 2.4 : 1.4; m.roughness = 0.2; return m; }
  if (R) {
    if (n.includes('edge') || n.includes('dark') || n.includes('black') || n.includes('grey')) { m.color.multiplyScalar(0.55); m.metalness = 0.75; m.roughness = 0.35; }
    else if (n.includes('main') || n.startsWith('material')) {
      // re-paint the white/gold shells in the rust armour palette
      const l = m.color.getHSL({}).l; m.color.set(n.includes('main2') ? P.dark : P.body).multiplyScalar(0.6 + l * 0.6); m.metalness = 0.55; m.roughness = 0.38;
    } else { m.metalness = 0.6; m.roughness = 0.35; }
    if (type === 'boss') m.color.lerp(new THREE.Color(0x601010), 0.35);
    return m;
  }
  // glim: glassy teal crystal-flesh with a fresnel rim glow
  if (n.includes('black') || n.includes('dark') || n.includes('secondary') || n.includes('horn') || n === 'material.001') { m.color.set(P.dark); m.roughness = 0.25; m.metalness = 0.2; rimify(m, P.acc, 0.35); return m; }
  const l = m.color.getHSL({}).l;
  m.color.set(P.body).multiplyScalar(0.75 + l * 0.4); m.roughness = 0.18; m.metalness = 0.15; m.emissive = new THREE.Color(0x0a5a48); m.emissiveIntensity = 0.45;
  if (type === 'boss') m.color.lerp(new THREE.Color(0x60ff90), 0.25);
  rimify(m, 0x60ffe0, 0.9);
  return m;
}
export function glbEnemy(type, race, P) {
  const R = race === 'rust' ? 'rust' : 'glim'; const src = A.enemy[MAP[R][type]]; if (!src) return null;
  const model = SkeletonUtils.clone(src.scene);
  const air = type === 'flyer';
  const target = SIZE[type] || 0.5; const dim = air ? Math.max(src.size.x, src.size.z) : Math.max(src.size.y, src.size.x * 0.7);
  const k = target / dim; model.scale.setScalar(k); model.position.y = -src.minY * k;
  const mats = []; const cache = new Map();
  model.traverse(o => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const nl = list.map(s => { if (!cache.has(s)) { const m = enemyMats(s, R, type, P); cache.set(s, m); mats.push(m); } return cache.get(s); });
    o.material = Array.isArray(o.material) ? nl : nl[0];
  });
  const mixer = new THREE.AnimationMixer(model);
  const pick = (names) => { for (const nm of names) { const c = src.clips.find(c => c.name.split('|').pop() === nm); if (c) return c; } return src.clips[0]; };
  const walk = pick(type === 'swarm' ? CLIP.swarm : air ? CLIP.air : CLIP.ground);
  const act = walk ? mixer.clipAction(walk) : null; if (act) { act.play(); act.time = Math.random() * walk.duration; }
  const death = src.clips.find(c => /Death|Dead/.test(c.name));
  return { model, mixer, act, death, mats, k };
}

// ---------- PBR terrain layers (Poly Haven, CC0): <name>_c = albedo*AO + height(alpha), <name>_n = normal (X in RGB, Y in A) ----------
const terrCache = {};
function ktx(url, srgb) {
  return A.ktx2.loadAsync(url).then(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t; });
}
export function loadTerrainLayer(name) {
  if (!terrCache[name]) terrCache[name] = Promise.all([ktx(`assets/terrain/${name}_c.ktx2`, true), ktx(`assets/terrain/${name}_n.ktx2`, false)]).then(([c, n]) => ({ c, n }))
    .catch(e => { console.warn('terrain', name, e); delete terrCache[name]; return null; });
  return terrCache[name];
}
