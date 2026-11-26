// Run: serve the repo on :8765, then: node tests/wave-hitch-profile.mjs http://localhost:8765/ 33 3 4 45 tag   (level 0-based, tier, CPU throttle, seconds). Needs puppeteer-core; writes traces/<tag>.json
// Heavy-wave hitch profiler: many upgraded towers, stacked waves, powers; CPU throttle; Chrome trace -> long tasks, GC, compiles.
// usage: node wave.mjs <base> <level 0-based> <q> <throttle> <secs> <tag>
import puppeteer from 'puppeteer-core'; import fs from 'fs';
const [base = 'http://localhost:8765/', level = '33', q = '3', thr = '4', secs = '40', tag = 'x'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 900000, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.setViewport({ width: 360, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 160)); });
await p.goto(`${base}?q=${q}&level=${+level + 1}&nostory&unlock&nogov&god${process.env.QX || ''}`, { waitUntil: 'networkidle0', timeout: 180000 });
await p.waitForFunction(() => window.__ap2 && __ap2.game && __ap2.R.ground && __ap2.screen === 'battle', { timeout: 180000 });
await p.touchscreen.tap(5, 400); // audio unlock like a real player
await new Promise(r => setTimeout(r, 3000));
await p.evaluate(() => {
  const g = __ap2.game; g.gold = 1e7; g.cores = 99;
  const kinds = g.L.towers; let n = 0;
  for (let pass = 0; pass < 3; pass++) for (let y = 0; y < 16; y++) for (let x = 0; x < 9; x++) { if (n >= 26) break; const k = kinds[(n + pass) % kinds.length]; if (g.canBuild(k, x, y) && g.build(k, x, y)) n++; }
  g.towers.forEach((t, i) => { const tgt = i % 3; for (let l = 0; l < tgt + 1; l++) g.upgrade(t, i % 2); });
  window.__pf = { frames: [], prog: [], t0: performance.now() };
  const R = __ap2.R, info = R.renderer.info; let lastP = info.programs.length, lastG = info.memory.geometries, lastT = info.memory.textures, lastF = performance.now();
  const of = R.frame.bind(R);
  R.frame = (...a) => { const fxT = a[1] ? a[1].fx.map(f => f.t + (f.k ? ':' + f.k : '')).join(',') : ''; const s = performance.now(); const r = of(...a); const e = performance.now();
    const pn = info.programs.length, gn = info.memory.geometries, tn = info.memory.textures;
    __pf.frames.push([Math.round(s - __pf.t0), +(s - lastF).toFixed(1), +(e - s).toFixed(1), pn - lastP, gn - lastG, tn - lastT, __ap2.game ? __ap2.game.enemies.length : 0]);
    if (pn > lastP) (__pf.prog).push({ t: Math.round(s - __pf.t0), fx: fxT, names: info.programs.slice(lastP).map(p => p.name + '|' + (p.cacheKey || '').slice(0, 60)) }); lastP = pn; lastG = gn; lastT = tn; lastF = s; return r; };
  const gu = g.update.bind(g); window.__simMs = 0; g.update = (dt) => { const s = performance.now(); gu(dt); __simMs += performance.now() - s; };
});
if (process.env.HOOK) await p.evaluate(async () => { const T = await import('three'); window.__disp = [];
  const wrap = (C, nm) => { const o = C.prototype.dispose; C.prototype.dispose = function () { __disp.push([Math.round(performance.now() - __pf.t0), nm, this.name || this.type || '', (new Error().stack || '').split('\n').slice(2, 5).map(l => l.trim().replace(/https?:\/\/[^/]+\//, '')).join(' < ')]); return o.call(this); }; };
  const gl = __ap2.R.renderer.getContext(); Error.stackTraceLimit = 40; for (const fn of ['createProgram', 'createTexture', 'createFramebuffer']) { const o = gl[fn].bind(gl); gl[fn] = (...a) => { __disp.push([Math.round(performance.now() - __pf.t0), 'GL.' + fn, '', (new Error().stack || '').split('\n').map(l => l.trim()).filter(l => /js\/(render|main|gfx)|Pass|N8AO/.test(l)).slice(0, 4).map(l => l.replace(/\(?https?:\/\/[^)]*\/([\w.]+\.js):(\d+):\d+\)?/, '$1:$2')).join(' < ')]); return o(...a); }; }
  wrap(T.Material, 'mat'); wrap(T.Texture, 'tex'); wrap(T.WebGLRenderTarget, 'rt'); });
if (process.env.HOOK) await p.evaluate(() => { const R = __ap2.R; for (const fn of ['enemyGet', 'projGet', 'fxGet']) { if (!R[fn]) continue; const o = R[fn].bind(R); R[fn] = (...a) => { const before = R.renderer.info.memory.geometries; const r = o(...a); __disp.push([Math.round(performance.now() - __pf.t0), 'call.' + fn, String(a[0]) + '|' + String(a[1]), '']); return r; }; } });
const cdp = await p.createCDPSession();
if (+thr > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: +thr });
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 }); await cdp.send('Profiler.start');
await p.tracing.start({ path: `traces/${tag}.json`, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'v8.execute', 'blink.user_timing', 'gpu'] });
// stacked waves + powers during the recording
await p.evaluate(async (secs) => {
  const g = __ap2.game; const P = Object.keys(g.powers); let k = 0;
  const end = performance.now() + secs * 1000;
  while (performance.now() < end && g.status !== 'won') {
    g.startWave(); await new Promise(r => setTimeout(r, 2500));
    if (P.length) { const pk = P[k++ % P.length]; const pw = g.powers[pk]; pw.charges = 9; pw.cd = 0; const e = g.enemies.find(e => !e.dead); if (e) g.usePower(pk, e.x, e.z); }
    await new Promise(r => setTimeout(r, 2500));
  }
}, +secs);
await p.tracing.stop();
const { profile } = await cdp.send('Profiler.stop');
{ const byId = new Map(profile.nodes.map(n => [n.id, n])); const self = {}; const dts = profile.timeDeltas; let tot = 0;
  // long-sample windows: map samples to timestamps; attribute self time per function, and separately inside >50ms loop calls is hard; report overall + per-function
  profile.samples.forEach((id, i) => { const n = byId.get(id); const cf = n.callFrame; const k = (cf.functionName || '(anon)') + ' ' + (cf.url || '').split('/').slice(-2).join('/') + ':' + (cf.lineNumber + 1); const d = dts[i] || 0; self[k] = (self[k] || 0) + d; tot += d; });
  const parent = new Map(); for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
  const incl = {}; profile.samples.forEach((id, i) => { const seen = new Set(); let cur = id; while (cur != null) { const n = byId.get(cur); const cf = n.callFrame; if (/\/js\//.test(cf.url) || /three.module|n8ao|EffectComposer|Pass\.js/.test(cf.url)) { const k = (cf.functionName || '(anon)') + ' ' + cf.url.split('/').slice(-1)[0] + ':' + (cf.lineNumber + 1); if (!seen.has(k)) { seen.add(k); incl[k] = (incl[k] || 0) + (dts[i] || 0); } } cur = parent.get(cur); } });
  console.log('INCL', JSON.stringify(Object.entries(incl).sort((a, b) => b[1] - a[1]).slice(0, 45).map(([k, v]) => k + ' ' + (v / 1000).toFixed(0) + 'ms'), null, 1));
  console.log('TOPSELF', JSON.stringify(Object.entries(self).filter(([k]) => !/^\((idle|program)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => k + ' ' + (v / 1000).toFixed(0) + 'ms ' + (100 * v / tot).toFixed(1) + '%'), null, 1)); }
const dd = await p.evaluate(() => window.__disp || []); const dm = {}; for (const d of dd) { const k = d[1] + ' ' + d[2] + ' @ ' + d[3].replace(/:\d+\)/g, ')'); dm[k] = (dm[k] || 0) + 1; } console.log('TIMELINE', JSON.stringify(dd.filter(d => !/MeshBasic/.test(d[2])).map(d => d[0] + ' ' + d[1] + ' ' + d[2]).join('; ')).slice(0, 6000)); console.log('DISPOSES', JSON.stringify(Object.entries(dm).sort((a,b)=>b[1]-a[1]).slice(0, 20), null, 1));
const keys = await p.evaluate(() => { const ps = __ap2.R.renderer.info.programs.filter(p => p.name === 'moon_rock_03'); return ps.map(p => p.cacheKey); }); for (let kk = 1; kk < keys.length; kk++) { const a = keys[kk-1].split(','), b2 = keys[kk].split(','); console.log('KEYDIFF', keys.length, JSON.stringify(a.map((x, i) => x !== b2[i] ? i + ':' + x + '=>' + b2[i] : null).filter(Boolean))); }
const pf = await p.evaluate(() => ({ progDetail: __pf.prog, frames: __pf.frames, sim: __simMs, q: __ap2.R.quality, progs: __ap2.R.renderer.info.programs.length }));
fs.writeFileSync(`traces/${tag}.frames.json`, JSON.stringify(pf));
// --- analyse trace: main-thread long tasks + GC
const tr = JSON.parse(fs.readFileSync(`traces/${tag}.json`)); const ev = tr.traceEvents || tr;
const mains = ev.filter(e => e.name === 'thread_name' && e.args && e.args.name === 'CrRendererMain'); const cnt = m => ev.filter(e => e.pid === m.pid && e.tid === m.tid && e.name === 'FunctionCall').length; const main = mains.sort((a, b) => cnt(b) - cnt(a))[0]; const pid = main.pid, tid = main.tid;
const M = ev.filter(e => e.pid === pid && e.tid === tid && e.ph === 'X');
const tasks = M.filter(e => (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask') && e.dur > 50000);
const gc = M.filter(e => /GC|Scavenge|MarkCompact|MajorGC|MinorGC/.test(e.name));
const gcSum = (re) => gc.filter(e => re.test(e.name)).reduce((s, e) => s + e.dur, 0) / 1000;
const bigGc = gc.filter(e => e.dur > 8000).map(e => e.name + ':' + (e.dur / 1000).toFixed(0)).slice(0, 12);
// what's inside each long task (top children by dur)
const inside = tasks.slice(0, 400).map(t => { const ch = M.filter(e => e !== t && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e.dur > 4000 && !/RunTask/.test(e.name)); const m = {}; for (const c of ch) { const n = c.name + (c.args && c.args.data && c.args.data.functionName ? '(' + c.args.data.functionName + ')' : ''); m[n] = Math.max(m[n] || 0, c.dur / 1000); } return m; });
const agg = {}; for (const m of inside) for (const [k, v] of Object.entries(m)) { agg[k] = agg[k] || [0, 0]; agg[k][0]++; agg[k][1] = Math.max(agg[k][1], v); }
const fr = pf.frames.slice(5); const gaps = fr.map(f => f[1]).sort((a, b) => a - b); const jsms = fr.map(f => f[2]).sort((a, b) => a - b);
const comp = fr.filter(f => f[3] > 0).map(f => `t${f[0]} +${f[3]}prog ${f[2]}ms`), geo = fr.filter(f => f[4] > 3 || f[5] > 0).map(f => `t${f[0]} geo+${f[4]} tex+${f[5]} ${f[2]}ms`);
console.log(JSON.stringify({ tag, level, q: pf.q, thr, frames: fr.length, longTasks50: tasks.length, longTasks100: tasks.filter(t => t.dur > 100000).length, maxTask: Math.round(Math.max(0, ...tasks.map(t => t.dur)) / 1000),
  gapP50: gaps[gaps.length >> 1], gapP95: gaps[Math.floor(gaps.length * .95)], gapMax: gaps[gaps.length - 1], renderJsP50: jsms[jsms.length >> 1], renderJsP95: jsms[Math.floor(jsms.length * .95)], renderJsMax: jsms[jsms.length - 1], simMs: Math.round(pf.sim),
  gcMinorMs: gcSum(/Scavenge|MinorGC/), gcMajorMs: gcSum(/MarkCompact|MajorGC/), bigGc, newPrograms: comp.slice(0, 12), geoTex: geo.slice(0, 12), maxEnemies: Math.max(...fr.map(f => f[6])) }, null, 1));
console.log(JSON.stringify(pf.progDetail, null, 0).slice(0, 5000)); console.log('LT', JSON.stringify(tasks.map(t => { const g = gc.filter(e => e.ts >= t.ts && e.ts < t.ts + t.dur && /^(MinorGC|MajorGC)$/.test(e.name)).reduce((s, e) => s + e.dur, 0); const gl = M.filter(e => e.ts >= t.ts && e.ts < t.ts + t.dur && /WaitForCmd|Finish|GetProgramiv|GetShaderiv|texSubImage|TexImage/.test(e.name)).reduce((s, e) => s + e.dur, 0); return Math.round(t.dur / 1000) + 'ms(gc' + Math.round(g / 1000) + ',glwait' + Math.round(gl / 1000) + ')'; }))); console.log('inside long tasks:', JSON.stringify(Object.entries(agg).sort((a, b) => b[1][0] - a[1][0]).slice(0, 25)));
if (errs.length) console.log(errs.slice(0, 8).join('\n'));
await b.close();
