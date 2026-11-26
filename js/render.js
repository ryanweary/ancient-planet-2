// Ancient Planet II renderer: textured sunken-path terrain, PBR models, lighting, grade & FX
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { N8AOPass } from './vendor/n8ao.min.js';
import { PCSS_CHUNK } from './gfx/pcss.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GW, GH, TOWERS, ENEMIES } from './data.js';
import { C, rng } from './levels.js';
import { cellX, cellZ } from './core.js';
import * as TX from './gfx/tex.js';
import { initModels, towerMesh, enemyMesh, baseMesh, decoMesh, rockPile, MAT, crystalMat, glow, rockGeo, crystalGeo } from './gfx/models.js';
import { loadAssets, A as ASSETS, DecoBatch, TreeBatch, TREES, loadTerrainLayer, decoHeight } from './gfx/assets.js';

// margins (world units) around the 9x15 play grid; terrain fills the whole view
const MX = 5, MS = 7, MN = 10;
const X0 = -GW / 2 - MX, Z0 = -GH / 2 - MN, EW = GW + 2 * MX, EH = GH + MN + MS;
const PATH_D = -0.2, WATER_Y = -0.27, WATER_D = -0.5;

export const BIOMES = {
  verdant: { slab: 0, det: 0.30, top: 'rocky_terrain_02', topT: 0xc8f080, patch: 'dry_ground_01', patchT: 0xd8c8a0, pathT: 0xb89a70, cliff: 'aerial_rocks_02', cliffT: 0xb8a890, sky: 0x9fd7ff, fog: 0xb0dcf0, sun: 0xfff0d8, sunI: 2.7, hs: 0xd0e8ff, hg: 0x5a6a30, hI: 0.9, water: 0x38d8e8, haz: null, deco: ['rock', 'pine', 'pine', 'ruin'], obst: ['rock', 'rock', 'ruin'], tuft: 'verdant', tuftT: 0xffffff, amb: 'fireflies', crystalCol: 0x4ff0ff, rockT: 0xa89a88, leaf: 0x2f6a26, trunk: 0x5a3a22, grade: [1.2, 1.06, [1.03, 1.02, 0.96]] },
  reef: { slab: 0, det: 0.35, top: 'coast_sand_01', topT: 0xfff0d8, patch: 'leafy_grass', patchT: 0xb8e090, pathT: 0xf0dcb8, cliff: 'rock_face', cliffT: 0xe0c8a8, sky: 0xbff0ff, fog: 0xc0eef4, sun: 0xfff6e8, sunI: 2.8, hs: 0xd8f4ff, hg: 0x8a7a50, hI: 1.0, water: 0x18d8d0, haz: null, deco: ['coral', 'rock', 'crystal', 'pine'], obst: ['coral', 'rock'], tuft: 'reef', tuftT: 0xffffff, amb: 'dust', crystalCol: 0xff70d0, rockT: 0xd0b8a0, leaf: 0x3a8a40, trunk: 0x7a5a3a, grade: [1.15, 1.04, [1.0, 1.02, 1.02]] },
  frost: { slab: 0, det: 0.35, top: 'snow_02', topT: 0xf4f8ff, patch: 'aerial_rocks_02', patchT: 0xc0d0e8, pathT: 0xc8d4e4, cliff: 'rock_face', cliffT: 0x9aa8c0, sky: 0xd8ecff, fog: 0xd0e4f6, sun: 0xfff6ee, sunI: 2.4, hs: 0xe0f0ff, hg: 0x6a7a90, hI: 1.05, water: 0x7ac8f0, haz: null, deco: ['pine', 'ice', 'rock', 'pine'], obst: ['ice', 'rock'], tuft: 'frost', tuftT: 0xffffff, amb: 'snow', crystalCol: 0x9fe8ff, rockT: 0x9aa4b4, leaf: 0x34584e, trunk: 0x4a3a30, grade: [1.05, 1.05, [0.97, 1.0, 1.05]] },
  mire: { slab: 0, det: 0.30, top: 'brown_mud_leaves_01', topT: 0xa8c080, patch: 'forest_ground_04', patchT: 0x9a8a6a, pathT: 0x8a7a5a, cliff: 'aerial_rocks_02', cliffT: 0x80907a, sky: 0x5a7a60, fog: 0x587860, sun: 0xe8f8d0, sunI: 2.1, hs: 0xb8d8c0, hg: 0x3a4a2a, hI: 0.9, water: 0x4aa070, haz: null, deco: ['fungus', 'pine', 'rock', 'fungus'], obst: ['fungus', 'rock'], tuft: 'mire', tuftT: 0xffffff, amb: 'fireflies', crystalCol: 0x60ffb0, rockT: 0x7a806a, leaf: 0x1e4a2a, trunk: 0x3a3022, grade: [1.1, 1.08, [0.97, 1.03, 0.98]] },
  forge: { slab: 0, det: 0.40, top: 'burned_ground_01', topT: 0xb09080, patch: 'dry_ground_01', patchT: 0x906050, pathT: 0x8a6a58, cliff: 'rock_face', cliffT: 0x6a5850, sky: 0x4a2a20, fog: 0x3a2018, sun: 0xffd0a0, sunI: 2.4, hs: 0xffc8a0, hg: 0x3a2018, hI: 0.8, water: null, haz: 'lava', deco: ['basalt', 'rock', 'basalt'], obst: ['basalt', 'rock'], tuft: 'forge', tuftT: 0xffffff, amb: 'embers', crystalCol: 0xffa040, rockT: 0x5a4a44, leaf: 0x3a2a20, trunk: 0x2a2018, grade: [1.15, 1.1, [1.06, 0.98, 0.92]] },
  sky: { slab: 1, det: 0.35, top: 'leafy_grass', topT: 0xd8f0a0, patch: 'coast_sand_01', patchT: 0xf0e0c0, pathT: 0xf0eadc, cliff: 'rock_face', cliffT: 0xd8c8b0, sky: 0xbfe4ff, fog: 0xdcefff, sun: 0xfff6e0, sunI: 2.8, hs: 0xe0f0ff, hg: 0x8a8a70, hI: 1.05, water: null, haz: 'void', deco: ['column', 'ruin', 'rock', 'pine'], obst: ['column', 'ruin', 'rock'], tuft: 'sky', tuftT: 0xffffff, amb: 'dust', crystalCol: 0x7fd8ff, rockT: 0xc8b8a4, leaf: 0x4a8a36, trunk: 0x6a4a2a, grade: [1.12, 1.03, [1.02, 1.02, 1.0]] },
  storm: { slab: 1, det: 0.35, top: 'dry_ground_01', topT: 0x9a94b0, patch: 'aerial_rocks_02', patchT: 0x8a88a8, pathT: 0xa8a4b8, cliff: 'rock_face', cliffT: 0x6a6684, sky: 0x4a4668, fog: 0x4a4668, sun: 0xe8e0ff, sunI: 2.2, hs: 0xc8c0ff, hg: 0x3a3450, hI: 0.95, water: 0x5070b8, haz: null, deco: ['shard', 'rock', 'rock', 'shard'], obst: ['shard', 'rock'], tuft: 'storm', tuftT: 0xffffff, amb: 'sparks', crystalCol: 0xc080ff, rockT: 0x6a6880, leaf: 0x3a4a40, trunk: 0x2a2a30, grade: [1.1, 1.08, [0.98, 0.97, 1.06]] },
  city: { slab: 1, det: 0.45, top: 'concrete_floor_worn_001', topT: 0xa8b0c0, patch: 'metal_plate', patchT: 0x98a8b8, pathT: 0x8a90a0, cliff: 'rock_face', cliffT: 0x707888, sky: 0x2a3048, fog: 0x2a3048, sun: 0xe0ecff, sunI: 2.3, hs: 0xc0d0ff, hg: 0x303848, hI: 1.0, water: 0x2aa8c8, haz: null, deco: ['tower', 'rock', 'tower'], obst: ['tower', 'rock'], tuft: 'city', tuftT: 0xffffff, amb: 'dust', crystalCol: 0x40f0ff, rockT: 0x707884, leaf: 0x2a3a30, trunk: 0x2a2a2a, grade: [1.08, 1.08, [0.97, 1.0, 1.06]] },
};

// PBR terrain layers per biome (Poly Haven CC0 scans, KTX2): top / patch / path / cliff, plus gentle tints, tiling and roughness
const TERR = {
  verdant: { b: [96, 98, 124, 100], L: ['aerial_grass_rock', 'forest_ground_04', 'dirt_floor', 'rock_face_03'], t: [0xb8f090, 0xe8e4d8, 0xe8dccc, 0xd8d2c8], s: [0.30, 0.45, 0.5, 0.45], r: [0.93, 0.96, 0.9, 0.82] },
  reef: { b: [150, 140, 135, 120], L: ['coast_sand_01', 'aerial_beach_01', 'coast_sand_05', 'rock_face'], t: [0xfff8ee, 0xfff4e4, 0xfff0dc, 0xe8dccc], s: [0.35, 0.3, 0.5, 0.45], r: [0.9, 0.9, 0.85, 0.82] },
  frost: { b: [190, 178, 120, 100], L: ['snow_field_aerial', 'snow_03', 'rocks_ground_05', 'rock_face_04'], t: [0xf4f8ff, 0xeef4ff, 0xc8d4e8, 0xc8d0e0], s: [0.25, 0.45, 0.5, 0.45], r: [0.7, 0.6, 0.75, 0.8] },
  mire: { b: [88, 88, 92, 96], L: ['brown_mud_leaves_01', 'forest_ground_04', 'muddy_tracks', 'rock_pitted_mossy'], t: [0xd8e0c4, 0xc8ccb0, 0xc8bca4, 0xb8c0a8], s: [0.4, 0.45, 0.5, 0.45], r: [0.85, 0.92, 0.55, 0.8] },
  forge: { b: [78, 84, 96, 62], L: ['burned_ground_01', 'cracked_red_ground', 'rocks_ground_05', 'dark_rock'], t: [0xe0c8bc, 0xd8b0a0, 0xc8b0a4, 0xa89890], s: [0.4, 0.4, 0.5, 0.45], r: [0.9, 0.9, 0.85, 0.75] },
  sky: { b: [106, 140, 130, 115], L: ['aerial_grass_rock', 'coast_sand_01', 'stone_pathway', 'rock_face'], t: [0xc0f0a0, 0xfff4e4, 0xf8f4ec, 0xf0e4d4], s: [0.3, 0.4, 0.5, 0.45], r: [0.93, 0.9, 0.8, 0.82] },
  storm: { b: [95, 90, 118, 82], L: ['dry_ground_rocks', 'aerial_rocks_02', 'stone_pathway', 'rock_face'], t: [0xc4bcd8, 0xb0acc8, 0xc8c4d8, 0x9894b0], s: [0.4, 0.4, 0.5, 0.45], r: [0.9, 0.85, 0.75, 0.8] },
  city: { b: [112, 96, 112, 90], L: ['concrete_floor_worn_001', 'metal_plate', 'gravel_road', 'rock_face'], t: [0xd0d6e0, 0xc0c8d4, 0xc0c4cc, 0x98a0b0], s: [0.35, 0.5, 0.5, 0.45], r: [0.8, 0.5, 0.9, 0.8] },
};

// mean sRGB brightness of each packed albedo, so every layer can be normalised to its biome's target brightness
const TLUM = { aerial_beach_01: 111, aerial_grass_rock: 67, aerial_rocks_02: 80, brown_mud_leaves_01: 74, burned_ground_01: 67, coast_sand_01: 111, coast_sand_05: 49, concrete_floor_worn_001: 84,
  cracked_red_ground: 72, dark_rock: 27, dirt_floor: 137, dry_ground_rocks: 82, forest_ground_04: 84, gravel_road: 92, metal_plate: 46, muddy_tracks: 46, rock_face_03: 104, rock_face_04: 70,
  rock_face: 74, rock_pitted_mossy: 152, rocks_ground_05: 98, snow_03: 104, snow_04: 110, snow_field_aerial: 133, stone_pathway: 103 };
const terrTint = (TR, i) => new THREE.Color(TR.t[i]).multiplyScalar(Math.min(4, Math.max(0.35, Math.pow(TR.b[i] / (TLUM[TR.L[i]] || 100), 2.2))));

// per-biome picks from the glTF set (names are files in assets/models)
const GLBDECO = {
  verdant: { rocks: ['rock_07', 'rock_09', 'stone_01', 'rock_moss_set_01', 'namaqualand_boulder_05'], small: ['rock_09', 'stone_01', 'rock_07'], trees: ['pine', 'fir', 'broad', 'broad'], cover: ['fern_02', 'fern_02', 'shrub_03', 'tree_stump_01', 'dead_tree_trunk'] },
  reef: { rocks: ['coast_rocks_01', 'namaqualand_boulder_05', 'rock_09'], tint: 0xfff4e8, small: ['moon_rock_03', 'rock_09'], trees: ['palm', 'palm', 'broad'], cover: ['fern_02', 'shrub_03'] },
  frost: { rocks: ['moon_rock_01', 'moon_rock_05', 'moon_rock_03'], tint: 0xe4ecff, small: ['moon_rock_03', 'moon_rock_05'], trees: ['fir', 'pine', 'fir'], cover: ['dead_tree_trunk', 'tree_stump_01'], treeTint: 0xc8d8dc },
  mire: { rocks: ['rock_moss_set_01', 'rock_07', 'stone_01'], tint: 0xb8c4a8, small: ['rock_09', 'rock_moss_set_01'], trees: ['broad', 'pine', 'broad'], cover: ['fern_02', 'tree_stump_01', 'dead_tree_trunk', 'shrub_03'], treeTint: 0x9aaa90, coverTint: 0xb0c0a0 },
  forge: { rocks: ['rock_07', 'namaqualand_boulder_04', 'rock_09'], tint: 0x6a5450, small: ['rock_09', 'rock_07'], trees: [], cover: ['dead_quiver_trunk', 'dead_tree_trunk'] },
  sky: { rocks: ['stone_01', 'moon_rock_05', 'rock_09'], tint: 0xf4ece0, small: ['moon_rock_03', 'rock_09'], trees: ['broad', 'pine'], cover: ['shrub_03', 'fern_02'] },
  storm: { rocks: ['rock_07', 'rock_09', 'moon_rock_01'], tint: 0xa098bc, small: ['rock_09', 'moon_rock_03'], trees: [], cover: ['dead_quiver_trunk'] },
  city: { rocks: ['rock_09', 'stone_01'], tint: 0x9aa2b0, small: ['rock_09'], trees: [], cover: ['old_military_crate', 'barrel_03', 'old_military_crate'] },
};

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.15 }, con: { value: 1.05 }, tint: { value: new THREE.Vector3(1, 1, 1) }, vig: { value: 0.32 },
    sh: { value: new THREE.Vector3(0.96, 1.0, 1.05) }, hi: { value: new THREE.Vector3(1.04, 1.0, 0.95) }, grain: { value: 0.0 }, ca: { value: 0.0 }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, con, vig, grain, ca, time; uniform vec3 tint, sh, hi; uniform vec2 res; varying vec2 vUv;
  float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  void main(){
    vec2 d=vUv-0.5; vec4 c=texture2D(tDiffuse,vUv); vec3 col=c.rgb;
    if (ca > 0.0) { vec2 o=d*ca*dot(d,d); col.r=texture2D(tDiffuse,vUv-o).r; col.b=texture2D(tDiffuse,vUv+o).b; }
    float l=dot(col,vec3(0.2126,0.7152,0.0722));
    col=mix(vec3(l),col,sat);
    // filmic S-curve contrast around mid-grey, then split-tone shadows/highlights
    col=clamp(col,0.0,1.0); vec3 s=col*col*(3.0-2.0*col); col=mix(col,s,clamp(con-1.0,0.0,1.0)*2.2);
    col*=mix(sh,hi,smoothstep(0.15,0.75,l));
    col*=tint;
    col*=1.0-vig*dot(d,d)*1.6;
    col+=(h12(vUv*res+fract(time)*137.0)-0.5)*grain;
    gl_FragColor=vec4(clamp(col,0.0,1.0),c.a); }`,
};
// separable tilt-shift: blur grows away from a horizontal focus band (subtle miniature depth-of-field)
const TiltShader = {
  uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2(1, 0) }, res: { value: new THREE.Vector2(1, 1) }, focus: { value: 0.45 }, band: { value: 0.2 }, amt: { value: 3.0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 dir, res; uniform float focus, band, amt; varying vec2 vUv;
  void main(){
    float dy=vUv.y-focus; float k=dy>0.0?smoothstep(band, band+0.3, dy):0.35*smoothstep(band+0.15, band+0.45, -dy); float r=k*amt;
    if (r < 0.05) { gl_FragColor=texture2D(tDiffuse,vUv); return; }
    vec2 st=dir/res*r; vec4 acc=texture2D(tDiffuse,vUv)*0.2270270270;
    acc+=(texture2D(tDiffuse,vUv+st*1.3846153846)+texture2D(tDiffuse,vUv-st*1.3846153846))*0.3162162162;
    acc+=(texture2D(tDiffuse,vUv+st*3.2307692308)+texture2D(tDiffuse,vUv-st*3.2307692308))*0.0702702703;
    gl_FragColor=acc; }`,
};

function bake(roots, shadows = true) {
  const byMat = new Map();
  for (const root of roots) {
    root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!o.isMesh) return;
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(o.matrixWorld);
      if (!byMat.has(o.material)) byMat.set(o.material, { list: [], cast: o.castShadow }); byMat.get(o.material).list.push(g);
    });
  }
  const out = new THREE.Group();
  for (const [m, { list, cast }] of byMat) { const g = mergeGeometries(list); if (!g) continue; const mesh = new THREE.Mesh(g, m); mesh.castShadow = shadows && cast; mesh.receiveShadow = true; out.add(mesh); list.forEach(x => x.dispose()); }
  return out;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    TX.setAniso(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    this.quality = 3;
    // post chain: [N8AO (scene+GTAO-style AO) | plain render] -> bloom -> tilt-shift -> filmic output -> grade/LUT/vignette/grain -> SMAA
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera); this.composer.addPass(this.renderPass);
    try {
      this.ao = new N8AOPass(this.scene, this.camera, 512, 512);
      Object.assign(this.ao.configuration, { aoRadius: 0.9, distanceFalloff: 0.6, intensity: 2.6, halfRes: true, gammaCorrection: false, color: new THREE.Color(0x05080a) });
      this.ao.setQualityMode('Medium'); this.ao.enabled = false; this.composer.addPass(this.ao);
    } catch (e) { console.warn('n8ao', e); this.ao = null; }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.4, 0.86);
    this.composer.addPass(this.bloom);
    this.tiltH = new ShaderPass(TiltShader); this.tiltV = new ShaderPass(TiltShader); this.tiltV.uniforms.dir.value.set(0, 1);
    this.composer.addPass(this.tiltH); this.composer.addPass(this.tiltV);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader); this.composer.addPass(this.grade);
    this.smaa = new SMAAPass(512, 512); this.composer.addPass(this.smaa);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a3a20, 1.0); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d0, 2.6); this.sun.position.set(-5, 13, 7); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048); const sc = this.sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 40; this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.level = new THREE.Group(); this.scene.add(this.level);
    this.dyn = new THREE.Group(); this.scene.add(this.dyn);
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.tmap = new Map(); this.emap = new Map(); this.pmap = new Map(); this.cmap = new Map(); this.omap = new Map(); this.bmap = new Map(); this.mmap = new Map(); this.beams = new Map();
    this.effects = []; this.debris = []; this.corpses = []; this.time = 0; this.frameN = 0;
    this.fpsAcc = 0; this.fpsN = 0; this.fpsT = 0; this.lowCount = 0;
    this.w = 1; this.h = 1; this.rect = { left: 0, top: 0, width: 1, height: 1 };
    this.resize();
  }
  // async asset init: CC0 textures, HDRI, procedural textures, models
  async init(onProgress) {
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.envRoom = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envRoom; this.scene.environmentIntensity = 0.55;
    const step = (k) => onProgress && onProgress(k);
    const hdrP = new RGBELoader().loadAsync('assets/sky.hdr').then(t => { t.mapping = THREE.EquirectangularReflectionMapping; this.envSky = pm.fromEquirectangular(t).texture; t.dispose(); this.scene.environment = this.envSky; }).catch(e => console.warn('hdr', e));
    const [granite, rock, leafy, rface] = await Promise.all([TX.loadTex('granite_tile_diff'), TX.loadLayer('aerial_rocks_02'), TX.loadLayer('leafy_grass'), TX.loadLayer('rock_face')]);
    step(0.15);
    await loadAssets(this.renderer, p => step(0.15 + 0.75 * p));
    const T = { metal: TX.makeMetal(3), armor: TX.makeArmor(5), stripes: TX.makeStripes(), dome: TX.makeDome(), slabs: TX.makePathSlabs(granite, 1), rock: rface, soft: TX.makeSoft() };
    step(0.95);
    this.T = T; T.flare = TX.makeFlare(); T.smoke = TX.makeSmokeSprite(); T.water = TX.makeWaterNormal(); T.macro = TX.makeMacro(3); T.leafy = leafy; T.rocks = rock;
    initModels(T);
    this.initParticles();
    await hdrP;
    step(1);
    this.ready = true;
    this.buildMenuScene();
  }
  // tiers: 1 Low (direct render), 2 Med (bloom+SMAA), 3 High (+N8AO half-res, tilt-shift, grass blades), 4 Ultra (+PCSS soft shadows, full-res AO, 4K shadow map, grain/CA)
  setQuality(q) {
    this.quality = q;
    const dpr = Math.min(window.devicePixelRatio || 1, q >= 4 ? 2.5 : q >= 3 ? 2 : q === 2 ? 1.5 : 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = q >= 2; this.sun.castShadow = q >= 2;
    const ms = q >= 4 ? 4096 : q >= 3 ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== ms) { this.sun.shadow.mapSize.set(ms, ms); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    this.setPCSS(q >= 4);
    this.bloom.enabled = q >= 2;
    if (this.ao) { this.ao.enabled = q >= 3; this.renderPass.enabled = !this.ao.enabled; this.ao.configuration.halfRes = q < 4; this.ao.setQualityMode(q >= 4 ? 'High' : 'Medium'); }
    this.tiltH.enabled = this.tiltV.enabled = q >= 3;
    this.smaa.enabled = q >= 2;
    this.grade.uniforms.grain.value = q >= 4 ? 0.035 : q >= 3 ? 0.018 : 0; this.grade.uniforms.ca.value = q >= 4 ? 0.012 : 0;
    if (this.grassMesh) this.grassMesh.visible = q >= 3;
    if (this.uPar) this.uPar.value = q >= 3 ? 0.035 : 0;
    if (this.tuftMesh) this.tuftMesh.count = Math.floor(this.tuftMesh.userData.max * (q >= 3 ? 1 : q === 2 ? 0.6 : 0.25));
    if (this.ambP) this.ambP.geometry.setDrawRange(0, Math.floor(this.ambN * (q >= 3 ? 1 : q === 2 ? 0.6 : 0.3)));
    this._dpr = -1; this.resize();
  }
  // PCSS (percentage-closer soft shadows) for Ultra: contact-hardening penumbrae; swaps the shadow chunk and recompiles
  setPCSS(on) {
    if (this._pcss === on) return; this._pcss = on;
    if (!this._chunk0) this._chunk0 = THREE.ShaderChunk.shadowmap_pars_fragment;
    THREE.ShaderChunk.shadowmap_pars_fragment = on ? PCSS_CHUNK(this._chunk0) : this._chunk0;
    this.scene.traverse(o => { const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.needsUpdate = true); });
  }
  // size the drawing buffer to the canvas' real on-screen box (fixes tap offsets on phones)
  resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width || window.innerWidth)), h = Math.max(1, Math.round(r.height || window.innerHeight));
    this.rect = { left: r.left, top: r.top, width: w, height: h };
    if (w === this.w && h === this.h && this._dpr === this.renderer.getPixelRatio()) return;
    this._dpr = this.renderer.getPixelRatio();
    this.renderer.setSize(w, h, false); this.composer.setPixelRatio(this._dpr); this.composer.setSize(w, h);
    const pw = w * this._dpr, ph = h * this._dpr;
    for (const t of [this.tiltH, this.tiltV]) t.uniforms.res.value.set(pw, ph);
    this.grade.uniforms.res.value.set(pw, ph); this.tiltH.uniforms.amt.value = this.tiltV.uniforms.amt.value = 2.2 * this._dpr;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
    if (this.inBattle) this.fit(); else if (this.menu) this.menuCam();
  }
  // 3/4 camera: ~48 deg pitch. Default is the close view (~5.8 tiles across).
  // zoom: 1 = default, >1 closer, <1 zoomed out until the whole board fits.
  distForView(viewW, viewD, inset = false) {
    const th = Math.tan(this.camera.fov * Math.PI / 360), a = this.w / this.h, hFrac = inset ? Math.max(0.55, (this.h - 110) / this.h) : 1;
    return Math.max(viewW / (2 * th * a), viewD * Math.sin(this.pitch) / (2 * th * hFrac), 4);
  }
  distToFitBoard() {
    // Look slightly south of center so the nearer (bottom) edge isn't eaten by perspective + the HUD.
    const pitch = this.pitch, lookZ = 1.1;
    const corners = [[-GW / 2, 0, -GH / 2 - 0.3], [GW / 2, 0, -GH / 2 - 0.3], [-GW / 2, 0, GH / 2 + 0.3], [GW / 2, 0, GH / 2 + 0.3], [0, 1.9, -GH / 2 + 0.6]];
    const v = new THREE.Vector3(), insT = 52, insB = 108, insX = 10;
    const saved = this.camera.position.clone();
    let lo = 4, hi = 90;
    for (let k = 0; k < 22; k++) {
      const d = (lo + hi) / 2;
      this.camera.position.set(0, Math.sin(pitch) * d, lookZ + Math.cos(pitch) * d); this.camera.lookAt(0, 0, lookZ); this.camera.updateMatrixWorld();
      let ok = true;
      for (const c of corners) { v.set(...c).project(this.camera); const sx = (v.x + 1) / 2 * this.w, sy = (1 - v.y) / 2 * this.h; if (v.z < 0 || v.z > 1 || sx < insX || sx > this.w - insX || sy < insT || sy > this.h - insB) ok = false; }
      if (ok) hi = d; else lo = d;
    }
    this.camera.position.copy(saved);
    this.lookOutZ = lookZ;
    return Math.max(hi * 1.02, this.distDef || hi);
  }
  fit() {
    const pitch = 48 * Math.PI / 180; this.pitch = pitch;
    this.camera.fov = 32; this.camera.updateProjectionMatrix();
    const prevZoom = this.zoom || 1;
    this.distDef = this.distForView(5.8, 8.5, false);
    this.distIn = this.distForView(3.4, 5.0, false);
    this.distOut = this.distToFitBoard();
    if (this.camDist == null || this.pan == null) { this.camDist = this.distDef; this.zoom = 1; }
    else { this.camDist = Math.max(this.distIn, Math.min(this.distOut, this.distDef / prevZoom)); this.zoom = this.distDef / this.camDist; }
    const th = Math.tan(this.camera.fov * Math.PI / 360);
    this.viewHalfW = this.camDist * th * (this.w / this.h); this.viewHalfD = this.camDist * th / Math.sin(pitch);
    if (this.pan == null) this.pan = { x: 0, z: -GH / 2 + this.viewHalfD * 0.85 };
    this.applyCam();
  }
  applyCam() {
    if (!this.pan) return;
    const th = Math.tan(this.camera.fov * Math.PI / 360), d = this.camDist, p = this.pitch;
    this.viewHalfW = d * th * (this.w / this.h); this.viewHalfD = d * th / Math.sin(p);
    this.panBy(0, 0);
    if (this.scene.fog && this.inBattle) { this.scene.fog.near = d + 8; this.scene.fog.far = d + Math.max(45, d * 0.8); }
    const sc = this.sun.shadow.camera, pad = 2;
    sc.left = -this.viewHalfW - pad; sc.right = this.viewHalfW + pad; sc.top = this.viewHalfD + pad + 2; sc.bottom = -this.viewHalfD - pad; sc.updateProjectionMatrix();
  }
  panLimits() {
    const hx = Math.max(0, GW / 2 + 0.6 - this.viewHalfW);
    const zMin = -GH / 2 - 1.4, zMax = GH / 2 + 0.6;
    const useHalf = this.viewHalfD * Math.max(0.5, (this.h - 110) / this.h);
    const mid = this.lookOutZ ?? ((zMin + zMax) / 2);
    return { x0: -hx, x1: hx, z0: Math.min(zMin + useHalf, mid), z1: Math.max(zMax - useHalf, mid) };
  }
  panBy(dxPx, dyPx) {
    if (!this.pan) return;
    const k = 2 * this.viewHalfW / this.w;
    this.pan.x -= dxPx * k; this.pan.z -= dyPx * k / Math.sin(this.pitch);
    const L = this.panLimits(); this.pan.x = Math.max(L.x0, Math.min(L.x1, this.pan.x)); this.pan.z = Math.max(L.z0, Math.min(L.z1, this.pan.z));
    const d = this.camDist, p = this.pitch;
    this.camera.position.set(this.pan.x, Math.sin(p) * d, this.pan.z + Math.cos(p) * d); this.camera.lookAt(this.pan.x, 0, this.pan.z); this.camera.updateMatrixWorld();
    this.camBase = this.camera.position.clone();
    this.sun.position.set(this.pan.x - 5, 13, this.pan.z + 7); this.sun.target.position.set(this.pan.x, 0, this.pan.z); this.sun.target.updateMatrixWorld();
  }
  panTo(x, z) { if (!this.pan) return; this.pan.x = x; this.pan.z = z; this.panBy(0, 0); }
  // zoom around a screen point (pinch midpoint or wheel cursor). zoom=1 default, >1 closer, <1 out.
  zoomTo(zoom, clientX, clientY) {
    if (!this.pan || this.distDef == null) return;
    const zMin = this.distDef / this.distOut, zMax = this.distDef / this.distIn;
    zoom = Math.max(zMin, Math.min(zMax, zoom));
    const newDist = Math.max(this.distIn, Math.min(this.distOut, this.distDef / zoom));
    if (Math.abs(newDist - this.camDist) < 1e-4) return;
    const world = (clientX != null) ? this.pick(clientX, clientY) : null;
    this.camDist = newDist; this.zoom = this.distDef / this.camDist;
    this.applyCam();
    if (world) {
      const y = this.heightAt(world.x, world.z);
      const [sx, sy] = this.toScreen(world.x, y, world.z);
      this.panBy(clientX - sx, clientY - sy);
    }
  }
  toggleZoom(clientX, clientY) {
    const mid = (this.distDef + this.distOut) / 2;
    this.zoomTo(this.distDef / (this.camDist > mid ? this.distDef : this.distOut), clientX, clientY);
  }
  // NDC from the canvas' bounding rect; raycast real geometry (towers first, then terrain)
  ndc(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }
  pick(clientX, clientY) {
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(this.ndc(clientX, clientY), this.camera);
    let p = null, tower = null;
    if (this.tmap.size) {
      const hits = this.ray.intersectObjects([...this.tmap.values()], true);
      if (hits.length) { let o = hits[0].object; while (o && !o.userData.tid) o = o.parent; if (o) tower = o.userData.tid; }
    }
    if (this.ground) { const h = this.ray.intersectObject(this.ground, false); if (h.length) p = h[0].point; }
    if (!p) { p = new THREE.Vector3(); if (!this.ray.ray.intersectPlane(this.plane, p)) return null; }
    let cx = Math.round(p.x + (GW - 1) / 2), cy = Math.round(p.z + (GH - 1) / 2);
    // snap to the cell whose projected center is closest to the tap (sloped/far tiles at zoom-out)
    let bestD = Infinity, bx = cx, by = cy;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const tx = cx + dx, ty = cy + dy; if (tx < 0 || ty < 0 || tx >= GW || ty >= GH) continue;
      const [sx, sy] = this.cellScreen(tx, ty); const d = (sx - clientX) ** 2 + (sy - clientY) ** 2;
      if (d < bestD) { bestD = d; bx = tx; by = ty; }
    }
    cx = bx; cy = by;
    return { x: p.x, z: p.z, cx, cy, tower, inGrid: cx >= 0 && cy >= 0 && cx < GW && cy < GH };
  }
  toScreen(x, y, z) { const v = new THREE.Vector3(x, y, z).project(this.camera); const r = this.canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }
  cellScreen(cx, cy) { const x = cellX(cx), z = cellZ(cy); return this.toScreen(x, this.heightAt(x, z), z); }

  // ---------------- menu / planet ----------------
  buildMenuScene() {
    const g = new THREE.Group(); this.menu = g;
    const W = 1024, H = 512; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); const img = c.createImageData(W, H); const d = img.data;
    const ccv = document.createElement('canvas'); ccv.width = W; ccv.height = H; const cc = ccv.getContext('2d'); const cimg = cc.createImageData(W, H); const cd = cimg.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const lat = Math.abs(y / H - 0.5) * 2;
      const n = TX.fbm(x / 128, y / 128, 8, 6, 11) + TX.fbm(x / 32, y / 32, 32, 3, 4) * 0.15 - 0.08;
      let col;
      const L3 = (a, b, t) => a.map((v, q) => v + (b[q] - v) * Math.max(0, Math.min(1, t)));
      const sea = L3([14, 50, 100], [40, 140, 180], n / 0.47);
      const m = (n - 0.48) / 0.3; const dry = TX.fbm(x / 64, y / 64, 16, 3, 7);
      let land = L3(L3([90, 150, 60], [50, 100, 40], m * 1.6), [130, 118, 96], (m - 0.6) * 2.5);
      land = L3(land, [170, 150, 90], (dry - 0.5) * 4);
      col = L3(L3(sea, [205, 195, 150], (n - 0.465) / 0.012), land, (n - 0.478) / 0.012);
      if (lat > 0.82) { const s = Math.min(1, (lat - 0.82) / 0.1); col = col.map(v => v + (240 - v) * s); }
      const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      const cn = TX.fbm(x / 96, y / 64, 10.666, 5, 33); const a = Math.max(0, (cn - 0.5) * 3.2); cd[i] = cd[i + 1] = cd[i + 2] = 255; cd[i + 3] = Math.min(255, a * 255);
    }
    c.putImageData(img, 0, 0); cc.putImageData(cimg, 0, 0);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const ctex = new THREE.CanvasTexture(ccv); ctex.colorSpace = THREE.SRGBColorSpace;
    const planet = new THREE.Mesh(new THREE.SphereGeometry(3, 96, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 }));
    g.add(planet); this.planet = planet;
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(3.04, 96, 64), new THREE.MeshStandardMaterial({ map: ctex, transparent: true, depthWrite: false, roughness: 1 })); g.add(clouds); this.clouds = clouds;
    const atm = new THREE.Mesh(new THREE.SphereGeometry(3.35, 64, 48), new THREE.ShaderMaterial({ transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-abs(dot(vN,vV)),2.2); gl_FragColor=vec4(vec3(0.35,0.8,1.0)*f*1.6,f); }' }));
    g.add(atm); this.atm = atm;
    const nb = document.createElement('canvas'); nb.width = 512; nb.height = 256; const nc = nb.getContext('2d'); const ni = nc.createImageData(512, 256); const nd = ni.data;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) { const n = TX.fbm(x / 64, y / 64, 8, 5, 51), m = TX.fbm(x / 32, y / 32, 16, 4, 61); const i = (y * 512 + x) * 4; const a = Math.max(0, n - 0.45) * 2; nd[i] = 10 + a * 60 * m + a * 30; nd[i + 1] = 12 + a * 80 * (1 - m); nd[i + 2] = 30 + a * 140; nd[i + 3] = 255; }
    nc.putImageData(ni, 0, 0); const ntex = new THREE.CanvasTexture(nb); ntex.colorSpace = THREE.SRGBColorSpace;
    g.add(new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.MeshBasicMaterial({ map: ntex, side: THREE.BackSide, fog: false })));
    const sp = new Float32Array(1500 * 3); for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + Math.random() * 20); sp.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false })));
    this.ships = [];
    for (let i = 0; i < 0; i++) {
      const s = new THREE.Group();
      s.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.3), MAT.metal)); s.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.22), MAT.dark).translateY(0.12).translateX(-0.1));
      for (const z of [-0.2, 0.2]) s.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.25), MAT.dark).translateZ(z * 1.2).translateX(-0.2));
      const eng = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.T.flare, color: 0x60e0ff, blending: THREE.AdditiveBlending, depthWrite: false })); eng.scale.setScalar(0.5); eng.position.x = -0.5; s.add(eng);
      s.position.set(-2 + i * 1.6, 1.5 - i * 1.4, 1 + i); s.scale.setScalar(0.6 + i * 0.2); g.add(s); this.ships.push(s);
    }
    this.menuCam();
  }
  showMenu() {
    this.inBattle = false; this.level.visible = false; this.dyn.visible = false;
    if (!this.menu) return;
    if (!this.menu.parent) this.scene.add(this.menu);
    this.scene.background = new THREE.Color(0x050a12); this.scene.fog = null;
    this.hemi.color.set(0x8090c0); this.hemi.groundColor.set(0x101020); this.hemi.intensity = 0.4;
    this.sun.color.set(0xfff4e0); this.sun.intensity = 3.2;
    this.grade.uniforms.sat.value = 1.1; this.grade.uniforms.con.value = 1.05; this.grade.uniforms.tint.value.set(1, 1, 1); this.grade.uniforms.vig.value = 0.4;
    this.menuCam();
  }
  menuCam() {
    if (!this.menu) return;
    const a = this.w / this.h, port = a < 1;
    const d = port ? 6.4 / a : 9;
    this.camera.position.set(0, 0, d); this.camera.lookAt(0, 0, 0);
    this.sun.position.set(-8, 5, 7); this.sun.target.position.set(0, 0, 0);
    const py = port ? -d * 0.2 : -1.2, px = port ? 0.6 : 1.8;
    for (const o of [this.planet, this.clouds, this.atm]) o.position.set(px, py, 0);
    this.ships.forEach((s, i) => { s.position.y = (port ? d * 0.16 : 1.5) - i * (port ? d * 0.05 : 1.4); });
  }

  // ---------------- level ----------------
  heightAt(x, z) {
    const H = this.hf; if (!H) return 0;
    const fx = (x - X0) * H.res, fz = (z - Z0) * H.res; const ix = Math.max(0, Math.min(H.nx - 2, Math.floor(fx))), iz = Math.max(0, Math.min(H.nz - 2, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - ix)), tz = Math.min(1, Math.max(0, fz - iz)); const a = H.h[iz * H.nx + ix], b = H.h[iz * H.nx + ix + 1], c = H.h[(iz + 1) * H.nx + ix], d = H.h[(iz + 1) * H.nx + ix + 1];
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  }
  async prepBiome(name) {
    const B = BIOMES[name]; if (B.layers) return B;
    const TR = TERR[name] || TERR.verdant;
    const hd = await Promise.all(TR.L.map(n => loadTerrainLayer(n)));
    const blank = (c) => { const t = new THREE.DataTexture(new Uint8Array(c), 1, 1); t.needsUpdate = true; return t; };
    B.layers = hd.map(l => l || { c: blank([128, 128, 128, 128]), n: blank([128, 128, 128, 128]) }); B.terr = TR;
    B.rockMat = new THREE.MeshStandardMaterial({ map: this.T.rock.d, normalMap: this.T.rock.n, color: B.rockT, roughness: 0.9, flatShading: true });
    B.leafMat = new THREE.MeshStandardMaterial({ map: this.T.leafy.d, color: B.leaf, roughness: 0.9, flatShading: true });
    B.trunkMat = new THREE.MeshStandardMaterial({ color: B.trunk, roughness: 0.9 });
    B.bldMat = new THREE.MeshStandardMaterial({ map: MAT.metal.map, normalMap: MAT.metal.normalMap, color: 0x6a7488, metalness: 0.4, roughness: 0.5 });
    B.tuftTex = TX.makeTuft(B.tuft);
    return B;
  }
  setLevel(game) {
    this.g = game; this.inBattle = true;
    if (this.menu && this.menu.parent) this.scene.remove(this.menu);
    this.level.visible = true; this.dyn.visible = true;
    const L = game.L, B = BIOMES[L.biome]; this.B = B;
    for (const m of [this.tmap, this.emap, this.pmap, this.cmap, this.omap, this.bmap, this.mmap, this.beams]) m.clear();
    this.level.traverse(o => { if (o.geometry && o.userData.own) o.geometry.dispose(); });
    this.level.clear(); this.dyn.clear(); this.effects = []; this.debris = []; this.corpses = [];
    this.dyn.add(this.points); this.dyn.add(this.points2);
    this.scene.background = new THREE.Color(B.sky);
    this.scene.fog = new THREE.Fog(B.fog, 34, 70);
    this.hemi.color.set(B.hs); this.hemi.groundColor.set(B.hg); this.hemi.intensity = B.hI;
    this.sun.color.set(B.sun); this.sun.intensity = B.sunI;
    const [sat, con, tint] = B.grade; this.grade.uniforms.sat.value = sat; this.grade.uniforms.con.value = con; this.grade.uniforms.tint.value.set(...tint); this.grade.uniforms.vig.value = 0.34;
    this.buildTerrain(L, B);
    this.buildDeco(L, B);
    const base = baseMesh(B, !!game.bgun); base.position.set(cellX(L.base[0]), 0, cellZ(0.5)); this.level.add(base); this.baseGroup = base;
    this.baseCrystal = base.userData.crystal; this.shield = base.userData.shield; this.baseGun = base.userData.gun || null;
    this.pan = null; this.camDist = null; this.zoom = 1; this.fit();
    this.rangeRing = new THREE.Group();
    const rr = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 72), new THREE.MeshBasicMaterial({ color: 0x9cff60, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false }));
    const rf = new THREE.Mesh(new THREE.CircleGeometry(1, 72), new THREE.MeshBasicMaterial({ color: 0x80ff40, transparent: true, opacity: 0.2, depthWrite: false, depthTest: false }));
    rr.rotation.x = rf.rotation.x = -Math.PI / 2; rr.renderOrder = rf.renderOrder = 5; this.rangeRing.add(rf); this.rangeRing.add(rr); this.rangeRing.visible = false; this.level.add(this.rangeRing);
    this.cellHL = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), new THREE.MeshBasicMaterial({ color: 0xffe060, transparent: true, opacity: 0.45, depthWrite: false, depthTest: false }));
    this.cellHL.rotation.x = -Math.PI / 2; this.cellHL.renderOrder = 6; this.cellHL.visible = false; this.level.add(this.cellHL);
    this.validHL = new THREE.Group(); this.level.add(this.validHL);
    this.pathHL = new THREE.Group(); this.level.add(this.pathHL);
    this.buildAmbient(B);
    this.setQuality(this.quality);
  }

  // ---- terrain: heightfield with sunken carved path, water/lava basins, hills outside the grid ----
  buildTerrain(L, B) {
    const res = 6, nx = Math.round(EW * res) + 1, nz = Math.round(EH * res) + 1;
    const h = new Float32Array(nx * nz), pw = new Float32Array(nx * nz), cellW = new Float32Array(nx * nz);
    // path polylines in world space, extended beyond the grid edges
    const segs = [];
    for (const pts of L.paths) {
      const P = pts.map(([x, y]) => [cellX(x), cellZ(y)]);
      const out = (q) => q[0] < -GW / 2 || q[0] > GW / 2 || q[1] < -GH / 2 || q[1] > GH / 2;
      const ext = (a, b) => { const dx = a[0] - b[0], dz = a[1] - b[1], l = Math.hypot(dx, dz) || 1; return [a[0] + dx / l * 12, a[1] + dz / l * 12]; };
      const W = P.slice();
      if (W.length > 1 && (out(W[0]) || pts[0][1] >= GH - 1 || pts[0][1] <= 0 || pts[0][0] <= 0 || pts[0][0] >= GW - 1)) W.unshift(ext(W[0], W[1]));
      const n = W.length; if (n > 1 && out(W[n - 1])) W.push(ext(W[n - 1], W[n - 2]));
      // visual only: round the corners (one Chaikin pass, cut capped so the walk line stays well inside the trench)
      let S = W;
      for (let it = 0; it < 2; it++) {
        const o = [S[0]];
        for (let i = 1; i < S.length - 1; i++) {
          const a = S[i - 1], b = S[i], c = S[i + 1];
          const la = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, lc = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
          const ka = Math.min(0.25 * la, it ? 0.12 : 0.3) / la, kc = Math.min(0.25 * lc, it ? 0.12 : 0.3) / lc;
          o.push([b[0] + (a[0] - b[0]) * ka, b[1] + (a[1] - b[1]) * ka], [b[0] + (c[0] - b[0]) * kc, b[1] + (c[1] - b[1]) * kc]);
        }
        o.push(S[S.length - 1]); S = o;
      }
      for (let i = 0; i < S.length - 1; i++) segs.push([S[i][0], S[i][1], S[i + 1][0], S[i + 1][1]]);
    }
    this.segs = segs;
    const segD = (x, z) => { let m = 1e9; for (const [ax, az, bx, bz] of segs) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1; let t = ((x - ax) * dx + (z - az) * dz) / l2; t = Math.max(0, Math.min(1, t)); const ex = ax + dx * t - x, ez = az + dz * t - z; m = Math.min(m, ex * ex + ez * ez); } return Math.sqrt(m); };
    this.segD = segD;
    const grid = this.g.grid;
    const cellAt = (cx, cy) => (cx < 0 || cy < 0 || cx >= GW || cy >= GH) ? -1 : grid[cy * GW + cx];
    const boxSdf = (x, z, test, hs = 0.5) => { const cx = Math.round(x + (GW - 1) / 2), cy = Math.round(z + (GH - 1) / 2); let m = 9; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!test(cellAt(cx + dx, cy + dy))) continue; const ox = Math.abs(x - cellX(cx + dx)) - hs, oz = Math.abs(z - cellZ(cy + dy)) - hs; const d = Math.max(ox, oz) < 0 ? Math.max(ox, oz) : Math.hypot(Math.max(ox, 0), Math.max(oz, 0)); m = Math.min(m, d); } return m; };
    const bx = cellX(L.base[0]), bz = cellZ(0.5);
    const voidHaz = B.haz === 'void';
    const ss = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = X0 + i / res, z = Z0 + j / res, k = j * nx + i;
      // distance outside the play rectangle
      const ox = Math.max(0, Math.abs(x) - GW / 2), ozN = Math.max(0, -GH / 2 - z), ozS = Math.max(0, z - GH / 2);
      const outD = Math.hypot(ox, Math.max(ozN, ozS));
      let y = 0;
      if (outD > 0) {
        const amp = ozS > 0 ? 0.35 : ozN > 0 ? 2.6 : 1.4;
        const hill = TX.fbm(x * 0.18 + 40, z * 0.18 + 40, 64, 4, 3) - 0.35;
        y = Math.max(-0.1, hill) * amp * ss(0, 3.5, outD) + ss(0.5, 6, outD) * (ozN > 0 ? 0.9 : ozS > 0 ? 0 : 0.35);
      } else y = (TX.fbm(x * 0.9 + 9, z * 0.9 + 9, 64, 2, 8) - 0.5) * 0.015;
      // carved path
      const pd = segD(x, z);
      let pth = 1 - ss(0.4, 0.56, pd);
      const toBase = Math.hypot(x - bx, (z - bz) * 1.3);
      const plaza = 1 - ss(1.5, 2.1, Math.max(Math.abs(x - bx) - 0.6, Math.abs(z - bz)));
      pw[k] = Math.max(1 - ss(0.44, 0.62, pd), plaza);
      pth *= ss(1.2, 2.2, toBase);
      y = y * (1 - Math.max(pth, plaza)) + PATH_D * pth;
      // water / hazard basins (cell based, softened)
      if (outD < 1.2) {
        const wd = boxSdf(x, z, v => v === C.WATER || v === C.HAZARD, 0.64) + (TX.fbm(x * 1.3 + 5, z * 1.3 + 2, 64, 2, 17) - 0.5) * 0.14;
        if (wd < 0.08) { const depth = voidHaz && B.haz ? -4 : WATER_D; const f = 1 - ss(-0.13, 0.06, wd); y = y * (1 - f) + depth * f; cellW[k] = f; }
      }
      h[k] = y;
    }
    this.hf = { h, nx, nz, res };
    // splat: R=path/plaza, G=dirt patch, B=AO, A=deposit glow
    const sp = new Uint8Array(nx * nz * 4);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = X0 + i / res, z = Z0 + j / res;
      let avg = 0, n = 0; for (let dj = -3; dj <= 3; dj += 3) for (let di = -3; di <= 3; di += 3) { const ii = Math.min(nx - 1, Math.max(0, i + di)), jj = Math.min(nz - 1, Math.max(0, j + dj)); avg += h[jj * nx + ii]; n++; }
      avg /= n; const ao = Math.max(0.35, Math.min(1, 1 - (avg - h[k]) * 2.6));
      const pd = this.segD(x, z);
      const patch = ss(0.62, 0.78, TX.fbm(x * 0.22 + 3, z * 0.22 + 7, 64, 3, 21) + (1 - ss(0.5, 1.0, pd)) * 0.1);
      let dep = 0; const cx = Math.round(x + (GW - 1) / 2), cy = Math.round(z + (GH - 1) / 2);
      if (cellAt(cx, cy) === C.DEPOSIT) { const d = Math.hypot(x - cellX(cx), z - cellZ(cy)); dep = Math.max(0, 1 - d / 0.5) * 0.9; }
      sp[k * 4] = pw[k] * 255; sp[k * 4 + 1] = patch * 255 * (1 - cellW[k]); sp[k * 4 + 2] = ao * 255; sp[k * 4 + 3] = dep * 255;
    }
    const splat = new THREE.DataTexture(sp, nx, nz, THREE.RGBAFormat); splat.magFilter = THREE.LinearFilter; splat.minFilter = THREE.LinearFilter; splat.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(EW, EH, nx - 1, nz - 1); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) { const i = k % nx, j = Math.floor(k / nx); pos.setY(k, h[j * nx + i]); pos.setX(k, X0 + i / res); pos.setZ(k, Z0 + j / res); }
    geo.computeVertexNormals();
    const Ly = B.layers, T = this.T, TR = B.terr;
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0 });
    this.uTime = this.uTime || { value: 0 };
    this.uPar = this.uPar || { value: 0.035 };
    const U = { tTc: { value: Ly[0].c }, tTn: { value: Ly[0].n }, tPc: { value: Ly[1].c }, tPn: { value: Ly[1].n }, tSc: { value: Ly[2].c }, tSn: { value: Ly[2].n }, tCc: { value: Ly[3].c }, tCn: { value: Ly[3].n },
      tSplat: { value: splat }, tMacro: { value: T.macro },
      cTop: { value: terrTint(TR, 0) }, cPatch: { value: terrTint(TR, 1) }, cPath: { value: terrTint(TR, 2) }, cCliff: { value: terrTint(TR, 3) }, cDep: { value: new THREE.Color(0xc08a20) },
      uScale: { value: new THREE.Vector4(...TR.s) }, uRough: { value: new THREE.Vector4(...TR.r) }, uPar: this.uPar, uTime: this.uTime, uOrig: { value: new THREE.Vector4(X0, Z0, EW, EH) } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN;
uniform sampler2D tTc, tTn, tPc, tPn, tSc, tSn, tCc, tCn, tSplat, tMacro;
uniform vec3 cTop, cPatch, cPath, cCliff, cDep; uniform vec4 uScale, uRough, uOrig; uniform float uTime, uPar;
// anti-tiling: blend a rotated/offset second tap by a macro noise mask
vec4 at2(sampler2D t, vec2 uv, float m) { vec4 a = texture2D(t, uv); if (m < 0.01) return a; vec4 b = texture2D(t, vec2(uv.y, -uv.x) * 0.731 + vec2(0.37, 0.11)); return mix(a, b, m); }
vec3 unpackN(vec4 s) { vec2 xy = vec2(s.r, s.a) * 2.0 - 1.0; return vec3(xy, sqrt(max(0.05, 1.0 - dot(xy, xy)))); }
vec3 nAt2(sampler2D t, vec2 uv, float m) { vec3 a = unpackN(texture2D(t, uv)); if (m < 0.01) return a; vec3 b = unpackN(texture2D(t, vec2(uv.y, -uv.x) * 0.731 + vec2(0.37, 0.11))); b.xy = vec2(-b.y, b.x); return normalize(mix(a, b, m)); }
// height-aware splat blend: the layer with the taller texels wins first (rocks poke through grass, dirt fills cracks)
float hbl(float t, float a, float b) { return smoothstep(0.2, 0.8, t * 2.2 - 0.6 + (b - a) * 0.8); }`)
        .replace('#include <map_fragment>', `
vec2 wuv = vWP.xz;
vec4 spl = texture2D(tSplat, (vWP.xz - uOrig.xy) / uOrig.zw);
float mac = texture2D(tMacro, wuv * 0.045).r; float mac2 = texture2D(tMacro, wuv * 0.02 + 0.3).r;
float am = smoothstep(0.42, 0.62, mac);
float slope = 1.0 - clamp(normalize(vWN).y, 0.0, 1.0);
float wC = smoothstep(0.12, 0.34, slope), wP = smoothstep(0.5, 0.85, spl.r), wG = spl.g;
// parallax offset (High+): shift lookups along the view ray by the dominant layer's height
vec3 V = normalize(cameraPosition - vWP); vec2 pv = V.xz / max(V.y, 0.35);
vec2 off = vec2(0.0);
if (uPar > 0.0) { float h0 = mix(texture2D(tTc, wuv * uScale.x).a, texture2D(tSc, wuv * uScale.z).a, wP); off = pv * (h0 - 0.5) * uPar; }
vec2 uvT = (wuv + off) * uScale.x, uvP = (wuv + off) * uScale.y, uvS = (wuv + off) * uScale.z;
vec2 uvC = vec2(wuv.x + vWP.y * 0.7, wuv.y - vWP.y * 0.4) * uScale.w;
vec4 sT = at2(tTc, uvT, am), sP = at2(tPc, uvP, am * 0.6), sS = texture2D(tSc, uvS), sC = texture2D(tCc, uvC);
vec3 cT = sT.rgb * cTop * mix(vec3(0.86, 0.92, 0.88), vec3(1.08, 1.05, 0.95), smoothstep(0.2, 0.8, mac2));
float fG = hbl(wG, sT.a, sP.a); vec3 tcol = mix(cT, sP.rgb * cPatch, fG); float hh = mix(sT.a, sP.a, fG); float rr = mix(uRough.x, uRough.y, fG);
float fS = hbl(wP, hh, sS.a); tcol = mix(tcol, sS.rgb * cPath, fS); hh = mix(hh, sS.a, fS); rr = mix(rr, uRough.z, fS);
float fC = hbl(wC, hh, sC.a); tcol = mix(tcol, sC.rgb * cCliff, fC); hh = mix(hh, sC.a, fC); rr = mix(rr, uRough.w, fC);
// crevices darker and rougher, crowns a touch smoother
tcol *= 0.82 + 0.3 * hh; rr = clamp(rr + (0.5 - hh) * 0.12, 0.3, 1.0);
float lip = smoothstep(0.02, 0.12, spl.r) * (1.0 - smoothstep(0.14, 0.26, spl.r));
tcol *= 1.0 + lip * 0.1;
float trench = smoothstep(0.22, 0.55, spl.r) * (1.0 - smoothstep(0.86, 1.0, spl.r));
tcol *= 1.0 - 0.42 * trench;
float tAO = mix(0.45, 1.0, spl.b); tcol *= mix(1.0, tAO, 0.6);
// wet shoreline: darker, glossier just above the water line
float wet = 1.0 - smoothstep(-0.32, -0.16, vWP.y);
tcol *= 1.0 - 0.35 * wet; rr = mix(rr, 0.25, wet * 0.8);
if (vWP.y < -0.3) tcol *= mix(0.55, 1.0, smoothstep(-0.55, -0.3, vWP.y));
diffuseColor.rgb *= tcol;
vec3 nT = nAt2(tTn, uvT, am), nP = nAt2(tPn, uvP, am * 0.6), nS = unpackN(texture2D(tSn, uvS)), nC = unpackN(texture2D(tCn, uvC));
vec3 nb = mix(mix(mix(nT, nP, fG), nS, fS), nC, fC); nb.xy *= 1.15 * (1.0 - wet * 0.6);
vec3 Nw = normalize(vWN); vec3 Tw = normalize(vec3(1.0, 0.0, 0.0) - Nw * Nw.x); vec3 Bw = cross(Nw, Tw);
vec3 tNW = normalize(Tw * nb.x + Bw * nb.y + Nw * max(nb.z, 0.25));`)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = rr;')
        .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(tNW, 0.0)).xyz);')
        .replace('#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= tAO; reflectedLight.indirectSpecular *= tAO;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += cDep * spl.a * (0.55 + 0.45 * sin(uTime * 3.0));');
    };
    const ground = new THREE.Mesh(geo, mat); ground.receiveShadow = true; ground.castShadow = true; ground.userData.own = true; ground.name = 'ground';
    this.level.add(ground); this.ground = ground;
    // under-skirt so the edges never show the void
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(EW * 3, EH * 3), new THREE.MeshBasicMaterial({ color: B.fog })); skirt.rotation.x = -Math.PI / 2; skirt.position.y = voidHaz ? -5 : -0.8; this.level.add(skirt);
    // water / lava / void planes
    this.water = null;
    if (B.water) {
      // water: depth from the terrain heightfield drives tint, transparency and shoreline foam; low roughness reflects the HDRI sky (IBL)
      const H = this.hf, wd = new Uint8Array(H.nx * H.nz);
      for (let k = 0; k < wd.length; k++) wd[k] = Math.max(0, Math.min(255, (WATER_Y - H.h[k]) / 0.26 * 255));
      const dTex = new THREE.DataTexture(wd, H.nx, H.nz, THREE.RedFormat); dTex.magFilter = dTex.minFilter = THREE.LinearFilter; dTex.needsUpdate = true;
      const base = new THREE.Color(B.water);
      const wm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.06, metalness: 0.0, transparent: true, envMapIntensity: 1.7, depthWrite: false });
      const WU = { tDepth: { value: dTex }, tWN: { value: T.water }, cShal: { value: base.clone().lerp(new THREE.Color(0xe8fff4), 0.25) }, cDeep: { value: base.clone().multiplyScalar(0.12) }, uTime: this.uTime, uOrig: { value: new THREE.Vector4(X0, Z0, EW, EH) } };
      wm.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, WU);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP2;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP2; uniform sampler2D tDepth, tWN; uniform vec3 cShal, cDeep; uniform float uTime; uniform vec4 uOrig;`)
          .replace('#include <map_fragment>', `
float dep = texture2D(tDepth, (vWP2.xz - uOrig.xy) / uOrig.zw).r;
vec2 q = vWP2.xz;
vec3 w1 = texture2D(tWN, q * 0.35 + vec2(uTime * 0.021, uTime * 0.013)).xyz * 2.0 - 1.0;
vec3 w2 = texture2D(tWN, q * 0.61 * mat2(0.8, -0.6, 0.6, 0.8) - vec2(uTime * 0.017, -uTime * 0.025)).xyz * 2.0 - 1.0;
vec3 wn = normalize(vec3(w1.xy + w2.xy, 1.4));
float fd = smoothstep(0.0, 1.0, dep);
vec3 wcol = mix(cShal, cDeep, sqrt(fd));
// shoreline foam: animated bands that thin out with depth
float fn = texture2D(tWN, q * 1.7 + vec2(uTime * 0.04, 0.0)).b;
float band = 0.5 + 0.5 * sin(dep * 40.0 - uTime * 2.2 + fn * 6.0);
float foam = (1.0 - smoothstep(0.0, 0.35, dep)) * smoothstep(0.45, 0.85, band * 0.6 + fn * 0.7) + (1.0 - smoothstep(0.0, 0.06, dep)) * 0.8;
foam = clamp(foam, 0.0, 1.0);
wcol = mix(wcol, vec3(0.95), foam * 0.85);
diffuseColor.rgb = wcol;
diffuseColor.a = clamp(mix(0.55, 0.96, fd) + foam * 0.5, 0.0, 1.0);`)
          .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.05, 0.6, foam);')
          .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(wn.x, wn.z, -wn.y, 0.0)).xyz);');
      };
      const w = new THREE.Mesh(new THREE.PlaneGeometry(EW, EH), wm); w.rotation.x = -Math.PI / 2; w.position.set(X0 + EW / 2, WATER_Y, Z0 + EH / 2); w.receiveShadow = true; w.renderOrder = 2; this.level.add(w); this.water = w; w.userData.own = true;
      T.water.repeat.set(1, 1); T.water.offset.set(0, 0); this.water.userData.shader = true;
    } else if (B.haz === 'lava') {
      const lm = new THREE.MeshStandardMaterial({ color: 0xff6010, emissive: 0xff4a08, emissiveIntensity: 1.6, roughness: 0.6, normalMap: T.water, normalScale: new THREE.Vector2(0.8, 0.8) });
      const w = new THREE.Mesh(new THREE.PlaneGeometry(EW, EH), lm); w.rotation.x = -Math.PI / 2; w.position.set(X0 + EW / 2, WATER_Y - 0.05, Z0 + EH / 2); this.level.add(w); this.water = w; this.water.userData.lava = true;
      T.water.repeat.set(EW / 4, EH / 4);
    } else if (voidHaz) {
      const cm = new THREE.MeshBasicMaterial({ map: T.soft, color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
      const r = rng(L.seed + 3);
      for (let i = 0; i < 40; i++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cm); c.rotation.x = -Math.PI / 2; c.scale.setScalar(1.5 + r() * 2.5); c.position.set((r() - 0.5) * EW, -3.4 - r() * 0.8, (r() - 0.5) * EH); this.level.add(c); }
    }
  }
  buildDeco(L, B) {
    const r = rng(L.seed + 9); const roots = []; const grid = this.g.grid;
    const G = GLBDECO[L.biome] || GLBDECO.verdant; const useGLB = ASSETS.ready;
    const db = new DecoBatch(), tb = new TreeBatch(); const tint = G.tint ?? null;
    const pick = (a) => a[Math.floor(r() * a.length)];
    const rockAt = (x, z, s, list = G.rocks) => { const n = pick(list); db.add(n, x, this.heightAt(x, z) - 0.02 * s, z, r() * 6.28, s, tint, 0.8 + r() * 0.4); };
    const treeAt = (x, z, h) => { const kind = pick(G.trees); const ids = TREES[kind]; if (!ids) return; const id = pick(ids); tb.add(id, x, this.heightAt(x, z) - 0.04, z, h * (kind === 'palm' ? 1.3 : 1), r() < 0.5); };
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const v = grid[y * GW + x], wx = cellX(x), wz = cellZ(y);
      if (v === C.ROCK) {
        const kind = B.obst[Math.floor(r() * B.obst.length)];
        if (useGLB && kind === 'ruin') { this.ruinAt(db, wx, wz, r, tint, 0.9); continue; }
        if (useGLB && kind === 'rock') { rockAt(wx, wz, 0.78 + r() * 0.2); if (r() < 0.7) rockAt(wx + (r() - 0.5) * 0.6, wz + (r() - 0.5) * 0.6, 0.25 + r() * 0.15, G.small); continue; }
        const d = decoMesh(kind, B, r, 1); d.position.set(wx, this.heightAt(wx, wz), wz); d.rotation.y = r() * 6.28; roots.push(d);
        if (useGLB) rockAt(wx + (r() - 0.5) * 0.5, wz + (r() - 0.5) * 0.5, 0.3 + r() * 0.15, G.small);
      }
      else if (v === C.DEPOSIT) {
        const g = new THREE.Group(); const cm = crystalMat(0xffe070, 0xffa020, 1.1);
        for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(crystalGeo(0.06 + r() * 0.04, 0.22 + r() * 0.2, 5, 'dep' + i), cm); m.position.set(0.24 + (r() - 0.5) * 0.15, 0, -0.22 + (r() - 0.5) * 0.15); m.rotation.set((r() - 0.5) * 0.6, r() * 6, (r() - 0.5) * 0.6); m.castShadow = true; g.add(m); }
        if (useGLB) rockAt(wx + 0.24, wz - 0.22, 0.28, G.small); else g.add(rockPile(r, B.rockMat, 3, 0.18, 0.08).translateX(0.24).translateZ(-0.22));
        g.position.set(wx, 0, wz); roots.push(g);
      }
    }
    // margin scatter: photoscanned rocks, impostor trees, ground cover, plus the biome's fantasy pieces
    const target = useGLB ? 210 : 150;
    let tries = 0, placed = 0;
    while (placed < target && tries++ < target * 10) {
      const x = X0 + 0.5 + r() * (EW - 1), z = Z0 + 0.5 + r() * (EH - 1);
      if (x > -GW / 2 - 0.15 && x < GW / 2 + 0.15 && z > -GH / 2 - 0.4 && z < GH / 2 + 0.15) continue;
      if (this.segD(x, z) < 1.0) continue;
      const hy = this.heightAt(x, z); if (hy < -0.1) continue;
      const near = Math.abs(x) < GW / 2 + 1.2 && z > -GH / 2 - 1.2 && z < GH / 2 + 1.2;
      let kind = B.deco[Math.floor(r() * B.deco.length)];
      if (useGLB && G.cover.length && r() < 0.28) kind = 'cover';
      if (near && kind === 'pine' && r() < 0.5) continue; // keep tall trees from hiding the board
      if (useGLB) {
        if (kind === 'ruin') { this.ruinAt(db, x, z, r, tint, 1 + r() * 0.5); placed++; continue; }
        if (kind === 'rock') { rockAt(x, z, 0.5 + r() * 0.9); if (r() < 0.5) rockAt(x + (r() - 0.5) * 0.9, z + (r() - 0.5) * 0.9, 0.2 + r() * 0.2, G.small); placed++; continue; }
        if (kind === 'pine' && G.trees.length) { const n = 1 + (r() < 0.45 ? 1 : 0) + (near ? 0 : (r() < 0.3 ? 1 : 0)); for (let i = 0; i < n; i++) treeAt(x + (i ? (r() - 0.5) * 0.9 : 0), z + (i ? (r() - 0.5) * 0.9 : 0), (near ? 1.1 : 1.4) + r() * 0.9); placed++; continue; }
        if (kind === 'cover') { const n = pick(G.cover); let sc = (n.includes('trunk') ? 1.2 : n.includes('crate') || n.includes('barrel') ? 0.5 : n.includes('stump') ? 0.55 : 0.6) * (0.7 + r() * 0.6); const dh = decoHeight(n); if (dh * sc > 0.85) sc = 0.85 / dh * (0.8 + r() * 0.3); db.add(n, x, hy - 0.02, z, r() * 6.28, sc, n.includes('fern') || n.includes('shrub') ? G.coverTint ?? null : tint); placed++; continue; }
      }
      const d = decoMesh(kind, B, r, 0.9 + r() * 0.7); d.position.set(x, hy - 0.03, z); d.rotation.y = r() * 6.28; roots.push(d); placed++;
      if (useGLB && r() < 0.6) rockAt(x + (r() - 0.5) * 0.7, z + (r() - 0.5) * 0.7, 0.25 + r() * 0.25, G.small);
    }
    // small rocks along the carved path edges
    for (const [ax, az, bx, bz] of this.segs) {
      const len = Math.hypot(bx - ax, bz - az); const n = Math.floor(len * 0.8);
      for (let i = 0; i < n; i++) {
        if (r() < 0.45) continue; const t = r(); const side = r() < 0.5 ? -1 : 1; const nx = -(bz - az) / len, nz = (bx - ax) / len;
        const x = ax + (bx - ax) * t + nx * side * 0.52, z = az + (bz - az) * t + nz * side * 0.52;
        const inGrid = x > -GW / 2 - 0.3 && x < GW / 2 + 0.3 && z > -GH / 2 - 0.3 && z < GH / 2 + 0.3; if (inGrid) continue;
        if (useGLB) { rockAt(x, z, 0.14 + r() * 0.16, G.small); continue; }
        const p = rockPile(r, B.rockMat, 1 + Math.floor(r() * 3), 0.12, 0.09); p.position.set(x, this.heightAt(x, z), z); roots.push(p);
      }
    }
    const baked = bake(roots); baked.traverse(o => { if (o.isMesh) o.userData.own = true; }); this.level.add(baked);
    if (useGLB) {
      db.build(this.level, true);
      tb.build(this.level, this.uTime, true, G.treeTint ?? 0xffffff);
    }
    this.buildTufts(L, B);
    this.buildGrass(L, B);
  }
  // weathered standing stones (photoscanned rock stretched upright) with rubble at the foot
  ruinAt(db, x, z, r, tint, s) {
    const y = this.heightAt(x, z) - 0.03;
    db.add(r() < 0.5 ? 'stone_01' : 'rock_07', x, y, z, r() * 6.28, 0.42 * s, tint, 2.6 + r() * 1.4);
    if (r() < 0.6) db.add('rock_09', x + 0.32 * s, y, z + (r() - 0.5) * 0.4, r() * 6.28, 0.3 * s, tint, 0.8);
    if (r() < 0.5) db.add('stone_01', x - 0.3 * s, y, z + (r() - 0.5) * 0.4, r() * 6.28, 0.22 * s, tint, 0.7);
  }
  buildTufts(L, B) {
    const r = rng(L.seed + 21);
    const g1 = new THREE.PlaneGeometry(0.34, 0.26); g1.translate(0, 0.13, 0); const g2 = g1.clone().rotateY(Math.PI / 2);
    const geo = mergeGeometries([g1, g2]); const nrm = geo.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    const mat = new THREE.MeshStandardMaterial({ map: B.tuftTex, alphaTest: 0.45, side: THREE.DoubleSide, color: B.tuftT, roughness: 1 });
    mat.onBeforeCompile = (sh) => { sh.uniforms.uTime = this.uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
#ifdef USE_INSTANCING
vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
#else
vec4 ip = vec4(0.0);
#endif
float sw = position.y * 3.5; transformed.x += sin(uTime * 2.1 + ip.x * 1.3 + ip.z * 0.7) * 0.05 * sw; transformed.z += cos(uTime * 1.7 + ip.z * 1.1) * 0.03 * sw;`); };
    const max = 160; const im = new THREE.InstancedMesh(geo, mat, max); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let n = 0, tries = 0;
    while (n < max && tries++ < max * 4) {
      const x = X0 + r() * EW, z = Z0 + r() * EH; const y = this.heightAt(x, z);
      if (y < -0.08) continue; const inGrid = x > -GW / 2 && x < GW / 2 && z > -GH / 2 && z < GH / 2;
      if (inGrid) continue;
      if (Math.abs(this.heightAt(x + 0.2, z) - y) > 0.12 || Math.abs(this.heightAt(x, z + 0.2) - y) > 0.12) continue;
      if (this.segD(x, z) < 0.5) continue;
      const k = 0.8 + r() * 0.9; q.setFromAxisAngle(up, r() * 6.28); s.set(k, k * (0.8 + r() * 0.5), k); p.set(x, y - 0.01, z); m4.compose(p, q, s); im.setMatrixAt(n++, m4);
    }
    im.count = n; im.userData.max = n; im.receiveShadow = true; im.castShadow = false; im.frustumCulled = false; this.level.add(im); this.tuftMesh = im;
  }
  // instanced grass blades (High+): clumps of tapered blades coloured from the ground texture under them, swaying in a travelling wind
  buildGrass(L, B) {
    this.grassMesh = null;
    const GR = { verdant: 1, mire: 0.7, sky: 0.9, reef: 0.25 }[L.biome]; if (!GR) return;
    const r = rng(L.seed + 33);
    const blades = [];
    for (let b = 0; b < 7; b++) {
      const hgt = 0.09 + r() * 0.1, w = 0.012 + r() * 0.008, a = r() * 6.28, lean = (r() - 0.5) * 0.5, ox = (r() - 0.5) * 0.16, oz = (r() - 0.5) * 0.16;
      const P = [], U = []; const seg = 3;
      for (let i = 0; i <= seg; i++) { const t = i / seg, ww = w * (1 - t * 0.92), bend = lean * t * t * hgt; P.push([-ww, t * hgt, bend], [ww, t * hgt, bend]); U.push([0, t], [1, t]); }
      const g = new THREE.BufferGeometry(); const pos = [], uv = [], idx = [];
      const ca = Math.cos(a), sa = Math.sin(a);
      P.forEach(([x, y, z]) => pos.push(ox + x * ca - z * sa, y, oz + x * sa + z * ca)); U.forEach(u => uv.push(...u));
      for (let i = 0; i < seg; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      const n = new Float32Array(pos.length); for (let i = 0; i < n.length; i += 3) { n[i] = 0.1; n[i + 1] = 1; n[i + 2] = 0.2; } g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
      blades.push(g);
    }
    const geo = mergeGeometries(blades);
    const TR = B.terr, Ly = B.layers;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.5 });
    const GU = { tG: { value: Ly[0].c }, uGS: { value: TR.s[0] }, cG: { value: terrTint(TR, 0) }, uTime: this.uTime };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, GU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uGS; uniform sampler2D tG; uniform vec3 cG; varying vec3 vGC; varying float vGH;')
        .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
vGC = textureLod(tG, ip.xz * uGS, 5.0).rgb * cG; vGH = clamp(position.y / 0.17, 0.0, 1.0);
float k = vGH * vGH;
float gust = sin(uTime * 0.9 + ip.x * 0.35 - ip.z * 0.22) * 0.5 + 0.5;
transformed.x += (sin(uTime * 2.3 + ip.x * 1.7 + ip.z * 0.9) * 0.025 + gust * 0.045) * k;
transformed.z += cos(uTime * 1.9 + ip.z * 1.3) * 0.018 * k;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGC; varying float vGH;')
        .replace('#include <map_fragment>', 'diffuseColor.rgb *= mix(vGC * 0.6, vGC * 1.5 + vec3(0.03, 0.05, 0.0), vGH);')
        .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(0.1, 1.0, 0.25, 0.0)).xyz);');
    };
    const max = Math.round(5200 * GR); const im = new THREE.InstancedMesh(geo, mat, max);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const grid = this.g.grid, bx = cellX(L.base[0]), bz = cellZ(0.5);
    let n = 0, tries = 0;
    while (n < max && tries++ < max * 6) {
      const x = X0 + 1 + r() * (EW - 2), z = Z0 + 3 + r() * (EH - 3); const y = this.heightAt(x, z);
      if (y < -0.1 || this.segD(x, z) < 0.62) continue;
      if (Math.abs(x - bx) < 1.9 && Math.abs(z - bz) < 1.6) continue;
      if (Math.abs(this.heightAt(x + 0.15, z) - y) > 0.06 || Math.abs(this.heightAt(x, z + 0.15) - y) > 0.06) continue;
      const cx = Math.round(x + (GW - 1) / 2), cy = Math.round(z + (GH - 1) / 2);
      if (cx >= 0 && cy >= 0 && cx < GW && cy < GH) { const v = grid[cy * GW + cx]; if (v === C.WATER || v === C.HAZARD || v === C.ROCK || v === C.DEPOSIT) continue; }
      const patch = TX.fbm(x * 0.22 + 3, z * 0.22 + 7, 64, 3, 21); if (patch > 0.7 && r() < 0.85) continue;
      const k = 0.7 + r() * 0.8; q.setFromAxisAngle(up, r() * 6.28); sc.set(k, k * (0.8 + r() * 0.6), k); p.set(x, y - 0.005, z); m4.compose(p, q, sc); im.setMatrixAt(n++, m4);
    }
    im.count = n; im.receiveShadow = true; im.castShadow = false; im.frustumCulled = false; im.visible = this.quality >= 3; im.name = 'grass';
    geo.userData = {}; im.userData.own = true; this.level.add(im); this.grassMesh = im;
  }
  buildAmbient(B) {
    const N = 220; this.ambN = N; const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), ph = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 14; pos[i * 3 + 1] = Math.random() * 3; pos[i * 3 + 2] = (Math.random() - 0.5) * 22; ph[i] = Math.random() * 6.28; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const type = B.amb;
    const cfg = { fireflies: [0xd8ff70, 0.13, true], snow: [0xffffff, 0.09, false], embers: [0xff8a30, 0.09, true], dust: [0xfff0d0, 0.06, false], sparks: [0xc8a0ff, 0.08, true] }[type] || [0xffffff, 0.06, false];
    const m = new THREE.PointsMaterial({ color: cfg[0], size: cfg[1], map: this.T.soft, transparent: true, depthWrite: false, opacity: type === 'dust' ? 0.5 : 0.9, blending: cfg[2] ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true });
    const p = new THREE.Points(g, m); p.frustumCulled = false; this.level.add(p); this.ambP = p; this.ambV = { vel, ph, type };
  }
  stepAmbient(dt) {
    if (!this.ambP) return; const pos = this.ambP.geometry.attributes.position.array, { ph, type } = this.ambV; const t = this.time; const N = this.ambN;
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      if (type === 'snow') { pos[k + 1] -= dt * (0.35 + (i % 5) * 0.05); pos[k] += Math.sin(t + ph[i]) * dt * 0.2; if (pos[k + 1] < -0.2) { pos[k + 1] = 3; pos[k] = (Math.random() - 0.5) * 14; pos[k + 2] = (Math.random() - 0.5) * 22; } }
      else if (type === 'embers' || type === 'sparks') { pos[k + 1] += dt * (0.3 + (i % 4) * 0.1); pos[k] += Math.sin(t * 2 + ph[i]) * dt * 0.15; if (pos[k + 1] > 3) { pos[k + 1] = 0; pos[k] = (Math.random() - 0.5) * 14; pos[k + 2] = (Math.random() - 0.5) * 22; } }
      else { pos[k] += Math.sin(t * 0.7 + ph[i]) * dt * 0.25; pos[k + 1] = 0.3 + (type === 'dust' ? 1.5 : 0.8) * (0.5 + 0.5 * Math.sin(t * 0.5 + ph[i] * 3)) + (i % 3) * 0.2; pos[k + 2] += Math.cos(t * 0.6 + ph[i]) * dt * 0.25; }
    }
    this.ambP.geometry.attributes.position.needsUpdate = true;
    if (type === 'fireflies' || type === 'sparks') this.ambP.material.opacity = 0.6 + 0.35 * Math.sin(t * 3);
  }
  showRange(x, z, r) { if (r == null) { this.rangeRing.visible = false; return; } this.rangeRing.visible = true; this.rangeRing.position.set(x, Math.max(0, this.heightAt(x, z)) + 0.04, z); this.rangeRing.scale.set(r, 1, r); }
  showCell(cx, cy, color = 0xffe060) { if (cx == null) { this.cellHL.visible = false; return; } this.cellHL.visible = true; this.cellHL.material.color.set(color); const x = cellX(cx), z = cellZ(cy); this.cellHL.position.set(x, Math.max(WATER_Y, this.heightAt(x, z)) + 0.05, z); }
  showValid(cells, color = 0x80ff80) {
    this.validHL.clear(); if (!cells) return;
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false, depthTest: false });
    for (const [cx, cy] of cells) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.84), m); p.rotation.x = -Math.PI / 2; const x = cellX(cx), z = cellZ(cy); p.position.set(x, Math.max(WATER_Y, this.heightAt(x, z)) + 0.045, z); p.renderOrder = 4; this.validHL.add(p); }
  }
  showPathHL(on) {
    this.pathHL.clear(); if (!on) return;
    const m = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.28, depthWrite: false, depthTest: false });
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (this.g.grid[y * GW + x] === C.PATH) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), m); p.rotation.x = -Math.PI / 2; p.position.set(cellX(x), PATH_D + 0.045, cellZ(y)); p.renderOrder = 4; this.pathHL.add(p); }
  }

  // ---------------- particles ----------------
  // GPU particles: each particle is written once at spawn (origin, velocity, birth time, life); the vertex shader integrates
  // motion, gravity, ground bounce, growth and fade, so the CPU never touches live particles
  initParticles() {
    const mk = (N, additive, tex, smoke) => {
      const g = new THREE.BufferGeometry();
      const A0 = new Float32Array(N * 4), AV = new Float32Array(N * 4), AC = new Float32Array(N * 3), AP = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) { A0[i * 4 + 3] = -1e4; AP[i * 4 + 1] = 0.001; }
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      const at = { a0: new THREE.BufferAttribute(A0, 4), av: new THREE.BufferAttribute(AV, 4), ac: new THREE.BufferAttribute(AC, 3), ap: new THREE.BufferAttribute(AP, 4) };
      for (const [k, v] of Object.entries(at)) { v.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, v); }
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { scale: { value: 300 }, map: { value: tex }, uT: { value: 0 } },
        defines: smoke ? { SMOKE: 1 } : {},
        vertexShader: `attribute vec4 a0, av, ap; attribute vec3 ac; uniform float scale, uT; varying vec3 vC; varying float vA; varying float vR;
void main(){
  float t = uT - a0.w, life = ap.y;
  if (t < 0.0 || t > life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  vec3 p = a0.xyz + av.xyz * t; p.y -= 0.5 * av.w * t * t;
  if (p.y < -0.15) p.y = -0.15 + abs(p.y + 0.15) * 0.15;
  float k = 1.0 - t / life;
  vC = ac;
#ifdef SMOKE
  vA = min(1.0, (1.0 - k) * 6.0) * k * 0.6; vR = ap.w + t * 0.6;
#else
  vA = k; vR = ap.w;
#endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = ap.x * (1.0 + ap.z * (1.0 - k)) * scale / (-mv.z);
  gl_Position = projectionMatrix * mv; }`,
        fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; varying float vR; void main(){ vec2 p=gl_PointCoord-0.5; float c=cos(vR), s=sin(vR); p=vec2(c*p.x-s*p.y, s*p.x+c*p.y)+0.5; vec4 t=texture2D(map,p); gl_FragColor=vec4(vC*t.rgb, t.a*vA); }',
      });
      const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 8;
      return { p, N, A0, AV, AC, AP, at, next: 0, lo: N, hi: -1 };
    };
    this.P1 = mk(3000, true, this.T.soft, false); this.P2 = mk(800, false, this.T.smoke, true);
    this.points = this.P1.p; this.points2 = this.P2.p;
    this._col = new THREE.Color();
  }
  emit(P, x, y, z, vx, vy, vz, color, size, life, grow = 0, grav = 0) {
    const i = P.next; P.next = (P.next + 1) % P.N;
    P.A0[i * 4] = x; P.A0[i * 4 + 1] = y; P.A0[i * 4 + 2] = z; P.A0[i * 4 + 3] = this.time;
    P.AV[i * 4] = vx; P.AV[i * 4 + 1] = vy; P.AV[i * 4 + 2] = vz; P.AV[i * 4 + 3] = grav;
    const c = this._col.set(color); P.AC[i * 3] = c.r; P.AC[i * 3 + 1] = c.g; P.AC[i * 3 + 2] = c.b;
    P.AP[i * 4] = size; P.AP[i * 4 + 1] = life; P.AP[i * 4 + 2] = grow; P.AP[i * 4 + 3] = Math.random() * 6.28;
    if (i < P.lo) P.lo = i; if (i > P.hi) P.hi = i;
  }
  burst(x, y, z, color, n, speed, size, life, opts = {}) {
    const q = this.quality >= 3 ? 1 : this.quality === 2 ? 0.7 : 0.4;
    for (let i = 0; i < n * q; i++) {
      const a = Math.random() * 6.28, u = Math.random() * 2 - 1, s = speed * (0.4 + Math.random() * 0.6), k = Math.sqrt(1 - u * u);
      this.emit(this.P1, x, y, z, Math.cos(a) * k * s, Math.abs(u) * s * (opts.up ?? 1), Math.sin(a) * k * s, color, size * (0.6 + Math.random() * 0.6), life * (0.6 + Math.random() * 0.6), opts.grow || 0, opts.grav ?? 4);
    }
  }
  smoke(x, y, z, n, color = 0x2a2a2a, size = 0.5) {
    const q = this.quality >= 2 ? 1 : 0.5;
    for (let i = 0; i < n * q; i++) this.emit(this.P2, x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6, color, size, 0.9 + Math.random() * 0.7, 1.2, -0.25);
  }
  // upload only the slots written this frame
  stepParticles(dt) {
    for (const P of [this.P1, this.P2]) {
      P.p.material.uniforms.uT.value = this.time;
      if (P.hi >= P.lo) {
        for (const a of Object.values(P.at)) { a.clearUpdateRanges(); a.addUpdateRange(P.lo * a.itemSize, (P.hi - P.lo + 1) * a.itemSize); a.needsUpdate = true; }
        P.lo = P.N; P.hi = -1;
      }
    }
    const s = this.h / (2 * Math.tan(this.camera.fov * Math.PI / 360));
    this.P1.p.material.uniforms.scale.value = s * 0.5; this.P2.p.material.uniforms.scale.value = s * 0.5;
  }
  addFx(o, life, upd) { this.dyn.add(o); this.effects.push({ o, t: 0, life, upd }); }
  flare(x, y, z, color, size, life = 0.08) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.T.flare, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.position.set(x, y, z); s.scale.setScalar(size); s.renderOrder = 9; s.material.rotation = Math.random() * 6.28;
    this.addFx(s, life, (e, k) => { s.material.opacity = 1 - k; s.scale.setScalar(size * (1 + k * 0.6)); });
  }
  scorch(x, z, r) {
    if (this.quality < 2) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.T.soft, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, this.heightAt(x, z) + 0.02, z); m.scale.setScalar(r * 2); m.renderOrder = 1;
    this.addFx(m, 6, (e, k) => { m.material.opacity = 0.5 * (1 - k * k); });
  }
  ring(x, z, r, color, life = 0.45, y) {
    y = y ?? Math.max(WATER_Y, this.heightAt(x, z)) + 0.08;
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
    this.addFx(m, life, (e, k) => { const s = r * (0.3 + 0.7 * Math.sqrt(k)); m.scale.set(s, s, s); m.material.opacity = 0.9 * (1 - k); });
  }
  beamFx(pts, color, life, width = 0.05, jitter = 0) {
    const positions = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay, az] = pts[i], [bx, by, bz] = pts[i + 1]; const segs = jitter ? 6 : 1; let px = ax, py = ay, pz = az;
      for (let s = 1; s <= segs; s++) { const k = s / segs; let nx = ax + (bx - ax) * k, ny = ay + (by - ay) * k, nz = az + (bz - az) * k; if (s < segs && jitter) { nx += (Math.random() - 0.5) * jitter; ny += (Math.random() - 0.5) * jitter; nz += (Math.random() - 0.5) * jitter; } positions.push(px, py, pz, nx, ny, nz); px = nx; py = ny; pz = nz; }
    }
    // thick beams: cylinders per segment
    const grp = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < positions.length; i += 6) { const m = new THREE.Mesh(this.unitCyl(), mat); this.seg(m, positions[i], positions[i + 1], positions[i + 2], positions[i + 3], positions[i + 4], positions[i + 5], width); grp.add(m); }
    this.addFx(grp, life, (e, k) => { mat.opacity = 1 - k; });
  }
  unitCyl() { return this._ucyl || (this._ucyl = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0)); }
  seg(m, ax, ay, az, bx, by, bz, r) {
    const d = new THREE.Vector3(bx - ax, by - ay, bz - az); const l = d.length() || 0.001;
    m.position.set(ax, ay, az); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.divideScalar(l)); m.scale.set(r, l, r);
  }
  pillar(x, z, color, life, radius = 0.25, height = 14) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, height / 2, z);
    this.addFx(m, life, (e, k) => { m.material.opacity = 0.9 * (1 - k); m.scale.set(1 + k, 1, 1 + k); });
  }
  breakup(m, f = 1) {
    const u = m.userData; const col = u.body ? u.body.color.clone() : new THREE.Color(0x888888); const n = Math.round((this.quality >= 3 ? 10 : this.quality === 2 ? 6 : 3) * f);
    const big = m.scale.x * (u.big || 1); const mat = u.body || MAT.dark;
    const p = new THREE.Vector3(); m.getWorldPosition(p); const y0 = p.y + (u.air ? 0.95 : 0.3);
    for (let i = 0; i < n; i++) {
      const s = 0.04 + Math.random() * 0.07; const d = new THREE.Mesh(i % 3 ? new THREE.BoxGeometry(s, s * 0.7, s * 1.2) : new THREE.TetrahedronGeometry(s), i % 2 ? mat : MAT.dark); d.castShadow = true;
      d.position.set(p.x + (Math.random() - 0.5) * 0.2, y0, p.z + (Math.random() - 0.5) * 0.2);
      d.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3), w: new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0), life: 1.1 + Math.random() * 0.5 };
      this.dyn.add(d); this.debris.push(d);
    }
  }
  stepCorpses(dt) {
    for (const m of this.corpses) {
      const u = m.userData; u.dieT += dt; u.mixer.update(dt);
      if (u.dieT > 0.9) { m.position.y -= dt * 0.5; u.sh.material = u.sh.material; }
      if (u.dieT > 1.8) { this.dyn.remove(m); u.dead = true; }
    }
    this.corpses = this.corpses.filter(m => !m.userData.dead);
  }
  stepDebris(dt) {
    for (const d of this.debris) {
      const u = d.userData; u.life -= dt; u.v.y -= 9 * dt; d.position.addScaledVector(u.v, dt); d.rotation.x += u.w.x * dt; d.rotation.y += u.w.y * dt;
      const gy = this.heightAt(d.position.x, d.position.z) + 0.03; if (d.position.y < gy) { d.position.y = gy; u.v.y *= -0.35; u.v.x *= 0.6; u.v.z *= 0.6; u.w.multiplyScalar(0.6); }
      if (u.life < 0.3) d.scale.setScalar(Math.max(0.01, u.life / 0.3));
      if (u.life <= 0) { this.dyn.remove(d); d.geometry.dispose(); }
    }
    this.debris = this.debris.filter(d => d.userData.life > 0);
  }
  muzzleWorld(tm, k) {
    const a = tm && tm.userData.anim; if (!a || !a.muzzles.length) return null;
    const mz = a.muzzles[k % a.muzzles.length]; tm.updateMatrixWorld(true); return a.head.localToWorld(new THREE.Vector3(...mz));
  }
  consumeFx(game, ui) {
    this.dies = [];
    for (const f of game.fx) {
      switch (f.t) {
        case 'muzzle': {
          const col = { gun: 0xffd070, missile: 0xff9040, naval: 0xffc080, destroyer: 0xff5040, energy: 0x90ff70, reaper: 0xff60c0 }[f.k] || 0xffe080;
          const tm = this.tmap.get(f.tid);
          let p = null;
          if (tm) { tm.userData.shot = (tm.userData.shot || 0) + 1; p = this.muzzleWorld(tm, tm.userData.shot); tm.userData.recoil = 1; }
          if (!p) p = new THREE.Vector3(f.x, (f.base ? 1.25 : 0.45) + Math.max(0, this.heightAt(f.x, f.z)), f.z);
          const big = f.k === 'gun' ? 0.45 : f.k === 'naval' || f.k === 'destroyer' ? 0.9 : 0.6;
          this.flare(p.x, p.y, p.z, col, big, 0.07);
          this.burst(p.x, p.y, p.z, col, f.k === 'gun' ? 2 : 5, 1.2, 0.12, 0.12, { grav: 0 });
          if (f.k === 'naval' || f.k === 'destroyer' || f.k === 'missile') this.smoke(p.x, p.y, p.z, 2, 0x6a6a6a, 0.35);
          break;
        }
        case 'boom': {
          const col = f.c ?? 0xffa040; const y = Math.max(WATER_Y, this.heightAt(f.x, f.z));
          this.flare(f.x, y + 0.35, f.z, 0xffd090, 1.2 + f.r * 1.4, 0.18);
          this.burst(f.x, y + 0.3, f.z, col, 10 + f.r * 14, 2.5 + f.r * 2, 0.3 + f.r * 0.2, 0.45, { grav: 3 });
          this.burst(f.x, y + 0.2, f.z, 0xffe0a0, 6, 4, 0.08, 0.5, { grav: 7 });
          this.ring(f.x, f.z, f.r * 1.1, col, 0.4);
          if (f.r > 0.9) this.shake = Math.max(this.shake || 0, 0.12);
          if (f.k !== 'lob') { this.smoke(f.x, y + 0.3, f.z, 3 + Math.round(f.r * 3), 0x3a3633, 0.6); this.scorch(f.x, f.z, 0.3 + f.r * 0.4); }
          else this.flare(f.x, y + 0.2, f.z, 0x80ff60, 1 + f.r, 0.3);
          break;
        }
        case 'hit': { const y = Math.max(0, this.heightAt(f.x, f.z)); this.burst(f.x, y + 0.4, f.z, f.k === 'bolt' ? 0xff5050 : 0xffe080, 3, 1.5, 0.12, 0.2, { grav: 2 }); this.flare(f.x, y + 0.4, f.z, 0xfff0c0, 0.3, 0.06); break; }
        case 'die': {
          const c = f.race === 'rust' ? 0xff8040 : 0x60ffd0; const y = this.heightAt(f.x, f.z);
          const big = f.type === 'boss' ? 3 : f.type === 'brute' || f.type === 'tank' ? 1.6 : 1;
          this.dies.push(f);
          this.flare(f.x, y + (f.air ? 0.95 : 0.35), f.z, c, 0.9 * big, 0.2);
          this.burst(f.x, y + (f.air ? 0.95 : 0.35), f.z, c, 10 * big, 2.5 * big, 0.26 * big, 0.5, { grav: 5 });
          this.smoke(f.x, y + 0.3, f.z, Math.round(2 * big), f.race === 'rust' ? 0x2a2420 : 0x4a8a80, 0.45 * big);
          if (f.race === 'rust') this.scorch(f.x, f.z, 0.3 * big);
          if (big > 1) { this.ring(f.x, f.z, 1.2 * big, c, 0.5); this.shake = Math.max(this.shake || 0, 0.1 * big); }
          if (ui) ui.floatText(f.x, 0.8, f.z, '+' + f.g, 'gold');
          break;
        }
        case 'bossdie': this.ring(f.x, f.z, 4, 0xffffff, 0.8); this.flare(f.x, 1, f.z, 0xffffff, 5, 0.4); this.shake = 0.6; break;
        case 'dmg': if (ui) ui.floatText(f.x, 1.0, f.z, f.v, f.crit ? 'crit' : 'dmg'); break;
        case 'chain': { const P = f.pts.map(([x, z], i) => [x, i === 0 ? 1.1 : 0.45 + Math.max(0, this.heightAt(x, z)), z]); this.beamFx(P, 0xb070ff, 0.18, 0.045, 0.35); this.beamFx(P, 0xffffff, 0.1, 0.018, 0.2); for (const [x, y, z] of P.slice(1)) { this.burst(x, y, z, 0xc080ff, 3, 1.2, 0.18, 0.2, { grav: 0 }); this.flare(x, y, z, 0xc080ff, 0.5, 0.12); } break; }
        case 'strike': this.pillar(f.x, f.z, 0xff6040, 0.7, 0.5); this.pillar(f.x, f.z, 0xffffff, 0.4, 0.2); this.ring(f.x, f.z, f.r * 1.3, 0xff8040, 0.7); this.flare(f.x, 0.5, f.z, 0xffc080, 6, 0.4); this.burst(f.x, 0.3, f.z, 0xffa040, 50, 5, 0.45, 0.7); this.smoke(f.x, 0.3, f.z, 10, 0x333333, 0.9); this.scorch(f.x, f.z, f.r); this.shake = 0.5; break;
        case 'strikeMark': { const m = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.7, 40), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, depthWrite: false, depthTest: false })); m.rotation.x = -Math.PI / 2; m.position.set(f.x, Math.max(0, this.heightAt(f.x, f.z)) + 0.06, f.z); this.addFx(m, 1.1, (e, k) => { m.material.opacity = 0.5 + 0.5 * Math.sin(k * 30); m.rotation.z = k * 4; }); this.pillar(f.x, f.z, 0xff4020, 1.1, 0.04); break; }
        case 'freeze': for (const e of game.enemies) this.burst(e.x, 0.5, e.z, 0xa0e8ff, 6, 1.5, 0.25, 0.6, { grav: 0 }); this.flash = { c: '#9fe8ff', a: 0.35 }; break;
        case 'build': this.ring(f.x, f.z, 0.8, 0xffe080, 0.4); this.smoke(f.x, 0.1, f.z, 5, 0x8a7a60, 0.45); this.burst(f.x, 0.2, f.z, 0xffe080, 10, 1.5, 0.1, 0.4, { grav: 3 }); break;
        case 'upgrade': this.ring(f.x, f.z, 0.9, 0x80ff80, 0.5); this.burst(f.x, 0.4, f.z, 0x80ff80, 16, 2, 0.18, 0.6, { grav: -1 }); this.pillar(f.x, f.z, 0x80ff80, 0.5, 0.35, 3); break;
        case 'sell': this.smoke(f.x, 0.2, f.z, 6, 0x8a7a60, 0.5); if (ui) ui.floatText(f.x, 0.8, f.z, '+' + f.v, 'gold'); break;
        case 'coin': this.burst(f.x, 0.6, f.z, 0xffd040, 10, 1.8, 0.16, 0.45, { grav: 2 }); this.flare(f.x, 0.65, f.z, 0xffe080, 0.8, 0.2); if (ui) ui.floatText(f.x, 0.9, f.z, '+' + f.v, 'gold'); break;
        case 'coinSpawn': this.burst(f.x, 0.9, f.z, 0xfff0a0, 6, 1.2, 0.18, 0.4, { grav: 3 }); break;
        case 'cleared': this.burst(f.x, 0.4, f.z, 0xffa040, 24, 3, 0.3, 0.6); this.smoke(f.x, 0.3, f.z, 8, 0x5a4a3a, 0.6); this.flare(f.x, 0.4, f.z, 0xffc080, 2, 0.25); if (ui) ui.floatText(f.x, 1.0, f.z, `+${f.g} +1◆`, 'gold'); break;
        case 'leak': this.shake = 0.25; this.flash = { c: '#ff2020', a: 0.25 }; if (this.baseGroup) this.burst(this.baseGroup.position.x, 0.8, this.baseGroup.position.z, 0xff4030, 12, 2.5, 0.3, 0.5); break;
        case 'dome': this.ring(this.baseGroup.position.x, this.baseGroup.position.z, 2, 0x60e0ff, 0.6, 0.1); break;
      }
    }
  }

  // ---------------- per-frame sync ----------------
  projMesh(kind) {
    const C3 = this._pc || (this._pc = {
      tracer: new THREE.MeshBasicMaterial({ color: 0xffe890, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      bolt: new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      plasma: new THREE.MeshStandardMaterial({ color: 0xa0ff80, emissive: 0x60ff40, emissiveIntensity: 2.2, roughness: 0.3, flatShading: true }),
      shell: new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.7, roughness: 0.4 }),
      ico: new THREE.IcosahedronGeometry(0.11, 0), sph: new THREE.SphereGeometry(0.07, 10, 8), mbody: new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8).rotateX(Math.PI / 2), mnose: new THREE.ConeGeometry(0.035, 0.08, 8).rotateX(Math.PI / 2).translate(0, 0, 0.15), mfin: new THREE.BoxGeometry(0.12, 0.012, 0.05).translate(0, 0, -0.09),
    });
    const sp = (c, s) => { const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.T.flare, color: c, blending: THREE.AdditiveBlending, depthWrite: false })); o.scale.setScalar(s); return o; };
    const g = new THREE.Group();
    if (kind === 'bullet') { const m = new THREE.Mesh(this.unitCyl(), C3.tracer); g.add(m); g.userData.tr = m; g.add(sp(0xffe080, 0.18)); }
    else if (kind === 'bolt') { const m = new THREE.Mesh(this.unitCyl(), C3.bolt); g.add(m); g.userData.tr = m; g.add(sp(0xff5050, 0.35)); }
    else if (kind === 'lob') { const m = new THREE.Mesh(C3.ico, C3.plasma); g.add(m); g.userData.spin = m; g.add(sp(0x80ff60, 0.7)); }
    else if (kind === 'missile') { const b = new THREE.Group(); b.add(new THREE.Mesh(C3.mbody, MAT.metal)); b.add(new THREE.Mesh(C3.mnose, MAT.redLight)); const f1 = new THREE.Mesh(C3.mfin, MAT.dark); b.add(f1); const f2 = f1.clone(); f2.rotation.z = Math.PI / 2; b.add(f2); const fl = sp(0xffa040, 0.3); fl.position.z = -0.15; b.add(fl); g.add(b); g.userData.body = b; }
    else if (kind === 'shell') { g.add(new THREE.Mesh(C3.sph, C3.shell)); g.add(sp(0xffc080, 0.3)); }
    else g.add(sp(0xffffff, 0.3));
    g.traverse(o => { o.castShadow = false; }); return g;
  }
  syncBeam(t, tm, g) {
    let b = this.beams.get(t.id);
    if (!b) { b = new THREE.Group(); b.userData.segs = []; this.dyn.add(b); this.beams.set(t.id, b); }
    const out = new THREE.MeshBasicMaterial({ color: 0x70d8ff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.MeshBasicMaterial({ color: 0xeaffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    let last = [t.x, tm.position.y + (tm.userData.anim.beamY || 0.8), t.z], n = 0;
    for (const id of t.beams || []) {
      const e = g.enemies.find(o => o.id === id); if (!e) continue;
      const p = [e.x, this.heightAt(e.x, e.z) + (e.air ? 0.95 : 0.35), e.z];
      while (b.userData.segs.length <= n) { const s = new THREE.Group(); s.add(new THREE.Mesh(this.unitCyl(), b.userData.out || (b.userData.out = out))); s.add(new THREE.Mesh(this.unitCyl(), b.userData.core || (b.userData.core = core))); b.add(s); b.userData.segs.push(s); }
      const s = b.userData.segs[n++]; s.visible = true;
      const w = 0.045 + Math.sin(this.time * 30 + n) * 0.01;
      this.seg(s.children[0], ...last, ...p, w); this.seg(s.children[1], ...last, ...p, w * 0.35);
      if (Math.random() < 0.35) this.burst(p[0], p[1], p[2], 0xc0f0ff, 1, 0.8, 0.16, 0.3, { grav: 0 });
      if (Math.random() < 0.2) this.flare(p[0], p[1], p[2], 0x9fe8ff, 0.4, 0.08);
      last = p;
    }
    for (let i = n; i < b.userData.segs.length; i++) b.userData.segs[i].visible = false;
  }
  frame(dt, game, ui, sel) {
    this.time += dt; this.frameN++; if (this.uTime) this.uTime.value = this.time;
    if (!this.inBattle) {
      if (this.planet) { this.planet.rotation.y += dt * 0.05; this.clouds.rotation.y += dt * 0.065; }
      if (this.ships) this.ships.forEach((s, i) => { s.position.x += dt * (0.25 + i * 0.1); if (s.position.x > 6) s.position.x = -6; });
      this.render(dt); return;
    }
    const g = game;
    this.consumeFx(g, ui);
    // towers
    const seen = new Set();
    for (const t of g.towers) {
      seen.add(t.id);
      let m = this.tmap.get(t.id); const key = t.lvl + ':' + t.branch;
      if (!m || m.userData.key !== key) {
        const born = m ? m.userData.born : this.time; if (m) this.dyn.remove(m);
        m = towerMesh(t); m.userData.key = key; m.userData.tid = t.id; m.userData.born = born;
        const water = g.grid[t.cy * GW + t.cx] === C.WATER;
        m.position.set(t.x, water ? WATER_Y - 0.03 : Math.max(0, this.heightAt(t.x, t.z)), t.z);
        m.userData.anim.h0 = m.userData.anim.head.position.clone(); m.userData.y0 = m.position.y;
        this.dyn.add(m); this.tmap.set(t.id, m);
      }
      const a = m.userData.anim;
      const age = this.time - m.userData.born; const sc = age < 0.3 ? 0.3 + age / 0.3 * 0.7 : 1; m.scale.setScalar(sc);
      if (!a.noAim) a.head.rotation.y += ((t.aim - a.head.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 15);
      const firing = t.target != null;
      for (const s of a.spin) { if (t.kind === 'gun' && !a.float) s.rotation.z += dt * (firing ? 30 : 1.5); else s.rotation.y += dt * (firing ? 2.5 : 0.8); }
      if (a.float) for (const s of a.spin) s.position.y = a.float + Math.sin(this.time * 2 + t.id) * 0.05;
      if (t.kind === 'naval') m.position.y = m.userData.y0 + Math.sin(this.time * 1.5 + t.id) * 0.025;
      if (a.column) { const k = 1 - Math.min(1, (t.coinT || 0) / 14); a.column.material.opacity = 0.12 + 0.3 * k; a.column.scale.y = 0.5 + 0.7 * k; }
      if (m.userData.recoil) { m.userData.recoil = Math.max(0, m.userData.recoil - dt * 8); const r = 0.05 * m.userData.recoil; a.head.position.set(a.h0.x - Math.sin(a.head.rotation.y) * r, a.h0.y, a.h0.z - Math.cos(a.head.rotation.y) * r); }
      if (t.kind === 'cryo') this.syncBeam(t, m, g);
    }
    for (const [id, m] of this.tmap) if (!seen.has(id)) { this.dyn.remove(m); this.tmap.delete(id); }
    for (const [id, b] of this.beams) { const t = seen.has(id) && g.towers.find(o => o.id === id); if (!t || !t.beams || !t.beams.length) { b.userData.segs.forEach(s => s.visible = false); if (!seen.has(id)) { this.dyn.remove(b); this.beams.delete(id); } } }
    // enemies
    const es = new Set();
    for (const e of g.enemies) {
      es.add(e.id);
      let m = this.emap.get(e.id);
      if (!m) { m = enemyMesh(e.type, e.race); m.scale.setScalar(1.35); this.dyn.add(m); this.emap.set(e.id, m); }
      const gy = this.heightAt(e.x, e.z);
      m.position.set(e.x, e.air ? Math.max(gy, WATER_Y) : gy, e.z); m.rotation.y = e.rot;
      const u = m.userData; const moving = !e.blocked && g.freezeT <= 0;
      const ph = this.time * (e.type === 'swarm' ? 22 : 10) * (1 - (e.slow || 0)) + e.id;
      for (const l of u.legs) { if (l.flap || u.air) l.p.rotation.z = Math.sin(this.time * 16 + e.id + l.phase) * (l.amp || 0.4); else if (moving) l.p.rotation.x = Math.sin(ph + l.phase) * l.amp; }
      for (const s of u.spin) s.rotation.y += dt * 30;
      if (u.mixer) {
        // skinned walk cycle, stride synced to actual ground speed
        const base = ENEMIES[e.type].speed || 1; const v = e.speed * (1 - (e.slow || 0)) * (1 + (e.hasted || 0));
        if (u.act) u.act.timeScale = moving ? Math.max(0.35, Math.min(2.2, v / base)) * (e.type === 'swarm' ? 1.5 : 1.05) : (u.air ? 0.6 : 0.12);
        if (this.quality >= 2 || ((this.frameN + e.id) & 1) === 0) u.mixer.update(this.quality >= 2 ? dt : dt * 2);
        if (u.air) { u.inner.position.y = 0.95 + Math.sin(this.time * 3 + e.id) * 0.08; u.inner.rotation.z = Math.sin(this.time * 2 + e.id) * 0.1; u.sh.material.opacity = 0.35; }
      } else {
        if (u.air) u.inner.position.y = 0.95 + Math.sin(this.time * 3 + e.id) * 0.08; else { u.inner.position.y = moving ? Math.abs(Math.sin(ph)) * 0.03 : 0; u.inner.rotation.z = moving ? Math.sin(ph) * 0.07 : 0; u.inner.rotation.x = moving ? 0.05 + Math.cos(ph * 2) * 0.025 : 0; }
        if (u.air) { u.inner.rotation.z = Math.sin(this.time * 2 + e.id) * 0.1; u.sh.material.opacity = 0.35; }
      }
      const fl = u.flash || [{ m: u.body, em: u.baseEm, ei: u.baseEI }];
      const mode = e.hitT > 0 ? 1 : ((e.slow || 0) > 0 || g.freezeT > 0) ? 2 : 0;
      if (mode !== u.fmode) { u.fmode = mode; for (const f of fl) { if (mode === 1) { f.m.emissive.setRGB(1, 1, 1); f.m.emissiveIntensity = 0.6; } else if (mode === 2) { f.m.emissive.setRGB(0.25, 0.55, 0.9); f.m.emissiveIntensity = 0.6; } else { f.m.emissive.copy(f.em); f.m.emissiveIntensity = f.ei; } } }
      const f = Math.max(0, e.hp / e.maxHp);
      u.hb.visible = f < 0.999;
      if (u.hb.visible) { u.fg.scale.x = Math.max(0.01, f); u.fg.position.x = -0.22 * (1 - f); u.fg.material.color.setHSL(f * 0.33, 0.95, 0.5); u.hb.quaternion.copy(m.quaternion).invert().multiply(this.camera.quaternion); }
      if (e.hasted && Math.random() < 0.1) this.burst(e.x, gy + 0.3, e.z, 0xff3030, 1, 0.5, 0.15, 0.3, { grav: -1 });
    }
    for (const [id, m] of this.emap) if (!es.has(id)) {
      const died = this.dies && this.dies.some(d => Math.hypot(d.x - m.position.x, d.z - m.position.z) < 0.9);
      if (died && m.userData.mixer && m.userData.death && this.quality >= 2 && this.corpses.length < 24) {
        // play the death clip, then sink into the ground
        const u = m.userData; u.hb.visible = false; u.mixer.stopAllAction(); const a = u.mixer.clipAction(u.death); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = 1.6; a.play();
        u.dieT = 0; this.corpses.push(m); this.breakup(m, 0.5); this.emap.delete(id); continue;
      }
      if (died) this.breakup(m);
      this.dyn.remove(m); this.emap.delete(id);
    }
    // projectiles
    const ps = new Set();
    for (const p of g.proj) {
      ps.add(p.id);
      let m = this.pmap.get(p.id);
      const y = (p.y ?? 0.5);
      if (!m) { m = this.projMesh(p.kind); m.position.set(p.x, y, p.z); this.dyn.add(m); this.pmap.set(p.id, m); }
      const prev = m.position.clone(); m.position.set(p.x, y, p.z);
      const u = m.userData;
      if (u.tr) { const dx = p.tx - p.x, dz = p.tz - p.z, l = Math.hypot(dx, dz) || 1; const tl = p.kind === 'bolt' ? 0.55 : 0.45; this.seg(u.tr, -dx / l * tl, 0, -dz / l * tl, 0, 0, 0, p.kind === 'bolt' ? 0.03 : 0.016); }
      if (u.spin) { u.spin.rotation.x += dt * 8; u.spin.rotation.y += dt * 5; if (Math.random() < 0.7) this.emit(this.P1, p.x, y, p.z, 0, 0, 0, 0x70ff50, 0.28, 0.3, 0, 0); }
      if (u.body) {
        const d = m.position.clone().sub(prev); if (d.lengthSq() > 1e-6) u.body.lookAt(m.position.clone().add(d)), u.body.position.set(0, 0, 0);
        if (u.body.parent === m) { u.body.position.set(0, 0, 0); }
        if (this.quality >= 2 || Math.random() < 0.5) { this.emit(this.P2, p.x, y, p.z, (Math.random() - 0.5) * 0.1, 0.15, (Math.random() - 0.5) * 0.1, 0x8a8a8a, 0.22, 0.8, 2, -0.15); this.emit(this.P1, p.x, y, p.z, 0, 0, 0, 0xffa040, 0.16, 0.12, 0, 0); }
      }
      if (p.kind === 'shell' && Math.random() < 0.4) this.emit(this.P2, p.x, y, p.z, 0, 0.1, 0, 0x777777, 0.12, 0.4, 1, 0);
    }
    for (const [id, m] of this.pmap) if (!ps.has(id)) { this.dyn.remove(m); this.pmap.delete(id); }
    // coins
    const cs = new Set();
    for (const c of g.coins) {
      cs.add(c.id);
      let m = this.cmap.get(c.id);
      if (!m) {
        m = new THREE.Group();
        const cm = this._coinMat || (this._coinMat = new THREE.MeshStandardMaterial({ color: 0xffc020, emissive: 0xc07800, emissiveIntensity: 0.8, metalness: 0.9, roughness: 0.25 }));
        const coin = new THREE.Mesh(this._coinGeo || (this._coinGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24)), cm); coin.rotation.x = Math.PI / 2; coin.castShadow = true; m.add(coin);
        const rim = new THREE.Mesh(this._rimGeo || (this._rimGeo = new THREE.TorusGeometry(0.2, 0.025, 6, 24)), cm); m.add(rim);
        const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.T.flare, color: 0xffd060, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 })); gl.scale.setScalar(0.9); m.add(gl);
        this.dyn.add(m); this.cmap.set(c.id, m);
      }
      m.position.set(c.x, 0.65 + Math.sin(this.time * 4 + c.id) * 0.08, c.z); m.rotation.y = this.time * 3;
      m.visible = c.life - c.t > 3 || Math.sin(this.time * 20) > 0;
    }
    for (const [id, m] of this.cmap) if (!cs.has(id)) { this.dyn.remove(m); this.cmap.delete(id); }
    // objects (targets / beacons)
    const os = new Set();
    for (const o of g.objects) {
      os.add(o.id);
      let m = this.omap.get(o.id);
      if (!m) {
        m = new THREE.Group(); const r = rng(o.id * 7 + 3);
        if (o.kind === 'target') {
          m.add(rockPile(r, this.B.rockMat, 5, 0.32, 0.2));
          const ms = new THREE.Group(); ms.position.set(0.05, 0.25, 0.05); ms.rotation.set(0.9, 0.6, 0.2);
          ms.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10), MAT.metal)); ms.add(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.15, 10), MAT.redLight).translateY(0.32));
          for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.012), MAT.dark); f.position.y = -0.2; f.rotation.y = i * Math.PI / 4; ms.add(f); }
          m.add(ms);
        } else {
          m.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.0, 8), MAT.stoneDark).translateY(0.5)); m.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.14), MAT.gold).translateY(0.82));
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), glow(0xff3030, 1.8)); orb.position.y = 1.15; m.add(orb); m.userData.orb = orb;
          const aura = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.2, 64), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.25, depthWrite: false })); aura.rotation.x = -Math.PI / 2; aura.position.y = 0.05; m.add(aura); m.userData.aura = aura;
        }
        m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        const ch = new THREE.Group(); const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false });
        ch.add(new THREE.Mesh(new THREE.RingGeometry(0.22, 0.27, 32), cm));
        for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.16), cm); const a = i * Math.PI / 2; b.position.set(Math.sin(a) * 0.33, Math.cos(a) * 0.33, 0); b.rotation.z = -a; ch.add(b); }
        ch.position.y = o.kind === 'beacon' ? 1.6 : 1.0; ch.renderOrder = 20; ch.children.forEach(c => c.renderOrder = 20); m.add(ch); m.userData.ch = ch;
        m.position.set(o.x, Math.max(0, this.heightAt(o.x, o.z)), o.z); this.dyn.add(m); this.omap.set(o.id, m);
      }
      m.userData.ch.quaternion.copy(this.camera.quaternion); m.userData.ch.scale.setScalar(1 + Math.sin(this.time * 4) * 0.08);
      if (m.userData.orb) { m.userData.orb.position.y = 1.15 + Math.sin(this.time * 3) * 0.08; m.userData.aura.material.opacity = 0.15 + 0.12 * Math.sin(this.time * 4); }
    }
    for (const [id, m] of this.omap) if (!os.has(id)) { this.dyn.remove(m); this.omap.delete(id); }
    for (const L of g.lasers) if (!L.fxd) { L.fxd = true; this.pillar(L.x, L.z, 0xffa030, L.dur + 0.2, 0.08); this.pillar(L.x, L.z, 0xffffff, L.dur, 0.03); }
    for (const L of g.lasers) if (L.t < L.dur) { this.burst(L.x, 0.4, L.z, 0xffc060, 2, 2, 0.2, 0.25); if (Math.random() < 0.3) this.flare(L.x, 0.3, L.z, 0xffc060, 1, 0.1); }
    // blocks & mines
    const bs = new Set();
    for (const b of g.blocks) { bs.add(b.id); let m = this.bmap.get(b.id); if (!m) { m = new THREE.Group(); const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.85), MAT.stone); c1.position.y = 0.25; c1.castShadow = true; m.add(c1); const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.87, 0.08, 0.87), MAT.stripes); c2.position.y = 0.42; m.add(c2); m.position.set(b.x, this.heightAt(b.x, b.z), b.z); this.dyn.add(m); this.bmap.set(b.id, m); this.smoke(b.x, 0.1, b.z, 6, 0x9a9a94, 0.5); } m.scale.y = 0.4 + 0.6 * b.hp / b.maxHp; }
    for (const [id, m] of this.bmap) if (!bs.has(id)) { this.dyn.remove(m); this.bmap.delete(id); }
    const ms = new Set();
    for (const mi of g.mines) { ms.add(mi.id); let m = this.mmap.get(mi.id); if (!m) { m = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.08, 12), MAT.dark); c.position.y = 0.04; m.add(c); const l = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), MAT.redLight); l.position.y = 0.1; m.add(l); m.userData.l = l; m.position.set(mi.x, this.heightAt(mi.x, mi.z), mi.z); this.dyn.add(m); this.mmap.set(mi.id, m); } m.userData.l.visible = Math.sin(this.time * 8 + mi.id) > 0; }
    for (const [id, m] of this.mmap) if (!ms.has(id)) { this.dyn.remove(m); this.mmap.delete(id); }
    // base
    if (this.baseCrystal) { if (this.baseCrystal.userData.y0 == null) this.baseCrystal.userData.y0 = this.baseCrystal.position.y; this.baseCrystal.rotation.y += dt; this.baseCrystal.position.y = this.baseCrystal.userData.y0 + Math.sin(this.time * 2) * 0.06; }
    if (MAT.dome) MAT.dome.emissiveIntensity = 0.6 + 0.25 * Math.sin(this.time * 2.2);
    if (this.shield) { this.shield.visible = g.dome > 0; this.shield.material.opacity = 0.08 + 0.05 * Math.sin(this.time * 3); }
    if (this.baseGun && g.bgun) this.baseGun.rotation.y = g.bgun.aim;
    // water shimmer
    if (this.water && !this.water.userData.shader) { const t = this.T.water; t.offset.x = this.time * 0.02; t.offset.y = this.time * 0.013; if (this.water.userData.lava) this.water.material.emissiveIntensity = 1.4 + 0.35 * Math.sin(this.time * 1.7); }
    // effects
    for (const e of this.effects) { e.t += dt; e.upd(e, Math.min(1, e.t / e.life)); if (e.t >= e.life) { this.dyn.remove(e.o); e.o.traverse(o => { if (o.geometry && o.geometry !== this._ucyl) o.geometry.dispose(); if (o.material && o.isSprite) o.material.dispose(); }); e.dead = true; } }
    this.effects = this.effects.filter(e => !e.dead);
    this.stepParticles(dt); this.stepDebris(dt); this.stepAmbient(dt); this.stepCorpses(dt);
    // screen shake around the fitted camera
    if (this.camBase) { if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt); const s = this.shake * 0.15; this.camera.position.set(this.camBase.x + (Math.random() - 0.5) * s, this.camBase.y + (Math.random() - 0.5) * s * 0.5, this.camBase.z); } else this.camera.position.copy(this.camBase); }
    this.render(dt);
  }
  render(dt) {
    this.fpsT += dt; this.fpsN++;
    if (this.fpsT > 2) {
      const fps = this.fpsN / this.fpsT; this.fpsT = 0; this.fpsN = 0;
      if (this.autoQ !== false) { if (fps < 38 && this.quality > 1) { this.lowCount++; if (this.lowCount >= 2) { this.setQuality(this.quality - 1); this.lowCount = 0; } } else this.lowCount = 0; }
      this.lastFps = fps;
    }
    this.grade.uniforms.time.value = this.time;
    if (this.quality >= 2) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
  }
}

// ---------------- portrait icons (rendered once after init) ----------------
export function makeIcons(towerKinds, enemyTypes) {
  const S = 128;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  let r;
  try { r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true, alpha: false }); } catch (e) { return {}; }
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.setPixelRatio(1); r.setSize(S, S, false);
  const sc = new THREE.Scene();
  try { const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; sc.environmentIntensity = 0.9; } catch (e) { }
  r.toneMappingExposure = 1.2;
  sc.add(new THREE.HemisphereLight(0xdfe8ff, 0x403020, 1.8));
  const dl = new THREE.DirectionalLight(0xfff4e0, 3.2); dl.position.set(-2, 4, 3); sc.add(dl);
  const rim = new THREE.DirectionalLight(0x80e0ff, 1.5); rim.position.set(2, 2, -3); sc.add(rim);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const grad = (a, b) => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'); const l = g.createLinearGradient(0, 0, 0, 128); l.addColorStop(0, a); l.addColorStop(1, b); g.fillStyle = l; g.fillRect(0, 0, 4, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const out = {};
  const shot = (obj, bg, h, dist) => { sc.background = bg; sc.add(obj); cam.position.set(dist * 0.55, h + dist * 0.6, dist * 0.8); cam.lookAt(0, h * 0.55, 0); r.render(sc, cam); const url = cv.toDataURL('image/png'); sc.remove(obj); return url; };
  const tb = grad('#4a5e6c', '#1a2228');
  for (const k of towerKinds) { const m = towerMesh({ kind: k, lvl: k === 'factory' ? 1 : 0, branch: -1, id: 1, x: 0, z: 0, coinT: 0, beams: [] }); m.rotation.y = -0.6; out['t_' + k] = shot(m, tb, 0.62, 1.8); }
  const rb = grad('#5a3a26', '#1e140e'), gb = grad('#1e5a52', '#0a1e1c');
  for (const [type, race] of enemyTypes) {
    const m = enemyMesh(type, race); if (m.userData.mixer) m.userData.mixer.update(0.35); if (m.userData.hb) m.userData.hb.visible = false; if (m.userData.sh) m.userData.sh.visible = false; m.rotation.y = 0.6;
    const big = type === 'boss' ? 2.4 : type === 'brute' ? 1.6 : type === 'tank' ? 1.3 : 1;
    out['e_' + type + '_' + race] = shot(m, race === 'rust' ? rb : gb, (ENEMIES[type].air ? 0.9 : 0.35) * Math.min(big, 1.6), 1.6 * big);
  }
  r.dispose(); try { r.forceContextLoss(); } catch (e) { }
  return out;
}
