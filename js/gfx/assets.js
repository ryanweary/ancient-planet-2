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
const ENEMY = { e_rust_grunt: 103, e_rust_tank: 126, e_rust_flyer: 74, e_rust_brute: 95, e_spider: 131, e_glim_tank: 62, e_glim_brute: 159, e_glim_boss: 139, e_glim_flyer: 69,
  e_mech_leela: 155, e_mech_stan: 265, e_mech_george: 310, e_mech_mike: 260, e_mon_slime: 60, e_mon_skeleton: 51, e_mon_bat: 256, e_mon_dragon: 260 };

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
        // strip lights/cameras baked into exported models: each clone would add lights to the scene, changing the light count and forcing every lit shader to recompile mid-wave
        const junk = []; g.scene.traverse(o => { if (o.isLight || o.isCamera) junk.push(o); }); for (const o of junk) o.removeFromParent();
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
  // Rustborn: textured, weathered walking mechs (Quaternius Animated Mech Pack) for the core infantry, older robots for the support units
  rust: { grunt: 'e_mech_leela', swarm: 'e_spider', tank: 'e_mech_stan', flyer: 'e_rust_flyer', brute: 'e_mech_george', boss: 'e_mech_mike', healer: 'e_rust_grunt', shield: 'e_rust_tank', splitter: 'e_rust_brute', phantom: 'e_mech_leela' },
  // Glimmerkin: crystal-flesh creatures; every type has its own body now
  glim: { grunt: 'e_mon_slime', swarm: 'e_spider', tank: 'e_glim_tank', flyer: 'e_mon_bat', brute: 'e_glim_brute', boss: 'e_glim_boss', healer: 'e_glim_flyer', shield: 'e_glim_tank', splitter: 'e_mon_dragon', phantom: 'e_mon_skeleton' },
};
// target size in world units (before the renderer's global 1.35 enemy scale)
const SIZE = { grunt: 0.52, swarm: 0.3, tank: 0.62, flyer: 0.5, brute: 0.85, boss: 1.55, healer: 0.5, shield: 0.68, splitter: 0.72, phantom: 0.52 };
// special enemies get a distinct body colour so they read instantly
const TINT = { healer: 0x60ff80, shield: 0x60a0ff, splitter: 0xe060ff, phantom: 0x8060c0 };
// per-model size correction: the mechs are tall and spindly (sizing by height shrinks their bodies), the slime is wide and low
const MSCALE = { e_mech_leela: 1.4, e_mech_stan: 1.35, e_mech_george: 1.35, e_mech_mike: 1.3, e_mon_slime: 0.62, e_mon_skeleton: 1.1, e_mon_dragon: 0.95, e_mon_bat: 1.05 };
const CLIP = { ground: ['Walk', 'Run', 'Spider_Walk', 'Slime_Walk', 'Skeleton_Running', 'Dragon_Flying', 'Fast_Flying', 'Flying_Idle'], swarm: ['Run', 'Spider_Walk', 'Walk'], air: ['Fast_Flying', 'Flying_Idle', 'Bat_Flying', 'Dragon_Flying', 'Run', 'Walk', 'Idle'] };
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
    if (src.map) {
      // hand-painted, weathered mech textures: keep the paint, rust and decals; warm them toward the Rustborn palette
      m.color.set(0xffffff).lerp(new THREE.Color(0xffb080), 0.18); m.metalness = 0.45; m.roughness = 0.55;
      if (type === 'boss') { m.color.lerp(new THREE.Color(0xff5030), 0.35); m.emissive = new THREE.Color(0x401008); m.emissiveIntensity = 1; }
      if (TINT[type]) { m.color.lerp(new THREE.Color(TINT[type]), 0.5); m.emissive = new THREE.Color(TINT[type]).multiplyScalar(0.2); m.emissiveIntensity = 1; }
      rimify(m, TINT[type] || 0xff8a30, 0.5);
      return m;
    }
    if (n.includes('edge') || n.includes('dark') || n.includes('black') || n.includes('grey')) { m.color.multiplyScalar(0.55); m.metalness = 0.75; m.roughness = 0.35; }
    else if (n.includes('main') || n.startsWith('material')) {
      // re-paint the white/gold shells in the rust armour palette
      const l = m.color.getHSL({}).l; m.color.set(n.includes('main2') ? P.dark : P.body).multiplyScalar(0.6 + l * 0.6); m.metalness = 0.55; m.roughness = 0.38;
    } else { m.metalness = 0.6; m.roughness = 0.35; }
    if (type === 'boss') m.color.lerp(new THREE.Color(0x601010), 0.35);
    if (TINT[type]) { m.color.lerp(new THREE.Color(TINT[type]), 0.55); m.emissive = new THREE.Color(TINT[type]).multiplyScalar(0.25); m.emissiveIntensity = 1; }
    rimify(m, TINT[type] || 0xff8a30, 0.55);
    return m;
  }
  // Glimmerkin: living crystal. Keep the model's own light/dark structure (belly, wings, claws read as different facets),
  // mapped onto a teal-to-mint crystal ramp, with an inner glow and a bright fresnel rim
  const l = m.color.getHSL({}, THREE.SRGBColorSpace).l;
  const deep = new THREE.Color(P.dark), mid = new THREE.Color(P.body), hi = new THREE.Color(0x70f0d0);
  const c = l < 0.25 ? deep.clone().lerp(mid, l / 0.25) : mid.clone().lerp(hi, Math.min(0.55, (l - 0.25) * 0.9));
  const tint = TINT[type] ? new THREE.Color(TINT[type]) : null;
  if (tint) c.lerp(tint, 0.5);
  if (type === 'boss') c.lerp(new THREE.Color(0x60ff90), 0.2);
  m.color.copy(c); m.map = null;
  const darkPart = l < 0.12 || n.includes('black') || n.includes('dark') || n.includes('claws') || n.includes('horn');
  m.roughness = darkPart ? 0.35 : 0.32; m.metalness = darkPart ? 0.35 : 0.15; m.envMapIntensity = 0.7;
  m.emissive = (tint || mid).clone().multiplyScalar(darkPart ? 0.08 : 0.22); m.emissiveIntensity = 1;
  rimify(m, tint ? tint.getHex() : 0x7affe8, darkPart ? 0.45 : 0.75);
  return m;
}
// Glimmerkin are living crystal: a cluster of glowing shards grows from the spine/head bone, so it rides the animation
const shardGeo = (() => { let g = null; return () => g || (g = new THREE.OctahedronGeometry(1, 0).scale(0.35, 1, 0.35)); })();
const shardMats = {};
function crystalize(model, type, k, P) {
  let bone = null, best = 1e9;
  const pref = [/spine|chest|torso|body/i, /head/i, /hips|root|pelvis/i];
  let first = null;
  model.traverse(o => { if (!o.isBone) return; if (!first) first = o; for (let i = 0; i < pref.length; i++) if (pref[i].test(o.name) && i < best) { best = i; bone = o; } });
  bone = bone || (first && (first.children.find(c => c.isBone) || first));
  if (!bone) return;
  const col = TINT[type] || (type === 'boss' ? 0x9fff70 : P.acc);
  const mat = shardMats[col] || (shardMats[col] = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.1, flatShading: true }));
  // bone space is in the model's original units: divide by the bone's world scale so shards come out a fixed world size
  model.updateMatrixWorld(true); const ws = new THREE.Vector3(); bone.getWorldScale(ws); const u = 1 / (Math.abs(ws.x) || 1);   // world scale already includes the model's fit scale
  const n = type === 'boss' ? 7 : type === 'brute' || type === 'tank' || type === 'shield' ? 5 : type === 'swarm' ? 2 : 4;
  const sz = Math.min(SIZE[type] || 0.5, 0.72) * 0.3 * u;   // capped: big bodies get more shards, not bigger ones
  const grp = new THREE.Group(); grp.name = 'shards';
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(shardGeo(), mat); const a = (i / n) * Math.PI * 2, r = sz * 0.6;
    m.position.set(Math.cos(a) * r, sz * (0.6 + (i % 2) * 0.3), Math.sin(a) * r - sz * 0.4);
    m.rotation.set(Math.sin(a) * 0.5 - 0.3, a, Math.cos(a) * 0.5);
    m.scale.setScalar(sz * (0.7 + ((i * 37) % 10) / 20)); m.castShadow = false; grp.add(m);
  }
  bone.add(grp);
}
export function glbEnemy(type, race, P) {
  const R = race === 'rust' ? 'rust' : 'glim'; const src = A.enemy[MAP[R][type]]; if (!src) return null;
  const model = SkeletonUtils.clone(src.scene);
  const air = type === 'flyer';
  const target = SIZE[type] || 0.5; const dim = air ? Math.max(src.size.x, src.size.z) : Math.max(src.size.y, src.size.x * 0.7);
  const k = target / dim * (MSCALE[MAP[R][type]] || 1); model.scale.setScalar(k); model.position.y = -src.minY * k;
  const mats = []; const cache = new Map();
  model.traverse(o => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const nl = list.map(s => { if (!cache.has(s)) { const m = enemyMats(s, R, type, P); cache.set(s, m); mats.push(m); } return cache.get(s); });
    o.material = Array.isArray(o.material) ? nl : nl[0];
  });
  if (type === 'phantom' || type === 'boss') for (const m of mats) { m.transparent = true; m.opacity = 1; }
  const mixer = new THREE.AnimationMixer(model);
  const pick = (names) => { for (const nm of names) { const c = src.clips.find(c => c.name.split('|').pop() === nm); if (c) return c; } return src.clips[0]; };
  const walk = pick(type === 'swarm' ? CLIP.swarm : air ? CLIP.air : CLIP.ground);
  const act = walk ? mixer.clipAction(walk) : null; if (act) { act.play(); act.time = Math.random() * walk.duration; }
  const death = src.clips.find(c => /Death|Dead/.test(c.name));
  if (R === 'glim') crystalize(model, type, k, P);
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
