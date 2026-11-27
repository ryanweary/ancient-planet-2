import { GW, GH, TOWERS } from './data.js';
import { C } from './levels.js';
import { cellX, cellZ, buildCost, upgradeCost, towerStats } from './core.js';

export class AutoPlayer {
  constructor(g, opts = {}) {
    this.g = g; this.acc = 0; this.skill = opts.skill ?? 1; this.callEarly = !!opts.callEarly;
    this.samples = [];
    for (const p of g.paths) for (let d = 0; d < p.len; d += 0.25) {
      // position along polyline
      const { P, cum } = p; let i = 1; while (i < P.length - 1 && cum[i] < d) i++;
      const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      this.samples.push([P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t, d / p.len]);
    }
    let rust = 0, glim = 0, air = 0, armor = 0, tot = 0;
    for (const w of g.L.waves) for (const gr of w) { const n = gr.count; tot += n; if (gr.race === 'rust') rust += n; else glim += n; if (gr.type === 'flyer') air += n; if (gr.type === 'tank' || gr.type === 'brute' || gr.type === 'boss' || gr.type === 'shield' || gr.type === 'splitter') armor += n; if (gr.type === 'phantom') this.cloak = (this.cloak || 0) + n; }
    this.mix = { rust: rust / tot, glim: glim / tot, air: air / tot, armor: armor / tot };
  }
  coverage(x, z, r) { let c = 0; for (const s of this.samples) { const d = Math.hypot(s[0] - x, s[1] - z); if (d <= r) c += 0.6 + s[2]; } return c; }
  bestCell(kind) {
    const g = this.g; const s = towerStats(kind, 0, 0, g.meta); let best = null, bv = 0;
    for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
      if (!g.canBuild(kind, cx, cy)) continue;
      let v;
      if (kind === 'support') { v = 0; for (const t of g.towers) if (t.kind !== 'factory' && t.kind !== 'support' && Math.hypot(t.x - cellX(cx), t.z - cellZ(cy)) <= s.range) v += 1 + t.lvl * 0.5; }
      else if (kind === 'factory') v = 1;
      else v = this.coverage(cellX(cx), cellZ(cy), s.range);
      if (this.skill < 1 && kind !== 'factory') { (this._c || (this._c = [])).push([v, cx, cy]); }
      if (v > bv) { bv = v; best = [cx, cy]; }
    }
    if (this.skill < 1 && this._c && this._c.length) {
      const c = this._c.sort((a, b) => b[0] - a[0]); this._c = null;
      const k = Math.max(1, Math.floor(c.length * (1 - this.skill) * 0.8));
      const pick = c[Math.floor(this.g.r() * k)]; return { cx: pick[1], cy: pick[2], v: pick[0] };
    }
    this._c = null;
    return best ? { cx: best[0], cy: best[1], v: bv } : null;
  }
  desiredKind() {
    const g = this.g, av = g.L.towers;
    const cnt = k => g.towers.filter(t => t.kind === k).length;
    const n = g.towers.filter(t => t.kind !== 'factory' && t.kind !== 'support').length;
    const opts = [];
    const w = { gun: 1 + this.mix.rust * 1.5 + this.mix.air * 2, energy: 1 + this.mix.glim * 2 + this.mix.armor, cryo: 0.6, missile: 1.4 + this.mix.air * 2, naval: 1.6, reaper: 1.4, destroyer: 1 + this.mix.armor * 3 };
    for (const k of ['gun', 'energy', 'cryo', 'missile', 'naval', 'reaper', 'destroyer']) {
      if (!av.includes(k)) continue;
      if (k === 'cryo' && cnt('cryo') >= 1 + Math.floor(n / 6)) continue;
      if (k === 'energy' && n === 0) continue;
      opts.push([k, w[k] / (1 + cnt(k))]);
    }
    opts.sort((a, b) => b[1] - a[1]);
    for (const [k] of opts) { const c = this.bestCell(k); if (c && c.v > 3) return { k, c }; }
    return null;
  }
  tick(dt) {
    this.acc += dt; if (this.acc < 0.4 / Math.min(1, this.skill) * (this.skill < 1 ? 2.5 : 1)) return; this.acc = 0;
    const g = this.g;
    if (g.status === 'won' || g.status === 'lost') return;
    // tap objects
    if (g.laserCd <= 0 && g.objects.length) { const o = g.objects.find(o => o.kind === 'beacon') || g.objects[0]; g.tapObject(o.id); }
    // coins
    for (const c of g.coins.slice()) if (c.t > 0.8 && (this.skill >= 1 || (c.id * 7919 % 100) < 75)) g.tapCoin(c.id);
    // powers when threatened
    if (g.status === 'play' && (this.skill >= 1 || g.r() < 0.3)) this.powers();
    // spend
    for (let i = 0; i < 4; i++) if (!this.spend()) break;
    if (g.status === 'build') g.startWave();
    if (this.callEarly && g.status === 'play' && g.wave < g.nWaves && g.enemies.length === 0 && g.queue.length === 0 && g.nextIn > 4) g.startWave();
  }
  spend() {
    const g = this.g;
    const combat = g.towers.filter(t => t.kind !== 'factory' && t.kind !== 'support');
    // factories early
    const facCost = buildCost('factory', g.meta);
    if (g.L.towers.includes('factory') && g.wave <= g.nWaves * 0.6 && combat.length >= 1 && g.gold >= facCost) {
      const c = this.bestCell('factory');
      if (c && g.towers.filter(t => t.kind === 'factory').length < 4 && g.build('factory', c.cx, c.cy)) return true;
    }
    // support
    if (g.L.towers.includes('support') && combat.length >= (this.cloak ? 3 : 5) && g.cores >= 1 && g.gold >= buildCost('support', g.meta) && g.towers.filter(t => t.kind === 'support').length < 1 + Math.floor(combat.length / 7)) {
      const c = this.bestCell('support'); if (c && c.v >= 4) { g.build('support', c.cx, c.cy); return true; }
    }
    // best upgrade candidate
    let up = null, upv = 0;
    for (const t of g.towers) {
      const c = upgradeCost(t.kind, t.lvl, t.branch); if (c == null) continue;
      if (t.kind === 'factory' && g.wave > g.nWaves * 0.5) continue;
      const s = towerStats(t.kind, t.lvl, t.branch, g.meta);
      const cov = (t.kind === 'factory' || t.kind === 'support') ? 6 : this.coverage(t.x, t.z, s.range);
      const v = cov / c;
      if (v > upv) { upv = v; up = { t, c }; }
    }
    const want = this.desiredKind();
    const bc = want ? buildCost(want.k, g.meta) : 1e9;
    const newV = want ? want.c.v / bc * 0.9 : 0;
    if (want && (newV >= upv || combat.length < 3) && g.gold >= bc) { g.build(want.k, want.c.cx, want.c.cy); return true; }
    if (up && (upv > newV || !want) && g.gold >= up.c) {
      const br = up.t.lvl === 2 ? this.pickBranch(up.t) : undefined;
      g.upgrade(up.t, br); return true;
    }
    return false;
  }
  pickBranch(t) {
    if (t.kind === 'gun') return this.mix.armor > 0.25 ? 1 : 0;
    if (t.kind === 'energy') return 1;
    if (t.kind === 'cryo') return 0;
    if (t.kind === 'support') return 0;
    return this.g.r() < 0.5 ? 0 : 1;
  }
  powers() {
    const g = this.g;
    let front = null, fp = 0;
    for (const e of g.enemies) { const p = e.d / g.paths[e.pi].len; if (p > fp) { fp = p; front = e; } }
    if (!front) return;
    const danger = fp > 0.75;
    const P = g.powers;
    if (P.mines && P.mines.charges > 0 && P.mines.cd <= 0 && fp > 0.5 && g.enemies.length > 6) {
      const p = g.paths[front.pi]; const d = Math.min(p.len - 0.5, front.d + 1.5);
      const pos = this.posAt(p, d); g.usePower('mines', pos[0], pos[1]);
    }
    if (!danger) return;
    if (P.strike && P.strike.charges > 0 && P.strike.cd <= 0) g.usePower('strike', front.x, front.z);
    else if (P.block && P.block.charges > 0 && P.block.cd <= 0) { const p = g.paths[front.pi]; const pos = this.posAt(p, Math.min(p.len - 0.6, front.d + 1)); g.usePower('block', pos[0], pos[1]); }
    else if (P.freeze && P.freeze.charges > 0 && P.freeze.cd <= 0 && fp > 0.88) g.usePower('freeze', 0, 0);
  }
  posAt(p, d) { const { P, cum } = p; let i = 1; while (i < P.length - 1 && cum[i] < d) i++; const t = Math.max(0, Math.min(1, (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1))); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t]; }
}
