import { GW, GH, TOWERS, ENEMIES, POWERS } from './data.js';
import { C, rng, hpMul, plen } from './levels.js';

export const cellX = cx => cx - (GW - 1) / 2;
export const cellZ = cy => cy - (GH - 1) / 2;

function buildPath(pts) {
  const P = pts.map(([x, y]) => [cellX(x), cellZ(y)]);
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  return { P, cum, len: cum[cum.length - 1] };
}
function posAt(path, d) {
  const { P, cum } = path;
  if (d <= 0) return [P[0][0], P[0][1], Math.atan2(P[1][0] - P[0][0], P[1][1] - P[0][1])];
  for (let i = 1; i < P.length; i++) {
    if (d <= cum[i]) {
      const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      const a = P[i - 1], b = P[i];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[0] - a[0], b[1] - a[1])];
    }
  }
  const n = P.length - 1; return [P[n][0], P[n][1], 0];
}
function nearestD(path, x, z) {
  let best = 1e9, bd = 0;
  const { P, cum } = path;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i];
    const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L2; t = Math.max(0, Math.min(1, t));
    const px = a[0] + dx * t, pz = a[1] + dz * t, dd = Math.hypot(px - x, pz - z);
    if (dd < best) { best = dd; bd = cum[i - 1] + t * Math.sqrt(L2); }
  }
  return { d: bd, dist: best };
}

export function towerStats(kind, lvl, branch, meta) {
  const T = TOWERS[kind];
  let s = lvl < 3 ? T.levels[lvl] : T.branches[branch].levels[lvl - 3];
  s = { ...T.levels[0], ...s };
  const m = meta && meta.tower[kind];
  if (m) { if (s.dmg) s.dmg *= 1 + m.dmg; if (s.dps) s.dps *= 1 + m.dmg; s.range *= 1 + m.range; }
  if (kind === 'support' && meta) s.boost += meta.boost;
  if (kind === 'factory' && meta) s.coin = Math.round(s.coin * (1 + meta.coin));
  return s;
}
export function upgradeCost(kind, lvl, branch) {
  const T = TOWERS[kind];
  if (lvl < 2) return T.levels[lvl + 1].cost;
  if (!T.branches) return null;
  if (lvl === 2) return T.branches[0].levels[0].cost; // same for both branches
  if (lvl === 3) return T.branches[branch].levels[1].cost;
  return null;
}
export function buildCost(kind, meta) {
  const T = TOWERS[kind];
  const m = meta && meta.tower[kind];
  return Math.round(T.cost * (1 - (m ? m.cost : 0)));
}

export class Game {
  constructor(level, opts = {}) {
    this.L = level;
    this.meta = opts.meta || { tower: {}, power: {}, life: 0, bgun: 0, dome: 0, gold: 0, coin: 0, magnet: 0, boost: 0 };
    this.easy = !!opts.easy;
    this.auto = !!opts.autoCollect;
    this.god = !!opts.god;
    this.r = rng(level.seed * 13 + 1);
    this.grid = level.grid.slice();
    this.paths = level.paths.map(buildPath);
    this.hpMul = hpMul(level.idx) * (this.easy ? 0.68 : 1);
    this.goldMul = 1 + level.idx * 0.025;
    this.gold = Math.round(level.startGold * (1 + this.meta.gold) * (this.easy ? 1.25 : 1));
    this.cores = 1 + (level.idx >= 5 ? 1 : 0);
    this.maxLife = 20 + this.meta.life + (this.easy ? 10 : 0);
    this.life = this.maxLife;
    this.dome = this.meta.dome;
    this.wave = 0; this.nWaves = level.waves.length;
    this.queue = []; this.waveTimer = 0; this.nextIn = 0;
    this.enemies = []; this.towers = []; this.proj = []; this.coins = []; this.blocks = []; this.mines = []; this.strikes = []; this.lasers = [];
    this.fx = []; this.t = 0; this.status = 'build'; this.uid = 1; this.freezeT = 0;
    this.stats = { gold: 0, kills: 0, leaks: 0, goldEarned: 0, coinsTapped: 0, coinsMissed: 0 };
    this.towerAt = new Map();
    this.objects = []; // targets & beacons
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const v = this.grid[y * GW + x];
      if (v === C.TARGET) this.objects.push({ id: this.uid++, kind: 'target', cx: x, cy: y, x: cellX(x), z: cellZ(y), hp: 1, maxHp: 1 });
      if (v === C.BEACON) this.objects.push({ id: this.uid++, kind: 'beacon', cx: x, cy: y, x: cellX(x), z: cellZ(y), hp: 3, maxHp: 3 });
    }
    this.laserCd = 0;
    this.powers = {};
    for (const k of level.powers) {
      const pm = this.meta.power[k] || { charges: 0, pot: 0, cd: 0 };
      this.powers[k] = { charges: POWERS[k].charges + pm.charges, cd: 0, cdMax: POWERS[k].cd * (1 - pm.cd), pot: 1 + pm.pot, pending: false };
    }
    const b = level.base;
    this.baseX = cellX(b[0]); this.baseZ = cellZ(b[1]);
    this.bgun = this.meta.bgun ? { lvl: this.meta.bgun, cd: 0, aim: 0, target: null } : null;
  }
  cell(x, y) { return (x < 0 || y < 0 || x >= GW || y >= GH) ? -1 : this.grid[y * GW + x]; }
  canBuild(kind, cx, cy) {
    if (this.towerAt.has(cy * GW + cx)) return false;
    const v = this.cell(cx, cy);
    const T = TOWERS[kind];
    if (T.deposit) return v === C.DEPOSIT;
    if (T.water) return v === C.WATER;
    return v === C.FREE;
  }
  build(kind, cx, cy) {
    if (!this.L.towers.includes(kind) || !this.canBuild(kind, cx, cy)) return null;
    const cost = buildCost(kind, this.meta), core = TOWERS[kind].core || 0;
    if (this.gold < cost || this.cores < core) return null;
    this.gold -= cost; this.cores -= core;
    const t = { id: this.uid++, kind, cx, cy, x: cellX(cx), z: cellZ(cy), lvl: 0, branch: -1, cd: 0.3, aim: 0, spent: cost, target: null, beams: [], coinT: 0, kills: 0, built: this.t };
    t.coinT = towerStats(kind, 0, 0, this.meta).every || 0;
    this.towers.push(t); this.towerAt.set(cy * GW + cx, t);
    this.fx.push({ t: 'build', x: t.x, z: t.z });
    return t;
  }
  upgrade(t, branch) {
    const c = upgradeCost(t.kind, t.lvl, t.branch);
    if (c == null || this.gold < c) return false;
    if (t.lvl === 2) { if (branch !== 0 && branch !== 1) return false; t.branch = branch; }
    this.gold -= c; t.spent += c; t.lvl++;
    this.fx.push({ t: 'upgrade', x: t.x, z: t.z });
    return true;
  }
  sell(t) {
    const refund = Math.floor(t.spent * 0.5);
    this.gold += refund;
    this.towers = this.towers.filter(o => o !== t); this.towerAt.delete(t.cy * GW + t.cx);
    this.fx.push({ t: 'sell', x: t.x, z: t.z, v: refund });
    return refund;
  }
  tstats(t) { return towerStats(t.kind, t.lvl, t.branch, this.meta); }
  // effective stats incl. support aura
  eff(t) {
    const s = towerStats(t.kind, t.lvl, t.branch, this.meta);
    if (t.kind === 'support' || t.kind === 'factory') return s;
    let boost = 0, rateB = 0, rangeB = 0;
    for (const o of this.towers) if (o.kind === 'support') {
      const os = towerStats('support', o.lvl, o.branch, this.meta);
      if (Math.hypot(o.x - t.x, o.z - t.z) <= os.range + 0.01) { boost = Math.max(boost, os.boost); rateB = Math.max(rateB, os.rateB || 0); rangeB = Math.max(rangeB, os.rangeB || 0); }
    }
    if (boost) { if (s.dmg) s.dmg *= 1 + boost; if (s.dps) s.dps *= 1 + boost; }
    if (rateB && s.rate) s.rate *= 1 + rateB;
    if (rangeB) s.range *= 1 + rangeB;
    s.boosted = boost > 0;
    return s;
  }
  startWave() {
    if (this.wave >= this.nWaves || this.status === 'won' || this.status === 'lost') return 0;
    let bonus = 0;
    if (this.status === 'play' && this.nextIn > 0) { bonus = Math.round(this.nextIn * 1.5 + 5); this.gold += bonus; this.fx.push({ t: 'bonus', v: bonus }); }
    this.status = 'play';
    const groups = this.L.waves[this.wave];
    for (const g of groups) for (let i = 0; i < g.count; i++) this.queue.push({ at: this.t + g.delay + i * g.interval, type: g.type, race: g.race, path: Math.min(g.path, this.paths.length - 1) });
    this.queue.sort((a, b) => a.at - b.at);
    this.wave++;
    const lastAt = this.queue.length ? this.queue[this.queue.length - 1].at - this.t : 0;
    this.nextIn = this.wave < this.nWaves ? lastAt + 9 : 0;
    this.fx.push({ t: 'wave', v: this.wave });
    return bonus;
  }
  nextWavePreview() {
    if (this.wave >= this.nWaves) return [];
    const m = {};
    for (const g of this.L.waves[this.wave]) { const k = g.type + ':' + g.race; m[k] = (m[k] || 0) + g.count; }
    return Object.entries(m).map(([k, n]) => { const [type, race] = k.split(':'); return { type, race, n }; });
  }
  spawn(type, race, pi) {
    const E = ENEMIES[type];
    const path = this.paths[pi];
    const hp = E.hp * this.hpMul * (1 + (this.wave - 1) * 0.015) * (E.boss && this.L.idx === 39 ? 0.75 : 1);
    const e = { id: this.uid++, type, race, pi, d: 0, hp, maxHp: hp, speed: E.speed * (0.94 + this.r() * 0.12), armor: E.armor, air: !!E.air, slow: 0, slowT: 0, x: 0, z: 0, rot: 0, off: (this.r() - 0.5) * 0.3, blocked: false, hasted: 0, hitT: 0, dead: false };
    const p = posAt(path, 0); e.x = p[0]; e.z = p[1]; e.rot = p[2];
    this.enemies.push(e);
  }
  damage(e, dmg, src, opts = {}) {
    if (e.dead) return 0;
    let d = dmg;
    if (src) {
      const T = TOWERS[src];
      if (T.strong === e.race) d *= 1.5; else if (T.weak === e.race) d *= 0.72;
      if (src === 'destroyer' && (e.type === 'tank' || e.type === 'boss' || e.type === 'brute')) d *= 2;
    }
    if (!opts.beam) { const arm = e.armor * (1 - (opts.pierce || 0)); d = Math.max(d * 0.2, d - arm); }
    e.hp -= d; e.hitT = 0.12;
    if (opts.show) this.fx.push({ t: 'dmg', x: e.x, z: e.z, v: Math.round(d), crit: d > dmg * 1.2 });
    if (e.hp <= 0) this.kill(e, opts.tower);
    return d;
  }
  kill(e, tower) {
    e.dead = true;
    const E = ENEMIES[e.type];
    let g = Math.round(E.gold * this.goldMul);
    if (tower) { tower.kills++; if (tower.kind === 'reaper') g += towerStats('reaper', tower.lvl, tower.branch, this.meta).soul || 1; }
    this.gold += g; this.stats.gold += g; this.stats.kills++;
    this.fx.push({ t: 'die', x: e.x, z: e.z, type: e.type, race: e.race, air: e.air, g });
    if (E.boss) { this.cores += 1; this.fx.push({ t: 'bossdie', x: e.x, z: e.z }); }
  }
  inRange(t, s, e) { return Math.hypot(e.x - t.x, e.z - t.z) <= s.range; }
  pickTarget(t, s) {
    const T = TOWERS[t.kind];
    let best = null, bp = -1;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.air ? !T.air : !T.ground) continue;
      if (!this.inRange(t, s, e)) continue;
      let p = e.d / this.paths[e.pi].len + (e.type === 'boss' ? 0.02 : 0);
      if (t.kind === 'destroyer' && e.armor > 0) p += 0.5;
      if (p > bp) { bp = p; best = e; }
    }
    return best;
  }
  tapCoin(id) {
    const c = this.coins.find(c => c.id === id);
    if (!c) return 0;
    this.coins = this.coins.filter(o => o !== c);
    this.gold += c.v; this.stats.coinsTapped++;
    this.fx.push({ t: 'coin', x: c.x, z: c.z, v: c.v });
    return c.v;
  }
  tapObject(id) {
    const o = this.objects.find(o => o.id === id);
    if (!o || this.laserCd > 0) return false;
    this.laserCd = 0.8;
    this.lasers.push({ x: o.x, z: o.z, t: 0, dur: 0.7, obj: o.id });
    return true;
  }
  usePower(k, x, z) {
    const p = this.powers[k];
    if (!p || p.charges <= 0 || p.cd > 0 || this.status !== 'play') return false;
    const def = POWERS[k];
    if (def.target === 'path') {
      let ok = false;
      for (const path of this.paths) if (nearestD(path, x, z).dist < 0.55) ok = true;
      if (!ok) return false;
      const cx = Math.round(x + (GW - 1) / 2), cy = Math.round(z + (GH - 1) / 2);
      x = cellX(cx); z = cellZ(cy);
      const ds = this.paths.map(path => { const n = nearestD(path, x, z); return n.dist < 0.6 ? n.d : null; });
      if (k === 'block') this.blocks.push({ id: this.uid++, x, z, ds, hp: 260 * p.pot * Math.sqrt(this.hpMul), maxHp: 260 * p.pot * Math.sqrt(this.hpMul) });
      else {
        for (let i = 0; i < 3; i++) {
          const path = this.paths[0];
          const n = nearestD(path, x, z);
          const d = n.dist < 0.6 ? n.d + (i - 1) * 0.6 : null;
          let mx = x, mz = z, mds = ds;
          if (d != null) { const pp = posAt(path, d); mx = pp[0]; mz = pp[1]; mds = this.paths.map(pth => { const q = nearestD(pth, mx, mz); return q.dist < 0.6 ? q.d : null; }); }
          this.mines.push({ id: this.uid++, x: mx, z: mz, ds: mds, dmg: 120 * p.pot * Math.sqrt(this.hpMul) * 1.3, arm: 0.6 });
        }
      }
    } else if (k === 'freeze') {
      this.freezeT = 4 * (0.75 + 0.25 * p.pot);
      this.fx.push({ t: 'freeze' });
    } else if (k === 'strike') {
      this.strikes.push({ x, z, t: 0, at: 1.1, r: 1.7, dmg: 520 * p.pot * this.hpMul });
      this.fx.push({ t: 'strikeMark', x, z });
    }
    p.charges--; p.cd = p.cdMax;
    this.fx.push({ t: 'power', k });
    return true;
  }
  update(dt) {
    if (this.status === 'won' || this.status === 'lost') return;
    this.t += dt;
    if (this.laserCd > 0) this.laserCd -= dt;
    for (const k in this.powers) { const p = this.powers[k]; if (p.cd > 0) p.cd = Math.max(0, p.cd - dt); }
    if (this.status === 'play') {
      while (this.queue.length && this.queue[0].at <= this.t) { const q = this.queue.shift(); this.spawn(q.type, q.race, q.path); }
      if (this.wave < this.nWaves) {
        this.nextIn -= dt;
        const clear = !this.queue.length && !this.enemies.length;
        if (this.nextIn <= 0 || (clear && this.nextIn > 3)) { if (clear && this.nextIn > 3) this.nextIn = 3; else { this.nextIn = 0; this.startWaveAuto(); } }
      }
    }
    // lasers (tap obstacles)
    for (const L of this.lasers) {
      L.t += dt;
      if (L.t >= L.dur && !L.done) {
        L.done = true;
        const o = this.objects.find(o => o.id === L.obj);
        if (o) {
          o.hp--;
          this.fx.push({ t: 'boom', x: o.x, z: o.z, r: 0.8, c: 0xffaa33 });
          if (o.hp <= 0) {
            this.objects = this.objects.filter(q => q !== o);
            this.grid[o.cy * GW + o.cx] = C.FREE;
            const g = o.kind === 'target' ? 15 : 25;
            this.gold += g; this.cores += 1;
            this.fx.push({ t: 'cleared', x: o.x, z: o.z, g, kind: o.kind });
          }
        }
      }
    }
    this.lasers = this.lasers.filter(L => L.t < L.dur + 0.25);
    // enemies
    const frozen = this.freezeT > 0;
    if (frozen) this.freezeT -= dt;
    const beacons = this.objects.filter(o => o.kind === 'beacon');
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.hitT > 0) e.hitT -= dt;
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
      e.hasted = 0;
      for (const b of beacons) if (Math.hypot(b.x - e.x, b.z - e.z) < 2.2) e.hasted = 0.3;
      let v = e.speed * (1 - e.slow) * (1 + e.hasted);
      if (frozen) v = 0;
      // blocks
      e.blocked = false;
      if (!e.air) for (const b of this.blocks) {
        const bd = b.ds[e.pi];
        if (bd != null && e.d < bd && e.d >= bd - 0.75) { e.blocked = true; b.hp -= ENEMIES[e.type].dmg * 14 * dt * (frozen ? 0 : 1); break; }
      }
      if (!e.blocked) e.d += v * dt;
      const path = this.paths[e.pi];
      const p = posAt(path, e.d);
      const nx = p[0] + Math.cos(p[2]) * e.off, nz = p[1] - Math.sin(p[2]) * e.off;
      e.x = nx; e.z = nz; e.rot = p[2];
      if (e.d >= path.len) {
        e.dead = true; e.leaked = true;
        const dmg = ENEMIES[e.type].dmg;
        if (this.dome > 0) { this.dome--; this.fx.push({ t: 'dome' }); }
        else if (!this.god) { this.life -= dmg; this.stats.leaks += dmg; this.fx.push({ t: 'leak', v: dmg }); }
      }
      // mines
      if (!e.air) for (const m of this.mines) {
        if (m.boom) continue;
        const md = m.ds[e.pi];
        if (md != null && Math.abs(md - e.d) < 0.3) {
          m.boom = true;
          this.fx.push({ t: 'boom', x: m.x, z: m.z, r: 1.2, c: 0xff7a20 });
          for (const o of this.enemies) if (!o.dead && !o.air && Math.hypot(o.x - m.x, o.z - m.z) < 1.2) this.damage(o, m.dmg, null, { pierce: 0.5, show: true });
        }
      }
    }
    this.mines = this.mines.filter(m => !m.boom);
    for (const b of this.blocks) if (b.hp <= 0 && !b.dead) { b.dead = true; this.fx.push({ t: 'boom', x: b.x, z: b.z, r: 0.9, c: 0xaaaaaa }); }
    this.blocks = this.blocks.filter(b => !b.dead);
    // strikes
    for (const s of this.strikes) {
      s.t += dt;
      if (s.t >= s.at && !s.done) {
        s.done = true;
        this.fx.push({ t: 'strike', x: s.x, z: s.z, r: s.r });
        for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - s.x, e.z - s.z) < s.r) this.damage(e, s.dmg, null, { pierce: 1, show: true });
      }
    }
    this.strikes = this.strikes.filter(s => s.t < s.at + 0.8);
    // towers
    for (const t of this.towers) this.towerUpdate(t, dt);
    if (this.bgun) this.baseGun(dt);
    // projectiles
    for (const p of this.proj) this.projUpdate(p, dt);
    this.proj = this.proj.filter(p => !p.done);
    this.enemies = this.enemies.filter(e => !e.dead);
    // coins
    for (const c of this.coins) {
      c.t += dt;
      if ((this.auto && c.t > 1.0) || (this.meta.magnet && c.t > 3)) { this.tapCoin(c.id); continue; }
      if (c.t > c.life) { c.gone = true; this.stats.coinsMissed++; }
    }
    this.coins = this.coins.filter(c => !c.gone);
    if (this.life <= 0) { this.life = 0; this.status = 'lost'; this.fx.push({ t: 'lost' }); }
    else if (this.status === 'play' && this.wave >= this.nWaves && !this.queue.length && !this.enemies.length) { this.status = 'won'; this.fx.push({ t: 'won' }); }
  }
  startWaveAuto() { const saved = this.nextIn; this.nextIn = 0; this.startWave(); }
  baseGun(dt) {
    const g = this.bgun; g.cd -= dt;
    const range = 2.6 + g.lvl * 0.3;
    let best = null, bd = -1;
    for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - this.baseX, e.z - this.baseZ) < range && e.d > bd) { bd = e.d; best = e; }
    g.target = best ? best.id : null;
    if (best) {
      g.aim = Math.atan2(best.x - this.baseX, best.z - this.baseZ);
      if (g.cd <= 0) {
        g.cd = 1 / (2 + g.lvl);
        this.proj.push({ id: this.uid++, kind: 'bullet', x: this.baseX, z: this.baseZ + 0.4, y: 0.9, tx: best.x, tz: best.z, target: best.id, speed: 14, dmg: 6 + 10 * g.lvl * Math.sqrt(this.hpMul), src: null, splash: 0, pierce: 0.3 });
        this.fx.push({ t: 'muzzle', x: this.baseX, z: this.baseZ + 0.4, k: 'gun', a: g.aim, base: true });
      }
    }
  }
  towerUpdate(t, dt) {
    const T = TOWERS[t.kind];
    if (t.kind === 'factory') {
      const s = towerStats('factory', t.lvl, 0, this.meta);
      if (this.status !== 'play') return;
      t.coinT -= dt;
      if (t.coinT <= 0) {
        t.coinT = s.every;
        const v = s.coin + Math.floor(this.r() * 6) - 2;
        const a = this.r() * Math.PI * 2;
        this.coins.push({ id: this.uid++, x: t.x + Math.cos(a) * 0.45, z: t.z + Math.sin(a) * 0.45, v, t: 0, life: 12, from: t.id });
        this.fx.push({ t: 'coinSpawn', x: t.x, z: t.z });
      }
      return;
    }
    if (t.kind === 'support') return;
    const s = this.eff(t);
    t.cd -= dt;
    t.beams = [];
    const tg = this.pickTarget(t, s);
    t.target = tg ? tg.id : null;
    if (!tg) return;
    const want = Math.atan2(tg.x - t.x, tg.z - t.z);
    let da = want - t.aim; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    t.aim += da * Math.min(1, dt * 12);
    if (T.proj === 'beam') {
      const targets = [tg];
      const chain = s.chain || 1;
      let last = tg;
      for (let i = 1; i < chain; i++) {
        let nb = null, nd = 1.8;
        for (const e of this.enemies) if (!e.dead && !targets.includes(e) && Math.hypot(e.x - last.x, e.z - last.z) < nd) { nd = Math.hypot(e.x - last.x, e.z - last.z); nb = e; }
        if (!nb) break; targets.push(nb); last = nb;
      }
      for (const e of targets) {
        e.slow = Math.max(e.slow, e.type === 'boss' ? s.slow * 0.6 : s.slow); e.slowT = 0.35;
        this.damage(e, s.dps * dt, 'cryo', { beam: true, tower: t });
      }
      t.beams = targets.map(e => e.id);
      return;
    }
    if (t.cd > 0) return;
    t.cd = 1 / s.rate;
    const mx = t.x + Math.sin(t.aim) * 0.35, mz = t.z + Math.cos(t.aim) * 0.35;
    this.fx.push({ t: 'muzzle', x: mx, z: mz, k: t.kind, a: t.aim, tid: t.id });
    const base = { src: t.kind, tower: t, pierce: s.pierce || 0, splash: s.splash || 0, dmg: s.dmg };
    switch (T.proj) {
      case 'bullet': this.proj.push({ ...base, id: this.uid++, kind: 'bullet', x: mx, z: mz, y: 0.6, target: tg.id, tx: tg.x, tz: tg.z, speed: 16 }); break;
      case 'lob': {
        const n = s.multi || 1;
        for (let i = 0; i < n; i++) {
          let e = tg;
          if (i > 0) { const others = this.enemies.filter(o => !o.dead && !o.air && o !== tg && this.inRange(t, s, o)); if (others.length) e = others[Math.floor(this.r() * others.length)]; }
          const lead = e.speed * (1 - e.slow) * 0.6;
          const ahead = posAt(this.paths[e.pi], e.d + lead);
          this.proj.push({ ...base, id: this.uid++, kind: 'lob', x: t.x, z: t.z, y: 0.9, sx: t.x, sz: t.z, tx: ahead[0], tz: ahead[1], t: 0, dur: 0.6 + i * 0.08 });
        }
        break;
      }
      case 'missile': for (let i = 0; i < s.multi; i++) this.proj.push({ ...base, id: this.uid++, kind: 'missile', x: t.x, z: t.z, y: 0.7, vx: Math.sin(t.aim + (i - s.multi / 2) * 0.5) * 3, vz: Math.cos(t.aim + (i - s.multi / 2) * 0.5) * 3, vy: 3, target: tg.id, tx: tg.x, tz: tg.z, speed: 6.5, life: 0, delay: i * 0.08 }); break;
      case 'shell': this.proj.push({ ...base, id: this.uid++, kind: 'shell', x: mx, z: mz, y: 0.5, target: tg.id, tx: tg.x, tz: tg.z, speed: 11 }); break;
      case 'bolt': this.proj.push({ ...base, id: this.uid++, kind: 'bolt', x: mx, z: mz, y: 0.6, target: tg.id, tx: tg.x, tz: tg.z, speed: 20 }); break;
      case 'chain': {
        const hit = [tg]; let last = tg;
        for (let i = 1; i < s.chain; i++) {
          let nb = null, nd = 2.0;
          for (const e of this.enemies) if (!e.dead && !hit.includes(e) && Math.hypot(e.x - last.x, e.z - last.z) < nd) { nd = Math.hypot(e.x - last.x, e.z - last.z); nb = e; }
          if (!nb) break; hit.push(nb); last = nb;
        }
        const pts = [[t.x, t.z]].concat(hit.map(e => [e.x, e.z]));
        this.fx.push({ t: 'chain', pts });
        hit.forEach((e, i) => this.damage(e, s.dmg * Math.pow(0.85, i), 'reaper', { tower: t, show: i === 0 }));
        break;
      }
    }
  }
  projUpdate(p, dt) {
    if (p.kind === 'lob') {
      p.t += dt; const k = Math.min(1, p.t / p.dur);
      p.x = p.sx + (p.tx - p.sx) * k; p.z = p.sz + (p.tz - p.sz) * k; p.y = 0.9 + Math.sin(k * Math.PI) * 1.6 - 0.8 * k;
      if (k >= 1) this.impact(p);
      return;
    }
    const tg = this.enemies.find(e => e.id === p.target && !e.dead);
    if (tg) { p.tx = tg.x; p.tz = tg.z; }
    if (p.kind === 'missile') {
      if (p.delay > 0) { p.delay -= dt; return; }
      p.life += dt;
      const dx = p.tx - p.x, dz = p.tz - p.z, dist = Math.hypot(dx, dz) || 1;
      const steer = Math.min(1, dt * (3 + p.life * 6));
      p.vx += (dx / dist * p.speed - p.vx) * steer; p.vz += (dz / dist * p.speed - p.vz) * steer;
      p.vy += (-p.y * 2 - p.vy) * steer * 0.6;
      p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.max(0.15, p.y + p.vy * dt);
      if (dist < 0.25 || p.life > 3) this.impact(p, tg);
      return;
    }
    const dx = p.tx - p.x, dz = p.tz - p.z, dist = Math.hypot(dx, dz);
    const step = p.speed * dt;
    if (dist <= step) { p.x = p.tx; p.z = p.tz; this.impact(p, tg); return; }
    p.x += dx / dist * step; p.z += dz / dist * step;
  }
  impact(p, tg) {
    p.done = true;
    if (p.splash > 0) {
      const air = p.kind === 'missile';
      this.fx.push({ t: 'boom', x: p.x, z: p.z, r: p.splash, c: p.kind === 'lob' ? 0x66ff66 : 0xffa040, k: p.kind });
      let first = true;
      for (const e of this.enemies) {
        if (e.dead || (e.air && !air)) continue;
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        if (d <= p.splash) { this.damage(e, p.dmg * (d < p.splash * 0.5 ? 1 : 0.6), p.src, { pierce: p.pierce, tower: p.tower, show: first }); first = false; }
      }
    } else if (tg) {
      this.damage(tg, p.dmg, p.src, { pierce: p.pierce, tower: p.tower, show: p.kind === 'bolt' || p.dmg >= 25 });
      this.fx.push({ t: 'hit', x: p.x, z: p.z, k: p.kind });
    }
  }
  starRating() {
    if (this.status !== 'won') return 0;
    const f = this.life / this.maxLife;
    return f >= 0.85 ? 3 : f >= 0.45 ? 2 : 1;
  }
}
export { posAt, nearestD };
