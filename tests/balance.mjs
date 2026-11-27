// Balance tool: simulates every level headlessly with the AutoPlayer and the emerald upgrades a typical player would own by then.
//   node tests/balance.mjs report            -> strong (skill 1) and casual (skill 0.6) AI results per level with the current HP_TABLE
//   node tests/balance.mjs fit [from] [to]   -> per level, binary-search the enemy-health scale where the strong AI just keeps 3 stars,
//                                               then print a new HP_TABLE (MARGIN below that edge so 3 stars needs careful play)
//   node tests/balance.mjs endless [world]   -> how far the strong AI gets in Endless with mid-campaign upgrades
// Runs in plain Node (the simulation has no renderer dependency). Use several processes for speed: `fit 0 9`, `fit 10 19`, ...
import { genLevel, genEndless, HP_TABLE } from '../js/levels.js';
import { Game } from '../js/core.js';
import { AutoPlayer } from '../js/ai.js';
import { allMetaNodes, metaEffects, UNLOCKS } from '../js/data.js';

// set each level to 90% of the health where the strong AI barely keeps 3 stars (gentler on the first levels, which teach the game)
const MARGIN = i => Math.min(0.9, 0.5 + 0.08 * i);
const EMER_PER_LEVEL = 50;   // emeralds a player has typically earned per level cleared before reaching level i

// Cheapest-first buying of everything unlocked by level i: a broad, "typical" upgrade spread.
export function expectedOwned(i) {
  let budget = EMER_PER_LEVEL * i; const owned = {};
  const nodes = allMetaNodes().filter(n => (n.tab !== 'towers' || UNLOCKS.tower[n.group] <= i) && (n.tab !== 'weapon' || UNLOCKS.power[n.group] <= i)).sort((a, b) => a.cost - b.cost);
  for (let changed = true; changed;) {
    changed = false;
    for (const n of nodes) if (!owned[n.id] && (!n.req || owned[n.req]) && n.cost <= budget) { owned[n.id] = 1; budget -= n.cost; changed = true; }
  }
  return owned;
}
export function play(L, { skill = 1, owned = {}, cap = 3600, variant = 0 } = {}) {
  if (variant) L.seed += variant * 1013;   // different enemy jitter / AI tie-breaks: same level, slightly different run
  const g = new Game(L, { meta: metaEffects(owned), autoCollect: skill >= 1 });
  const ai = new AutoPlayer(g, { skill, callEarly: skill >= 1 });
  let t = 0;
  while (g.status !== 'won' && g.status !== 'lost' && t < cap) { ai.tick(1 / 30); g.update(1 / 30); g.fx.length = 0; t += 1 / 30; }
  return { status: g.status, life: g.life, maxLife: g.maxLife, stars: g.starRating(), wave: g.wave, nWaves: g.nWaves };
}
const name = i => `${Math.floor(i / 5) + 1}-${i % 5 + 1}`;
const [mode = 'report', a = '0', b = '39'] = import.meta.url.endsWith('balance.mjs') ? process.argv.slice(2) : ['none'];

if (mode === 'report') {
  for (let i = +a; i <= +b; i++) {
    const owned = expectedOwned(i), L = genLevel(i);
    const s = play(L, { owned }), c = play(genLevel(i), { owned, skill: 0.6 });
    console.log(`${name(i)} ${L.twists.join('+').padEnd(16)} strong: ${s.status} ${s.stars}★ ${s.life}/${s.maxLife}   casual: ${c.status} ${c.stars}★ ${c.life}/${c.maxLife} w${c.wave}/${c.nWaves}`);
  }
} else if (mode === 'fit') {
  const out = [];
  for (let i = +a; i <= +b; i++) {
    const owned = expectedOwned(i), base = HP_TABLE[i];
    let lo = 0.25, hi = 4;   // scale multipliers on the current table entry
    for (let it = 0; it < 9; it++) {
      const mid = Math.sqrt(lo * hi); HP_TABLE[i] = base * mid;
      let ok = 0; for (let v = 0; v < 3 && ok < 2 && ok + (3 - v) >= 2; v++) if (play(genLevel(i), { owned, variant: v }).stars >= 3) ok++;
      if (ok >= 2) lo = mid; else hi = mid;   // 3 stars in at least 2 of 3 runs
    }
    let v = +(base * lo * MARGIN(i)).toFixed(2);
    // cliff levels (a leaked Warlord costs 10 life): step down until the chosen value itself holds 3 stars in 2 of 3 runs
    for (let k = 0; k < 6; k++) {
      HP_TABLE[i] = v; let ok = 0;
      for (let r = 0; r < 3; r++) if (play(genLevel(i), { owned, variant: r }).stars >= 3) ok++;
      if (ok >= 2) break; v = +(v * 0.9).toFixed(2);
    }
    HP_TABLE[i] = v;
    const chk = play(genLevel(i), { owned }), cas = play(genLevel(i), { owned, skill: 0.6 });
    out.push([i, v]);
    console.log(`${name(i)} edge x${lo.toFixed(2)} -> HP ${v}   strong ${chk.stars}★ ${chk.life}/${chk.maxLife}   casual ${cas.status} ${cas.stars}★`);
  }
  console.log('FIT ' + JSON.stringify(out));
} else if (mode === 'endless') {
  const worlds = a === '0' && process.argv.length < 4 ? [0, 3, 6] : [+a];
  for (const w of worlds) for (const lvl of [15, 25, 39]) {
    const r = play(genEndless(w, 1), { owned: expectedOwned(lvl), cap: 7200 });
    console.log(`endless world ${w + 1} with level-${lvl} upgrades: reached wave ${r.wave}`);
  }
}
