// Run: npm i puppeteer-core; serve the repo (python3 -m http.server 8765); QS="?q=1&nogov" node tests/unlock-chain.mjs http://localhost:8765/ fresh 0 39 next
// flow=next takes the in-victory "Next level" button (the path that used to freeze the game at every world transition); flow=map goes via the map nodes.
// Full unlock-chain test through the REAL UI: touch taps only, no ?unlock/?god flags, fresh or migrated save.
// usage: node chain.mjs <baseUrl> <save: fresh|old1|old2|partial|through:N> <from> <to> [flow: map|next]
//   through:N = a save where levels 0..N-1 are complete (so level N has just unlocked)
import puppeteer from 'puppeteer-core';
const [base = 'http://localhost:8765/', mode = 'fresh', from = '0', to = '39', flow = 'map'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 220)); });
let save = null;
if (mode.startsWith('through:')) { const n = +mode.split(':')[1]; save = { v: 1, stars: Array.from({ length: 40 }, (_, i) => i < n ? 3 : 0), emer: 100, seen: {}, tut: { done: 1 }, quality: 'auto', plays: n }; }
else save = {
  fresh: null,
  old1: { v: 1, stars: { 0: 3, 1: 2, 2: 1 }, emer: 40 },
  old2: { stars: [3, 3, 3, 3, 3, 1, 0, 0], emer: 12, easy: false, music: false },
  partial: { v: 1, stars: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1], emer: 100, owned: { x: 1 }, hist: [], seen: { w0: 1, w1: 1 }, tut: { done: 1 }, quality: 'auto', plays: 30 },
}[mode];
await p.evaluateOnNewDocument((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); if (s) localStorage.setItem('ap2-save-v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } }, save);
if (process.env.THROTTLE) { const c = await p.createCDPSession(); await c.send('Network.enable'); await c.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 250000, uploadThroughput: 100000 }); }
await p.goto(`${base}${process.env.QS ?? '?q=1&nogov'}`, { waitUntil: 'networkidle0', timeout: 180000 });
await p.waitForFunction(() => window.__ap2 && __ap2.screen, { timeout: 180000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const state = () => p.evaluate(() => ({ screen: __ap2.screen, stars: __ap2.S.stars.slice(0, 40).join(''), battle: !!__ap2.game, lvl: __ap2.game ? __ap2.game.L.idx : null, story: !!document.querySelector('#story'), hint: (document.querySelector('.hint,#hint')||{}).textContent }));
async function tapSel(sel, why) {
  const r = await p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const top = document.elementFromPoint(x, y); return { x, y, hit: !!top && (top === e || e.contains(top) || top.contains(e)), topTag: top ? (top.id || top.className || top.tagName) : null }; }, sel);
  if (!r) throw new Error(`no element ${sel} (${why})`);
  if (!r.hit) throw new Error(`${sel} (${why}) is covered by ${r.topTag}`);
  await p.touchscreen.tap(r.x, r.y); await sleep(250);
}
async function tapNode(i) {
  const w = Math.floor(i / 5), l = i % 5;
  for (let k = 0; k < 12; k++) {
    const cur = await p.evaluate(() => [...document.querySelectorAll('.dots i')].findIndex(x => x.classList.contains('on')));
    if (cur === w) break; await tapSel(cur < w ? '.arrow.r' : '.arrow.l', 'world arrow');
  }
  const hit = await p.evaluate((l) => { const n = document.querySelectorAll('#mv .node')[l]; const b = n.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const top = document.elementFromPoint(x, y); return { x, y, locked: n.classList.contains('locked'), ok: top && (top === n || n.contains(top)), top: top && (top.className || top.tagName) }; }, l);
  if (hit.locked) throw new Error(`node ${i} LOCKED`);
  if (!hit.ok) throw new Error(`node ${i} covered by ${hit.top}`);
  await p.touchscreen.tap(hit.x, hit.y); await sleep(300);
}
async function story() { for (let k = 0; k < 14; k++) { const st = await state(); if (!st.story) break; await tapSel('#snext', 'story next'); await sleep(150); } }
async function startViaMap(i) {
  let st = await state();
  if (st.screen !== 'map') { await tapSel('#tset', 'x').catch(() => { }); await p.evaluate(() => __ap2.showMap()); await sleep(300); }
  await tapNode(i); await tapSel('#lplay', 'Play'); await story();
  await p.waitForFunction(() => __ap2.screen === 'battle' && __ap2.game, { timeout: 120000, polling: 300 }).catch(() => { });
  st = await state(); if (st.screen !== 'battle') throw new Error(`level ${i} did not start (screen=${st.screen} hint=${st.hint})`);
  if (st.lvl !== i) throw new Error(`tapped level ${i} but started level ${st.lvl}`);
}
// the battle must actually run, not freeze: sim time and renderer frames both advance
async function aliveCheck(i) {
  const a = await p.evaluate(() => ({ t: __ap2.game.time ?? __ap2.game.t ?? 0, f: __ap2.R.frameN, w: __ap2.game.wave }));
  await p.evaluate(() => { __ap2.game.startWave && __ap2.game.startWave(); });
  await sleep(5000);
  const c = await p.evaluate(() => ({ t: __ap2.game.time ?? __ap2.game.t ?? 0, f: __ap2.R.frameN, en: __ap2.game.enemies.length, w: __ap2.game.wave, idx: __ap2.game.L.idx }));
  if (c.f <= a.f) throw new Error(`renderer frozen on level ${i} (frame ${a.f}->${c.f})`);
  if (c.idx !== i) throw new Error(`battle shows level ${c.idx}, expected ${i}`);
}
for (let i = +from; i <= +to; i++) {
  const t0 = Date.now(); const tag = `${Math.floor(i / 5) + 1}-${i % 5 + 1}`;
  try {
    if (flow === 'next' && i > +from) {
      const tN = Date.now(); await tapSel('#rnext', 'Next level'); await story();
      await p.waitForFunction((i) => __ap2.screen === 'battle' && __ap2.game && __ap2.game.L.idx === i, { timeout: 120000, polling: 300 }, i).catch(() => { });
      console.log('  next->battle ms', Date.now() - tN); const st = await state(); if (st.screen !== 'battle' || st.lvl !== i) throw new Error(`NEXT did not start ${tag} (screen=${st.screen} lvl=${st.lvl} hint=${st.hint})`);
    } else await startViaMap(i);
    await aliveCheck(i);
    await p.evaluate(() => { __ap2.game.status = 'won'; });
    await p.waitForSelector('#rmap', { timeout: 90000 }); await sleep(1800);
    const st = await state();
    if (!(+st.stars[i] > 0)) throw new Error(`victory did not record stars for ${tag}: ${st.stars}`);
    const ls = await p.evaluate(() => JSON.parse(localStorage.getItem('ap2-save-v1')).stars.slice(0, 40).join(''));
    if (ls[i] === '0') throw new Error(`localStorage missing star for ${tag}`);
    if (flow !== 'next') { await tapSel('#rmap', 'Map'); await sleep(300); }
    console.log(`${tag} ok ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  } catch (e) { console.log(`FAIL at ${tag}: ${e.message}`); console.log(JSON.stringify(await state())); process.exitCode = 1; break; }
}
if (errs.length) console.log('CONSOLE:\n' + errs.slice(0, 10).join('\n'));
await b.close();
