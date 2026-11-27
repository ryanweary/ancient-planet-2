// Ancient Planet II: Return to Hamal — app shell, screens, HUD, input, save
import { GW, GH, TOWERS, ENEMIES, RACES, POWERS, POWER_ORDER, TOWER_ORDER, UNLOCKS, META, WORLDS, STORY, ENDING, metaEffects, TWISTS, ABIL_TEXT, ENEMY_UNLOCK } from './data.js';
import { genLevel, genEndless, C, rng } from './levels.js';
import { Game, buildCost, upgradeCost, towerStats } from './core.js';
import { AutoPlayer } from './ai.js';
import { Renderer, makeIcons } from './render.js';
import { initAudio, sfx, setSfx, setMusic } from './audio.js';

const Q = new URLSearchParams(location.search);
const BUILD = 'v7';
const DBG = { auto: Q.has('auto'), god: Q.has('god'), unlock: Q.has('unlock'), nostory: Q.has('nostory') || Q.has('auto'), speed: +Q.get('speed') || 0, q: +Q.get('q') || 0, nogov: Q.has('nogov'), perf: Q.has('perf'), easy: Q.has('easy') };
const NL = 40;
const $ = (s, el = document) => el.querySelector(s);
const ui = $('#ui');
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

// ---------------- save ----------------
const SKEY = 'ap2-save-v1';
const defSave = () => ({ v: 1, stars: Array(NL).fill(0), emer: 0, owned: {}, hist: [], easy: false, music: true, sfx: true, quality: 'auto', seen: {}, tut: {}, plays: 0 });
let S;
function migrateSave(raw) {
  const out = Object.assign(defSave(), raw && typeof raw === 'object' ? raw : {});
  let st = out.stars;
  if (!Array.isArray(st)) st = (st && typeof st === 'object') ? Array.from({ length: NL }, (_, i) => +st[i] || 0) : [];
  if (st.length < NL) st = st.concat(Array(NL - st.length).fill(0));
  else if (st.length > NL) st = st.slice(0, NL);
  out.stars = st.map(n => Math.max(0, +n || 0));
  if (!out.seen || typeof out.seen !== 'object') out.seen = {};
  if (!out.tut || typeof out.tut !== 'object') out.tut = {};
  if (!out.owned || typeof out.owned !== 'object') out.owned = {};
  if (!out.endless || typeof out.endless !== 'object') out.endless = {};
  return out;
}
try { S = migrateSave(JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { S = defSave(); }
if (DBG.easy) S.easy = true;
const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) { } };
const unlocked = i => DBG.unlock || i <= 0 || (S.stars[i - 1] | 0) > 0;
const maxUnlocked = () => { let m = 0; for (let i = 0; i < NL; i++) if (unlocked(i)) m = i; return m; };
const totalStars = () => S.stars.reduce((a, b) => a + b, 0);
const lname = i => `${Math.floor(i / 5) + 1}-${i % 5 + 1}`;

// ---------------- renderer + icons ----------------
const canvas = $('#c');
const R = new Renderer(canvas);
// auto tier: High on modern phones/desktops, Med on weak or old devices (fps watchdog still steps down)
const autoTier = () => { const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4; return (mem < 3 || cores < 4) ? 2 : 3; };
// Auto remembers what the governor settled on (per device/screen) so the next session starts there instead of re-learning; picking a tier by hand clears it
const GFX_KEY = 'ap2-gfx', gfxId = () => [screen_w(), window.devicePixelRatio || 1].join('x');
function screen_w() { return Math.round(Math.max(window.screen.width, window.screen.height)); }
const gfxLoad = () => { try { const g = JSON.parse(localStorage.getItem(GFX_KEY) || 'null'); return g && g.id === gfxId() ? g : null; } catch (e) { return null; } };
const setQ = () => {
  const auto = !DBG.q && S.quality === 'auto';
  let q = DBG.q || { ultra: 4, high: 3, med: 2, low: 1 }[S.quality] || autoTier(), sc = 1;
  if (auto) { const g = gfxLoad(); if (g) { q = Math.max(1, Math.min(4, g.q | 0)) || q; sc = Math.max(0.55, Math.min(1, +g.s || 1)); } else { try { localStorage.removeItem(GFX_KEY); } catch (e) { } } }
  R.autoQ = auto && !DBG.nogov; R.setQuality(q);
  if (sc < 1) { R.dprScale = sc; R.applyDpr(); R.resize(); }
};
R.onGov = (q, sc) => { try { localStorage.setItem(GFX_KEY, JSON.stringify({ id: gfxId(), q, s: Math.round(sc * 100) / 100 })); } catch (e) { } };
setQ();
const ldBar = document.querySelector('#loading .ld-bar i');
const ldPct = document.querySelector('#loading .ld-pct');
const prog = k => { const v = Math.round(k * 100); if (ldBar) { ldBar.style.animation = 'none'; ldBar.style.width = Math.max(4, v) + '%'; } if (ldPct) ldPct.textContent = (v < 100 ? 'Loading assets… ' : 'Preparing… ') + v + '%'; };
prog(0);
try { await R.init(prog); } catch (e) { console.error('renderer init', e); }
R.showMenu();
let ICONS = {};
try {
  const et = []; for (const t of Object.keys(ENEMIES)) for (const r of Object.keys(RACES)) et.push([t, r]);
  ICONS = makeIcons(TOWER_ORDER, et);
} catch (e) { console.warn('icons', e); }
const PICONS = {};
function drawPowerIcons() {
  const draw = (k, fn) => { const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d'); fn(x); PICONS[k] = c.toDataURL(); };
  const bg = (x, a, b) => { const g = x.createLinearGradient(0, 0, 0, 96); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, 96, 96); };
  draw('block', x => { bg(x, '#5a6068', '#2a2e34'); x.fillStyle = '#b8b4a8'; x.fillRect(20, 34, 56, 38); x.fillStyle = '#8a867a'; x.fillRect(20, 64, 56, 8); x.fillStyle = '#f0c020'; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(22 + i * 14, 34); x.lineTo(30 + i * 14, 34); x.lineTo(24 + i * 14, 46); x.lineTo(20 + i * 14, 46); x.fill(); } });
  draw('mines', x => { bg(x, '#4a3a2a', '#201810'); for (const [cx, cy] of [[30, 58], [62, 46], [50, 72]]) { x.fillStyle = '#3a3a3a'; x.beginPath(); x.arc(cx, cy, 13, 0, 7); x.fill(); x.fillStyle = '#ff3020'; x.shadowColor = '#ff3020'; x.shadowBlur = 10; x.beginPath(); x.arc(cx, cy - 3, 4, 0, 7); x.fill(); x.shadowBlur = 0; } });
  draw('freeze', x => { bg(x, '#2a6a9a', '#0a2a4a'); x.strokeStyle = '#dff6ff'; x.lineWidth = 6; x.lineCap = 'round'; x.shadowColor = '#9fe8ff'; x.shadowBlur = 12; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; x.beginPath(); x.moveTo(48 + Math.cos(a) * 30, 48 + Math.sin(a) * 30); x.lineTo(48 - Math.cos(a) * 30, 48 - Math.sin(a) * 30); x.stroke(); for (const s of [1, -1]) { const px = 48 + s * Math.cos(a) * 18, py = 48 + s * Math.sin(a) * 18; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a + s * 2.4 + (s < 0 ? Math.PI : 0)) * 0, py); x.stroke(); } } });
  draw('strike', x => { bg(x, '#3a1a3a', '#100a18'); const g = x.createLinearGradient(40, 0, 56, 0); g.addColorStop(0, 'rgba(255,80,40,0)'); g.addColorStop(.5, '#fff'); g.addColorStop(1, 'rgba(255,80,40,0)'); x.fillStyle = '#ff5030'; x.shadowColor = '#ff6040'; x.shadowBlur = 20; x.fillRect(38, 0, 20, 70); x.fillStyle = g; x.fillRect(40, 0, 16, 72); x.beginPath(); x.ellipse(48, 74, 30, 10, 0, 0, 7); x.fillStyle = '#ffa040'; x.fill(); });
}
drawPowerIcons();
const ticon = k => ICONS['t_' + k] || '';
const eicon = (t, r) => ICONS['e_' + t + '_' + r] || '';

// ---------------- audio prefs ----------------
setSfx(S.sfx); setMusic(S.music);
let audioReady = false;
window.addEventListener('pointerdown', () => { if (!audioReady) { audioReady = true; initAudio(); setSfx(S.sfx); setMusic(S.music); } }, { capture: true });
const click = () => sfx.click && sfx.click();

// ---------------- float texts ----------------
const floatsEl = $('#floats'); const floats = []; const pool = [];
const UI = {
  floatText(x, y, z, text, cls) {
    if (floats.length > 60 && cls === 'dmg') return;
    const [sx, sy] = R.toScreen(x, y, z);
    const el = pool.pop() || document.createElement('div');
    el.className = 'ft ' + cls; el.textContent = text; el.style.opacity = 1; el.style.left = '0'; el.style.top = '0';
    floatsEl.appendChild(el);
    floats.push({ el, sx: sx + (Math.random() - 0.5) * 10, sy, t: 0, life: cls === 'dmg' ? 0.6 : 1.0 });
  },
};
function stepFloats(dt) {
  for (const f of floats) {
    f.t += dt; const k = f.t / f.life;
    f.el.style.transform = `translate(${f.sx}px, ${f.sy - k * 34}px) translate(-50%,-50%) scale(${k < 0.15 ? 0.6 + k * 2.6 : 1})`;
    f.el.style.opacity = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
  }
  for (let i = floats.length - 1; i >= 0; i--) if (floats[i].t >= floats[i].life) { const f = floats[i]; f.el.remove(); pool.push(f.el); floats.splice(i, 1); }
}
function clearFloats() { for (const f of floats) { f.el.remove(); pool.push(f.el); } floats.length = 0; }
const flashEl = $('#flash');
function flash(c, a) { flashEl.style.transition = 'none'; flashEl.style.background = c; flashEl.style.opacity = a; requestAnimationFrame(() => { flashEl.style.transition = 'opacity .45s'; flashEl.style.opacity = 0; }); }

// ---------------- generic helpers ----------------
const svgPlay = '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>';
const svgPause = '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
const svgFF = '<svg viewBox="0 0 24 24"><path d="M3 5v14l9-7zM12 5v14l9-7z"/></svg>';
let screen = 'title';
function clearUI() { ui.innerHTML = ''; closeMenus && closeMenus(); }
function nav(active) {
  const items = [['title', '⌂', 'Home'], ['map', '◈', 'Map'], ['upg', '▲', 'Upgrades'], ['info', '?', 'Codex'], ['set', '⚙', 'Settings']];
  const el = h(`<div class="nav">${items.map(([k, i, l]) => `<div class="nb ${k === active ? 'on' : ''}" data-k="${k}"><div class="oct"><div style="background:linear-gradient(160deg,#4a5058,#23272c)">${i}</div></div>${l}</div>`).join('')}</div>`);
  el.querySelectorAll('.nb').forEach(b => b.onclick = () => { click(); go(b.dataset.k); });
  return el;
}
function metabar() {
  return h(`<div class="metabar panel"><div class="it"><span class="star">★</span> ${totalStars()}/120</div><div class="it" style="font-size:13px;opacity:.75">${S.easy ? 'EASY MODE' : ''}</div><div class="it"><span class="emer">◆</span> <span id="emer">${S.emer}</span></div></div>`);
}
function go(k, arg) {
  if (k === 'title') showTitle(); else if (k === 'map') showMap(arg); else if (k === 'upg') showUpg(arg); else if (k === 'info') showInfo(); else if (k === 'set') showSettings();
}

// ---------------- title ----------------
function showTitle() {
  endBattleScene(); screen = 'title'; clearUI(); R.showMenu();
  const el = h(`<div id="title">
    <div class="title-logo">ANCIENT PLANET <b>II</b></div>
    <div class="sub">Return to Hamal</div>
    <div class="title-pod"><div class="play-big" id="tplay">${svgPlay}</div>
      <div class="title-small"><button class="sq" id="tset">⚙</button><button class="sq" id="tinfo">?</button><button class="sq" id="tmus">${S.music ? '♪' : '✕'}</button></div></div>
    <div class="disclaimer">A fan-made tribute sequel with original art &amp; code. Not affiliated with the original developers. <span style="opacity:.6">Build ${BUILD}</span></div></div>`);
  ui.appendChild(el);
  $('#tplay').onclick = () => { click(); if (!S.seen.w0 && !DBG.nostory) { showStory(STORY[0], () => { S.seen.w0 = 1; save(); showMap(0); }); } else showMap(); };
  $('#tset').onclick = () => { click(); showSettings(); };
  $('#tinfo').onclick = () => { click(); showInfo(); };
  $('#tmus').onclick = (e) => { S.music = !S.music; setMusic(S.music); save(); e.currentTarget.textContent = S.music ? '♪' : '✕'; };
}

// ---------------- world map ----------------
const MAPC = {
  verdant: ['#1d4a6a', '#5a9a3c', '#3c7a2e', '#c8b878'], reef: ['#0e5a7e', '#d6c48a', '#3ab8a0', '#f0e0b0'], frost: ['#1c3a5a', '#e6f2fa', '#9ac8e8', '#ffffff'],
  mire: ['#14302e', '#4a6a34', '#2e4a28', '#8ac060'], forge: ['#241414', '#6a3a26', '#3a2018', '#ff7020'], sky: ['#5a8ac8', '#c8ccb0', '#8a9a70', '#ffffff'],
  storm: ['#20283a', '#5a6a5a', '#3a4a40', '#a0c0ff'], city: ['#12121e', '#4a4a5c', '#2a2a3a', '#ffcc40'],
};
let mapWorld = 0;
function blobPath(r, cx, cy, rx, ry, n = 14, j = 0.28) {
  const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const k = 1 - j / 2 + r() * j; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  let d = ''; for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; d += (i === 0 ? `M${((pts[n - 1][0] + p[0]) / 2).toFixed(1)},${((pts[n - 1][1] + p[1]) / 2).toFixed(1)}` : '') + ` Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}`; }
  return d + 'Z';
}
function nodePos(w) { const r = rng(w * 71 + 5); const base = [[32, 112], [66, 94], [36, 74], [64, 52], [44, 30]]; return base.map(([x, y], i) => [x + (r() - 0.5) * 10, y + (r() - 0.5) * 6]); }
const PAINTED = {};
function paintedMap(w) {
  if (PAINTED[w]) return PAINTED[w];
  const b = WORLDS[w].biome, [sea, land, land2, acc] = MAPC[b];
  const W = 300, H = 420, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const S = hex(sea), L1 = hex(land), L2 = hex(land2), A = hex(acc);
  const hs = (ix, iy, s) => { let h = (ix * 374761393 + iy * 668265263 + s * 974711) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const vn = (px, py, s) => { const xi = Math.floor(px), yi = Math.floor(py), xf = px - xi, yf = py - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hs(xi, yi, s), bb = hs(xi + 1, yi, s), cc = hs(xi, yi + 1, s), d = hs(xi + 1, yi + 1, s); return a + (bb - a) * u + (cc - a) * v + (a - bb - cc + d) * u * v; };
  const fb = (px, py, s, o = 5) => { let t = 0, am = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { t += vn(px * f, py * f, s + i) * am; n += am; am *= 0.5; f *= 2; } return t / n; };
  const seed = w * 17 + 3;
  const ht = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const nx = (i / W - 0.5) * 2, ny = (j / H - 0.52) * 2; const fall = 1 - Math.pow(Math.hypot(nx * 1.05, ny * 0.95), 2.2); ht[j * W + i] = fb(i / 70, j / 70, seed) * 0.9 + fall * 0.55 - 0.42 + fb(i / 18, j / 18, seed + 9, 3) * 0.12; }
  const img = x.createImageData(W, H), d = img.data; const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * Math.max(0, Math.min(1, t)));
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    const k = j * W + i, h0 = ht[k]; const dx = ht[k + 1] - ht[k - 1], dy = ht[k + W] - ht[k - W];
    const shade = Math.max(0.55, Math.min(1.35, 1 + (-dx - dy) * 22)); let col;
    if (h0 < 0) { const dep = Math.min(1, -h0 * 5); col = mix(mix(S, [255, 255, 255], 0.18), S.map(v => v * 0.7), dep); const wave = Math.sin(i * 0.15 + Math.sin(j * 0.05) * 3 + j * 0.02) > 0.97 ? 1.12 : 1; col = col.map(v => v * wave); if (h0 > -0.025) col = mix(col, A, 0.35); }
    else { const t = Math.min(1, h0 * 1.8); col = mix(L1, L2, t + (fb(i / 25, j / 25, seed + 4, 3) - 0.5) * 0.9); if (h0 < 0.02) col = mix(col, A, 0.45); if (h0 > 0.42) col = mix(col, b === 'forge' ? [50, 26, 22] : [128, 116, 98], (h0 - 0.42) * 6); if (h0 > 0.62 && (b === 'frost' || b === 'storm')) col = mix(col, [236, 238, 242], (h0 - 0.58) * 8); col = col.map(v => v * shade); }
    const g = (fb(i / 3, j / 3, seed + 20, 2) - 0.5) * 18; d[k * 4] = col[0] + g; d[k * 4 + 1] = col[1] + g; d[k * 4 + 2] = col[2] + g; d[k * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // painterly strokes: trees / rocks / buildings
  const r = rng(w * 131 + 17);
  for (let n = 0; n < 340; n++) { const i = 10 + r() * (W - 20), j = 10 + r() * (H - 20), h0 = ht[(j | 0) * W + (i | 0)]; if (h0 < 0.04 || h0 > 0.45) continue; const z = 2 + r() * 3;
    if (b === 'city') { x.fillStyle = 'rgba(20,20,34,.85)'; x.fillRect(i, j - z * 2, z * 1.4, z * 2); x.fillStyle = acc; x.fillRect(i + z * 0.4, j - z * 1.6, 1, 1); }
    else if (b === 'reef' || b === 'mire') { x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.arc(i + 1, j + 1, z, 0, 7); x.fill(); x.fillStyle = `rgba(${A.join(',')},.55)`; x.beginPath(); x.arc(i, j, z * 0.7, 0, 7); x.fill(); }
    else { x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.moveTo(i - z, j + 1); x.lineTo(i + 1, j - z * 1.8); x.lineTo(i + z + 1, j + 1); x.fill(); x.fillStyle = b === 'frost' ? 'rgba(255,255,255,.8)' : b === 'forge' ? `rgba(${A.join(',')},.8)` : `rgba(${L2.map(v => v * 0.6).join(',')},.95)`; x.beginPath(); x.moveTo(i - z * 0.8, j); x.lineTo(i, j - z * 1.8); x.lineTo(i + z * 0.8, j); x.fill(); }
  }
  if (b === 'sky' || b === 'storm') for (let n = 0; n < 14; n++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.save(); x.translate(r() * W, r() * H); x.scale(2, 0.6); x.fillStyle = g; x.fillRect(-30, -30, 60, 60); x.restore(); }
  const vg = x.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.85); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  return (PAINTED[w] = c.toDataURL('image/jpeg', 0.88));
}
function worldSVG(w) {
  const np = nodePos(w);
  return `<img class="painted" src="${paintedMap(w)}" alt=""><svg viewBox="0 0 100 140" preserveAspectRatio="none"><path d="M${np.map(p => p.join(',')).join(' L')}" stroke="#000" stroke-opacity=".35" stroke-width="1.8" fill="none" transform="translate(.4,.6)"/><path d="M${np.map(p => p.join(',')).join(' L')}" stroke="#fff6d0" stroke-opacity=".9" stroke-width=".9" stroke-dasharray="2 1.6" fill="none"/></svg>`;
}
function worldSVG_old(w) {
  const b = WORLDS[w].biome, [sea, land, land2, acc] = MAPC[b]; const r = rng(w * 131 + 17);
  let s = `<svg viewBox="0 0 100 140" preserveAspectRatio="none"><defs><radialGradient id="lg${w}" cx="50%" cy="45%" r="60%"><stop offset="0%" stop-color="${land}"/><stop offset="100%" stop-color="${land2}"/></radialGradient>
  <pattern id="wv${w}" width="8" height="4" patternUnits="userSpaceOnUse"><path d="M0 2 Q2 0 4 2 T8 2" stroke="rgba(255,255,255,.08)" fill="none" stroke-width=".5"/></pattern></defs>
  <rect width="100" height="140" fill="${sea}"/><rect width="100" height="140" fill="url(#wv${w})"/>`;
  // islets
  for (let i = 0; i < 5; i++) s += `<path d="${blobPath(r, r() * 100, r() * 140, 3 + r() * 6, 2 + r() * 4, 8)}" fill="${land2}" opacity=".7"/>`;
  s += `<path d="${blobPath(r, 50, 72, 44, 60, 16, 0.3)}" fill="${land2}" transform="translate(1.2,2)" opacity=".6"/>`;
  s += `<path d="${blobPath(rng(w * 131 + 17), 50, 72, 44, 60, 16, 0.3)}" fill="url(#lg${w})" stroke="${acc}" stroke-opacity=".35" stroke-width=".6"/>`;
  // terrain detail
  for (let i = 0; i < 26; i++) {
    const x = 18 + r() * 64, y = 22 + r() * 100, z = 1.5 + r() * 3;
    if (b === 'frost' || b === 'storm' || b === 'forge' || b === 'verdant') s += `<path d="M${x - z},${y} L${x},${y - z * 1.4} L${x + z},${y}Z" fill="${b === 'forge' ? '#2a1610' : 'rgba(0,0,0,.22)'}"/><path d="M${x - z * .3},${y - z} L${x},${y - z * 1.4} L${x + z * .3},${y - z}Z" fill="${b === 'forge' ? acc : 'rgba(255,255,255,.5)'}"/>`;
    else if (b === 'city') s += `<rect x="${x}" y="${y - z * 2}" width="${z}" height="${z * 2}" fill="#20202c"/><rect x="${x + z * .3}" y="${y - z * 1.6}" width=".6" height=".6" fill="${acc}"/>`;
    else s += `<circle cx="${x}" cy="${y}" r="${z * .7}" fill="rgba(0,0,0,.15)"/><circle cx="${x - .3}" cy="${y - .3}" r="${z * .35}" fill="${acc}" opacity=".55"/>`;
  }
  if (b === 'sky') for (let i = 0; i < 8; i++) s += `<ellipse cx="${r() * 100}" cy="${r() * 140}" rx="${8 + r() * 10}" ry="${2 + r() * 2}" fill="#fff" opacity=".35"/>`;
  const np = nodePos(w);
  s += `<path d="M${np.map(p => p.join(',')).join(' L')}" stroke="#fff" stroke-opacity=".75" stroke-width=".9" stroke-dasharray="2 1.6" fill="none"/>`;
  return s + '</svg>';
}
function showMap(w) {
  endBattleScene(); screen = 'map'; clearUI(); R.showMenu();
  if (w == null) w = Math.floor(maxUnlocked() / 5);
  mapWorld = Math.max(0, Math.min(7, w));
  ui.appendChild(metabar());
  const fr = h(`<div class="frame panel" id="map"><div class="mapview" id="mv"></div></div>`); ui.appendChild(fr); ui.appendChild(nav('map'));
  ui.id = 'ui'; fr.id = 'map';
  renderWorld();
  const eb = h(`<button class="btn gold endless-btn ${endlessOpen() ? '' : 'dim'}" id="mendless">∞ Endless</button>`); fr.appendChild(eb);
  eb.onclick = () => { if (!endlessOpen()) { sfx.deny && sfx.deny(); hint2('Beat 1-5 to unlock Endless mode'); return; } click(); endlessCard(); };
}
function renderWorld() {
  const mv = $('#mv'); const w = mapWorld; const np = nodePos(w);
  mv.innerHTML = worldSVG(w) + `<div class="wname">${WORLDS[w].name}</div><div class="wblurb">${WORLDS[w].blurb}</div>
    <div class="arrow l" ${w === 0 ? 'style="visibility:hidden"' : ''}>‹</div><div class="arrow r" ${w === 7 ? 'style="visibility:hidden"' : ''}>›</div>
    <div class="dots">${WORLDS.map((_, i) => `<i class="${i === w ? 'on' : ''}"></i>`).join('')}</div>`;
  const cur = maxUnlocked();
  for (let l = 0; l < 5; l++) {
    const i = w * 5 + l, u = unlocked(i), st = S.stars[i];
    const n = h(`<div class="node ${u ? '' : 'locked'} ${i === cur && !st ? 'cur' : ''}" style="left:${np[l][0]}%;top:${np[l][1] / 1.4}%"><div class="em">${u ? (l === 4 ? '☠' : l + 1) : '🔒'}</div><div class="st">${u ? [0, 1, 2].map(k => `<span class="${k < st ? 'star' : 'off'}">★</span>`).join('') : ''}</div></div>`);
    n.onclick = (e) => { e.stopPropagation(); if (!u) { sfx.deny && sfx.deny(); return; } click(); levelCard(i); };
    mv.appendChild(n);
  }
  const maxWorld = Math.max(0, Math.min(7, Math.floor(maxUnlocked() / 5)));
  mv.querySelector('.arrow.l').onclick = e => { e.stopPropagation(); if (mapWorld > 0) { mapWorld--; click(); renderWorld(); } };
  mv.querySelector('.arrow.r').onclick = e => { e.stopPropagation(); if (mapWorld < 7) { mapWorld++; click(); renderWorld(); } };
  mv.querySelectorAll('.dots i').forEach((d, i) => { d.onclick = e => { e.stopPropagation(); if (i <= maxWorld || i === mapWorld) { mapWorld = i; click(); renderWorld(); } }; });
  let sx = null, sEl = null;
  mv.onpointerdown = e => { sx = e.clientX; sEl = e.target; };
  mv.onpointerup = e => {
    if (sx == null) return; const dx = e.clientX - sx, start = sEl; sx = null; sEl = null;
    if (Math.abs(dx) <= 50) return;
    if (start && start.closest && (start.closest('.node') || start.closest('.levelcard') || start.closest('.arrow'))) return;
    const nw = mapWorld + (dx < 0 ? 1 : -1); if (nw >= 0 && nw <= 7) { mapWorld = nw; renderWorld(); }
  };
}
const endlessOpen = () => DBG.unlock || (S.stars[4] | 0) > 0;
function hint2(t) { const mv = $('#mv'); if (!mv) return; const old = $('.levelcard', mv); if (old) old.remove(); const el = h(`<div class="levelcard panel"><div class="meta">${t}</div></div>`); mv.appendChild(el); setTimeout(() => el.remove(), 1800); }
const twistChips = tw => tw.map(k => `<span class="twist" title="${TWISTS[k].desc}"><i>${TWISTS[k].icon}</i>${TWISTS[k].name}</span>`).join('');
function endlessCard() {
  const mv = $('#mv'); const old = $('.levelcard', mv); if (old) old.remove();
  const maxW = Math.floor(maxUnlocked() / 5);
  const rows = WORLDS.map((W, w) => { const ok = w <= maxW || DBG.unlock; const best = S.endless['w' + w] || 0; return `<div class="erow ${ok ? '' : 'locked'}" data-w="${w}"><b>${W.name}</b><span>${ok ? (best ? 'Best: wave ' + best : 'Not played') : '🔒'}</span></div>`; }).join('');
  const el = h(`<div class="levelcard panel endless"><h3>∞ Endless</h3><div class="meta">Survive as long as you can. A Warlord every 10 waves, and a new mutation stacks on every 10 waves. Earn ◆ for every wave.</div><div class="elist">${rows}</div><div class="row"><button class="btn" id="lx">✕</button></div></div>`);
  mv.appendChild(el); el.onpointerup = e => e.stopPropagation();
  el.querySelectorAll('.erow').forEach(r => r.onclick = () => { if (r.classList.contains('locked')) { sfx.deny && sfx.deny(); return; } click(); startLevel(-1 - (+r.dataset.w)); });
  $('#lx').onclick = () => el.remove();
}
function unlockNotes(i) {
  const out = [];
  for (const k in UNLOCKS.tower) if (UNLOCKS.tower[k] === i && i > 0) out.push('New tower: ' + TOWERS[k].name);
  for (const k in UNLOCKS.power) if (UNLOCKS.power[k] === i) out.push('New power: ' + POWERS[k].name);
  if (i === 8) out.push('New: crosshair targets & beacons');
  for (const k in ENEMY_UNLOCK) if (ENEMY_UNLOCK[k] === i && i >= 9) out.push('New enemy: ' + ENEMIES[k].name);
  return out;
}
function levelCard(i) {
  const mv = $('#mv'); const old = $('.levelcard', mv); if (old) old.remove();
  const L = genLevel(i);
  const notes = unlockNotes(i);
  const el = h(`<div class="levelcard panel"><h3>${lname(i)} · ${WORLDS[L.world].name}</h3>
    <div class="meta">${L.waves.length} waves · <span class="star">${'★'.repeat(S.stars[i])}</span><span style="color:#555">${'★'.repeat(3 - S.stars[i])}</span>${L.l === 4 ? ' · <b style="color:#ff6a4a">BOSS</b>' : ''}</div>
    ${notes.length ? `<div class="new">${notes.join(' · ')}</div>` : ''}
    ${L.twists.length ? `<div class="twists">${twistChips(L.twists)}</div><div class="tdesc">${L.twists.map(k => TWISTS[k].desc).join(' ')}</div>` : ''}
    ${L.l === 4 ? `<div class="tdesc" style="color:#ff9a7a">Warlord: ${(L.bossAbil || []).map(a => ABIL_TEXT[a]).join(', ')}.</div>` : ''}
    <div class="row"><button class="btn green" id="lplay">Play</button><button class="btn ${S.easy ? 'gold' : ''}" id="leasy">Easy: ${S.easy ? 'On' : 'Off'}</button><button class="btn" id="lx">✕</button></div></div>`);
  mv.appendChild(el);
  el.onpointerup = e => e.stopPropagation();
  $('#lplay').onclick = () => { click(); const w = Math.floor(i / 5); if (i % 5 === 0 && !S.seen['w' + w] && !DBG.nostory) showStory(STORY[w], () => { S.seen['w' + w] = 1; save(); startLevel(i); }); else startLevel(i); };
  $('#leasy').onclick = () => { S.easy = !S.easy; save(); click(); levelCard(i); const mb = $('.metabar'); if (mb) mb.replaceWith(metabar()); };
  $('#lx').onclick = () => el.remove();
}

// ---------------- upgrades ----------------
let upgTab = 'towers', upgGroup = null, upgSel = null;
const GLYPH = { dmg: '✦', range: '◎', cost: '%', coin: '$', magnet: '⊛', boost: '⚡', charges: '+1', pot: '↑', cd: '⟳', life: '♥', bgun: '⌖', dome: '◠', gold: '¤', perk: '★', sell: '♻', interest: '%', mend: '✚' };
const groupLabel = (tab, g) => tab === 'towers' ? TOWERS[g].name : tab === 'weapon' ? POWERS[g].name : ({ gate: 'Temple Gate', gun: 'Base Turret', dome: 'Energy Dome', treasury: 'War Chest', salvage: 'Salvage' })[g];
const groupIcon = (tab, g) => tab === 'towers' ? ticon(g) : tab === 'weapon' ? PICONS[g] : null;
const groupLocked = (tab, g) => tab === 'towers' ? UNLOCKS.tower[g] > maxUnlocked() : tab === 'weapon' ? UNLOCKS.power[g] > maxUnlocked() : false;
function showUpg(tab) {
  endBattleScene(); screen = 'upg'; clearUI(); R.showMenu();
  if (tab) upgTab = tab;
  ui.appendChild(metabar());
  const fr = h(`<div class="frame panel" id="upg"><div class="tabs">${['towers', 'weapon', 'base'].map(t => `<div data-t="${t}" class="${t === upgTab ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)}</div>`).join('')}</div>
    <div class="ucards" id="ucards"></div><div class="ugroup-title" id="ugt"></div><div class="unodes" id="unodes"></div><div class="udetail" id="udet"></div></div>`);
  ui.appendChild(fr); ui.appendChild(nav('upg'));
  fr.querySelectorAll('.tabs div').forEach(d => d.onclick = () => { click(); upgTab = d.dataset.t; upgGroup = null; upgSel = null; showUpg(); });
  const groups = Object.keys(META[upgTab]).filter(g => upgTab !== 'towers' || TOWER_ORDER.includes(g)).sort((a, b) => upgTab === 'towers' ? TOWER_ORDER.indexOf(a) - TOWER_ORDER.indexOf(b) : 0);
  if (!upgGroup || !groups.includes(upgGroup)) upgGroup = groups.find(g => !groupLocked(upgTab, g)) || groups[0];
  const uc = $('#ucards');
  for (const g of groups) {
    const ic = groupIcon(upgTab, g);
    const el = h(`<div class="ucard ${g === upgGroup ? 'on' : ''} ${groupLocked(upgTab, g) ? 'locked' : ''}" style="${ic ? `background-image:url(${ic})` : ''}">${ic ? '' : `<div style="display:flex;height:100%;align-items:center;justify-content:center;font-size:28px">${{ gate: '♥', gun: '⌖', dome: '◠', treasury: '¤', salvage: '♻' }[g]}</div>`}<span>${groupLabel(upgTab, g)}</span></div>`);
    el.onclick = () => { click(); upgGroup = g; upgSel = null; showUpg(); };
    uc.appendChild(el);
  }
  renderNodes();
}
function renderNodes() {
  const nodes = META[upgTab][upgGroup]; const locked = groupLocked(upgTab, upgGroup);
  $('#ugt').textContent = groupLabel(upgTab, upgGroup) + (locked ? ' — unlocks later in the campaign' : '');
  const depth = {}; const dep = n => n.req ? (depth[n.req] ?? dep(nodes.find(m => m.id === n.req))) + 1 : 0;
  for (const n of nodes) depth[n.id] = dep(n);
  const rows = []; for (const n of nodes) (rows[depth[n.id]] = rows[depth[n.id]] || []).push(n);
  const box = $('#unodes'); box.innerHTML = '';
  if (!upgSel) upgSel = (nodes.find(n => !S.owned[n.id] && (!n.req || S.owned[n.req])) || nodes[0]).id;
  rows.forEach((row, ri) => {
    const r = h(`<div class="urow"></div>`);
    for (const n of row) {
      const own = !!S.owned[n.id], avail = !own && (!n.req || S.owned[n.req]) && !locked;
      const k = Object.keys(n.eff)[0];
      const el = h(`<div class="unode ${own ? 'own' : ''} ${avail ? 'avail' : ''} ${n.id === upgSel ? 'sel' : ''} ${n.perk ? 'perk' : ''}">${GLYPH[k] || '•'}${own ? '' : `<span class="c">${n.cost}</span>`}</div>`);
      el.onclick = () => { click(); upgSel = n.id; renderNodes(); };
      r.appendChild(el);
    }
    box.appendChild(r);
    if (ri < rows.length - 1) box.appendChild(h('<div style="text-align:center;color:#556;margin:-6px 0">▼</div>'));
  });
  const n = nodes.find(m => m.id === upgSel); const own = !!S.owned[n.id]; const avail = !own && (!n.req || S.owned[n.req]) && !locked;
  const k = Object.keys(n.eff)[0];
  const det = $('#udet');
  det.innerHTML = `<div class="big">${GLYPH[k] || '•'}</div><div class="txt"><b>${n.name}${n.perk ? ' <span style="color:var(--gold,#ffc840);font-size:11px">PERK</span>' : ''}</b>${n.desc}<br><span style="opacity:.7">${own ? 'Owned' : locked ? 'Locked' : !avail ? 'Requires ' + nodes.find(m => m.id === n.req).name : 'Cost: <span class="emer">◆ ' + n.cost + '</span>'}</span></div>
    <div class="col"><button class="btn green ${avail && S.emer >= n.cost ? '' : 'dim'}" id="ubuy">Buy</button><button class="btn ${S.hist.length ? '' : 'dim'}" id="uundo">Undo</button><button class="btn red ${Object.keys(S.owned).length ? '' : 'dim'}" id="ureset">Reset</button></div>`;
  $('#ubuy').onclick = () => {
    if (!avail || S.emer < n.cost) { sfx.deny && sfx.deny(); return; }
    S.owned[n.id] = 1; S.emer -= n.cost; S.hist.push(n.id); save(); sfx.upgrade && sfx.upgrade(); refreshEmer(); upgSel = null; renderNodes();
  };
  $('#uundo').onclick = () => { const id = S.hist.pop(); if (!id) return; const m = allNodes().find(x => x.id === id); if (m && S.owned[id]) { delete S.owned[id]; S.emer += m.cost; } save(); click(); refreshEmer(); upgSel = id; renderNodes(); };
  $('#ureset').onclick = () => { let ref = 0; for (const m of allNodes()) if (S.owned[m.id]) ref += m.cost; S.owned = {}; S.hist = []; S.emer += ref; save(); sfx.sell && sfx.sell(); refreshEmer(); upgSel = null; renderNodes(); };
}
const allNodes = () => { const o = []; for (const t in META) for (const g in META[t]) o.push(...META[t][g]); return o; };
const refreshEmer = () => { const e = $('#emer'); if (e) e.textContent = S.emer; };

// ---------------- codex ----------------
function showInfo() {
  endBattleScene(); screen = 'info'; clearUI(); R.showMenu();
  ui.appendChild(metabar());
  const fr = h(`<div class="frame panel" style="top:calc(58px + var(--safe-t))"><div class="scroll">
    <h3>How to play</h3>
    <p>Enemies march along the road toward your crystal temple. Tap any free tile to build a tower, tap a tower to upgrade or sell it. Build <b>Ore Factories</b> on glowing deposits and <b>tap the coins</b> they produce. Send waves early with the next-wave button for bonus gold. Clear crosshair rocks by tapping them to earn gold and Cores (◆). Win with most of your life intact for 3 stars, and spend emeralds on permanent upgrades.</p>
    <h3>Enemy races</h3>
    ${Object.entries(RACES).map(([k, r]) => `<div class="irow"><img src="${eicon('grunt', k)}"><div><b>${r.name}</b><br><small>${r.desc}</small></div></div>`).join('')}
    <h3>Enemies</h3>
    ${Object.entries(ENEMIES).map(([k, e]) => `<div class="irow"><img src="${eicon(k, 'rust')}"><img src="${eicon(k, 'glim')}"><div><b>${e.name}</b> <small>· from ${lname(ENEMY_UNLOCK[k])}</small><br><small>${e.desc ? e.desc + ' ' : ''}${e.air ? 'Flying. Ignores ground-only towers. ' : ''}${e.armor ? 'Armor ' + e.armor + '. ' : ''}${e.boss ? 'Boss. Massive health, and a special ability that changes by world.' : ''}${!e.desc && !e.air && !e.armor && !e.boss ? (k === 'swarm' ? 'Fast and numerous.' : 'Standard infantry.') : ''}</small></div></div>`).join('')}
    <h3>Twists</h3><p><small>From world 2 on, most levels change one or two rules. The level card tells you which.</small></p>
    ${Object.values(TWISTS).map(t => `<div class="irow"><div class="tico">${t.icon}</div><div><b>${t.name}</b><br><small>${t.desc}</small></div></div>`).join('')}
    <h3>Towers</h3>
    ${TOWER_ORDER.map(k => `<div class="irow"><img src="${ticon(k)}"><div><b>${TOWERS[k].name}</b> <small>· ${TOWERS[k].cost} gold${TOWERS[k].core ? ' + 1◆' : ''} · unlocks at ${lname(UNLOCKS.tower[k])}</small><br><small>${TOWERS[k].desc}</small>${TOWERS[k].branches ? `<br><small style="color:var(--lime)">Branches: ${TOWERS[k].branches.map(b => b.name).join(' / ')}</small>` : ''}</div></div>`).join('')}
    <h3>Powers</h3>
    ${POWER_ORDER.map(k => `<div class="irow"><img src="${PICONS[k]}"><div><b>${POWERS[k].name}</b> <small>· unlocks at ${lname(UNLOCKS.power[k])}</small><br><small>${POWERS[k].desc}</small></div></div>`).join('')}
    <h3>Credits</h3><p><small>Ancient Planet II: Return to Hamal is an unofficial fan-made tribute. All art is procedurally generated, and all code, story and characters are original.</small></p>
  </div></div>`);
  ui.appendChild(fr); ui.appendChild(nav('info'));
}

// ---------------- settings ----------------
function showSettings() {
  endBattleScene(); screen = 'set'; clearUI(); R.showMenu();
  ui.appendChild(metabar());
  const fr = h(`<div class="frame panel" style="top:calc(58px + var(--safe-t))"><div class="scroll">
    <div class="toggle">Easy mode<small style="flex:1;margin-left:10px;opacity:.6;font-size:11px">weaker enemies, more gold & life</small><div class="sw ${S.easy ? 'on' : ''}" data-k="easy"></div></div>
    <div class="toggle">Music<div class="sw ${S.music ? 'on' : ''}" data-k="music"></div></div>
    <div class="toggle">Sound effects<div class="sw ${S.sfx ? 'on' : ''}" data-k="sfx"></div></div>
    <div class="toggle">Graphics<div class="seg">${['auto', 'ultra', 'high', 'med', 'low'].map(q => `<div data-q="${q}" class="${S.quality === q ? 'on' : ''}">${q[0].toUpperCase() + q.slice(1)}</div>`).join('')}</div></div>
    <div class="toggle">Progress<button class="btn red" id="sreset" style="font-size:13px;padding:6px 12px">Reset progress</button></div>
    <p style="opacity:.6;font-size:12px;margin-top:20px">Progress saves automatically on this device. No ads, no energy timers, no purchases.</p>
  </div></div>`);
  ui.appendChild(fr); ui.appendChild(nav('set'));
  fr.querySelectorAll('.sw').forEach(sw => sw.onclick = () => {
    const k = sw.dataset.k; S[k] = !S[k]; sw.classList.toggle('on', S[k]); save(); click();
    if (k === 'music') setMusic(S.music); if (k === 'sfx') setSfx(S.sfx);
    if (k === 'easy') { const mb = $('.metabar'); if (mb) mb.replaceWith(metabar()); }
  });
  fr.querySelectorAll('.seg div').forEach(d => d.onclick = () => { S.quality = d.dataset.q; try { localStorage.removeItem(GFX_KEY); } catch (e) { } save(); setQ(); click(); fr.querySelectorAll('.seg div').forEach(x => x.classList.toggle('on', x === d)); });
  let armed = false;
  $('#sreset').onclick = (e) => { if (!armed) { armed = true; e.target.textContent = 'Tap again to erase'; return; } const keep = { music: S.music, sfx: S.sfx, quality: S.quality }; S = Object.assign(defSave(), keep); save(); showTitle(); };
}

// ---------------- story ----------------
const CHAR = {
  'Commander Ottoline Vex': { col: '#3a7ad8', acc: '#9fe8ff', kind: 'vex' },
  'Engineer Nib': { col: '#e08a2a', acc: '#ffe060', kind: 'nib' },
  'Viceroy Gorbin Plume': { col: '#8a3ad8', acc: '#ff60c0', kind: 'plume' },
};
function drawPanel(cv, card, wIdx, side) {
  const W = cv.width = 400, H = cv.height = 500; const x = cv.getContext('2d');
  const [sea, land, land2, acc] = MAPC[WORLDS[Math.min(7, wIdx)].biome];
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, sea); g.addColorStop(1, '#05080c'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  // speed lines / starburst
  x.save(); x.translate(side < 0 ? 120 : 280, 330); for (let i = 0; i < 36; i++) { x.rotate(Math.PI * 2 / 36); x.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; x.beginPath(); x.moveTo(0, 0); x.lineTo(600, -40); x.lineTo(600, 40); x.fill(); } x.restore();
  // ground
  x.fillStyle = land2; x.beginPath(); x.moveTo(0, 420); for (let i = 0; i <= 10; i++) x.lineTo(i * 40, 410 + Math.sin(i * 1.7 + wIdx) * 14); x.lineTo(W, H); x.lineTo(0, H); x.fill();
  x.fillStyle = land; x.beginPath(); x.moveTo(0, 450); for (let i = 0; i <= 10; i++) x.lineTo(i * 40, 445 + Math.cos(i * 1.3 + wIdx) * 8); x.lineTo(W, H); x.lineTo(0, H); x.fill();
  const c = CHAR[card.who] || CHAR['Engineer Nib'];
  const cx = side < 0 ? 120 : 280, by = 450;
  x.save(); x.translate(cx, by); if (side > 0) x.scale(-1, 1);
  x.lineWidth = 4; x.strokeStyle = '#111';
  const shape = (fn, fill) => { x.beginPath(); fn(); x.fillStyle = fill; x.fill(); x.stroke(); };
  if (c.kind === 'vex') {
    shape(() => { x.moveTo(-60, 0); x.lineTo(-48, -130); x.quadraticCurveTo(0, -160, 48, -130); x.lineTo(60, 0); x.closePath(); }, c.col);
    shape(() => { x.rect(-50, -120, 100, 14); }, '#22262a');
    shape(() => { x.arc(0, -190, 48, 0, 7); }, '#d8dce0');
    shape(() => { x.moveTo(-40, -200); x.quadraticCurveTo(0, -215, 40, -200); x.lineTo(36, -176); x.quadraticCurveTo(0, -168, -36, -176); x.closePath(); }, c.acc);
    shape(() => { x.rect(-6, -250, 12, 22); }, '#f0c020');
    shape(() => { x.moveTo(30, -110); x.lineTo(90, -60); x.lineTo(80, -48); x.lineTo(24, -90); x.closePath(); }, c.col);
  } else if (c.kind === 'nib') {
    shape(() => { x.ellipse(0, -55, 46, 60, 0, 0, 7); }, c.col);
    shape(() => { x.rect(-30, -60, 60, 40); }, '#6a4a2a');
    shape(() => { x.arc(0, -150, 44, 0, 7); }, '#f0c8a0');
    shape(() => { x.arc(-16, -158, 15, 0, 7); }, c.acc); shape(() => { x.arc(18, -158, 15, 0, 7); }, c.acc);
    shape(() => { x.arc(-16, -158, 6, 0, 7); }, '#222'); shape(() => { x.arc(18, -158, 6, 0, 7); }, '#222');
    shape(() => { x.moveTo(-10, -130); x.quadraticCurveTo(2, -120, 14, -130); }, 'transparent');
    shape(() => { x.moveTo(40, -70); x.lineTo(96, -128); x.lineTo(108, -116); x.lineTo(52, -58); x.closePath(); }, '#9aa0a8');
    shape(() => { x.arc(102, -124, 14, 0, 7); }, '#9aa0a8');
    shape(() => { x.moveTo(-44, -176); x.quadraticCurveTo(0, -214, 44, -176); x.closePath(); }, '#3a3a40');
  } else {
    shape(() => { x.moveTo(-80, 0); x.quadraticCurveTo(-70, -120, -40, -150); x.lineTo(40, -150); x.quadraticCurveTo(70, -120, 80, 0); x.closePath(); }, '#b0203a');
    shape(() => { x.moveTo(-42, 0); x.lineTo(-36, -150); x.quadraticCurveTo(0, -170, 36, -150); x.lineTo(42, 0); x.closePath(); }, c.col);
    for (let i = 0; i < 4; i++) shape(() => { x.rect(-8, -130 + i * 26, 16, 10); }, '#f0c020');
    shape(() => { x.ellipse(0, -200, 40, 52, 0, 0, 7); }, '#7ad0a0');
    shape(() => { x.ellipse(-14, -206, 9, 13, -0.3, 0, 7); }, '#fff'); shape(() => { x.ellipse(14, -206, 9, 13, 0.3, 0, 7); }, '#fff');
    shape(() => { x.arc(-12, -204, 4, 0, 7); }, '#111'); shape(() => { x.arc(16, -204, 4, 0, 7); }, '#111');
    shape(() => { x.moveTo(-18, -178); x.quadraticCurveTo(0, -168, 18, -178); }, 'transparent');
    for (let i = -2; i <= 2; i++) shape(() => { x.moveTo(i * 10, -246); x.quadraticCurveTo(i * 26, -300, i * 18 + 6, -330 + Math.abs(i) * 18); x.quadraticCurveTo(i * 12, -290, i * 6 + 4, -246); x.closePath(); }, i % 2 ? c.acc : '#f0c020');
  }
  x.restore();
  // halftone overlay
  x.fillStyle = 'rgba(0,0,0,.12)'; for (let yy = 0; yy < H; yy += 8) for (let xx = (yy / 8) % 2 * 4; xx < W; xx += 8) { x.beginPath(); x.arc(xx, yy, 1.2, 0, 7); x.fill(); }
}
function showStory(cards, done) {
  let finished = false;
  const prevScreen = screen;
  const finish = () => { if (finished) return; finished = true; if (el && el.parentNode) el.remove(); screen = prevScreen; try { done && done(); } catch (err) { console.warn('story done', err); } };
  if (!cards || !cards.length) { finish(); return; }
  screen = 'story';
  const wIdx = STORY.indexOf(cards) >= 0 ? STORY.indexOf(cards) : 7;
  const el = h(`<div id="story"><div class="title-logo">ANCIENT PLANET <b>II</b></div><div class="comic panel"><div class="art"><canvas></canvas><div class="bubble"></div></div></div>
    <div class="progress"><i></i></div><div class="story-row"><button class="btn" id="sskip">Skip</button><button class="btn green" id="snext">Next ▶</button></div></div>`);
  ui.appendChild(el);
  let i = 0;
  const show = () => {
    const c = cards[i]; const side = i % 2 ? 1 : -1;
    try { drawPanel($('canvas', el), c, wIdx, side); } catch (err) { console.warn('story art', err); }
    const b = $('.bubble', el); b.style.top = '5%'; b.innerHTML = `<span class="who">${c.who}</span>${c.text}`;
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    b.style.setProperty('--tail', side < 0 ? '30%' : '65%');
    $('.progress i', el).style.width = ((i + 1) / cards.length * 100) + '%';
    $('#snext', el).textContent = i === cards.length - 1 ? 'Continue ▶' : 'Next ▶';
  };
  const next = () => { click(); i++; if (i >= cards.length) finish(); else show(); };
  $('#snext', el).onclick = e => { e.stopPropagation(); next(); };
  $('#sskip', el).onclick = e => { e.stopPropagation(); click(); finish(); };
  el.onclick = e => { if (!e.target.closest('button')) next(); };
  show();
}

// ---------------- battle ----------------
let G = null, AI = null, curIdx = 0, paused = false, speed = 1, ended = false, endT = 0;
let sel = null;          // selected tower
let placeKind = null;    // tray placement
let powerMode = null;    // power awaiting target
let hudRefs = {}, lastHud = {};
let tutStep = 0;
function endBattleScene() { G = null; AI = null; sel = null; placeKind = null; powerMode = null; clearFloats(); }
let starting = false;
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ' timed out')), ms))]);
async function startLevel(i) {
  if (starting) return; starting = true;
  try {
  const L = i < 0 ? genEndless(-1 - i, 1 + (S.plays % 997)) : genLevel(i);
  try { await withTimeout(R.prepBiome(L.biome), 25000, 'biome load'); } catch (e) { console.warn('biome', e); }
  curIdx = i; S.plays++; save();
  G = new Game(L, { meta: metaEffects(S.owned), easy: S.easy, autoCollect: DBG.auto, god: DBG.god });
  AI = DBG.auto ? new AutoPlayer(G, { skill: 1, callEarly: true }) : null;
  paused = false; speed = DBG.speed || (DBG.auto ? 2 : 1); ended = false; endT = 0; sel = null; placeKind = null; powerMode = null;
  clearFloats();
  R.setLevel(G);
  try { await withTimeout(R.warmup(G), 8000, 'warmup'); } catch (e) { console.warn('warmup', e); }
  screen = 'battle'; ui.innerHTML = '';
  buildHUD();
  tutStep = i === 0 && !S.tut.done && !DBG.auto ? 1 : 0;
  tutCheck();
  const notes = i < 0 ? [] : unlockNotes(i).concat(L.twists.map(k => 'Twist: ' + TWISTS[k].name));
  banner(i < 0 ? `∞ Endless · ${WORLDS[L.world].name}` : `${lname(i)} ${L.name || ''}`);
  notes.forEach((n, k) => setTimeout(() => G && G === Gref && banner(n), 1700 * (k + 1)));
  const Gref = G;
  } catch (e) {
    console.error('startLevel', e);
    try { localStorage.setItem('ap2-lasterr', JSON.stringify({ t: Date.now(), lvl: i, msg: String(e && e.message || e), stack: String(e && e.stack || '').slice(0, 600) })); } catch (_) { }
    // never leave a half-built level behind: back to a clean map so the player can retry
    endBattleScene(); try { R.showMenu(); } catch (_) { }
    screen = 'map'; clearUI(); try { showMap(Math.floor(i / 5)); } catch (_) { }
    hint('Could not start this level — try again', 2500);
  }
  finally { starting = false; }
}
function banner(text) { const b = h(`<div class="banner">${text}</div>`); $('#hud').appendChild(b); setTimeout(() => b.remove(), 1650); }
function buildHUD() {
  const L = G.L;
  const hud = h(`<div id="hud">
    <div class="hud-top">
      <div class="hpill"><span class="ico exit" id="hexit">✕</span></div>
      <div class="hpill"><span class="ico gold">$</span><span id="hgold">0</span></div>
      <div class="hpill"><span class="ico core">◆</span><span id="hcore">0</span></div>
      <div class="hpill lifebox"><span style="color:#ff6a6a">♥</span><span id="hlife">20</span><div class="lifebar" id="hlb"><i></i></div></div>
      <div class="hpill wavetxt" id="hwave">Wave 0/0</div>
    </div>
    <div class="twistbar" id="htw">${twistChips(L.twists)}</div>
    <div class="tray l" id="tray"></div>
    <div class="tray r" id="ptray"></div>
    <div class="hud-bl"><div class="hb" id="hpause">${svgPause}</div><div class="hb ${speed > 1 ? 'on' : ''}" id="hff">${svgFF}</div></div>
    <div class="nextwave" id="hnext"></div>
    <div class="ctx" id="ctx"></div>
  </div>`);
  ui.appendChild(hud);
  const towers = TOWER_ORDER.filter(k => L.towers.includes(k));
  const avail = window.innerHeight - 48 - 130;
  const size = Math.max(36, Math.min(50, Math.floor(avail / towers.length) - 8));
  const tray = $('#tray');
  for (const k of towers) {
    const el = h(`<div class="tcard" data-k="${k}" style="width:${size}px;height:${size}px;background-image:url(${ticon(k)})"><div class="cost"><span class="ico gold" style="width:10px;height:10px;font-size:0"></span>${buildCost(k, G.meta)}${TOWERS[k].core ? '+◆' : ''}</div></div>`);
    el.onclick = () => { initAudio(); if (placeKind === k) { setPlace(null); return; } click(); closeMenus(); setPlace(k); };
    tray.appendChild(el);
  }
  const ptray = $('#ptray');
  for (const k of POWER_ORDER.filter(k => L.powers.includes(k))) {
    const el = h(`<div class="tcard" data-k="${k}" style="background-image:url(${PICONS[k]})"><div class="ring"></div><div class="ch">0</div></div>`);
    el.onclick = () => onPower(k);
    ptray.appendChild(el);
  }
  $('#hexit').onclick = () => { click(); openPause(); };
  $('#hpause').onclick = () => { click(); openPause(); };
  $('#hff').onclick = (e) => { click(); speed = speed > 1 ? 1 : 2; e.currentTarget.classList.toggle('on', speed > 1); };
  $('#hnext').onclick = () => { if (!G || ended) return; initAudio(); if (G.wave >= G.nWaves) return; closeMenus(); const b = G.startWave(); tutCheck(); if (b) banner(`+${b} early bonus`); };
  hudRefs = { gold: $('#hgold'), core: $('#hcore'), life: $('#hlife'), lb: $('#hlb'), wave: $('#hwave'), next: $('#hnext'), tray: [...tray.children], ptray: [...ptray.children] };
  lastHud = {};
}
function setPlace(k) {
  placeKind = k; powerMode = null;
  hudRefs.tray.forEach(el => el.classList.toggle('sel', el.dataset.k === k));
  hudRefs.ptray.forEach(el => el.classList.remove('sel'));
  R.showPathHL(false);
  if (!k) { R.showValid(null); return; }
  const cells = []; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (G.canBuild(k, x, y)) cells.push([x, y]);
  R.showValid(cells, TOWERS[k].water ? 0x60c0ff : TOWERS[k].deposit ? 0xffe060 : 0x80ff80);
  if (!cells.length) hint(TOWERS[k].water ? 'No free water here' : TOWERS[k].deposit ? 'No free deposits' : 'No free tiles', 1500);
}
function onPower(k) {
  if (!G || ended) return; initAudio();
  const p = G.powers[k];
  if (G.status !== 'play') { hint('Start the first wave to use powers', 1500); sfx.deny && sfx.deny(); return; }
  if (p.charges <= 0 || p.cd > 0) { sfx.deny && sfx.deny(); return; }
  closeMenus(); setPlace(null);
  if (POWERS[k].target === 'none') { if (G.usePower(k, 0, 0)) sfx.freeze && sfx.freeze(); return; }
  if (powerMode === k) { powerMode = null; R.showPathHL(false); hudRefs.ptray.forEach(el => el.classList.remove('sel')); return; }
  powerMode = k; click();
  hudRefs.ptray.forEach(el => el.classList.toggle('sel', el.dataset.k === k));
  R.showPathHL(POWERS[k].target === 'path');
  hint(POWERS[k].target === 'path' ? 'Tap the road to place ' + POWERS[k].name : 'Tap anywhere to call the ' + POWERS[k].name, 2000);
}
let hintEl = null, hintTimer = 0;
function hint(text, ms = 0) {
  if (!$('#hud')) return;
  if (!text) { if (hintEl) { hintEl.remove(); hintEl = null; } return; }
  if (hintEl && hintEl.textContent === text) { hintTimer = ms; return; }
  if (hintEl) hintEl.remove();
  hintEl = h(`<div class="hint">${text}</div>`); $('#hud').appendChild(hintEl); hintTimer = ms;
}
function closeMenus() {
  const c = $('#ctx'); if (c) c.innerHTML = '';
  const bb = $('.branchbox'); if (bb) bb.remove();
  ctxUI = null; sel = null; if (R.inBattle && R.rangeRing) { R.showRange(null); R.showCell(null); }
}
function clampXY(x, y) { return [Math.max(40, Math.min(window.innerWidth - 40, x)), Math.max(86, Math.min(window.innerHeight - 56, y))]; }
// Context buttons: an unclipped wrapper so the coin+cost badge can sit on the button (clip-path on .cbtn used to hide the price).
let ctxUI = null;
function goldBadge(v) { return `<div class="cprice"><span class="ico gold">$</span><b>${v}</b></div>`; }
function cbtn(cls, html, x, y, fn, price) {
  const [cx, cy] = clampXY(x, y);
  const w = h(`<div class="cwrap" style="left:${cx}px;top:${cy}px"><div class="cbtn ${cls}">${html}</div>${price == null || price === '' ? '' : goldBadge(price)}</div>`);
  w.onpointerdown = e => e.stopPropagation();
  w.onclick = e => { e.stopPropagation(); fn(); };
  $('#ctx').appendChild(w); return w;
}
function refreshCtx() {
  if (!G || !ctxUI) return;
  if (ctxUI.kind === 'tower') {
    const c = upgradeCost(ctxUI.t.kind, ctxUI.t.lvl, ctxUI.t.branch);
    if (c != null) ctxUI.up.classList.toggle('dim', G.gold < c);
  } else if (ctxUI.kind === 'build') {
    for (const it of ctxUI.items) it.el.classList.toggle('dim', G.gold < it.cost || G.cores < it.core);
  } else if (ctxUI.kind === 'branch') {
    for (const it of ctxUI.items) { const ok = G.gold >= it.cost; it.el.classList.toggle('ok', ok); it.el.classList.toggle('poor', !ok); }
  }
}
function openBuildMenu(cx, cy) {
  closeMenus();
  const v = G.cell(cx, cy);
  const kinds = TOWER_ORDER.filter(k => G.L.towers.includes(k) && G.canBuild(k, cx, cy));
  if (!kinds.length) { if (G.tw.scarce && G.capped('gun') && v === C.FREE) hint('Scarce Ground: 10-tower limit reached. Sell one to build.', 1800); return; }
  R.showCell(cx, cy);
  const [sx, sy] = R.cellScreen(cx, cy);
  const n = kinds.length, perRow = Math.min(n, 4), rows = Math.ceil(n / perRow);
  const above = sy > 220;
  const items = [];
  kinds.forEach((k, i) => {
    const row = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, n - row * perRow);
    const x = sx + (col - (inRow - 1) / 2) * 76;
    const y = above ? sy - 76 - (rows - 1 - row) * 80 : sy + 76 + row * 80;
    const cost = buildCost(k, G.meta);
    const b = cbtn('tw', '', x, y, () => {
      if (!G.build(k, cx, cy)) { sfx.deny && sfx.deny(); hint(G.cores < (TOWERS[k].core || 0) ? 'Needs a Core (◆) — blast crosshair rocks or beat bosses' : 'Not enough gold', 1400); return; }
      sfx.build && sfx.build(); closeMenus(); tutCheck();
    }, cost + (TOWERS[k].core ? '+◆' : ''));
    b.querySelector('.cbtn').style.backgroundImage = `url(${ticon(k)})`;
    items.push({ el: b, cost, core: TOWERS[k].core || 0 });
  });
  ctxUI = { kind: 'build', items }; refreshCtx();
}
function selectTower(t) {
  closeMenus(); sel = t;
  const s = G.eff(t);
  R.showRange(t.x, t.z, s.range || 0.01); R.showCell(t.cx, t.cy, 0x80ff60);
  const [sx, sy] = R.toScreen(t.x, 0.4, t.z);
  const c = upgradeCost(t.kind, t.lvl, t.branch);
  const max = c == null;
  const up = cbtn('up' + (max ? ' max' : ''), max ? 'MAX' : '▲', sx, sy - 72, () => {
    if (max) return;
    if (t.lvl === 2 && TOWERS[t.kind].branches) { openBranch(t); return; }
    if (!G.upgrade(t)) { sfx.deny && sfx.deny(); hint('Not enough gold', 1200); return; }
    sfx.upgrade && sfx.upgrade(); S.tut.up = 1; tutCheck(); selectTower(t);
  }, max ? null : c);
  cbtn('info', 'i', sx - 70, sy + 8, () => { click(); openTowerInfo(t); });
  cbtn('sell', '<span class="clabel">SELL</span>', sx + 70, sy + 8, () => { G.sell(t); sfx.sell && sfx.sell(); closeMenus(); }, '+' + Math.floor(t.spent * 0.5));
  ctxUI = { kind: 'tower', t, up }; refreshCtx();
}
function openBranch(t) {
  const T = TOWERS[t.kind];
  $('#ctx').innerHTML = '';
  const bb = h(`<div class="branchbox panel"><h4>Choose a specialization</h4>${T.branches.map((b, i) => `<div class="bropt" data-b="${i}"><div><b>${b.name}</b><small>${b.desc}</small></div><div class="c"><span class="ico gold">$</span><b>${b.levels[0].cost}</b></div></div>`).join('')}<button class="btn" id="bcancel">Cancel</button></div>`);
  $('#hud').appendChild(bb);
  bb.querySelectorAll('.bropt').forEach(o => o.onclick = () => { if (!G.upgrade(t, +o.dataset.b)) { sfx.deny && sfx.deny(); hint('Not enough gold', 1200); return; } sfx.upgrade && sfx.upgrade(); bb.remove(); selectTower(t); });
  $('#bcancel').onclick = () => { bb.remove(); selectTower(t); };
  ctxUI = { kind: 'branch', items: [...bb.querySelectorAll('.bropt')].map(o => ({ el: o, cost: T.branches[+o.dataset.b].levels[0].cost })) };
  refreshCtx();
}
function statRows(s, kind) {
  const r = [];
  if (s.dmg) r.push(['Damage', Math.round(s.dmg) + (s.multi ? ' × ' + s.multi : '')]);
  if (s.dps) r.push(['Damage / sec', Math.round(s.dps)]);
  if (s.rate) r.push(['Shots / sec', s.rate.toFixed(2)]);
  if (s.range) r.push(['Range', s.range.toFixed(1)]);
  if (s.splash) r.push(['Splash', s.splash.toFixed(1)]);
  if (s.slow) r.push(['Slow', Math.round(s.slow * 100) + '%']);
  if (s.chain) r.push(['Chain targets', s.chain]);
  if (s.pierce) r.push(['Armor pierce', Math.round(s.pierce * 100) + '%']);
  if (s.boost) r.push(['Damage boost', '+' + Math.round(s.boost * 100) + '%']);
  if (s.rateB) r.push(['Fire-rate boost', '+' + Math.round(s.rateB * 100) + '%']);
  if (s.rangeB) r.push(['Range boost', '+' + Math.round(s.rangeB * 100) + '%']);
  if (s.coin) r.push(['Coin value', s.coin]); if (s.every) r.push(['Coin every', s.every + 's']);
  if (s.soul) r.push(['Soul gold / kill', '+' + s.soul]);
  return r;
}
function openTowerInfo(t) {
  paused = true;
  const T = TOWERS[t.kind]; const s = G.eff(t);
  const bname = t.branch >= 0 ? T.branches[t.branch].name : '';
  const vs = T.strong ? `<p style="font-size:13px">Strong vs <b style="color:var(--lime)">${RACES[T.strong].name}</b>, weak vs <b style="color:#ff8a6a">${RACES[T.weak].name}</b>.</p>` : '';
  const m = h(`<div class="modal"><div class="panel infopanel"><div class="hdr"><img src="${ticon(t.kind)}"><div><b style="font-size:18px">${T.name}</b><br><small>Level ${t.lvl + 1}${bname ? ' · ' + bname : ''} · ${t.kills} kills</small></div></div>
    <small>${T.desc}</small>${vs}<table>${statRows(s, t.kind).map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>
    ${s.boosted ? '<small style="color:var(--lime)">Boosted by an Amplifier</small><br>' : ''}<div style="text-align:center;margin-top:10px"><button class="btn green" id="iok">OK</button></div></div></div>`);
  ui.appendChild(m);
  $('#iok').onclick = () => { click(); m.remove(); paused = false; };
}
function openPause() {
  if (!G || ended || $('.modal')) return;
  paused = true; closeMenus();
  const m = h(`<div class="modal"><div class="panel"><h2>Paused</h2><div style="margin-bottom:14px;opacity:.8">${curIdx < 0 ? 'Endless' : lname(curIdx)} · Wave ${G.wave}${G.L.endless ? '' : '/' + G.nWaves}${S.easy ? ' · Easy' : ''}</div><div class="col">
    <button class="btn green" id="presume">Resume</button><button class="btn" id="prestart">Restart</button><button class="btn" id="pmusic">Music: ${S.music ? 'On' : 'Off'}</button><button class="btn" id="pgfx">Graphics: ${gfxName()}</button><button class="btn red" id="pmap">Quit to map</button></div></div></div>`);
  ui.appendChild(m);
  $('#presume').onclick = () => { click(); m.remove(); paused = false; };
  $('#prestart').onclick = () => { click(); m.remove(); startLevel(curIdx); };
  $('#pmusic').onclick = e => { S.music = !S.music; setMusic(S.music); save(); e.target.textContent = 'Music: ' + (S.music ? 'On' : 'Off'); };
  $('#pgfx').onclick = e => { const o = ['auto', 'ultra', 'high', 'med', 'low']; S.quality = o[(o.indexOf(S.quality) + 1) % o.length]; try { localStorage.removeItem(GFX_KEY); } catch (_) { } save(); setQ(); click(); e.target.textContent = 'Graphics: ' + gfxName(); };
  $('#pmap').onclick = () => { click(); m.remove(); if (G && G.L.endless && G.wave > 1) { G.life = 0; G.status = "lost"; ended = true; endT = 0; finishBattle(); return; } showMap(curIdx < 0 ? -1 - curIdx : Math.floor(curIdx / 5)); };
}
const gfxName = () => { const n = { auto: 'Auto', ultra: 'Ultra', high: 'High', med: 'Medium', low: 'Low' }[S.quality] || 'Auto'; return S.quality === 'auto' ? n + ' (' + ['', 'Low', 'Med', 'High', 'Ultra'][R.quality] + ')' : n; };
function finishEndless() {
  const w = -1 - curIdx, reached = Math.max(0, G.wave - 1), key = 'w' + w, prev = S.endless[key] || 0;
  const best = reached > prev; if (best) S.endless[key] = reached;
  const total = Math.floor(reached * 1.2) + (best ? 10 : 0);
  S.emer += total; save(); sfx.win && sfx.win();
  const m = h(`<div class="modal"><div class="panel"><h2 style="color:var(--lime)">∞ Endless over</h2><div class="rew">${WORLDS[w].name}<br>You held out through <b>wave ${reached}</b>${best ? ' · <b style="color:var(--lime)">New best!</b>' : ` · best ${prev}`}<br>Waves → <span class="emer">◆ ${Math.floor(reached * 1.2)}</span>${best ? '<br>New record → <span class="emer">◆ 10</span>' : ''}<br><b>Total <span class="emer">◆ ${total}</span></b></div>
    <div class="col"><button class="btn green" id="rre">Again</button><button class="btn gold" id="rupg">Upgrades</button><button class="btn" id="rmap">Map</button></div></div></div>`);
  ui.appendChild(m);
  $('#rre').onclick = () => { click(); startLevel(curIdx); };
  $('#rupg').onclick = () => { click(); showUpg(); };
  $('#rmap').onclick = () => { click(); showMap(w); };
}
function finishBattle() {
  if (G.L.endless) return finishEndless();
  const won = G.status === 'won';
  const i = curIdx; const stars = won ? Math.max(1, G.starRating() || 1) : 0;
  let html;
  if (won) {
    const prev = S.stars[i]; const newStars = Math.max(0, stars - prev); const first = prev === 0;
    const goldE = Math.floor(G.gold / 8), starE = newStars * 15, firstE = first ? 10 : 0, replayE = first ? 0 : 3;
    const total = goldE + starE + firstE + replayE;
    S.stars[i] = Math.max(prev, stars); S.emer += total; S.hist = []; save();
    sfx.win && sfx.win();
    html = `<h2 style="color:var(--lime)">You win!</h2><div class="stars3">${[0, 1, 2].map(k => `<span class="${k < stars ? 'on' : ''}" style="animation-delay:${0.2 + k * 0.25}s">★</span>`).join('')}</div>
      <div class="rew">Leftover gold ${G.gold} → <span class="emer">◆ ${goldE}</span><br>${starE ? `New stars → <span class="emer">◆ ${starE}</span><br>` : ''}${firstE ? `First clear → <span class="emer">◆ ${firstE}</span><br>` : ''}${replayE ? `Replay bonus → <span class="emer">◆ ${replayE}</span><br>` : ''}<b>Total <span class="emer">◆ ${total}</span></b></div>
      <div class="col">${i < NL - 1 ? '<button class="btn green" id="rnext">Next level</button>' : ''}<button class="btn" id="rre">Restart</button><button class="btn gold" id="rupg">Upgrades</button><button class="btn" id="rmap">Map</button></div>`;
  } else {
    sfx.lose && sfx.lose(); S.emer += 5; save();
    html = `<h2 style="color:var(--red)">Defeat</h2><div class="rew">The temple has fallen on wave ${G.wave}/${G.nWaves}.<br>Salvage → <span class="emer">◆ 5</span><br><small>Tip: try different towers, build factories early, or spend emeralds on upgrades.${S.easy ? '' : ' Easy mode is in Settings.'}</small></div>
      <div class="col"><button class="btn green" id="rre">Retry</button><button class="btn gold" id="rupg">Upgrades</button><button class="btn" id="rmap">Map</button></div>`;
  }
  const m = h(`<div class="modal"><div class="panel">${html}</div></div>`); ui.appendChild(m);
  const toMap = () => { const w = Math.floor(Math.min(NL - 1, i + (won ? 1 : 0)) / 5); showMap(w); };
  const nb = $('#rnext');
  if (nb) nb.onclick = () => { click(); const n = i + 1, w = Math.floor(n / 5); if (n % 5 === 0 && !S.seen['w' + w] && !DBG.nostory) { m.remove(); endBattleScene(); clearUI(); R.showMenu(); screen = 'map'; showStory(STORY[w], () => { S.seen['w' + w] = 1; save(); startLevel(n); }); } else startLevel(n); };
  $('#rre').onclick = () => { click(); startLevel(i); };
  $('#rupg').onclick = () => { click(); showUpg(); };
  $('#rmap').onclick = () => { click(); toMap(); };
  if (won && i === NL - 1 && !S.seen.end && !DBG.nostory) { S.seen.end = 1; save(); showStory(ENDING, () => { }); }
}

// ---------------- tutorial ----------------
function tutCheck() {
  if (!G || !tutStep) return;
  const nonF = G.towers.filter(t => t.kind !== 'factory').length;
  const fac = G.towers.some(t => t.kind === 'factory');
  if (tutStep === 1 && fac) tutStep = 2;
  if (tutStep === 2 && nonF >= 1) tutStep = 3;
  if (tutStep === 3 && G.status === 'play') tutStep = 4;
  if (tutStep === 4 && G.stats.coinsTapped >= 1) tutStep = 5;
  if (tutStep === 5 && S.tut.up) { tutStep = 0; S.tut.done = 1; save(); hint(null); return; }
  const msgs = { 1: 'Tap a glowing deposit to build an Ore Factory', 2: 'Tap a grass tile beside the road to build a Machine Gun', 3: 'Press the wave button (bottom right) to start!', 4: G.coins.length ? 'Tap the gold coin from your factory!' : 'Factories make coins — keep an eye out', 5: 'Tap a tower to upgrade it' };
  hint(msgs[tutStep]);
}

// ---------------- input ----------------
let down = null;
// drag pans the camera (portrait board is taller than the screen); a drag never builds
const pointers = new Map();
let pinch = null;
let lastTap = { t: 0, x: 0, y: 0, empty: false };
canvas.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
  if (pointers.size >= 2 && screen === 'battle' && R.inBattle) {
    down = null;
    const pts = [...pointers.values()];
    const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
    pinch = { dist: Math.hypot(dx, dy) || 1, zoom: R.zoom || 1, midX: (pts[0].x + pts[1].x) / 2, midY: (pts[0].y + pts[1].y) / 2 };
    closeMenus(); return;
  }
  if (pinch) return;
  down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), drag: false };
});
canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size >= 2 && screen === 'battle' && R.inBattle) {
    const pts = [...pointers.values()].slice(0, 2);
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
    R.panBy(midX - pinch.midX, midY - pinch.midY);
    R.zoomTo(pinch.zoom * (dist / pinch.dist), midX, midY);
    pinch.midX = midX; pinch.midY = midY;
    return;
  }
  if (!down || screen !== 'battle' || !R.inBattle) return;
  if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down.drag = true; closeMenus(); }
  if (down.drag) { R.panBy(e.clientX - down.lx, e.clientY - down.ly); down.lx = e.clientX; down.ly = e.clientY; }
});
const endPtr = e => { pointers.delete(e.pointerId); };
canvas.addEventListener('pointercancel', e => { endPtr(e); if (pointers.size < 2) pinch = null; down = null; });
canvas.addEventListener('wheel', e => {
  if (screen !== 'battle' || !R.inBattle) return;
  e.preventDefault(); closeMenus();
  R.zoomTo((R.zoom || 1) * Math.exp(-e.deltaY * 0.0016), e.clientX, e.clientY);
}, { passive: false });
canvas.addEventListener('pointerup', e => {
  endPtr(e);
  if (pinch) { if (pointers.size < 2) pinch = null; down = null; return; }
  if (!down) return; const wasDrag = down.drag; const d = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
  if (wasDrag || d > 10 || screen !== 'battle' || !G || ended || paused) return;
  initAudio();
  tap(e.clientX, e.clientY);
});
function tap(sx, sy) {
  if (powerMode) {
    const p = R.pick(sx, sy); const k = powerMode;
    if (p && G.usePower(k, p.x, p.z)) { (k === 'strike' ? sfx.strike : sfx.build) && (k === 'strike' ? sfx.strike() : sfx.build()); }
    else { sfx.deny && sfx.deny(); hint('Tap on the road', 1200); return; }
    powerMode = null; R.showPathHL(false); hudRefs.ptray.forEach(el => el.classList.remove('sel')); return;
  }
  // coins first (generous radius)
  let best = null, bd = 44;
  for (const c of G.coins) { const [x, y] = R.toScreen(c.x, 0.7, c.z); const dd = Math.hypot(x - sx, y - sy); if (dd < bd) { bd = dd; best = c; } }
  if (best) { G.tapCoin(best.id); sfx.coin && sfx.coin(); tutCheck(); return; }
  for (const o of G.objects) { const [x, y] = R.toScreen(o.x, 0.4, o.z); if (Math.hypot(x - sx, y - sy) < 36) { if (G.tapObject(o.id)) sfx.laser && sfx.laser(); closeMenus(); return; } }
  const p = R.pick(sx, sy);
  window.__ap2 && (window.__ap2.lastPick = p);
  const now = performance.now();
  const emptyish = p && !p.tower && !placeKind && !powerMode;
  if (emptyish && lastTap.empty && lastTap.cx === p.cx && lastTap.cy === p.cy && now - lastTap.t < 320 && Math.hypot(sx - lastTap.x, sy - lastTap.y) < 18) {
    const occ = G.towerAt.get(p.cy * GW + p.cx);
    if (!occ) { closeMenus(); setPlace(null); R.toggleZoom(sx, sy); lastTap = { t: 0, x: 0, y: 0, empty: false }; return; }
  }
  if (!p || (!p.inGrid && !p.tower)) { closeMenus(); setPlace(null); return; }
  const hitT = !placeKind && p.tower ? G.towers.find(o => o.id === p.tower) : null;
  const t = hitT || G.towerAt.get(p.cy * GW + p.cx);
  if (hitT && !p.inGrid) { if (sel === t) closeMenus(); else { click(); selectTower(t); } return; }
  if (placeKind) {
    if (G.canBuild(placeKind, p.cx, p.cy)) {
      const k = placeKind;
      if (G.build(k, p.cx, p.cy)) { sfx.build && sfx.build(); tutCheck(); if (G.gold < buildCost(k, G.meta)) setPlace(null); else setPlace(k); }
      else { sfx.deny && sfx.deny(); hint(G.cores < (TOWERS[k].core || 0) ? 'Needs a Core (◆)' : 'Not enough gold', 1200); }
      return;
    }
    setPlace(null);
  }
  lastTap = { t: now, x: sx, y: sy, cx: p.cx, cy: p.cy, empty: !t && !placeKind };
  if (t) { if (sel === t) closeMenus(); else { click(); selectTower(t); } return; }
  if (sel) { closeMenus(); return; }
  openBuildMenu(p.cx, p.cy);
}

// ---------------- HUD update ----------------
function updHUD() {
  if (!G || !hudRefs.gold) return;
  const set = (k, v, fn) => { if (lastHud[k] !== v) { lastHud[k] = v; fn(v); } };
  set('gold', Math.floor(G.gold), v => { hudRefs.gold.textContent = v; refreshCtx(); });
  set('core', G.cores, v => { hudRefs.core.textContent = v; refreshCtx(); });
  set('life', Math.ceil(G.life), v => { hudRefs.life.textContent = v; hudRefs.lb.firstElementChild.style.width = (100 * G.life / G.maxLife) + '%'; hudRefs.lb.classList.toggle('low', G.life / G.maxLife < 0.4); });
  set('wave', G.L.endless ? '' + G.wave : G.wave + '/' + G.nWaves, v => hudRefs.wave.textContent = 'Wave ' + v);
  // tray affordability
  for (const el of hudRefs.tray) { const k = el.dataset.k; el.classList.toggle('poor', G.gold < buildCost(k, G.meta) || G.cores < (TOWERS[k].core || 0)); }
  for (const el of hudRefs.ptray) {
    const p = G.powers[el.dataset.k];
    const pct = p.cd > 0 ? Math.round(p.cd / p.cdMax * 100) : (p.charges <= 0 ? 100 : 0);
    el.querySelector('.ring').style.setProperty('--p', pct + '%');
    el.querySelector('.ch').textContent = p.charges;
    el.classList.toggle('poor', p.charges <= 0);
  }
  // next wave preview
  const key = G.wave + ':' + G.status + ':' + Math.ceil(G.nextIn);
  set('next', key, () => {
    if (G.wave >= G.nWaves) { hudRefs.next.innerHTML = `<span style="opacity:.8">Final wave</span>`; hudRefs.next.classList.remove('hb'); return; }
    const pv = G.nextWavePreview();
    const label = G.status === 'build' ? `<span>START<br><span class="tm">Wave 1</span></span>` : `<span>NEXT<br><span class="tm">${Math.ceil(G.nextIn)}s · +${Math.round(G.nextIn * 1.5 + 5)}</span></span>`;
    hudRefs.next.innerHTML = label + pv.slice(0, 4).map(q => `<div class="ni" style="background-image:url(${eicon(q.type, q.race)})"><span>${q.n}</span></div>`).join('') + `<div class="hb ${G.status === 'build' ? 'go' : ''}" style="width:38px;height:38px">${svgPlay}</div>`;
  });
}

// ---------------- fx → audio / status ----------------
function handleFx() {
  for (const f of G.fx) {
    switch (f.t) {
      case 'muzzle': sfx.shoot && sfx.shoot(f.k); break;
      case 'boom': sfx.boom && sfx.boom(f.r); break;
      case 'die': sfx.die && sfx.die(f.type); break;
      case 'coinSpawn': sfx.coinSpawn && sfx.coinSpawn(); setTimeout(tutCheck, 50); break;
      case 'leak': sfx.leak && sfx.leak(); break;
      case 'wave': sfx.wave && sfx.wave(); banner(f.v === G.nWaves ? 'Final wave!' : 'Wave ' + f.v); tutCheck(); break;
      case 'chain': sfx.shoot && sfx.shoot('reaper'); break;
      case 'strike': sfx.strike && sfx.strike(); break;
      case 'cleared': sfx.boom && sfx.boom(1); break;
      case 'bossdie': banner('Warlord destroyed!'); break;
      case 'mutation': setTimeout(() => G && banner('Mutation: ' + TWISTS[f.k].name), 1400); { const tb = $('#htw'); if (tb) tb.innerHTML = twistChips(G.L.twists); } break;
      case 'zap': sfx.boom && sfx.boom(0.6); break;
      case 'emp': sfx.boom && sfx.boom(1.2); banner('EMP! Towers stunned'); break;
      case 'crateDrop': sfx.coinSpawn && sfx.coinSpawn(); break;
    }
  }
  if (R.flash) { flash(R.flash.c, R.flash.a); R.flash = null; }
}

// ---------------- main loop ----------------
let last = performance.now();
// ?perf: on-screen fps, worst frame (last 5s), tier / render scale, enemies, build
let perfEl = null, pfLast = 0, pfN = 0, pfT0 = 0, pfWorst = 0, pfWorst5 = [];
if (DBG.perf) { perfEl = document.createElement('div'); perfEl.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:99999;font:11px/1.3 monospace;color:#9f9;background:rgba(0,0,0,.65);padding:3px 6px;border-radius:4px;pointer-events:none;white-space:pre'; document.body.appendChild(perfEl); }
function perfTick(now) {
  if (pfLast) { const d = now - pfLast; pfWorst = Math.max(pfWorst, d); } pfLast = now; pfN++;
  if (!pfT0) pfT0 = now;
  if (now - pfT0 >= 1000) {
    pfWorst5.push(pfWorst); if (pfWorst5.length > 5) pfWorst5.shift();
    const fps = pfN * 1000 / (now - pfT0), dpr = R.renderer.getPixelRatio();
    perfEl.textContent = `${fps.toFixed(0)} fps  worst ${pfWorst.toFixed(0)}ms (5s ${Math.max(...pfWorst5).toFixed(0)}ms)\n${['', 'Low', 'Med', 'High', 'Ultra'][R.quality]} dpr ${dpr.toFixed(2)}${R.autoQ ? ' auto' : ''}${capMs ? ' cap60' : ''}  en ${G ? G.enemies.length : 0}  ${BUILD}`;
    pfN = 0; pfT0 = now; pfWorst = 0;
  }
}
let loopErrs = 0, hzN = 0, hzPrev = 0, hzMin = 1e9, capMs = 0, lastTick = 0;
function loop(now) {
  requestAnimationFrame(loop);               // queued first: an exception below can never kill the loop again
  // 90/120Hz screens: draw at ~60fps (half the GPU work and heat, still smooth). Detected from the real rAF interval.
  if (hzN < 90) { if (hzPrev) { hzMin = Math.min(hzMin, now - hzPrev); } hzPrev = now; if (++hzN === 90 && hzMin < 9.5) capMs = 15.5; }
  if (capMs && now - lastTick < capMs) return;
  if (perfEl) perfTick(now);
  lastTick = now;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try { tick(dt); } catch (e) {
    if (loopErrs++ < 5) console.error('frame error', e);
    try { localStorage.setItem('ap2-lasterr', JSON.stringify({ t: Date.now(), where: 'loop', msg: String(e && e.message || e), stack: String(e && e.stack || '').slice(0, 600) })); } catch (_) { }
  }
}
function tick(dt) {
  if (screen === 'battle' && G) {
    if (!paused && !ended) {
      let sim = dt * speed;
      while (sim > 1e-6) { const s = Math.min(sim, 1 / 30); if (AI) AI.tick(s); G.update(s); sim -= s; }
    }
    handleFx();
    R.frame(paused ? 0 : dt * speed, G, UI, sel);
    G.fx.length = 0;
    if (sel && !G.towers.includes(sel)) closeMenus();
    updHUD();
    if (hintTimer > 0) { hintTimer -= dt * 1000; if (hintTimer <= 0) { hint(null); tutCheck(); } }
    if (!ended && (G.status === 'won' || G.status === 'lost')) { ended = true; endT = 1.3; closeMenus(); setPlace(null); hint(null); }
    if (ended && endT > 0) { endT -= dt; if (endT <= 0) finishBattle(); }
  } else R.frame(dt, null, null);
  stepFloats(dt);
}
const doResize = () => { R.resize(); };
window.addEventListener('resize', doResize);
window.addEventListener('orientationchange', () => setTimeout(doResize, 120));
if (window.visualViewport) { visualViewport.addEventListener('resize', doResize); visualViewport.addEventListener('scroll', doResize); }
if (window.ResizeObserver) new ResizeObserver(doResize).observe(canvas);
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'battle' && G && !ended) openPause(); });

// ---------------- boot ----------------
window.__ap2 = {
  get game() { return G; }, get screen() { return screen; }, R, S, startLevel, selectTower, showMap, showUpg, showTitle, showInfo, showSettings,
  setSpeed(v) { speed = v; }, pause(v) { paused = v; }, tap, save,
};
const ld = $('#loading'); ld.style.opacity = 0; setTimeout(() => ld.remove(), 500);
const lv = Q.get('level');
if (lv) { let i; if (lv.includes('-')) { const [a, b] = lv.split('-').map(Number); i = (a - 1) * 5 + (b - 1); } else i = (+lv) - 1; startLevel(Math.max(0, Math.min(NL - 1, i | 0))); }
else if (Q.get('endless')) startLevel(-1 - Math.max(0, Math.min(7, (+Q.get('endless') || 1) - 1)));
else if (Q.get('screen')) go(Q.get('screen'));
else showTitle();
requestAnimationFrame(loop);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js?v=7').catch(() => { });
