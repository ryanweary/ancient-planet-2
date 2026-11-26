import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
const base = process.argv[2] || 'http://localhost:8765/';
const out = process.argv[3] || '/workspace/ancient-planet-2/shots/upgrade-panel.png';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 300000, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`${base}?q=2&level=1&nostory&unlock&nogov`, { waitUntil: 'networkidle0', timeout: 180000 });
await p.waitForFunction(() => window.__ap2 && __ap2.game && __ap2.R.ground && __ap2.screen === 'battle', { timeout: 180000 });
await new Promise(r => setTimeout(r, 1500));
const setup = await p.evaluate(() => {
  const g = __ap2.game; __ap2.pause(true); g.gold = 200; g.cores = 5;
  // build a machine gun on a free road-adjacent tile, away from the edges so the panel is fully visible
  let built = null;
  for (let y = 4; y <= 10; y++) for (let x = 2; x <= 6; x++) {
    if (g.canBuild('gun', x, y) && g.build('gun', x, y)) { built = g.towers[g.towers.length - 1]; break; }
  }
  if (!built) return { ok: false, reason: 'no tile' };
  // can't afford the first upgrade (60)
  g.gold = 20;
  __ap2.selectTower(built);
  return { ok: true, id: built.id, cx: built.cx, cy: built.cy, cost: 60, gold: g.gold, spent: built.spent };
});
if (!setup.ok) throw new Error('setup failed: ' + setup.reason);
await new Promise(r => setTimeout(r, 400));
const before = await p.evaluate(() => {
  const up = document.querySelector('.cwrap .cbtn.up')?.parentElement;
  const sell = document.querySelector('.cwrap .cbtn.sell')?.parentElement;
  const price = up?.querySelector('.cprice b')?.textContent;
  const sellP = sell?.querySelector('.cprice b')?.textContent;
  const upBox = up?.getBoundingClientRect();
  const prBox = up?.querySelector('.cprice')?.getBoundingClientRect();
  const top = document.elementFromPoint(prBox ? prBox.x + prBox.width / 2 : 0, prBox ? prBox.y + prBox.height / 2 : 0);
  return {
    hasUp: !!up, dim: up?.classList.contains('dim'), price, sellP,
    upVis: upBox && upBox.width > 0 && upBox.top >= 0 && upBox.bottom <= 844,
    priceVis: prBox && prBox.width > 0 && prBox.height >= 16 && prBox.bottom <= 844 && prBox.top >= 0,
    priceH: prBox && +prBox.height.toFixed(1), priceW: prBox && +prBox.width.toFixed(1),
    priceFont: up ? getComputedStyle(up.querySelector('.cprice')).fontSize : null,
    clippedBy: top && !up?.contains(top) && !top.contains?.(up) ? (top.id || top.className) : null,
    gold: __ap2.game.gold,
  };
});
console.log('BEFORE', JSON.stringify(before));
if (!before.hasUp) throw new Error('upgrade button missing');
if (!before.dim) throw new Error('upgrade should be dim when gold is 20');
if (!before.priceVis) throw new Error('upgrade price not visible on screen');
if (before.price !== '60') throw new Error('expected cost 60, got ' + before.price);
if (!before.sellP || !before.sellP.startsWith('+')) throw new Error('sell value missing: ' + before.sellP);

await p.screenshot({ path: out.replace('.png', '-poor.png') });

// earn enough gold WITHOUT deselecting
await p.evaluate(() => { __ap2.game.gold = 80; });
await p.waitForFunction(() => {
  const up = document.querySelector('.cwrap .cbtn.up')?.parentElement;
  return up && !up.classList.contains('dim') && __ap2.game.gold === 80;
}, { timeout: 3000, polling: 50 });
const after = await p.evaluate(() => {
  const up = document.querySelector('.cwrap .cbtn.up')?.parentElement;
  const bg = getComputedStyle(up.querySelector('.cbtn')).backgroundImage || getComputedStyle(up.querySelector('.cbtn')).backgroundColor;
  return { dim: up.classList.contains('dim'), stillSelected: !!up, gold: __ap2.game.gold, bg };
});
console.log('AFTER', JSON.stringify(after));
if (after.dim) throw new Error('button stayed dim after gold was added (did not refresh live)');

await p.screenshot({ path: out });

// build-menu live affordability: open an empty tile, drop gold, then add gold
const build = await p.evaluate(() => {
  __ap2.selectTower && document.querySelector('.cwrap')?.remove();
  // close and open build menu on a free tile
  const g = __ap2.game;
  let cell = null;
  for (let y = 3; y <= 11; y++) for (let x = 2; x <= 6; x++) {
    if (!g.towerAt.get(y * 9 + x) && g.canBuild('gun', x, y)) { cell = [x, y]; break; }
  }
  if (!cell) return { ok: false };
  // use a tap on that cell — first close selection
  const evClose = window.__ap2; evClose.game; // keep
  // closeMenus via tapping empty? we'll call select none by using the public start path
  const [sx, sy] = __ap2.R.cellScreen(cell[0], cell[1]);
  return { ok: true, sx, sy, cell };
});
// close current selection then open build menu via a second code path:
await p.evaluate(() => { const el = document.querySelector('#hexit'); });
await p.evaluate((cell) => {
  // closeMenus is not exported; tap off-grid then we'll use gold + a custom hook
  const g = __ap2.game;
  // deselect by tapping far away via tap(0, 200) might hit tray; use a documented path:
  const hud = document.getElementById('hud');
  // call through selectTower of a dummy? just set gold after opening via internal: expose through click on canvas
}, build.cell);
// Simpler: use evaluate to open the build menu by clicking a free cell through tap after closing
await p.evaluate(() => {
  // Close by selecting nothing: dispatch to ap2.tap outside the grid
  __ap2.tap(200, 30); // top bar-ish may not close; try bottom empty
});
// Actually tap on the exit isn't closeMenus for towers. tap outside grid closes.
// We'll do a dedicated evaluate using cellScreen + tap after forcing close via gold test already passed.
// Build-menu test:
const bres = await p.evaluate(async () => {
  const g = __ap2.game;
  // deselect: the public tap on a non-grid point
  const canvas = document.getElementById('c');
  const r = canvas.getBoundingClientRect();
  __ap2.tap(r.left + 8, r.top + r.height - 8);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  let cell = null;
  for (let y = 3; y <= 11; y++) for (let x = 2; x <= 6; x++) {
    if (!g.towerAt.get(y * 9 + x) && g.canBuild('energy', x, y)) { cell = [x, y]; break; }
  }
  if (!cell) return { ok: false, reason: 'no empty' };
  const [sx, sy] = __ap2.R.cellScreen(cell[0], cell[1]);
  g.gold = 10; // can't afford energy (60) or gun (45)
  __ap2.tap(sx, sy);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const wraps = [...document.querySelectorAll('.cwrap .cbtn.tw')].map(b => b.parentElement);
  if (!wraps.length) return { ok: false, reason: 'no build menu', sx, sy };
  const dimBefore = wraps.every(w => w.classList.contains('dim'));
  g.gold = 500;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  // wait a couple frames for updHUD
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const dimAfter = wraps.map(w => w.classList.contains('dim'));
  const anyGreen = dimAfter.some(d => !d);
  return { ok: true, n: wraps.length, dimBefore, dimAfter, anyGreen, gold: g.gold };
});
console.log('BUILD', JSON.stringify(bres));
if (!bres.ok) throw new Error('build menu test failed: ' + bres.reason);
if (!bres.dimBefore) throw new Error('build menu should be dim at 10 gold');
if (!bres.anyGreen) throw new Error('build menu did not turn affordable after gold was added');

if (errs.length) console.log('ERRS', errs.slice(0, 5));
console.log('PASS');
await b.close();
