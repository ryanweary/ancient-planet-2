import { GW, GH, WORLDS, UNLOCKS, ENEMIES, ENEMY_UNLOCK, BOSS_ABIL } from './data.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
export const C = { FREE: 0, PATH: 1, ROCK: 2, WATER: 3, DEPOSIT: 4, BASE: 5, TARGET: 6, BEACON: 7, HAZARD: 8 };
const WATER_BIOMES = { reef: 1, frost: 1, mire: 1, storm: 1, city: 1 };
const HAZARD_BIOMES = { forge: 1, sky: 1 };

function cellsOf(pts) {
  const cells = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n);
      if (x >= 0 && x < GW && y >= 0 && y < GH) cells.push([x, y]);
    }
  }
  return cells;
}

function genMainPath(r, world, bx) {
  const pts = [];
  let x = ri(r, 1, GW - 2), y = GH - 1;
  pts.push([x, GH + 0.7]);
  const firstClimb = ri(r, 1, 2);
  y -= firstClimb; pts.push([x, y]);
  const minClimb = world >= 3 ? 2 : 2, maxClimb = world >= 4 ? 3 : 4;
  while (true) {
    const k = ri(r, minClimb, maxClimb);
    if (y - k < 3) break;
    let nx;
    let tries = 0;
    do { nx = ri(r, 0, GW - 1); tries++; } while ((Math.abs(nx - x) < 3 || (world < 1 && Math.abs(nx - x) > 6)) && tries < 50);
    pts.push([nx, y]); x = nx;
    y -= k; pts.push([x, y]);
  }
  if (x !== bx) pts.push([bx, y]);
  pts.push([bx, 2]);
  pts.push([bx, 1.05]);
  return pts;
}

export function plen(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; }

// Twists per level: deterministic, themed by biome. World 1 has none; later worlds stack more.
const TWIST_POOL = {
  verdant: ['supply', 'goldrush'], reef: ['supply', 'goldrush', 'fog', 'airraid'], frost: ['fog', 'armored', 'regen', 'swift'],
  mire: ['fog', 'regen', 'horde', 'bounty'], forge: ['armored', 'bounty', 'horde', 'scarce'], sky: ['airraid', 'swift', 'supply', 'scarce'],
  storm: ['storm', 'airraid', 'swift', 'regen'], city: ['storm', 'armored', 'scarce', 'horde', 'regen', 'bounty'],
};
function levelTwistCount(world, l) {
  if (world === 0) return 0;
  if (world === 1) return (l === 1 || l === 3) ? 1 : 0;
  return l === 0 ? 0 : (world >= 5 && (l === 2 || l === 4)) ? 2 : 1;
}
export function levelTwists(idx) {
  const world = Math.floor(idx / 5), l = idx % 5;
  if (world === 0) return [];
  const n = levelTwistCount(world, l);
  const pool = TWIST_POOL[WORLDS[world].biome].slice(), r = rng(4242 + world * 977);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  if (world === 1) pool.sort((a, b) => (b === 'supply') - (a === 'supply'));   // first twist ever seen is a friendly one
  let start = 0; for (let k = 0; k < l; k++) start += levelTwistCount(world, k);
  const out = [];
  for (let j = 0; out.length < n && j < pool.length * 2; j++) { const t = pool[(start + j) % pool.length]; if (!out.includes(t)) out.push(t); }
  return out;
}
export function genLevel(idx, seedOff = 0) {
  const world = Math.floor(idx / 5), l = idx % 5;
  const W = WORLDS[world];
  for (let attempt = 0; attempt < 40; attempt++) {
    const r = rng(9001 + idx * 7919 + attempt * 104729 + seedOff * 31337);
    const grid = new Array(GW * GH).fill(C.FREE);
    const set = (x, y, v) => { grid[y * GW + x] = v; };
    const get = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH) ? -1 : grid[y * GW + x];
    const bx = ri(r, 2, GW - 3);
    for (let x = bx - 1; x <= bx + 1; x++) for (let y = 0; y <= 1; y++) set(x, y, C.BASE);
    const main = genMainPath(r, world, bx);
    const paths = [main];
    for (const [x, y] of cellsOf(main)) if (get(x, y) !== C.BASE) set(x, y, C.PATH);
    // second entrance from a side
    const twoPaths = (idx >= 8 && (l === 2 || l === 4)) || (idx >= 22 && l === 1) || (idx >= 30 && l !== 0);
    if (twoPaths) {
      let ok = false;
      for (let t = 0; t < 30 && !ok; t++) {
        const row = ri(r, 4, GH - 4);
        const fromLeft = r() < 0.5;
        const xs = fromLeft ? [...Array(GW).keys()] : [...Array(GW).keys()].reverse();
        let join = -1;
        for (const x of xs) if (get(x, row) === C.PATH) { join = x; break; }
        if (join < 0 || Math.abs(join - (fromLeft ? 0 : GW - 1)) < 2) continue;
        // avoid rows adjacent to horizontal runs of main path
        let clash = false;
        for (const x of xs) { if (x === join) break; if (get(x, row - 1) === C.PATH || get(x, row + 1) === C.PATH) clash = true; }
        if (clash) continue;
        // build path2 polyline: entrance -> join -> rest of main
        let acc = 0, seg = -1;
        for (let i = 0; i < main.length - 1; i++) {
          const [x0, y0] = main[i], [x1, y1] = main[i + 1];
          const onSeg = (x0 === x1 && join === x0 && row >= Math.min(y0, y1) && row <= Math.max(y0, y1)) || (y0 === y1 && row === y0 && join >= Math.min(x0, x1) && join <= Math.max(x0, x1));
          if (onSeg) { seg = i; break; }
        }
        if (seg < 0) continue;
        const p2 = [[fromLeft ? -0.7 : GW - 0.3, row], [join, row], ...main.slice(seg + 1)];
        for (const [x, y] of cellsOf(p2.slice(0, 2))) if (get(x, y) === C.FREE) set(x, y, C.PATH);
        paths.push(p2); ok = true;
      }
    }
    const free = () => { const out = []; for (let y = 2; y < GH; y++) for (let x = 0; x < GW; x++) if (get(x, y) === C.FREE) out.push([x, y]); return out; };
    const nearPath = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (get(x + dx, y + dy) === C.PATH) return true; return false; };
    // water / hazard blobs
    const blobs = WATER_BIOMES[W.biome] ? (idx >= 10 ? ri(r, 1, 2) : 1) : HAZARD_BIOMES[W.biome] ? ri(r, 1, 2) : 0;
    const blobType = HAZARD_BIOMES[W.biome] ? C.HAZARD : C.WATER;
    for (let b = 0; b < blobs; b++) {
      const f = free(); if (!f.length) break;
      let [x, y] = f[Math.floor(r() * f.length)];
      const size = ri(r, 3, 6);
      for (let s = 0; s < size; s++) {
        if (get(x, y) === C.FREE) set(x, y, blobType);
        const d = ri(r, 0, 3); x += [1, -1, 0, 0][d]; y += [0, 0, 1, -1][d];
        x = Math.max(0, Math.min(GW - 1, x)); y = Math.max(2, Math.min(GH - 1, y));
      }
    }
    // deposits near-ish to path but not on it
    const nDep = 2 + (l >= 2 ? 1 : 0) + (idx >= 20 ? 1 : 0);
    let f = free().filter(([x, y]) => y > 2);
    for (let i = 0; i < nDep && f.length; i++) { const j = Math.floor(r() * f.length); const [x, y] = f[j]; set(x, y, C.DEPOSIT); f = free(); }
    // targets (relic boulders w/ crosshair)
    const nT = idx === 0 ? 1 : ri(r, 1, 3);
    f = free().filter(([x, y]) => nearPath(x, y));
    for (let i = 0; i < nT && f.length; i++) { const j = Math.floor(r() * f.length); const [x, y] = f.splice(j, 1)[0]; set(x, y, C.TARGET); }
    // beacons (buff enemies) from idx 8
    if (idx >= 8) {
      const nB = idx >= 24 ? ri(r, 1, 2) : ri(r, 0, 1);
      f = free().filter(([x, y]) => nearPath(x, y));
      for (let i = 0; i < nB && f.length; i++) { const j = Math.floor(r() * f.length); const [x, y] = f.splice(j, 1)[0]; set(x, y, C.BEACON); }
    }
    // decorative rocks / trees (block building)
    const nR = ri(r, 6, 11);
    f = free();
    for (let i = 0; i < nR && f.length; i++) { const j = Math.floor(r() * f.length); const [x, y] = f.splice(j, 1)[0]; if (!nearPath(x, y) || r() < 0.35) set(x, y, C.ROCK); }
    // sanity: enough buildable cells near path
    const buildNear = free().filter(([x, y]) => nearPath(x, y)).length;
    if (buildNear < 14) continue;
    if (WATER_BIOMES[W.biome] && idx >= 10) {
      // ensure water touches path range somewhere
      let wOk = false;
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (get(x, y) === C.WATER) {
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (get(x + dx, y + dy) === C.PATH) wOk = true;
      }
      if (!wOk) continue;
    }
    const twists = levelTwists(idx);
    const lv = {
      idx, world, l, biome: W.biome, name: `${world + 1}-${l + 1}`, grid, paths, base: [bx, 0.5], seed: 77 + idx * 31 + seedOff,
      startGold: Math.round(130 + idx * 9.5 + (l === 4 ? 40 : 0)),
      twists, bossAbil: BOSS_ABIL[world],
      waves: genWaves(idx, paths.length, rng(5150 + idx * 613), twists),
      towers: Object.keys(UNLOCKS.tower).filter(k => UNLOCKS.tower[k] <= idx && !(k === 'factory' && twists.includes('bounty'))),
      powers: Object.keys(UNLOCKS.power).filter(k => UNLOCKS.power[k] <= idx),
    };
    return lv;
  }
  throw new Error('level gen failed ' + idx);
}

// per-level enemy HP multipliers, fitted by simulation with twists, new enemies and typical upgrades (node tests/balance.mjs fit);
// world 1 is capped at 1.5x the original values: the AI collects coins instantly, new players are still learning
export const HP_TABLE = [0.62, 0.85, 1.11, 1.44, 1.88, 1.15, 3.95, 3.99, 5.84, 3.35, 2.68, 6.95, 4.8, 5.79, 5.56, 5.48, 11.1, 11.24, 9.69, 9.26, 9.85, 16.28, 15.05, 17.9, 10.51, 19.63, 9.22, 23.85, 22.7, 13.77, 16.84, 8.79, 16.03, 15.39, 19.47, 15.2, 11.3, 35.61, 21.24, 22.12];
export const TUNE = { scale: 1, wave: 0.2 };
export function hpMul(idx) { return HP_TABLE[idx] * TUNE.scale; }

function waveGroups(idx, w, nW, nPaths, r, twists, endless = false) {
  const world = Math.floor(idx / 5), l = idx % 5;
  const allowed = Object.keys(ENEMY_UNLOCK).filter(k => k !== 'boss' && ENEMY_UNLOCK[k] <= idx);
  const raceBias = [0.75, 0.3, 0.6, 0.35, 0.8, 0.4, 0.55, 0.5][world];
  const base = 230 * (idx === 0 ? 0.7 : 1);
  const budget = base * Math.pow(1 + TUNE.wave * Math.min(w, endless ? 14 : 99), 1.3) * (1 + idx * 0.012);
  const groups = [];
  const last = w === nW - 1;
  const nG = w < 2 ? 1 : ri(r, 1, Math.min(3, 1 + Math.floor(w / 3)));
  const horde = twists.includes('horde');
  let delay = 0;
  if (endless ? (w > 0 && (w + 1) % 10 === 0) : (last && l === 4)) {
    groups.push({ type: 'boss', race: r() < raceBias ? 'rust' : 'glim', count: idx === 39 && !endless ? 2 : 1, interval: 8, delay: 3, path: 0 });
  }
  if (!endless && (l === 2 || l === 3) && last && idx >= 6) groups.push({ type: 'brute', race: r() < raceBias ? 'rust' : 'glim', count: 1 + Math.floor(world / 3), interval: 3, delay: 4, path: nPaths - 1 });
  for (let g = 0; g < nG; g++) {
    let type = allowed[Math.floor(r() * allowed.length)];
    // newest enemy shows up more often in the world that introduces it
    const fresh = allowed.filter(k => ENEMY_UNLOCK[k] >= 9 && idx - ENEMY_UNLOCK[k] < 5);
    if (fresh.length && w >= 2 && r() < 0.35) type = fresh[Math.floor(r() * fresh.length)];
    if (w === 0) type = 'grunt';
    if ((type === 'brute' || type === 'splitter') && w < 3) type = 'tank';
    if ((type === 'tank' || type === 'shield') && w < 2) type = 'grunt';
    if ((type === 'healer' || type === 'phantom') && w < 1) type = 'grunt';
    const race = r() < raceBias ? 'rust' : 'glim';
    const e = ENEMIES[type];
    const share = budget / nG;
    let count = Math.max(1, Math.round(share / e.hp));
    if (type === 'swarm') count = Math.min(count, 24);
    if (type === 'brute' || type === 'tank' || type === 'splitter') count = Math.min(count, 8);
    if (type === 'healer' || type === 'shield') count = Math.min(count, 6);
    count = Math.min(count, 30);
    if (horde) count = Math.min(48, count * 2);
    let interval = type === 'swarm' ? 0.45 : type === 'tank' ? 1.6 : type === 'brute' ? 2.6 : type === 'splitter' ? 2.0 : type === 'shield' ? 1.8 : 0.95;
    if (horde) interval *= 0.55;
    groups.push({ type, race, count, interval, delay, path: nPaths > 1 ? (g % nPaths) : 0 });
    delay += count * interval * 0.55 + 1.5;
  }
  if (twists.includes('airraid') && w >= 2 && ENEMY_UNLOCK.flyer <= Math.max(idx, 3)) {
    const n = Math.max(2, Math.round(budget * 0.35 / ENEMIES.flyer.hp));
    groups.push({ type: 'flyer', race: r() < 0.5 ? 'rust' : 'glim', count: Math.min(14, horde ? n * 2 : n), interval: 0.8, delay: delay * 0.5 + 2, path: 0 });
  }
  return groups;
}
function genWaves(idx, nPaths, r, twists = []) {
  const l = idx % 5;
  const nW = Math.min(18, 6 + Math.round(idx * 0.3) + (l === 4 ? 2 : 0) + (idx === 0 ? 0 : 1));
  const waves = [];
  for (let w = 0; w < nW; w++) waves.push(waveGroups(idx, w, nW, nPaths, r, twists));
  return waves;
}

// ---------------- Endless mode ----------------
// A fresh map in a chosen world; waves are generated on demand. Every 10th wave brings a Warlord, and every 10 waves a new mutation (twist) stacks on.
export const ENDLESS_HP = 6;   // tuned with tests/balance.mjs endless: ~wave 22-35 with mid-campaign upgrades, 40+ with a full tree
const MUTATIONS = ['swift', 'armored', 'regen', 'fog', 'airraid', 'storm', 'horde'];
export function genEndless(world, seed = 1) {
  const idx = world * 5 + 2;
  const L = genLevel(idx, 1000 + seed);
  const r = rng(777 + seed * 131 + world);
  L.endless = true; L.name = 'Endless'; L.twists = []; L.waves = []; L.idx = idx; L.world = world;
  L.startGold = Math.round(L.startGold * 1.15);
  L.towers = Object.keys(UNLOCKS.tower).filter(k => UNLOCKS.tower[k] <= Math.max(idx, 20));
  L.powers = Object.keys(UNLOCKS.power).filter(k => UNLOCKS.power[k] <= Math.max(idx, 16));
  L.bossAbil = BOSS_ABIL[world];
  L.hpBase = ENDLESS_HP;   // same base in every world (the campaign table bakes in twist compensation); the map and enemy mix set the rest
  L.hpScale = w => Math.pow(1.085, Math.max(0, w - 1)) * (1 + Math.max(0, w - 30) * 0.03);
  L.goldK = 1;
  const pool = MUTATIONS.slice();
  L.more = (w) => {
    while (L.waves.length <= w) {
      const n = L.waves.length;
      if (n > 0 && n % 10 === 0 && pool.length) { const k = pool.splice(Math.floor(r() * pool.length), 1)[0]; L.twists.push(k); L.mutated = { wave: n + 1, k }; }
      if ((n + 1) % 10 === 0) { const all = ['summon', 'heal', 'shield', 'cloak', 'emp', 'haste']; L.bossAbil = []; const k = Math.min(4, 1 + Math.floor(n / 20)); while (L.bossAbil.length < k) { const a = all[Math.floor(r() * all.length)]; if (!L.bossAbil.includes(a)) L.bossAbil.push(a); } }
      L.waves.push(waveGroups(Math.min(39, idx + Math.floor(n / 4)), n, 9999, L.paths.length, r, L.twists, true));
    }
  };
  L.more(0);
  return L;
}
