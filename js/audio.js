// Procedural WebAudio SFX + calm generative music
let ctx = null, master, sfxBus, musicBus, noiseBuf, musicOn = true, sfxOn = true, started = false;
const last = {};
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.55 : 0; sfxBus.connect(comp);
  musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.32 : 0; musicBus.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startMusic();
}
export function setSfx(on) { sfxOn = on; if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05); }
export function setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.3); }
function limit(k, ms) { const n = performance.now(); if (last[k] && n - last[k] < ms) return false; last[k] = n; return true; }
function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function tone(type, f0, f1, dur, vol, dest = sfxBus, delay = 0) {
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, 0.005, vol, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, ftype, f0, f1, q = 1, delay = 0) {
  const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = ftype; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
  env(g, t, 0.003, vol, dur); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
export const sfx = {
  shoot(k) {
    if (!ctx || !sfxOn) return;
    switch (k) {
      case 'gun': if (limit('gun', 70)) noise(0.06, 0.18, 'highpass', 2500, 1200, 0.7); break;
      case 'energy': if (limit('en', 120)) tone('sine', 700, 180, 0.25, 0.18); break;
      case 'missile': if (limit('mi', 120)) noise(0.35, 0.16, 'bandpass', 600, 2400, 1.2); break;
      case 'naval': if (limit('nv', 150)) { noise(0.4, 0.35, 'lowpass', 900, 120, 0.8); tone('sine', 90, 40, 0.3, 0.3); } break;
      case 'destroyer': if (limit('de', 150)) { tone('sawtooth', 220, 60, 0.25, 0.14); noise(0.2, 0.2, 'lowpass', 2000, 300); } break;
      case 'reaper': if (limit('re', 90)) { noise(0.15, 0.16, 'highpass', 4000, 6000, 2); tone('square', 1200, 300, 0.12, 0.05); } break;
    }
  },
  boom(big) { if (!ctx || !limit('boom', big ? 60 : 90)) return; noise(big ? 0.7 : 0.35, big ? 0.5 : 0.25, 'lowpass', big ? 1200 : 1800, 80, 0.7); if (big) tone('sine', 70, 30, 0.6, 0.4); },
  die(race) { if (!ctx || !limit('die', 50)) return; if (race === 'glim') tone('triangle', 1400, 500, 0.15, 0.08); else noise(0.15, 0.12, 'bandpass', 900, 300, 1.5); },
  coin() { if (!ctx) return; tone('sine', 1320, 0, 0.09, 0.2); tone('sine', 1760, 0, 0.18, 0.2, sfxBus, 0.07); },
  coinSpawn() { if (!ctx || !limit('cs', 200)) return; tone('triangle', 880, 1320, 0.15, 0.08); },
  build() { if (!ctx) return; noise(0.15, 0.3, 'lowpass', 600, 100); tone('square', 160, 80, 0.12, 0.08); },
  upgrade() { if (!ctx) return; [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, 0, 0.18, 0.12, sfxBus, i * 0.06)); },
  sell() { if (!ctx) return; tone('triangle', 900, 300, 0.2, 0.12); },
  click() { if (!ctx || !limit('click', 40)) return; tone('square', 1500, 900, 0.04, 0.05); },
  deny() { if (!ctx) return; tone('square', 180, 140, 0.15, 0.1); },
  leak() { if (!ctx || !limit('leak', 150)) return; tone('sawtooth', 120, 60, 0.4, 0.2); },
  wave() { if (!ctx) return; tone('sawtooth', 220, 0, 0.5, 0.08); tone('sawtooth', 330, 0, 0.6, 0.06, sfxBus, 0.12); },
  laser() { if (!ctx) return; tone('sawtooth', 1800, 200, 0.6, 0.1); noise(0.6, 0.12, 'bandpass', 3000, 800, 3); },
  freeze() { if (!ctx) return; for (let i = 0; i < 6; i++) tone('sine', 2000 + i * 300, 0, 0.4, 0.05, sfxBus, i * 0.04); },
  strike() { if (!ctx) return; tone('sawtooth', 80, 1600, 1.1, 0.08); },
  win() { if (!ctx) return; [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone('triangle', f, 0, 0.35, 0.16, sfxBus, i * 0.13)); },
  lose() { if (!ctx) return; [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, 0, 0.5, 0.16, sfxBus, i * 0.22)); },
};
// ---- music: slow pad chords + sparse pentatonic plucks through a delay ----
function startMusic() {
  if (started) return; started = true;
  const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.62;
  const fb = ctx.createGain(); fb.gain.value = 0.38; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
  delay.connect(dl); dl.connect(fb); fb.connect(delay); delay.connect(musicBus);
  const chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 67]]; // Am7 Fmaj7 C G
  const penta = [69, 72, 74, 76, 79, 81, 84];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  let bar = 0;
  const playBar = () => {
    if (!ctx) return;
    const t = ctx.currentTime + 0.05, ch = chords[bar % 4], len = 6.4;
    for (const n of ch) for (const det of [-6, 6]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = mtof(n - 12); o.detune.value = det;
      f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.5;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.022, t + 2.2); g.gain.linearRampToValueAtTime(0.0001, t + len + 0.6);
      o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + len + 0.8);
    }
    for (let i = 0; i < 6; i++) {
      if (Math.random() < 0.45) continue;
      const tt = t + i * (len / 6) + Math.random() * 0.15, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = mtof(penta[Math.floor(Math.random() * penta.length)]);
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.05, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.4);
      o.connect(g); g.connect(musicBus); g.connect(delay); o.start(tt); o.stop(tt + 1.5);
    }
    bar++;
    setTimeout(playBar, len * 1000);
  };
  playBar();
}
