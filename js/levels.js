import { GW, GH, WORLDS, UNLOCKS, ENEMIES } from './data.js';

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

export function genLevel(idx) {
  const world = Math.floor(idx / 5), l = idx % 5;
  const W = WORLDS[world];
  for (let attempt = 0; attempt < 40; attempt++) {
    const r = rng(9001 + idx * 7919 + attempt * 104729);
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
    const lv = {
      idx, world, l, biome: W.biome, name: `${world + 1}-${l + 1}`, grid, paths, base: [bx, 0.5], seed: 77 + idx * 31,
      startGold: Math.round(130 + idx * 9.5 + (l === 4 ? 40 : 0)),
      waves: genWaves(idx, paths.length, rng(5150 + idx * 613)),
      towers: Object.keys(UNLOCKS.tower).filter(k => UNLOCKS.tower[k] <= idx),
      powers: Object.keys(UNLOCKS.power).filter(k => UNLOCKS.power[k] <= idx),
    };
    return lv;
  }
  throw new Error('level gen failed ' + idx);
}

// per-level enemy HP multipliers, calibrated by simulation (see ap2-test/capacity.mjs)
export const HP_TABLE = [0.44, 0.57, 0.74, 0.96, 1.25, 1.32, 1.72, 2.24, 2.91, 3.54, 4.54, 4.59, 5.97, 6.19, 5.88, 7.01, 9.11, 9.53, 9.05, 8.84, 11.49, 12.52, 11.89, 11.45, 10.88, 14.14, 13.43, 15.76, 20.31, 23.73, 20.74, 21.41, 20.5, 19.47, 25.31, 25.9, 26.51, 31.01, 29.47, 27.99];
export const TUNE = { scale: 1, wave: 0.2 };
export function hpMul(idx) { return HP_TABLE[idx] * TUNE.scale; }

function genWaves(idx, nPaths, r) {
  const world = Math.floor(idx / 5), l = idx % 5;
  const nW = Math.min(18, 6 + Math.round(idx * 0.3) + (l === 4 ? 2 : 0) + (idx === 0 ? 0 : 1));
  const allowed = ['grunt'];
  if (idx >= 0) allowed.push('swarm');
  if (idx >= 2) allowed.push('tank');
  if (idx >= 3) allowed.push('flyer');
  if (idx >= 6) allowed.push('brute');
  const raceBias = [0.75, 0.3, 0.6, 0.35, 0.8, 0.4, 0.55, 0.5][world];
  const waves = [];
  const base = 230 * (idx === 0 ? 0.7 : 1);
  for (let w = 0; w < nW; w++) {
    const budget = base * Math.pow(1 + TUNE.wave * w, 1.3) * (1 + idx * 0.012);
    const groups = [];
    const last = w === nW - 1;
    const nG = w < 2 ? 1 : ri(r, 1, Math.min(3, 1 + Math.floor(w / 3)));
    let delay = 0;
    if (last && l === 4) {
      groups.push({ type: 'boss', race: r() < raceBias ? 'rust' : 'glim', count: idx === 39 ? 2 : 1, interval: 8, delay: 3, path: 0 });
    }
    if ((l === 2 || l === 3) && last && idx >= 6) groups.push({ type: 'brute', race: r() < raceBias ? 'rust' : 'glim', count: 1 + Math.floor(world / 3), interval: 3, delay: 4, path: nPaths - 1 });
    for (let g = 0; g < nG; g++) {
      let type = allowed[Math.floor(r() * allowed.length)];
      if (w === 0) type = 'grunt';
      if (type === 'brute' && w < 3) type = 'tank';
      if (type === 'tank' && w < 2) type = 'grunt';
      const race = r() < raceBias ? 'rust' : 'glim';
      const e = ENEMIES[type];
      const share = budget / nG;
      let count = Math.max(1, Math.round(share / e.hp));
      if (type === 'swarm') count = Math.min(count, 24);
      if (type === 'brute' || type === 'tank') count = Math.min(count, 8);
      count = Math.min(count, 30);
      const interval = type === 'swarm' ? 0.45 : type === 'tank' ? 1.6 : type === 'brute' ? 2.6 : 0.95;
      groups.push({ type, race, count, interval, delay, path: nPaths > 1 ? (g % nPaths) : 0 });
      delay += count * interval * 0.55 + 1.5;
    }
    waves.push(groups);
  }
  return waves;
}
