// Ayla & Kameel's Super Obstacle Course
// A canvas platformer. No libraries, no build step.
'use strict';

const T = 32, H = 17, VH = 544, GT = 14;
let VW = 960;        // view width in game units; changes with the screen shape
let SIM = false;     // true while the debug bot simulates ahead (silences audio)
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

// ---------------------------------------------------------------- characters
const CHARS = {
  ayla: {
    name: 'Ayla', speed: 4.1, jump: 11.8, tag: 'Super Jumper!', color: '#ff6fa8', skin: '#c9946e',
    shirt: '#ff5fa2', shirtDark: '#d94484', overalls: '#8a4fd8', overallsDark: '#6d38b5',
    boots: '#ffc93c', bootsDark: '#e0a820', emblem: 'star', hair: '#3a2418', hairShine: 'rgba(255,220,180,.35)'
  },
  kameel: {
    name: 'Kameel', speed: 4.9, jump: 11.0, tag: 'Super Speedy!', color: '#4fb3ff', skin: '#bd8762',
    shirt: '#35c46a', shirtDark: '#249a4e', overalls: '#2f6fe0', overallsDark: '#2255b5',
    boots: '#ff8a2a', bootsDark: '#d96c12', emblem: 'bolt', hair: '#1c1512', hairShine: 'rgba(255,255,255,.28)'
  }
};

// ---------------------------------------------------------------- audio
// A small synth: every sound is made from oscillators and noise, mixed through
// an echo, a generated reverb and a compressor.
const AU = { ctx: null, master: null, sfx: null, mus: null, echo: null, rev: null, noiseBuf: null, p25: null,
  muted: false, music: null, playing: null, step: 0, next: 0, timer: null };
try { AU.muted = localStorage.getItem('ak_muted') === '1'; } catch (e) {}
function initAudio() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended' && !document.hidden) AU.ctx.resume(); return; }
  try {
    const c = AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2; comp.connect(c.destination);
    AU.master = c.createGain(); AU.master.gain.value = AU.muted ? 0 : 0.85; AU.master.connect(comp);
    AU.sfx = c.createGain(); AU.sfx.gain.value = 0.85; AU.sfx.connect(AU.master);
    const tone0 = c.createBiquadFilter(); tone0.type = 'lowpass'; tone0.frequency.value = 9500; tone0.connect(AU.master); // takes the harsh edge off
    AU.mus = c.createGain(); AU.mus.gain.value = 0.62; AU.mus.connect(tone0);
    // echo for the lead melody
    AU.echo = c.createDelay(1); AU.echo.delayTime.value = 0.27;
    const fb = c.createGain(); fb.gain.value = 0.3;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    AU.echo.connect(lp); lp.connect(fb); fb.connect(AU.echo); lp.connect(AU.mus);
    // noise for drums and effects
    const n = c.sampleRate, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    AU.noiseBuf = b;
    // reverb: a generated impulse response (decaying stereo noise) gives the music some room
    const len = Math.floor(c.sampleRate * 1.7), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const x = ir.getChannelData(ch); for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    AU.rev = c.createConvolver(); AU.rev.buffer = ir;
    const rg = c.createGain(); rg.gain.value = 0.55; AU.rev.connect(rg); rg.connect(AU.mus);
    // 25% pulse wave: the classic bright chiptune lead
    const N = 32, re = new Float32Array(N), im = new Float32Array(N);
    for (let k = 1; k < N; k++) re[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * 0.25);
    AU.p25 = c.createPeriodicWave(re, im);
  } catch (e) { AU.ctx = null; }
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
// one-shot sound effect voice
function tone(freq, dur, type = 'square', vol = 0.12, slide = null, when = 0) {
  if (!AU.ctx || SIM) return;
  const t0 = when || AU.ctx.currentTime;
  const o = AU.ctx.createOscillator(), g = AU.ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(g); g.connect(AU.sfx);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur, vol = 0.15, hp = 0, when = 0, dest = null, type = 'highpass') {
  if (!AU.ctx || SIM) return;
  const t0 = when || AU.ctx.currentTime;
  const s = AU.ctx.createBufferSource(), g = AU.ctx.createGain();
  s.buffer = AU.noiseBuf; s.loop = true;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  if (hp) { const f = AU.ctx.createBiquadFilter(); f.type = type; f.frequency.value = hp; s.connect(f); f.connect(g); } else s.connect(g);
  g.connect(dest || AU.sfx); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
  return g;
}
// A musical note. o = { wave, f, t, dur, vol, detune, pan, cut, vib, att, sus, rel, rev, echo }
function voice(o) {
  const c = AU.ctx, osc = c.createOscillator(), g = c.createGain(), t = o.t;
  if (o.wave === 'p25') osc.setPeriodicWave(AU.p25); else osc.type = o.wave;
  osc.frequency.value = o.f; if (o.detune) osc.detune.value = o.detune;
  if (o.vib && o.dur > 0.22) { // gentle vibrato that fades in on longer notes
    const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.6;
    lg.gain.setValueAtTime(0, t + 0.12); lg.gain.linearRampToValueAtTime(o.f * 0.011, t + 0.32);
    l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + o.dur + 0.3);
  }
  const att = o.att || 0.008;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.vol, t + att);
  g.gain.setTargetAtTime(o.vol * (o.sus === undefined ? 0.6 : o.sus), t + att, 0.09);
  g.gain.setTargetAtTime(0.0001, t + o.dur, o.rel || 0.03);
  let node = g; osc.connect(g);
  if (o.cut) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.cut; f.Q.value = 0.8; node.connect(f); node = f; }
  if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = o.pan; node.connect(p); node = p; }
  node.connect(AU.mus);
  if (o.rev) { const s = c.createGain(); s.gain.value = o.rev; node.connect(s); s.connect(AU.rev); }
  if (o.echo) { const s = c.createGain(); s.gain.value = o.echo; node.connect(s); s.connect(AU.echo); }
  osc.start(t); osc.stop(t + o.dur + (o.rel || 0.03) * 6 + 0.05);
}
function kick(t, v = 1) {
  const c = AU.ctx, o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
  g.gain.setValueAtTime(0.55 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g); g.connect(AU.mus); o.start(t); o.stop(t + 0.22);
  noise(0.012, 0.1 * v, 3000, t, AU.mus); // click
}
function snare(t, v = 1) {
  const g = noise(0.16, 0.2 * v, 1800, t, AU.mus, 'bandpass');
  if (g) { const s = AU.ctx.createGain(); s.gain.value = 0.35; g.connect(s); s.connect(AU.rev); }
  noise(0.09, 0.08 * v, 5000, t, AU.mus);
  const c = AU.ctx, o = c.createOscillator(), og = c.createGain(); o.type = 'triangle';
  o.frequency.setValueAtTime(230, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.07);
  og.gain.setValueAtTime(0.16 * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.09); o.connect(og); og.connect(AU.mus); o.start(t); o.stop(t + 0.1);
}
function hat(t, v = 1, open = false) { noise(open ? 0.16 : 0.035, 0.05 * v, 7500, t, AU.mus); }
function crash(t) { const g = noise(0.9, 0.09, 5200, t, AU.mus); if (g) { const s = AU.ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(AU.rev); } }

const seq = (arr, base, gap = 0.08, dur = 0.13, type = 'square', vol = 0.09) => { if (!AU.ctx) return; const t = AU.ctx.currentTime; arr.forEach((m, i) => tone(mtof(m + base), dur, type, vol, null, t + i * gap)); };
const SFX = {
  jump: () => tone(380, 0.16, 'square', 0.07, 760),
  dbl: () => tone(600, 0.12, 'triangle', 0.12, 1200),
  coin: () => { tone(988, 0.07, 'square', 0.06); tone(1319, 0.22, 'square', 0.06, null, AU.ctx ? AU.ctx.currentTime + 0.07 : 0); },
  stomp: (combo = 0) => { tone(240 * Math.pow(1.19, combo), 0.14, 'square', 0.13, 90 * Math.pow(1.19, combo)); noise(0.06, 0.1, 800); },
  bump: () => tone(140, 0.08, 'square', 0.12, 90),
  brk: () => noise(0.18, 0.2),
  spring: () => tone(180, 0.35, 'triangle', 0.18, 900),
  hurt: () => tone(420, 0.35, 'sawtooth', 0.12, 110),
  die: () => seq([72, 67, 64, 60, 55], 0, 0.13, 0.18, 'square', 0.1),
  power: () => seq([60, 64, 67, 72, 76, 79, 84], 0, 0.06, 0.1, 'square', 0.08),
  check: () => seq([72, 76, 79], 0, 0.09, 0.15, 'triangle', 0.15),
  win: () => seq([67, 72, 76, 79, 84, 79, 84, 88], 0, 0.12, 0.22, 'square', 0.09),
  shoot: () => noise(0.12, 0.12),
  oneup: () => seq([76, 79, 88, 84, 86, 91], 0, 0.09, 0.12, 'square', 0.08),
  select: () => tone(660, 0.08, 'square', 0.08, 990),
  swim: () => { tone(300, 0.12, 'sine', 0.1, 520); noise(0.08, 0.03, 1500); },
  swap: () => { tone(500, 0.1, 'triangle', 0.12, 1000); tone(750, 0.12, 'triangle', 0.1, 1500, AU.ctx ? AU.ctx.currentTime + 0.07 : 0); },
  bigstar: () => seq([72, 76, 79, 84, 88, 91, 96], 0, 0.07, 0.25, 'triangle', 0.13),
  bosshit: () => { tone(160, 0.3, 'sawtooth', 0.16, 50); noise(0.2, 0.2); },
  roar: () => { tone(110, 0.6, 'sawtooth', 0.16, 55); },
};

// ---- songs: each bar is 8 eighth-notes ('.' = rest, '-' = hold) over a chord
const SONG_DEFS = {
  title: { tempo: 126, bass: 'bounce', arp: 'arp8', drums: 'pop',
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C,D', 'G'],
    mel: ['D5 . G5 B5 D6 . B5 .', 'E6 . D6 B5 G5 . E5 .', 'E5 . G5 C6 E6 . C6 .', 'D6 - . F#5 A5 . D6 .',
          'D5 . G5 B5 D6 . B5 .', 'E6 . G6 E6 D6 . B5 .', 'C6 E6 G6 . F#6 D6 A5 .', 'G5 - . B5 G6 - - .'] },
  meadow: { tempo: 138, bass: 'bounce', arp: 'stab', drums: 'pop',
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F,G', 'C', 'F', 'C', 'Dm', 'G', 'F', 'Em', 'Dm,G', 'C'],
    mel: ['E5 . G5 . C6 . G5 E5', 'A5 - . G5 E5 . C5 .', 'F5 . A5 . C6 . A5 F5', 'G5 - . B5 D6 - - .',
          'E5 . G5 . C6 . G5 E5', 'A5 . C6 A5 G5 . E5 .', 'F5 A5 C6 . B5 G5 D5 .', 'C5 - . . C6 - . .',
          'A5 A5 . F5 A5 . C6 .', 'G5 G5 . E5 G5 . C6 .', 'F5 F5 . D5 F5 . A5 .', 'G5 . A5 . B5 . D6 .',
          'C6 . A5 . F5 . A5 .', 'B5 . G5 . E5 . G5 .', 'A5 . F5 . B5 . G5 .', 'C6 - . G5 C6 - . .'] },
  ice: { tempo: 112, bass: 'slow', arp: 'arp16', drums: 'soft', wave: 'triangle', echo: 0.7, leadVol: 0.12,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'Am', 'F', 'G', 'Em', 'Am', 'F', 'G', 'E', 'Am'],
    mel: ['E5 - A5 - C6 - B5 A5', 'A5 - F5 - C5 - F5 -', 'G5 - E5 - C5 - E5 G5', 'D5 - G5 - B5 - - .',
          'E5 - A5 - C6 - B5 A5', 'C6 - A5 - F5 - A5 -', 'B5 - G5 - D5 - G5 B5', 'A5 - - - - . . .',
          'A5 . C6 . F6 - E6 C6', 'B5 . D6 . G6 - D6 B5', 'G5 . B5 . E6 - D6 B5', 'C6 - B5 - A5 - - .',
          'F5 A5 C6 A5 F5 A5 C6 -', 'G5 B5 D6 B5 G5 B5 D6 -', 'G#5 B5 E6 - D6 - B5 -', 'A5 - - - E5 - A5 .'] },
  sky: { tempo: 150, bass: 'walk', arp: 'stab', drums: 'bouncy',
    chords: ['F', 'Bb', 'C', 'F', 'F', 'Bb', 'C', 'F', 'Dm', 'Bb', 'Gm', 'C', 'Dm', 'Bb', 'C', 'F'],
    mel: ['C6 A5 F5 A5 C6 . F6 .', 'D6 Bb5 F5 Bb5 D6 . F6 .', 'E6 C6 G5 C6 E6 . G6 .', 'F6 . C6 . A5 . F5 .',
          'A5 C6 F6 . E6 F6 . C6', 'Bb5 D6 F6 . E6 F6 . D6', 'C6 E6 G6 . F6 E6 D6 C6', 'F6 - . . F5 - . .',
          'D6 . D6 C6 A5 . F5 .', 'D6 . D6 C6 Bb5 . F5 .', 'Bb5 . Bb5 A5 G5 . D5 .', 'E5 G5 C6 E6 G6 . E6 .',
          'F6 . E6 D6 . A5 D6 .', 'F6 . E6 D6 . Bb5 D6 .', 'E6 . D6 C6 . G5 C6 E6', 'F6 - . C6 F6 - . .'] },
  castle: { tempo: 148, bass: 'drive', arp: 'arp16', drums: 'heavy', wave: 'sawtooth', leadVol: 0.055,
    chords: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Dm', 'Bb,A', 'Dm', 'Gm', 'Dm', 'Gm', 'A', 'Bb', 'C', 'Dm', 'A'],
    mel: ['D5 . D5 F5 D5 . A5 G#5', 'A5 . F5 . D5 . F5 .', 'Bb4 . Bb4 D5 Bb4 . F5 E5', 'E5 . C#5 . A4 . C#5 E5',
          'D5 . D5 F5 D5 . A5 G#5', 'A5 . D6 . A5 . F5 .', 'Bb5 A5 G5 F5 E5 C#5 E5 A5', 'D5 - . . D5 D5 . .',
          'G5 . Bb5 . D6 . Bb5 G5', 'F5 . A5 . D6 . A5 F5', 'G5 . Bb5 . D6 . G6 .', 'A5 G5 F5 E5 C#5 . A4 .',
          'D5 F5 Bb5 . D5 F5 Bb5 .', 'E5 G5 C6 . E5 G5 C6 .', 'F5 A5 D6 . F5 A5 D6 .', 'E6 . C#6 . A5 . E5 .'] },
  boss: { tempo: 172, bass: 'drive', arp: 'arp16', drums: 'heavy', wave: 'sawtooth', leadVol: 0.055,
    chords: ['Em', 'Em', 'C', 'B', 'Em', 'G', 'C', 'B'],
    mel: ['E5 . E5 G5 E5 . B5 .', 'E5 . E5 G5 E5 . D5 .', 'C5 . C5 E5 C5 . G5 .', 'B4 D#5 F#5 B5 F#5 D#5 B4 .',
          'E5 G5 B5 E6 B5 G5 E5 .', 'D5 G5 B5 D6 B5 G5 D5 .', 'C5 E5 G5 C6 E6 . C6 .', 'B5 . F#5 . D#5 . B4 .'] },
  star: { tempo: 184, bass: 'drive', arp: 'arp16', drums: 'bouncy',
    chords: ['C', 'C', 'Bb', 'Bb'],
    mel: ['C6 C6 . C6 . G5 C6 .', 'E6 E6 . E6 . C6 E6 .', 'D6 D6 . D6 . Bb5 D6 .', 'F6 F6 . F6 . D6 F6 .'] },
  win: { tempo: 150, bass: 'bounce', arp: 'arp16', drums: 'pop',
    chords: ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'C'],
    mel: ['C5 E5 G5 C6 G5 E5 C5 E5', 'F5 A5 C6 F6 C6 A5 F5 A5', 'G5 B5 D6 G6 D6 B5 G5 B5', 'C6 . C6 . C6 - - .',
          'E6 . C6 A5 E6 . C6 A5', 'F6 . C6 A5 F6 . C6 A5', 'G6 . D6 B5 G6 . B5 D6', 'C6 - . G5 C6 - - .'] },
  woods: { tempo: 118, bass: 'walk', arp: 'arp8', drums: 'soft', wave: 'triangle', echo: 0.5, leadVol: 0.12, swing: 0.14,
    chords: ['Em', 'C', 'Am', 'B', 'Em', 'G', 'Am,B', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'D', 'B', 'B'],
    mel: ['E5 . G5 . B5 - A5 G5', 'E5 . G5 . C6 - B5 A5', 'A5 . C6 . E6 - D6 C6', 'B5 - F#5 - D#5 - B4 .',
          'E5 . G5 . B5 - A5 G5', 'D6 - B5 - G5 - B5 D6', 'C6 - A5 - B5 - D#6 -', 'E6 - - - E5 - . .',
          'G5 E5 C5 E5 G5 - C6 -', 'A5 F#5 D5 F#5 A5 - D6 -', 'B5 G5 E5 G5 B5 - E6 -', 'D6 - B5 - G5 - E5 .',
          'C6 - G5 - E5 - G5 -', 'D6 - A5 - F#5 - A5 -', 'D#6 - B5 - F#5 - B5 -', 'B5 A5 G5 F#5 D#5 - B4 .'] },
  reef: { tempo: 104, bass: 'slow', arp: 'arp16', drums: 'soft', wave: 'triangle', echo: 0.75, leadVol: 0.12,
    chords: ['D', 'Bm', 'G', 'A', 'D', 'F#m', 'G,A', 'D', 'G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'D'],
    mel: ['F#5 - A5 - D6 - A5 -', 'F#5 - B5 - D6 - B5 -', 'G5 - B5 - D6 - B5 G5', 'A5 - C#6 - E6 - - .',
          'F#5 - A5 - D6 - F#6 -', 'E6 - C#6 - A5 - C#6 -', 'D6 B5 G5 B5 E6 C#6 A5 C#6', 'D6 - - - A5 - D6 .',
          'B5 - D6 - G6 - F#6 D6', 'A5 - C#6 - E6 - D6 C#6', 'A5 - C#6 - F#6 - E6 C#6', 'D6 - B5 - F#5 - B5 -',
          'G5 B5 D6 B5 G5 B5 D6 -', 'A5 C#6 E6 C#6 A5 C#6 E6 -', 'F#6 - E6 D6 - A5 D6 -', 'D6 - - - - . . .'] },
  desert: { tempo: 132, bass: 'bounce', arp: 'stab', drums: 'bouncy', swing: 0.1,
    chords: ['Am', 'Am', 'Dm', 'E', 'Am', 'F', 'E', 'Am', 'Dm', 'Am', 'E', 'Am', 'Dm', 'Am', 'F,E', 'Am'],
    mel: ['A5 . A5 B5 C6 . B5 A5', 'G#5 . A5 . E5 - - .', 'D6 . D6 E6 F6 . E6 D6', 'E6 . D6 C6 B5 . G#5 .',
          'A5 . A5 B5 C6 . E6 .', 'F6 . E6 . C6 . A5 .', 'G#5 B5 D6 . C6 B5 G#5 .', 'A5 - - . A5 A5 . .',
          'F5 A5 D6 . F5 A5 D6 .', 'E5 A5 C6 . E5 A5 C6 .', 'E5 G#5 B5 . D6 . B5 G#5', 'A5 . C6 . E6 - - .',
          'F6 . E6 D6 . A5 D6 .', 'E6 . D6 C6 . A5 C6 .', 'C6 A5 F5 A5 B5 G#5 E5 G#5', 'A5 - - . E5 . A5 .'] },
};
// the other bosses get the boss theme in a different key and speed
SONG_DEFS.boss2 = { ...SONG_DEFS.boss, tempo: 160, transpose: -2 };
SONG_DEFS.boss3 = { ...SONG_DEFS.boss, tempo: 166, transpose: 3, wave: 'p25', leadVol: 0.065 };
SONG_DEFS.boss4 = { ...SONG_DEFS.boss, tempo: 178, transpose: 5 };
Object.assign(SONG_DEFS.meadow, { swing: 0.1 }); Object.assign(SONG_DEFS.sky, { swing: 0.12 }); Object.assign(SONG_DEFS.title, { swing: 0.08 });

const BASS = { bounce: [0, null, 12, null, 0, null, 7, null], drive: [0, 0, 12, 0, 0, 0, 12, 0], walk: [0, null, 7, null, 12, null, 7, null], slow: [0, null, null, null, 7, null, null, null] };
// kick / snare / hat per 16th note. X = accent, o = open hat
const DRUMS = {
  pop: ['X.......x.x.....', '....X.......X...', 'x.x.X.x.x.x.X.o.'],
  soft: ['X.........x.....', '........x.......', '..x...x...x...o.'],
  bouncy: ['X.....x.x.....x.', '....X.......X..x', 'x.xxX.xxx.xxX.ox'],
  heavy: ['X.x...x.X.x...x.', '....X.......X...', 'x.x.X.x.x.x.X.x.'],
};
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function nm(s) { const m = /^([A-G])([#b]?)(\d)$/.exec(s); return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); }
function chord(s, tr) { const m = /^([A-G])([#b]?)(m?)$/.exec(s); const root = (NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + tr + 24) % 12; return { root, tri: [0, m[3] ? 3 : 4, 7, 12] }; }
function compileSong(def) {
  const n = def.mel.length * 16, tr = def.transpose || 0;
  const s = { tempo: def.tempo, n, lead: new Array(n).fill(null), harm: new Array(n).fill(null), bass: new Array(n).fill(null), arp: new Array(n).fill(null), pad: new Array(n).fill(null),
    drums: DRUMS[def.drums], wave: def.wave || 'p25', echo: def.echo || 0.22, leadVol: def.leadVol || 0.065, swing: def.swing || 0 };
  const chordAt = [];
  def.chords.forEach((cs, b) => {
    const cp = cs.split(',');
    for (let i = 0; i < 8; i++) {
      const ch = chord(cp[Math.floor(i * cp.length / 8)], tr), st = b * 16 + i * 2;
      chordAt[st] = chordAt[st + 1] = ch;
      const root = ch.root > 7 ? ch.root - 12 : ch.root;
      const bo = BASS[def.bass][i];
      if (bo !== null) s.bass[st] = { m: 36 + root + bo, len: def.bass === 'slow' ? 7 : 1.7 };
      if (def.arp === 'arp16') { for (let k = 0; k < 2; k++) s.arp[st + k] = { m: [60 + root + ch.tri[[0, 1, 2, 1, 3, 2, 1, 2][(i * 2 + k) % 8]]] }; }
      else if (def.arp === 'arp8') s.arp[st] = { m: [60 + root + ch.tri[[0, 1, 2, 3, 2, 1, 2, 1][i]]] };
      else if (i % 2 === 1) s.arp[st] = { m: [60 + root + ch.tri[0], 60 + root + ch.tri[1], 60 + root + ch.tri[2]] };
      if (i % (8 / cp.length) === 0) s.pad[st] = { m: [48 + root + ch.tri[0], 48 + root + ch.tri[2], 60 + root + ch.tri[1]], len: 16 / cp.length };
    }
  });
  let last = null;
  def.mel.forEach((bar, b) => bar.trim().split(/\s+/).forEach((tok, i) => {
    const st = b * 16 + i * 2;
    if (tok === '-') { if (last) last.len += 2; } else if (tok === '.') last = null; else {
      last = { m: nm(tok) + tr, len: 2 }; s.lead[st] = last;
      // harmony: the nearest chord note a third or more below the tune
      const ch = chordAt[st]; let hm = null;
      for (let d = 3; d <= 9; d++) if (ch.tri.includes(((last.m - d - ch.root) % 12 + 12) % 12)) { hm = last.m - d; break; }
      if (hm !== null) s.harm[st] = { m: hm, of: last };
    }
  }));
  return s;
}
const SONGS = {}; for (const k in SONG_DEFS) SONGS[k] = compileSong(SONG_DEFS[k]);

function playSong(name) {
  AU.music = name;
  if (!AU.timer) AU.timer = setInterval(musicTick, 25);
}
function stopSong() { AU.music = null; }
function musicTick() {
  if (!AU.ctx || AU.ctx.state !== 'running') return;
  const starry = game.state === 'play' && game.players.some(p => p.star > 0 && !p.dead);
  const want = AU.music && game.state !== 'paused' ? (starry ? 'star' : AU.music) : null;
  if (want !== AU.playing) { AU.playing = want; AU.step = 0; AU.next = AU.ctx.currentTime + 0.06; }
  if (!want) return;
  const hurry = game.state === 'play' && game.timeLeft < 30 * 60 && want !== 'star';
  const s = SONGS[want], sd = 60 / (s.tempo * (hurry ? 1.22 : 1)) / 4, c = AU.ctx;
  if (AU.next < c.currentTime) AU.next = c.currentTime + 0.03;
  while (AU.next < c.currentTime + 0.14) {
    const i = AU.step % s.n, b = i % 16, pass = Math.floor(AU.step / s.n), bar = Math.floor(i / 16);
    const t = AU.next + (b % 2 ? s.swing * sd : 0);
    const second = pass % 2 === 1;              // every other time through, the arrangement fills out
    const L = s.lead[i];
    if (L) {
      const d = L.len * sd * 0.92, f = mtof(L.m), soft = s.wave === 'triangle';
      voice({ wave: s.wave, f, t, dur: d, vol: s.leadVol, vib: true, cut: soft ? 0 : 3400, echo: s.echo, rev: 0.25 });
      voice({ wave: s.wave, f, t, dur: d, vol: s.leadVol * 0.45, detune: 9, pan: 0.25, cut: soft ? 0 : 3000 });
      if (second) voice({ wave: 'triangle', f: f * 2, t, dur: d * 0.6, vol: s.leadVol * 0.3, pan: -0.25, rev: 0.3 }); // sparkle an octave up
    }
    const Hm = s.harm[i];
    if (Hm && (second || bar >= s.n / 32)) voice({ wave: s.wave === 'sawtooth' ? 'sawtooth' : 'triangle', f: mtof(Hm.m), t, dur: Hm.of.len * sd * 0.9, vol: s.leadVol * 0.55, pan: -0.3, cut: 2400, rev: 0.25 });
    const P = s.pad[i];
    if (P) for (let k = 0; k < P.m.length; k++) voice({ wave: 'sawtooth', f: mtof(P.m[k]), t, dur: P.len * sd * 0.98, vol: 0.022, att: 0.12, sus: 0.9, rel: 0.12, cut: 900, pan: (k - 1) * 0.4, rev: 0.5 });
    const B = s.bass[i];
    if (B) { voice({ wave: 'triangle', f: mtof(B.m), t, dur: B.len * sd, vol: 0.2, sus: 0.75 }); voice({ wave: 'sawtooth', f: mtof(B.m), t, dur: B.len * sd * 0.6, vol: 0.05, cut: 500, sus: 0.3 }); }
    const A = s.arp[i];
    if (A) for (const m of A.m) voice({ wave: 'square', f: mtof(m + (second && A.m.length === 1 ? 12 : 0)), t, dur: sd * (A.m.length > 1 ? 1.1 : 0.8), vol: A.m.length > 1 ? 0.016 : 0.018, cut: 2600, pan: (i % 4 < 2 ? -0.4 : 0.4), rev: 0.2 });
    // drums, with a snare fill at the end of every fourth bar and a crash on each section
    const fill = bar % 4 === 3 && b >= 12, kc = s.drums[0][b], sc = s.drums[1][b], hc = s.drums[2][b];
    if (kc !== '.') kick(t, kc === 'X' ? 1 : 0.8);
    if (fill) snare(t, 0.55 + (b - 12) * 0.15); else if (sc !== '.') snare(t, sc === 'X' ? 1 : 0.7);
    if (hc !== '.') hat(t, hc === 'X' ? 1.3 : 0.8, hc === 'o');
    if (i % 128 === 0 && (pass > 0 || i > 0)) crash(t);
    AU.next += sd; AU.step++;
  }
}
function setMuted(m) {
  AU.muted = m;
  if (AU.master) AU.master.gain.value = m ? 0 : 0.85;
  document.getElementById('mute').textContent = m ? '🔇' : '🔊';
  try { localStorage.setItem('ak_muted', m ? '1' : '0'); } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (game.state === 'play') game.state = 'paused'; if (AU.ctx) AU.ctx.suspend(); }
  else if (AU.ctx) AU.ctx.resume();
});

// ---------------------------------------------------------------- themes
const THEMES = {
  meadow: { song: 'meadow', brick: '#d0703a', tip: 'Stomp the Grumbles and find 3 big stars!' },
  ice: { song: 'ice', brick: '#8fc6ea', tip: 'Ice is slippery! Watch out for falling icicles!' },
  sky: { song: 'sky', brick: '#ff9c6b', tip: 'A storm is chasing you! Keep moving and beat the clock!' },
  woods: { song: 'woods', brick: '#7a5a8c', tip: 'Ghosts are shy: look right at them and they freeze!' },
  reef: { song: 'reef', brick: '#f08a6c', tip: 'Tap jump again and again to swim! Keep away from jellyfish.' },
  desert: { song: 'desert', brick: '#d99a4e', tip: 'Jump the rolling boulders and mind the prickly cactus!' },
  castle: { song: 'castle', brick: '#7f5a5a', tip: 'Dodge the fire and beat King Grumble!' },
};
// Every boss guards a gate at the end of its world and takes three stomps.
const BOSS = {
  bat: { name: 'COUNT FLAPULA', w: 70, h: 46, song: 'boss2' },
  crab: { name: 'CAPTAIN PINCH', w: 76, h: 50, song: 'boss3' },
  scarab: { name: 'SIR ROLLSALOT', w: 66, h: 54, song: 'boss4' },
  grumble: { name: 'KING GRUMBLE', w: 64, h: 60, song: 'boss' },
};

// ---------------------------------------------------------------- level builder
function builder(w, theme, name) {
  const g = []; for (let y = 0; y < H; y++) g.push(new Array(w).fill('.'));
  const lv = { w, theme, name, g, ents: [], start: { x: 2, y: GT - 1 } };
  const b = {
    lv,
    t(x, y, c) { if (x >= 0 && x < w && y >= 0 && y < H) g[y][x] = c; return b; },
    fill(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) b.t(x, y, c); return b; },
    ground(x0, x1, top = GT) { return b.fill(x0, top, x1, H - 1, '#'); },
    ice(x0, x1, top = GT) { b.fill(x0, top, x1, H - 1, '#'); return b.fill(x0, top, x1, top, 'I'); },
    row(x0, x1, y, c) { return b.fill(x0, y, x1, y, c); },
    coins(x0, x1, y) { return b.row(x0, x1, y, 'C'); },
    col(x, y0, y1, c = 'C') { return b.fill(x, y0, x, y1, c); },
    lava(x0, x1) { return b.fill(x0, 15, x1, 16, 'L'); },
    // a wall from ceiling to floor with a gap between rows g0 and g1 (used underwater)
    wall(x, g0, g1) { b.fill(x, 2, x + 1, g0 - 1, '#'); return b.fill(x, g1 + 1, x + 1, GT - 1, '#'); },
    // the boss arena: a gate at `door`, the boss inside, the goal beyond
    arena(kind, aL, door) { b.fill(door, 2, door, GT - 1, 'D'); b.e('boss', door - 9, 12, { kind, aL, aR: door, door }); return b.e('goal', door + 9, 13); },
    stairs(x, n, dir = 1, top = GT) {
      for (let i = 0; i < n; i++) { const hgt = dir > 0 ? i + 1 : n - i; b.fill(x + i, top - hgt, x + i, top - 1, '#'); }
      return b;
    },
    e(k, x, y, o = {}) { lv.ents.push(Object.assign({ k, x, y }, o)); return b; },
  };
  return b;
}

function buildLevels() {
  const L = [];
  // ---------- World 1: Sunny Meadow
  {
    const b = builder(172, 'meadow', 'Sunny Meadow');
    b.ground(0, 30).coins(7, 10, 11)
      .t(12, 10, '?').t(13, 10, 'B').t(14, 10, '!').t(15, 10, 'B').t(16, 10, '?').t(14, 6, '?')
      .e('g', 20, 13).fill(24, 12, 25, 13, '#').coins(24, 25, 10).e('g', 28, 13)
      .ground(34, 62).stairs(38, 4).fill(42, 10, 44, 13, '#').coins(42, 44, 8)
      .e('spring', 48, 13).col(48, 3, 7).e('g', 52, 13).e('g', 55, 13).e('s', 58, 13)
      .e('mplat', 63, 11, { w: 3, range: 2.5 * T }).coins(63, 67, 8)
      .ground(68, 104).e('check', 70, 13)
      .row(74, 80, 11, 'B').t(77, 11, '*').coins(74, 80, 9)
      .e('b', 86, 8).e('g', 88, 13).e('g', 90, 13).e('g', 92, 13)
      .t(97, 13, 'S').t(98, 13, 'S').coins(96, 99, 10)
      .ground(108, 128).row(111, 115, 11, '=').coins(111, 115, 10).t(113, 7, '+')
      .e('s', 118, 13).e('g', 122, 13).e('j', 125, 13)
      .e('big', 17, 6, { i: 0 }).e('big', 50, 2, { i: 1 }).e('big', 132, 8, { i: 2 })
      .e('fall', 130, 12, { w: 2 }).e('fall', 134, 11, { w: 2 }).coins(130, 131, 10).coins(134, 135, 9)
      .ground(137, 171).stairs(141, 8).coins(150, 152, 12)
      .e('goal', 157, 13);
    L.push(b.lv);
  }
  // ---------- World 2: Penguin Peaks
  {
    const b = builder(190, 'ice', 'Penguin Peaks');
    b.ground(0, 25).coins(6, 9, 11).t(10, 10, '?').t(11, 10, '!').t(12, 10, '?')
      .e('p', 20, 13).ice(26, 40).ground(26, 40).fill(26, 14, 40, 14, 'I')
      .row(28, 33, 6, 'I').e('icicle', 29, 7).e('icicle', 32, 7).e('p', 37, 13)
      .ground(44, 70).e('check', 46, 13).fill(50, 12, 52, 13, 'I').coins(50, 52, 10)
      .e('spring', 56, 13).row(55, 63, 5, '=').coins(56, 63, 4).e('p', 61, 13).e('p', 66, 13)
      .e('mplat', 71, 11, { w: 3, range: 2.5 * T })
      .ground(76, 110).fill(80, 14, 100, 14, 'I')
      .row(84, 88, 10, 'B').t(86, 10, '*').t(85, 10, '?').coins(84, 88, 7)
      .e('b', 92, 8).e('p', 96, 13).e('s', 101, 13).e('check', 106, 13)
      .row(112, 113, 11, '=').t(112, 7, 'C').t(113, 7, 'C')
      .ground(116, 150).t(120, 13, 'S').t(121, 13, 'S')
      .row(125, 135, 6, 'I').e('icicle', 127, 7).e('icicle', 130, 7).e('icicle', 133, 7).e('j', 129, 13)
      .e('big', 30, 10, { i: 0 }).e('big', 63, 2, { i: 1 }).e('big', 156, 6, { i: 2 }).coins(126, 134, 11)
      .fill(140, 11, 141, 13, 'I').fill(144, 9, 145, 13, 'I').coins(144, 145, 7)
      .e('fall', 152, 12, { w: 2 }).e('fall', 155, 10, { w: 2 }).t(158, 9, '+')
      .ground(158, 189).stairs(162, 6).e('p', 172, 13)
      .e('goal', 176, 13);
    L.push(b.lv);
  }
  // ---------- World 3: Smiley Skies
  {
    const b = builder(196, 'sky', 'Smiley Skies');
    b.ground(0, 14).coins(5, 9, 11).t(8, 10, '?')
      .row(17, 21, 11, '=').coins(17, 21, 10).row(24, 27, 9, '=').coins(24, 27, 8)
      .e('mplat', 30, 10, { w: 3, range: 4 * T })
      .ground(38, 48, 12).t(42, 8, '?').t(43, 8, '!').t(44, 8, '?').e('g', 46, 11)
      .e('vplat', 51, 11, { w: 3, range: 5 * T })
      .row(55, 60, 6, '=').coins(55, 60, 5).e('b', 58, 3)
      .e('fall', 63, 8, { w: 2 }).e('fall', 67, 9, { w: 2 }).e('fall', 71, 10, { w: 2 })
      .ground(75, 90, 12).e('check', 77, 11).e('s', 84, 11).e('spring', 89, 11).col(89, 1, 4)
      .row(93, 97, 5, '=').coins(93, 97, 4)
      .e('mplat', 100, 9, { w: 3, range: 5 * T }).e('b', 105, 5)
      .ground(110, 125, 11).row(114, 118, 7, 'B').t(116, 7, '*').t(114, 7, '?')
      .e('g', 117, 10).e('j', 120, 10).e('g', 122, 10).e('g', 124, 10)
      .e('big', 26, 5, { i: 0 }).e('big', 60, 3, { i: 1 }).e('big', 136, 3, { i: 2 })
      .row(128, 131, 9, '=').row(134, 137, 7, '=').row(140, 143, 9, '=').coins(128, 131, 8).coins(134, 137, 6).coins(140, 143, 8)
      .e('b', 132, 5).e('b', 139, 4)
      .e('vplat', 146, 11, { w: 3, range: 4 * T }).t(147, 4, '+')
      .ground(151, 195, 12).e('check', 152, 11).e('s', 158, 11)
      .stairs(162, 6, 1, 12).e('goal', 174, 11);
    L.push(b.lv);
  }
  // ---------- World 4: Lava Castle
  {
    const b = builder(204, 'castle', 'Lava Castle');
    b.fill(0, 0, 203, 1, '#').ground(0, 20).coins(4, 7, 11)
      .t(12, 11, 'U').e('firebar', 12, 11, { len: 3, speed: 0.035 })
      .lava(21, 24).ground(26, 45).e('crusher', 30, 2).e('crusher', 36, 2)
      .t(40, 10, '?').t(41, 10, '+').t(44, 13, 'T')
      .lava(46, 50).e('mplat', 46, 11, { w: 2, range: 2.5 * T })
      .ground(51, 80).e('check', 52, 13).t(58, 10, 'U').e('firebar', 58, 10, { len: 4, speed: -0.03 })
      .e('s', 63, 13).e('s', 67, 13).row(70, 74, 10, 'B').t(72, 10, '*').t(76, 13, 'S').t(77, 13, 'S')
      .lava(81, 88).e('fall', 82, 11, { w: 2 }).e('fall', 85, 10, { w: 2 }).coins(82, 83, 9).coins(85, 86, 8)
      .ground(89, 120).t(95, 13, '#').t(95, 12, 'T').e('crusher', 100, 2).e('crusher', 105, 2).e('crusher', 110, 2)
      .e('j', 102, 13).e('g', 108, 13).e('check', 116, 13)
      .lava(121, 127).e('vplat', 122, 12, { w: 2, range: 3 * T }).e('vplat', 125, 9, { w: 2, range: 3 * T, phase: Math.PI })
      .ground(128, 203).t(135, 10, 'U').e('firebar', 135, 10, { len: 5, speed: 0.04 }).coins(132, 138, 7)
      .t(145, 10, 'U').e('firebar', 145, 10, { len: 4, speed: -0.045 }).t(141, 6, '+')
      .t(150, 13, 'S').t(151, 13, 'S').t(155, 13, 'T').e('s', 158, 13)
      .e('big', 22, 10, { i: 0 }).e('big', 73, 7, { i: 1 })
      .e('check', 162, 13).arena('grumble', 165, 186);
    L.push(b.lv);
  }
  // ---------- Spooky Woods
  {
    const b = builder(192, 'woods', 'Spooky Woods');
    b.ground(0, 22).coins(5, 8, 11).t(10, 10, '?').t(11, 10, '!').e('g', 16, 13)
      .ground(26, 48).fill(30, 12, 31, 13, '#').coins(30, 31, 10).e('ghost', 35, 8).row(36, 40, 9, '=').coins(36, 40, 8).e('big', 38, 5, { i: 0 })
      .e('s', 42, 13).t(45, 13, 'S').t(46, 13, 'S')
      .e('fall', 49, 12, { w: 2 }).e('fall', 52, 11, { w: 2 }).coins(49, 50, 10).coins(52, 53, 9)
      .ground(55, 80).e('check', 57, 13).e('b', 62, 8).row(64, 68, 10, 'B').t(66, 10, '*').e('b', 70, 7).e('ghost', 73, 7).e('j', 77, 13)
      .e('mplat', 81, 11, { w: 3, range: 3 * T }).coins(82, 86, 8)
      .ground(87, 112).e('spring', 90, 13).row(92, 99, 5, '=').coins(92, 98, 4).e('big', 99, 2, { i: 1 })
      .e('ghost', 96, 10).e('g', 102, 13).e('g', 105, 13).e('s', 109, 13)
      .e('vplat', 114, 12, { w: 3, range: 4 * T })
      .ground(119, 191).e('check', 121, 13).e('ghost', 127, 6).t(131, 13, 'S').t(132, 13, 'S').e('ghost', 137, 9)
      .row(139, 143, 10, 'B').t(141, 10, '+').e('b', 146, 8)
      .arena('bat', 150, 172);
    L.push(b.lv);
  }
  // ---------- Coral Reef (underwater: swim by tapping jump)
  {
    const b = builder(190, 'reef', 'Coral Reef');
    b.lv.water = true;
    b.fill(0, 0, 189, 1, '#').ground(0, 189).coins(5, 9, 10)
      .wall(14, 8, 11).coins(17, 21, 6).row(17, 21, 13, 'S').e('jelly', 19, 9)
      .wall(26, 3, 6).t(29, 13, 'S').t(31, 13, 'S').e('big', 30, 11, { i: 0 }).e('jelly', 33, 5).e('b', 36, 9)
      .wall(40, 9, 12).t(45, 8, '?').t(46, 8, '+').coins(43, 49, 5)
      .wall(52, 4, 7).e('jelly', 55, 8).wall(58, 9, 12)
      .e('check', 62, 13).coins(64, 78, 8).e('jelly', 66, 4).e('jelly', 66, 11).e('jelly', 70, 7).e('jelly', 74, 4).e('jelly', 74, 11).e('s', 69, 13).e('s', 77, 13)
      .wall(82, 5, 8).e('b', 86, 4).wall(90, 9, 12).e('big', 93, 3, { i: 1 }).e('jelly', 93, 7).wall(96, 3, 6)
      .row(100, 104, 8, 'B').t(102, 8, '*').row(106, 116, 13, 'S').coins(106, 116, 9).e('b', 109, 6).e('b', 113, 11)
      .wall(118, 7, 10).e('check', 122, 13).e('jelly', 126, 6).e('jelly', 126, 11)
      .wall(130, 3, 6).e('jelly', 133, 9).wall(136, 9, 12).e('jelly', 139, 5).wall(142, 5, 8).coins(144, 147, 7)
      .arena('crab', 148, 170);
    L.push(b.lv);
  }
  // ---------- Sandy Ruins
  {
    const b = builder(192, 'desert', 'Sandy Ruins');
    b.ground(0, 24).coins(5, 8, 11).e('cactus', 12, 13).t(15, 10, '?').t(16, 10, '!').t(17, 10, '?').e('cactus', 20, 13).e('big', 20, 9, { i: 0 })
      .ground(28, 62).e('g', 34, 13).e('cactus', 40, 13).coins(39, 41, 9).e('s', 47, 13).fill(59, 11, 62, 13, '#').e('bspawn', 59, 10, { dir: -1 })
      .e('fall', 64, 11, { w: 2 }).e('fall', 67, 10, { w: 2 }).coins(64, 65, 9).coins(67, 68, 8)
      .ground(70, 100).e('check', 72, 13).fill(76, 0, 96, 1, '#').e('crusher', 79, 2).e('crusher', 85, 2).e('crusher', 91, 2).coins(82, 83, 12).coins(88, 89, 12)
      .row(97, 99, 10, 'B').t(98, 10, '*')
      .e('mplat', 101, 11, { w: 3, range: 2.5 * T })
      .ground(106, 142).e('spring', 108, 13).row(110, 116, 5, '=').coins(110, 115, 4).e('big', 116, 2, { i: 1 })
      .e('cactus', 113, 13).e('cactus', 119, 13).e('j', 124, 13).e('s', 130, 13).e('cactus', 134, 13)
      .fill(139, 11, 142, 13, '#').e('bspawn', 139, 10, { dir: -1 }).e('check', 141, 10).t(141, 6, '+')
      .ground(147, 191).e('g', 149, 13)
      .arena('scarab', 151, 173);
    L.push(b.lv);
  }
  return [L[0], L[1], L[2], L[4], L[5], L[6], L[3]]; // Lava Castle is the finale
}
const LEVELS = buildLevels();
// Difficulty sets how long the clock gives you in each world, how much time a checkpoint adds,
// how fast the storm chases, and how much each leftover second is worth.
const DIFFS = [
  { name: 'Easy', color: '#7dff7d', time: [120, 130, 130, 160, 170, 170, 200], check: 20, chase: 1.1, bonus: 10 },
  { name: 'Normal', color: '#ffe14a', time: [80, 90, 90, 110, 120, 120, 150], check: 15, chase: 1.5, bonus: 20 },
  { name: 'Hard', color: '#ff6b6b', time: [55, 60, 65, 80, 85, 85, 110], check: 10, chase: 1.9, bonus: 40 },
];
const diff = () => DIFFS[game.diff];

// ---------------------------------------------------------------- input
const keys = {};
let botInput = null; // debug bot override
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) onPress(e.code);
  keys[e.code] = true; initAudio();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// Touch: round on-screen buttons. Any finger near a button presses it, so thumbs can slide between ◀ and ▶.
const TOUCH = { on: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches), btns: [], st: {}, sig: '' };
const touchLayer = document.getElementById('touch');
function layoutTouch() {
  const show = TOUCH.on && ['play', 'intro', 'goal', 'paused'].includes(game.state);
  const r = touchLayer.getBoundingClientRect(), cr = cv.getBoundingClientRect();
  const sig = [show, game.mode, Math.round(r.width), Math.round(r.height), Math.round(cr.bottom)].join();
  if (sig === TOUCH.sig) return;
  TOUCH.sig = sig; touchLayer.innerHTML = ''; TOUCH.btns = []; TOUCH.st = {};
  if (!show) return;
  const W = r.width, Hh = r.height, portrait = Hh > W;
  const add = (key, label, cx, cy, rad, cls = '') => {
    const el = document.createElement('div'); el.className = 'tb ' + cls; el.textContent = label;
    el.style.cssText = `left:${cx - rad}px;top:${cy - rad}px;width:${rad * 2}px;height:${rad * 2}px;font-size:${rad * 0.8}px`;
    touchLayer.appendChild(el); TOUCH.btns.push({ key, cx, cy, rad, el });
  };
  if (portrait) {
    // The buttons live in the empty space under the game, centred in it, and are sized to fit
    // that space so nothing overlaps or runs off the bottom of the screen.
    const top = cr.bottom - r.top + 10, space = Math.max(120, Hh - top - 10);
    if (game.mode === 2) { // one row per player
      const k = Math.min(1.1, W / 400, space / 250), rowH = Math.min(space / 2, 130 * k);
      const y0 = top + (space - rowH * 2) / 2;
      [0, 1].forEach(pi => {
        const y = y0 + rowH * (pi + 0.5), cls = pi ? 'p2' : 'p1';
        add('l' + pi, '◀', 56 * k, y, 44 * k, cls); add('r' + pi, '▶', 160 * k, y, 44 * k, cls); add('j' + pi, '▲', W - 68 * k, y, 50 * k, cls);
      });
    } else {
      const k = Math.min(1.15, W / 390, space / 230);
      const jr = 58 * k, sr = 30 * k, gap = 12 * k, block = jr * 2 + gap + sr * 2;   // swap sits above jump
      const y0 = top + (space - block) / 2, jy = y0 + sr * 2 + gap + jr;
      add('l0', '◀', 62 * k, jy, 48 * k); add('r0', '▶', 172 * k, jy, 48 * k);
      add('j0', '▲', W - 74 * k, jy, jr, 'jump');
      add('s0', '⇄', W - 74 * k, y0 + sr, sr, 'swap');
    }
  } else {
    const k = Math.max(0.72, Math.min(1.2, Math.min(W, Hh) / 390)), by = Hh - 66 * k;
    if (game.mode === 2) {
      const q = Math.min(k, W / 620);
      add('l0', '◀', 50 * q, by, 40 * q, 'p1'); add('r0', '▶', 138 * q, by, 40 * q, 'p1'); add('j0', '▲', 232 * q, by - 8 * q, 44 * q, 'p1');
      add('j1', '▲', W - 232 * q, by - 8 * q, 44 * q, 'p2'); add('l1', '◀', W - 138 * q, by, 40 * q, 'p2'); add('r1', '▶', W - 50 * q, by, 40 * q, 'p2');
    } else {
      add('l0', '◀', 62 * k, by, 48 * k); add('r0', '▶', 172 * k, by, 48 * k);
      add('j0', '▲', W - 76 * k, by - 4 * k, 58 * k, 'jump');
      add('s0', '⇄', W - 168 * k, by - 74 * k, 30 * k, 'swap'); // up and to the left of jump, clear of it
    }
  }
}
function touchUpdate(e) {
  if (e.target && e.target.closest && e.target.closest('#btns')) return;
  if (!TOUCH.on) { TOUCH.on = true; }
  initAudio();
  const r = touchLayer.getBoundingClientRect(), st = {};
  for (const t of e.touches) {
    const x = t.clientX - r.left, y = t.clientY - r.top;
    let best = null, bd = 1e9;
    for (const b of TOUCH.btns) { const d = Math.hypot(x - b.cx, y - b.cy) / b.rad; if (d < 1.7 && d < bd) { bd = d; best = b; } }
    if (best) st[best.key] = true;
  }
  for (const b of TOUCH.btns) b.el.classList.toggle('down', !!st[b.key]);
  if (st.s0 && !TOUCH.st.s0 && game.state === 'play') swapChar(game.players[0]);
  TOUCH.st = st;
  if (e.type === 'touchstart') { const t = e.changedTouches[0]; onClick(canvasPoint(t)); }
  if (e.cancelable) e.preventDefault();
}
for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) addEventListener(ev, touchUpdate, { passive: false });
addEventListener('gesturestart', e => e.preventDefault());
addEventListener('contextmenu', e => e.preventDefault());

function canvasPoint(p) {
  const r = cv.getBoundingClientRect();
  return { x: (p.clientX - r.left) / r.width * VW, y: (p.clientY - r.top) / r.height * VH };
}
cv.addEventListener('mousedown', e => { initAudio(); onClick(canvasPoint(e)); });
document.getElementById('mute').onclick = () => { initAudio(); setMuted(!AU.muted); };
document.getElementById('pause').onclick = () => togglePause();
const fsBtn = document.getElementById('fs');
const fsEl = document.documentElement;
if (!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen)) fsBtn.style.display = 'none';
fsBtn.onclick = () => {
  if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  const p = (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl);
  if (p && p.then) p.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
};
setMuted(AU.muted);

function readInput(p) {
  const inp = p.input, ts = TOUCH.st;
  let l, r, j;
  if (botInput) { l = botInput.l; r = botInput.r; j = botInput.j; }
  else if (game.mode === 2) {
    if (p.idx === 0) { l = keys.KeyA || ts.l0; r = keys.KeyD || ts.r0; j = keys.KeyW || keys.Space || ts.j0; }
    else { l = keys.ArrowLeft || ts.l1; r = keys.ArrowRight || ts.r1; j = keys.ArrowUp || keys.Enter || ts.j1; }
  } else {
    l = keys.ArrowLeft || keys.KeyA || ts.l0;
    r = keys.ArrowRight || keys.KeyD || ts.r0;
    j = keys.ArrowUp || keys.KeyW || keys.Space || keys.KeyZ || ts.j0;
  }
  inp.jPressed = !!j && !inp.j;
  inp.l = !!l; inp.r = !!r; inp.j = !!j;
}

// ---------------------------------------------------------------- world helpers
const SOLID = new Set(['#', 'B', 'U', '?', '!', '*', '+', 'I', 'T', 'D']);
let lv = null;
function tile(tx, ty) {
  if (tx < 0 || tx >= lv.w) return '#';
  if (ty < 0 || ty >= H) return '.';
  return lv.g[ty][tx];
}
function setTile(tx, ty, c) { if (tx >= 0 && tx < lv.w && ty >= 0 && ty < H) { lv.g[ty][tx] = c; dirtyTile(tx); } }
const solid = c => SOLID.has(c);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function moveBody(b) {
  b.hitWall = 0;
  b.x += b.vx;
  const t0 = Math.floor(b.y / T), t1 = Math.floor((b.y + b.h - 0.01) / T);
  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w - 0.01) / T);
    for (let ty = t0; ty <= t1; ty++) if (solid(tile(tx, ty))) { b.x = tx * T - b.w; b.vx = 0; b.hitWall = 1; break; }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x / T);
    for (let ty = t0; ty <= t1; ty++) if (solid(tile(tx, ty))) { b.x = (tx + 1) * T; b.vx = 0; b.hitWall = -1; break; }
  }
  b.prevBottom = b.y + b.h;
  b.y += b.vy;
  b.onGround = false; b.headTile = null; b.groundTile = null;
  const l0 = Math.floor(b.x / T), l1 = Math.floor((b.x + b.w - 0.01) / T);
  if (b.vy > 0) {
    const ty = Math.floor((b.y + b.h - 0.01) / T);
    for (let tx = l0; tx <= l1; tx++) {
      const c = tile(tx, ty);
      if (solid(c) || (c === '=' && b.prevBottom <= ty * T + 0.5)) {
        b.y = ty * T - b.h; b.vy = 0; b.onGround = true; b.groundTile = c; break;
      }
    }
  } else if (b.vy < 0) {
    const ty = Math.floor(b.y / T);
    let best = null, bd = 1e9; const cx = b.x + b.w / 2;
    for (let tx = l0; tx <= l1; tx++) if (solid(tile(tx, ty))) { const d = Math.abs((tx + 0.5) * T - cx); if (d < bd) { bd = d; best = tx; } }
    if (best !== null) { b.y = (ty + 1) * T; b.vy = 0; b.headTile = { tx: best, ty }; }
  }
}

// ---------------------------------------------------------------- particles & popups
let parts = [], popups = [];
function burst(x, y, color, n = 10, spd = 4, grav = 0.25, size = 4) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * spd;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 30 + Math.random() * 25, color, size, grav });
  }
}
function popup(x, y, text, color = '#fff') { popups.push({ x, y, text, color, life: 50 }); }

// ---------------------------------------------------------------- game state
let game = {
  state: 'title', mode: 1, sel: 0, world: 0, unlocked: 1, score: 0, coins: 0, lives: 5,
  players: [], ents: [], cam: { x: 0 }, t: 0, timer: 0, levelCoins: 0, totalCoins: 0, check: null,
  fireworks: [], best: 0, levelTime: 0, diff: 1, timeLeft: 0, timeMax: 0, timeBonus: 0, chaseX: null, stars: [false, false, false], bestStars: [], boss: null, freeze: 0, look: 0, shake: 0,
};
try { game.unlocked = Math.max(1, Math.min(LEVELS.length, +localStorage.getItem('ak_unlocked') || 1)); game.best = +localStorage.getItem('ak_best') || 0; game.bestStars = JSON.parse(localStorage.getItem('ak_stars') || '[]');
  const d = localStorage.getItem('ak_diff'); if (d !== null && DIFFS[+d]) game.diff = +d;
  if (localStorage.getItem('ak_v') !== '2') { // Lava Castle moved from world 4 to world 7
    if (game.bestStars[3] != null) { game.bestStars[6] = game.bestStars[3]; game.bestStars[3] = 0; }
    game.unlocked = Math.min(game.unlocked, 4);
    localStorage.setItem('ak_v', '2'); localStorage.setItem('ak_stars', JSON.stringify(game.bestStars)); localStorage.setItem('ak_unlocked', game.unlocked);
  } } catch (e) {}
if (DEBUG) game.unlocked = LEVELS.length;

function makePlayer(who, idx) {
  return { who, idx, ch: CHARS[who], x: 0, y: 0, w: 22, h: 50, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, jbuf: 0,
    hearts: 3, inv: 0, wings: false, usedDbl: false, star: 0, dead: false, deadT: 0, gone: false, anim: 0, squash: 0,
    plat: null, finished: false, combo: 0, swapCd: 0, input: { l: false, r: false, j: false, jPressed: false }, groundTile: null, blink: 0 };
}

if (DEBUG) window.startGame = startGame;
function startGame(mode, who) {
  game.mode = mode;
  game.players = mode === 2 ? [makePlayer('ayla', 0), makePlayer('kameel', 1)] : [makePlayer(who, 0)];
  game.score = 0; game.coins = 0; game.lives = 5;
  loadLevel(game.world);
}

function loadLevel(i) {
  game.world = i;
  const src = LEVELS[i];
  lv = { w: src.w, theme: src.theme, name: src.name, g: src.g.map(r => r.slice()), start: src.start, water: !!src.water };
  game.ents = []; parts = []; popups = []; game.fireworks = [];
  game.totalCoins = 0; game.levelCoins = 0; game.levelTime = 0;
  game.timeMax = diff().time[i] * 60; game.timeLeft = game.timeMax; game.timeBonus = 0;
  game.chaseX = src.theme === 'sky' ? -320 : null;
  game.stars = [false, false, false]; game.boss = null; game.freeze = 0; game.look = 0; game.shake = 0;
  bumpAnim.clear(); cannonTimers.clear();
  for (let y = 0; y < H; y++) for (let x = 0; x < lv.w; x++) if (lv.g[y][x] === 'C' || lv.g[y][x] === '?') game.totalCoins++;
  for (const e of src.ents) spawnEnt(e);
  game.check = { x: lv.start.x * T, y: (lv.start.y + 1) * T };
  game.players.forEach((p, k) => {
    Object.assign(p, { x: game.check.x + k * 30, y: game.check.y - p.h, vx: 0, vy: 0, dead: false, gone: false, finished: false,
      hearts: 3, inv: 0, star: 0, wings: false, plat: null, face: 1 });
  });
  game.cam.x = 0;
  game.state = 'intro'; game.timer = 0;
  playSong(THEMES[lv.theme].song);
}

function spawnEnt(e) {
  const x = e.x * T, y = e.y * T;
  const base = { k: e.k, alive: true, vx: 0, vy: 0, t: 0, active: false };
  let o;
  switch (e.k) {
    case 'g': o = { ...base, x: x + 3, y: y + 6, w: 26, h: 26, vx: -1, stomp: true }; break;
    case 'j': o = { ...base, x: x + 3, y: y + 6, w: 26, h: 26, stomp: true, dir: -1, wait: 40 }; break;
    case 'big': o = { ...base, x: x + 1, y: y + 1, w: 30, h: 30, i: e.i, y0: y + 1 }; break;
    case 'boss': { const B = BOSS[e.kind]; o = { ...base, kind: e.kind, x, y: (e.y + 2) * T - B.h, w: B.w, h: B.h, hp: 3, st: 'sleep', wait: 0, inv: 0, hops: 0, dir: -1, guard: false, aL: e.aL * T, aR: e.aR * T, door: e.door }; break; }
    case 'ghost': o = { ...base, x: x + 2, y: y + 2, w: 28, h: 28, stomp: false, shy: false, dir: -1 }; break;
    case 'jelly': o = { ...base, x: x + 4, y, w: 24, h: 26, y0: y, stomp: false }; break;
    case 'cactus': o = { ...base, x: x + 7, y: y - 14, w: 18, h: 46, stomp: false }; break;
    case 'bspawn': o = { ...base, x, y, w: 32, h: 32, timer: 40, dir: e.dir || -1 }; break;
    case 's': o = { ...base, x: x + 3, y: y + 8, w: 26, h: 24, vx: -0.8, stomp: false }; break;
    case 'p': o = { ...base, x: x + 2, y: y + 4, w: 28, h: 28, vx: -1.8, stomp: true }; break;
    case 'b': o = { ...base, x: x + 2, y: y + 4, w: 28, h: 22, x0: x, y0: y, stomp: true, dir: -1 }; break;
    case 'spring': o = { ...base, x: x + 2, y: y + 12, w: 28, h: 20, comp: 0 }; break;
    case 'mplat': o = { ...base, x, y, w: e.w * T, h: 14, x0: x, y0: y, range: e.range, axis: 'x', speed: 0.02, plat: true, phase: e.phase || 0 }; break;
    case 'vplat': o = { ...base, x, y, w: e.w * T, h: 14, x0: x, y0: y, range: e.range, axis: 'y', speed: 0.018, plat: true, phase: e.phase || 0 }; break;
    case 'fall': o = { ...base, x, y, w: e.w * T, h: 14, x0: x, y0: y, plat: true, fall: true, stood: 0, falling: false, respawn: 0 }; break;
    case 'check': o = { ...base, x: x + 8, y: y - 2 * T, w: 16, h: 3 * T, on: false }; break;
    case 'goal': o = { ...base, x: x + 12, y: y - 8 * T, w: 8, h: 9 * T, flagY: 0 }; break;
    case 'firebar': o = { ...base, cx: x + T / 2, cy: y + T / 2, len: e.len, speed: e.speed, ang: 0, x: x - e.len * 16, y: y - e.len * 16, w: e.len * 32 + T, h: e.len * 32 + T }; break;
    case 'crusher': o = { ...base, x: x + 2, y, w: 2 * T - 4, h: 2 * T - 4, y0: y, st: 'idle', wait: 0 }; break;
    case 'icicle': o = { ...base, x: x + 8, y, w: 16, h: 28, st: 'hang', shake: 0 }; break;
    default: return;
  }
  game.ents.push(o);
}
// cannons are tiles; scan on the fly
const cannonTimers = new Map();

function hurt(p) {
  if (p.inv > 0 || p.star > 0 || p.dead || p.finished) return;
  p.hearts--; p.wings = false;
  if (p.hearts <= 0) { die(p); return; }
  p.inv = 100; p.vy = -7; p.vx = -p.face * 3; SFX.hurt(); game.freeze = 5; game.shake = 6;
  burst(p.x + p.w / 2, p.y + 10, '#ff4d6d', 8);
}
function die(p, pit = false) {
  if (p.dead) return;
  p.dead = true; p.deadT = 0; p.gone = pit; p.vy = pit ? 0 : -11; p.vx = 0; p.hearts = 0;
  game.lives--; SFX.die();
}
function respawn(p) {
  const other = game.players.find(q => q !== p && !q.dead && !q.finished);
  if (other) { p.x = other.x; p.y = other.y - 20; }
  else { p.x = game.check.x; p.y = game.check.y - p.h; if (game.chaseX !== null) game.chaseX = Math.max(-320, p.x - VW * 0.8); }
  Object.assign(p, { dead: false, gone: false, vx: 0, vy: 0, hearts: 3, inv: 120, star: 0, wings: false, plat: null });
  burst(p.x + p.w / 2, p.y + p.h / 2, '#fff', 16, 5);
}

function addCoin(x, y) {
  game.coins++; game.levelCoins++; game.score += 100; SFX.coin();
  burst(x, y, '#ffd84a', 6, 3, 0.15, 3);
  if (game.coins % 50 === 0) { game.lives++; SFX.oneup(); popup(x, y - 20, '1-UP!', '#7dff7d'); }
}

function hitBlock(p, tx, ty) {
  const c = tile(tx, ty);
  const cx = tx * T + T / 2, cy = ty * T;
  bumpAnim.set(tx + ',' + ty, 10);
  // knock enemies standing on the block
  for (const e of game.ents) if (e.alive && e.stomp !== undefined && Math.abs(e.x + e.w / 2 - cx) < 26 && Math.abs(e.y + e.h - cy) < 6) defeat(e, p);
  if (c === '?') { setTile(tx, ty, 'U'); addCoin(cx, cy); coinPop(cx, cy); }
  else if (c === '!' || c === '*' || c === '+') {
    setTile(tx, ty, 'U'); SFX.power();
    const kind = c === '!' ? 'wings' : c === '*' ? 'star' : 'heart';
    game.ents.push({ k: 'item', kind, x: tx * T + 4, y: cy - 25, w: 24, h: 24, vx: kind === 'heart' ? 1.1 : 1.6, vy: -4, alive: true, t: 0, rise: 0, active: true });
  } else if (c === 'B') {
    setTile(tx, ty, '.'); SFX.brk(); game.score += 50;
    for (let i = 0; i < 4; i++) parts.push({ x: cx, y: cy + 16, vx: (i % 2 ? 1 : -1) * (2 + Math.random() * 2), vy: -6 - (i < 2 ? 3 : 0), life: 60, color: THEMES[lv.theme].brick, size: 9, grav: 0.4 });
  } else SFX.bump();
}
const bumpAnim = new Map();
function coinPop(x, y) { parts.push({ x, y: y - 10, vx: 0, vy: -7, life: 28, coin: true, grav: 0.45, size: 10 }); }

function swapChar(p) {
  if (game.mode !== 1 || !p || p.dead || p.finished || p.swapCd > 0 || game.state !== 'play') return;
  p.who = p.who === 'ayla' ? 'kameel' : 'ayla'; p.ch = CHARS[p.who]; p.swapCd = 20; p.squash = -8;
  SFX.swap(); burst(p.x + p.w / 2, p.y + p.h / 2, p.ch.color, 14, 4, 0.05, 5);
  popup(p.x + p.w / 2, p.y - 14, p.ch.name + '!', p.ch.color);
}
function hitBoss(e, p) {
  e.hp--; e.inv = 80; SFX.bosshit(); game.freeze = 8; game.shake = 12; e.st = 'idle'; e.wait = 50; e.vx = 0;
  burst(e.x + e.w / 2, e.y + 10, '#ffe14a', 20, 6);
  e.guard = false;
  popup(e.x + e.w / 2, e.y - 10, e.hp > 0 ? 'OUCH!' : BOSS[e.kind].name + ' DEFEATED!', '#ffe14a');
  if (e.hp > 0) return;
  e.alive = false; e.deadT = 0; e.how = 'boss'; e.vy = -9; e.vx = 0; game.boss = null; game.score += 5000; game.coins += 10; game.levelCoins += 10;
  for (let i = 0; i < 10; i++) parts.push({ x: e.x + e.w / 2 + (i - 5) * 6, y: e.y, vx: (i - 4.5) * 0.9, vy: -8 - (i % 3) * 2, life: 50, coin: true, grav: 0.4, size: 10 });
  for (let y = 2; y <= 13; y++) { setTile(e.door, y, '.'); burst(e.door * T + 16, y * T + 16, '#8a8aa0', 4, 4); }
  for (const f of game.ents) if (f.k === 'fb') f.remove = true;
  game.ents.push({ k: 'big', i: 2, x: Math.max(e.aL + 40, Math.min(e.aR - 70, e.x + e.w / 2 - 15)), y: 300, y0: 300, w: 30, h: 30, alive: true, active: true, t: 0, vx: 0, vy: 0 });
  playSong(THEMES[lv.theme].song); SFX.win();
}
function defeat(e, p, how = 'stomp', combo = 1) {
  if (!e.alive) return;
  e.alive = false; e.deadT = 0; e.how = how;
  if (how !== 'stomp') { e.vy = -7; e.vx = (p ? Math.sign(e.x - p.x) || 1 : 1) * 2; }
  const pts = [200, 400, 800, 1000, 2000][Math.min(combo, 5) - 1];
  game.score += pts;
  if (combo >= 5) { game.lives++; SFX.oneup(); popup(e.x + e.w / 2, e.y, '1-UP!', '#7dff7d'); }
  else popup(e.x + e.w / 2, e.y, (combo > 1 ? 'COMBO ×' + combo + '  ' : '') + '+' + pts, combo > 1 ? '#ffe14a' : '#fff');
  burst(e.x + e.w / 2, e.y + e.h / 2, '#fff', 8, 3);
}

// ---------------------------------------------------------------- update
function update() {
  game.t++;
  if (game.state === 'intro') {
    game.timer++;
    if (game.timer > 130) game.state = 'play';
    updateCamera(true);
    return;
  }
  if (game.state === 'goal') { updateGoal(); return; }
  if (game.state !== 'play') { updateFireworks(); return; }
  if (game.freeze > 0) { game.freeze--; return; }
  game.levelTime++;

  // the clock: hurry-up warning at 30 seconds, lose a life at zero
  game.timeLeft--;
  if (game.timeLeft === 30 * 60) { popup(game.cam.x + VW / 2, 200, 'HURRY UP!', '#ff6b6b'); seq([84, 88, 84, 88, 84, 88], 0, 0.09, 0.1, 'square', 0.1); }
  if (game.timeLeft <= 10 * 60 && game.timeLeft > 0 && game.timeLeft % 60 === 0) tone(1200, 0.06, 'square', 0.08);
  if (game.timeLeft <= 0) {
    const live = game.players.filter(p => !p.dead && !p.finished);
    popup(game.cam.x + VW / 2, 200, "TIME'S UP!", '#ff6b6b');
    live.forEach(p => die(p)); game.lives += Math.max(0, live.length - 1);
    game.timeLeft = game.timeMax;
  }
  // the storm: in chase levels the screen's left edge keeps creeping forward
  if (game.chaseX !== null) game.chaseX = Math.min(lv.w * T - VW, game.chaseX + diff().chase);

  // entities first (platforms move, riders carried)
  for (const e of game.ents) updateEnt(e);
  for (const p of game.players) updatePlayer(p);
  updateCamera(false);
  if (game.mode === 2) coopClamp();
  if (game.chaseX !== null) chaseClamp();
  updateCannons();
  updateParticles();
  game.ents = game.ents.filter(e => !e.remove);

  // all dead with no lives?
  if (game.players.every(p => p.dead) && game.lives < 0) {
    if (game.players.every(p => p.deadT > 100)) { game.state = 'gameover'; game.timer = 0; stopSong(); saveBest(); }
  }
}

function updateCamera(snap) {
  const live = game.players.filter(p => !p.dead || game.mode === 1);
  if (!live.length) return;
  let tx;
  if (game.mode === 2) tx = live.reduce((s, p) => s + p.x, 0) / live.length - VW * 0.45;
  else { game.look += (live[0].face * 70 - game.look) * (snap ? 1 : 0.035); tx = live[0].x + live[0].w / 2 - VW * 0.5 + game.look; }
  tx = Math.max(0, Math.min(lv.w * T - VW, tx));
  game.cam.x = snap ? tx : game.cam.x + (tx - game.cam.x) * 0.12;
  if (game.chaseX !== null && game.state === 'play') game.cam.x = Math.max(game.cam.x, game.chaseX);
}
// The storm shoves stragglers along; anyone squashed against a wall loses a life.
function chaseClamp() {
  for (const p of game.players) {
    if (p.dead || p.finished) continue;
    const minX = game.cam.x + 26;
    if (p.x >= minX) continue;
    p.x = minX; if (p.vx < 0) p.vx = 0;
    if (game.t % 6 === 0) burst(p.x, p.y + p.h / 2, '#d9c8ff', 2, 3, 0, 4);
    const tx = Math.floor((p.x + p.w - 0.01) / T);
    for (let ty = Math.floor(p.y / T); ty <= Math.floor((p.y + p.h - 0.01) / T); ty++) if (solid(tile(tx, ty))) { popup(p.x, p.y - 10, 'SQUASHED!', '#ff6b6b'); die(p); break; }
  }
}
function coopClamp() {
  for (const p of game.players) {
    if (p.dead || p.finished) continue;
    const minX = game.cam.x + 2, maxX = game.cam.x + VW - p.w - 2;
    if (p.x < minX) { p.x = minX; if (p.vx < 0) p.vx = 0; }
    if (p.x > maxX) { p.x = maxX; if (p.vx > 0) p.vx = 0; }
  }
}

function updatePlayer(p) {
  readInput(p);
  if (p.dead) {
    p.deadT++;
    if (!p.gone && p.deadT > 25) { p.vy += 0.5; p.y += p.vy; }
    const others = game.players.some(q => q !== p && !q.dead);
    if (p.deadT > (others ? 120 : 110) && game.lives >= 0) respawn(p);
    return;
  }
  if (p.finished) return;
  const ch = p.ch, inp = p.input;
  if (p.inv > 0) p.inv--;
  if (p.swapCd > 0) p.swapCd--;
  if (p.star > 0) { p.star--; if (game.t % 3 === 0) burst(p.x + p.w / 2, p.y + p.h / 2, `hsl(${game.t * 12 % 360},100%,65%)`, 1, 1.5, 0.05, 4); }

  // ride platform
  if (p.plat) {
    const pl = p.plat;
    if (!pl.respawn && p.x + p.w > pl.x && p.x < pl.x + pl.w) { p.x += pl.dx || 0; p.y = pl.y - p.h; }
    p.plat = null;
  }

  const icy = p.groundTile === 'I' && p.onGround;
  const accel = p.onGround ? (icy ? 0.1 : 0.55) : 0.38;
  const fric = p.onGround ? (icy ? 0.015 : 0.22) : 0.04;
  const max = ch.speed * (p.star > 0 ? 1.15 : 1) * (lv.water ? 0.74 : 1);
  if (inp.l && !inp.r) { p.vx = Math.max(-max, p.vx - accel); p.face = -1; }
  else if (inp.r && !inp.l) { p.vx = Math.min(max, p.vx + accel); p.face = 1; }
  else { if (Math.abs(p.vx) <= fric) p.vx = 0; else p.vx -= Math.sign(p.vx) * fric * (p.onGround ? 1 : 1) * (icy ? 1 : 1.2); }

  if (p.onGround) { p.coyote = 7; p.usedDbl = false; p.combo = 0; } else if (p.coyote > 0) p.coyote--;
  if (inp.jPressed) p.jbuf = 8; else if (p.jbuf > 0) p.jbuf--;
  if (lv.water) { // swimming: every press of jump is a stroke
    if (inp.jPressed) {
      p.vy = -5.4; p.jbuf = 0; p.squash = -6; SFX.swim();
      for (let i = 0; i < 3; i++) parts.push({ x: p.x + p.w / 2 + (Math.random() - 0.5) * 16, y: p.y + p.h - 6, vx: (Math.random() - 0.5), vy: -0.6 - Math.random(), life: 40, color: 'rgba(255,255,255,.7)', size: 3 + Math.random() * 3, grav: -0.02 });
    }
  } else if (p.jbuf > 0 && p.coyote > 0) {
    p.vy = -ch.jump; p.coyote = 0; p.jbuf = 0; p.onGround = false; p.squash = -8; SFX.jump();
  } else if (inp.jPressed && !p.onGround && p.coyote <= 0 && p.wings && !p.usedDbl) {
    p.vy = -ch.jump * 0.92; p.usedDbl = true; p.jbuf = 0; SFX.dbl();
    for (let i = 0; i < 8; i++) parts.push({ x: p.x + p.w / 2 + (Math.random() - 0.5) * 20, y: p.y + p.h, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2, life: 30, color: '#fff', size: 5, grav: 0 });
  }
  const grav = lv.water ? (inp.j && p.vy < 0 ? 0.13 : 0.2) : (inp.j && p.vy < 0) ? 0.45 : 0.9;
  p.vy = Math.min(lv.water ? 2.4 : 13, p.vy + grav);

  const wasGround = p.onGround;
  moveBody(p);
  if (p.headTile) { p.vy = 1; hitBlock(p, p.headTile.tx, p.headTile.ty); }

  // platforms
  if (p.vy >= 0) {
    for (const e of game.ents) {
      if (!e.plat || (e.fall && e.respawn > 0)) continue;
      if (p.x + p.w > e.x + 2 && p.x < e.x + e.w - 2 && p.prevBottom <= e.y + Math.max(0, e.dy || 0) + 2 && p.y + p.h >= e.y) {
        p.y = e.y - p.h; p.vy = 0; p.onGround = true; p.plat = e; p.groundTile = '='; if (e.fall) e.stood++;
      }
    }
  }
  if (p.onGround && !wasGround) { p.squash = 6; if (Math.abs(p.vx) > 0.5) dust(p); }
  if (p.squash > 0) p.squash--; else if (p.squash < 0) p.squash++;
  p.anim += p.onGround ? Math.abs(p.vx) * 0.09 : 0.1;
  if (p.onGround && Math.abs(p.vx) > 3 && game.t % 8 === 0) dust(p);

  // tile interactions: coins, spikes, lava
  const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - 1) / T), y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + p.h - 1) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const c = tile(tx, ty);
    if (c === 'C') { setTile(tx, ty, '.'); addCoin(tx * T + 16, ty * T + 16); }
    else if (c === 'S') { if (p.y + p.h > ty * T + 14 && p.x + p.w > tx * T + 4 && p.x < tx * T + T - 4) hurt(p); }
    else if (c === 'L') { if (p.y + p.h > ty * T + 8) { die(p); burst(p.x + p.w / 2, ty * T, '#ff7b00', 20, 5); return; } }
  }
  if (p.y > H * T + 40) { die(p, true); return; }

  // entities
  for (const e of game.ents) {
    if (!e.alive) continue;
    if (e.k === 'item') {
      if (e.rise <= 0 && overlap(p, e)) collectItem(p, e);
      continue;
    }
    if (e.k === 'spring') {
      if (p.vy > 0 && p.x + p.w > e.x && p.x < e.x + e.w && p.y + p.h > e.y && p.prevBottom <= e.y + 10) {
        p.y = e.y - p.h; p.vy = inp.j ? -19.5 : -17; e.comp = 12; SFX.spring(); p.squash = -10;
      }
      continue;
    }
    if (e.k === 'check') {
      if (!e.on && overlap(p, e)) {
        e.on = true; game.check = { x: e.x - 4, y: e.y + e.h }; SFX.check();
        game.timeLeft += diff().check * 60; popup(e.x + 8, e.y - 30, '+' + diff().check + ' TIME', '#bff');
        burst(e.x + 8, e.y + 10, '#7dff7d', 16, 4); popup(e.x + 8, e.y - 10, 'CHECKPOINT!', '#7dff7d');
        game.players.forEach(q => { if (!q.dead) q.hearts = Math.max(q.hearts, 3); });
      }
      continue;
    }
    if (e.k === 'goal') { if (p.x + p.w > e.x && p.x < e.x + e.w + 4) reachGoal(p, e); continue; }
    if (e.plat) continue;
    if (e.k === 'big') {
      if (overlap(p, e)) {
        e.alive = false; e.remove = true; game.stars[e.i] = true; game.score += 2000; SFX.bigstar(); game.freeze = 4;
        burst(e.x + 15, e.y + 15, '#ffe14a', 24, 6); popup(e.x + 15, e.y - 8, 'BIG STAR!', '#ffe14a');
      }
      continue;
    }
    if (e.k === 'boss') {
      if (e.st === 'sleep' || e.inv > 0 || !overlap(p, e)) continue;
      const above = p.vy > 0 && p.prevBottom <= e.y + (e.kind === 'bat' ? 28 : 20);
      if (above && !(e.kind === 'crab' && e.guard)) { hitBoss(e, p); p.vy = -13; p.y = e.y - p.h; }
      else if (p.star > 0) hitBoss(e, p);
      else if (e.kind === 'scarab' && e.st === 'stun') { /* dazed: safe to bump into */ }
      else { hurt(p); if (above) p.vy = -9; }
      continue;
    }
    if (e.k === 'firebar') {
      for (let i = 0; i < e.len; i++) {
        const r = 14 + i * 15, fx = e.cx + Math.cos(e.ang) * r, fy = e.cy + Math.sin(e.ang) * r;
        if (fx > p.x - 6 && fx < p.x + p.w + 6 && fy > p.y - 6 && fy < p.y + p.h + 6) { hurt(p); break; }
      }
      continue;
    }
    if (!overlap(p, e)) continue;
    if (e.k === 'bspawn') continue;
    if (e.k === 'crusher' || e.k === 'icicle') { if (p.star > 0 && e.k === 'icicle') { e.alive = false; burst(e.x + 8, e.y + 14, '#bfe9ff', 12); } else hurt(p); continue; }
    // enemies
    if (p.star > 0) { defeat(e, p, 'star'); SFX.stomp(); continue; }
    const stompable = e.stomp;
    if (stompable && p.vy > 0 && p.prevBottom <= e.y + 10) {
      p.combo++; defeat(e, p, 'stomp', p.combo); SFX.stomp(p.combo - 1); game.freeze = 3;
      p.vy = inp.j ? -12 : -8; p.y = e.y - p.h; p.usedDbl = false;
    } else hurt(p);
  }
}
function dust(p) {
  for (let i = 0; i < 3; i++) parts.push({ x: p.x + p.w / 2, y: p.y + p.h - 2, vx: (Math.random() - 0.5) * 2 - p.vx * 0.2, vy: -Math.random(), life: 18, color: 'rgba(255,255,255,0.8)', size: 4, grav: 0 });
}

function collectItem(p, e) {
  e.alive = false; e.remove = true;
  if (e.kind === 'wings') { p.wings = true; popup(e.x, e.y, 'DOUBLE JUMP!', '#bff'); }
  if (e.kind === 'star') { p.star = 600; popup(e.x, e.y, 'SUPER STAR!', '#ffe14a'); }
  if (e.kind === 'heart') { p.hearts = Math.min(5, p.hearts + 1); popup(e.x, e.y, '+1 HEART', '#ff7da8'); }
  game.score += 1000; SFX.power(); burst(e.x + 12, e.y + 12, '#fff', 14, 4);
}

function reachGoal(p, e) {
  if (game.state !== 'play') return;
  game.state = 'goal'; game.timer = 0; game.goal = e;
  const hgt = Math.max(0, Math.min(1, (e.y + e.h - (p.y + p.h)) / e.h));
  const bonus = Math.round(hgt * 50) * 100 + 500;
  game.timeBonus = Math.floor(game.timeLeft / 60) * diff().bonus;
  game.score += bonus + game.timeBonus; popup(e.x, p.y - 10, '+' + bonus, '#ffe14a');
  stopSong(); SFX.win();
  game.players.forEach(q => { if (q.dead) respawn(q); q.finished = true; q.vx = 0; q.vy = 0; q.inv = 0; });
  p.x = e.x - p.w + 4;
}
function updateGoal() {
  game.timer++;
  const e = game.goal, base = e.y + e.h;
  e.flagY = Math.min(e.h - 40, e.flagY + 5);
  game.players.forEach((p, i) => {
    if (game.timer < 50) { p.y = Math.min(base - p.h, p.y + 5); p.x = e.x - p.w + 4 - i * 26; p.face = 1; }
    else { p.vx = 2.5; p.face = 1; p.anim += 0.22; p.x += p.vx; p.y = base - p.h; }
  });
  if (game.timer % 20 === 0 && game.timer > 40) {
    game.fireworks.push({ x: game.cam.x + 200 + Math.random() * 560, y: 80 + Math.random() * 180, t: 0, hue: Math.random() * 360 });
    tone(200 + Math.random() * 300, 0.25, 'triangle', 0.05, 60);
  }
  updateFireworks(); updateParticles();
  updateCamera(false);
  if (game.timer > 230) {
    game.state = 'done'; game.timer = 0;
    if (game.world + 1 >= LEVELS.length) { game.state = 'victory'; playSong('win'); }
    else playSong('win');
    const got = game.stars.filter(Boolean).length;
    game.bestStars[game.world] = Math.max(game.bestStars[game.world] || 0, got);
    try { localStorage.setItem('ak_stars', JSON.stringify(game.bestStars)); } catch (e) {}
    game.unlocked = Math.max(game.unlocked, Math.min(LEVELS.length, game.world + 2));
    try { localStorage.setItem('ak_unlocked', game.unlocked); } catch (e) {}
    saveBest();
  }
}
function saveBest() { if (game.score > game.best) { game.best = game.score; try { localStorage.setItem('ak_best', game.best); } catch (e) {} } }
function updateFireworks() {
  game.timer++;
  if ((game.state === 'victory' || game.state === 'done') && game.t % 25 === 0) game.fireworks.push({ x: game.cam.x + 100 + Math.random() * 760, y: 60 + Math.random() * 200, t: 0, hue: Math.random() * 360 });
  for (const f of game.fireworks) {
    f.t++;
    if (f.t === 1) for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, life: 50, color: `hsl(${f.hue + i * 4},100%,65%)`, size: 4, grav: 0.06 }); }
  }
  game.fireworks = game.fireworks.filter(f => f.t < 5);
  updateParticles();
}
function updateParticles() {
  for (const q of parts) { q.vy += q.grav; q.x += q.vx; q.y += q.vy; q.life--; }
  parts = parts.filter(q => q.life > 0);
  for (const q of popups) { q.y -= 0.8; q.life--; }
  popups = popups.filter(q => q.life > 0);
  for (const [k, v] of bumpAnim) { if (v <= 1) bumpAnim.delete(k); else bumpAnim.set(k, v - 1); }
}

function nearestPlayer(x) {
  let best = null, bd = 1e9;
  for (const p of game.players) { if (p.dead || p.finished) continue; const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = p; } }
  return best;
}

function updateEnt(e) {
  e.t++;
  const onScreen = e.x + (e.w || 0) > game.cam.x - 120 && e.x < game.cam.x + VW + 120;
  if (!e.active && onScreen) e.active = true;
  if (!e.active) return;
  if (!e.alive && e.k !== 'item') {
    e.deadT++;
    if (e.how !== 'stomp') { e.vy += 0.5; e.y += e.vy; e.x += e.vx; }
    if (e.deadT > (e.how === 'stomp' ? 30 : 90)) e.remove = true;
    return;
  }
  switch (e.k) {
    case 'g': case 's': case 'p': {
      if (e.k === 'p') {
        const pl = nearestPlayer(e.x);
        if (pl && Math.abs(pl.x - e.x) < 400) { const want = Math.sign(pl.x - e.x) * 2.6; e.vx += (want - e.vx) * 0.02; }
      }
      e.vy = Math.min(12, e.vy + 0.6);
      const vx = e.vx; moveBody(e);
      if (e.hitWall) e.vx = -vx;
      // turn at ledges (walkers only; penguins slide off)
      if (e.onGround && e.k !== 'p') {
        const ahead = vx > 0 ? e.x + e.w + 2 : e.x - 2;
        const below = tile(Math.floor(ahead / T), Math.floor((e.y + e.h + 4) / T));
        if (!solid(below) && below !== '=') e.vx = -vx;
      }
      if (e.y > H * T + 50) e.remove = true;
      break;
    }
    case 'j': {
      e.vy = Math.min(12, e.vy + 0.6);
      const vx = e.vx; moveBody(e);
      if (e.hitWall) { e.dir = -e.dir; e.vx = -vx; }
      if (e.onGround) {
        e.vx = 0;
        if (--e.wait <= 0) { const pl = nearestPlayer(e.x); if (pl) e.dir = Math.sign(pl.x - e.x) || -1; e.vy = -10; e.vx = e.dir * 1.6; e.wait = 55; }
      }
      if (e.y > H * T + 50) e.remove = true;
      break;
    }
    case 'big': e.y = e.y0 + Math.sin(e.t * 0.08) * 4; break;
    case 'fb': {
      e.x += e.vx; e.life--;
      if (e.life <= 0 || solid(tile(Math.floor((e.x + 8) / T), Math.floor((e.y + 8) / T)))) e.remove = true;
      break;
    }
    case 'boss': {
      const B = BOSS[e.kind];
      if (e.st === 'sleep') {
        if (game.players.some(p => !p.dead && p.x > e.aL + T)) { e.st = 'idle'; e.wait = 80; game.boss = e; playSong(B.song); SFX.roar(); game.shake = 10; popup(e.x + e.w / 2, e.y - 20, B.name + '!', '#ff6b8b'); }
        break;
      }
      if (e.inv > 0) e.inv--;
      const pl = nearestPlayer(e.x + e.w / 2), pdx = pl ? pl.x + pl.w / 2 - (e.x + e.w / 2) : 0;
      const clamp = () => { let hit = 0; if (e.x < e.aL) { e.x = e.aL; hit = -1; } if (e.x + e.w > e.aR) { e.x = e.aR - e.w; hit = 1; } return hit; };
      const rage = 3 - e.hp; // 0, 1, 2: bosses speed up as they take hits
      if (e.kind === 'grumble') { // hops at you and spits fireballs
        e.vy = Math.min(13, e.vy + 0.55); moveBody(e);
        const c = clamp(); if (c) e.vx = -c * Math.abs(e.vx);
        if (e.st === 'idle') {
          e.vx = 0;
          if (--e.wait <= 0 && e.onGround) { e.vx = Math.max(-4.5, Math.min(4.5, pdx / 40)); e.vy = -12 - rage; e.st = 'air'; e.onGround = false; }
        } else if (e.st === 'air' && e.onGround) {
          e.st = 'idle'; e.vx = 0; e.wait = 34 + e.hp * 16; e.hops++; game.shake = 8; noise(0.15, 0.15);
          burst(e.x + 32, e.y + e.h, '#bbb', 10, 4);
          if (e.hops % 2 === 0 || e.hp < 3) {
            const dir = pdx < 0 ? -1 : 1, dirs = e.hp === 1 ? [dir, -dir] : [dir];
            for (const d of dirs) game.ents.push({ k: 'fb', x: e.x + 24 + d * 30, y: e.y + e.h - 20, w: 16, h: 16, vx: d * 3.1, vy: 0, life: 230, alive: true, active: true, t: 0, stomp: false });
            SFX.shoot();
          }
        }
      } else if (e.kind === 'bat') { // hovers out of reach, then swoops low: stomp it at the bottom of the dive
        const top = 5 * T, low = GT * T - e.h - 4;
        if (e.st === 'idle') {
          e.x += Math.max(-1.6, Math.min(1.6, pdx * 0.03)); e.y += (top + Math.sin(e.t * 0.08) * 10 - e.y) * 0.08; clamp();
          if (--e.wait <= 0) { e.st = 'swoop'; e.sw = 0; e.sx = e.x; e.tx = Math.max(e.aL, Math.min(e.aR - e.w, e.x + Math.max(-320, Math.min(320, pdx * 2)))); SFX.roar(); }
        } else {
          e.sw += 1 / (88 - rage * 14);
          const u = Math.min(1, e.sw); e.x = e.sx + (e.tx - e.sx) * u; e.y = top + (low - top) * Math.sin(Math.PI * u);
          if (u >= 1) { e.st = 'idle'; e.wait = 45 + e.hp * 25; }
        }
      } else if (e.kind === 'crab') { // scuttles side to side; stomp it only while its claws are down
        e.vy = Math.min(13, e.vy + 0.55); e.vx = e.dir * (1.3 + rage * 0.5); moveBody(e);
        if (clamp() || e.hitWall) e.dir = -e.dir;
        if (--e.wait <= 0) { e.guard = !e.guard; e.wait = e.guard ? 90 : 150; if (e.guard) SFX.bump(); }
      } else { // scarab: charges across the arena, then lies dazed after hitting the wall
        e.vy = Math.min(13, e.vy + 0.55);
        if (e.st === 'idle') { e.vx = 0; moveBody(e); if (--e.wait <= 0) { e.st = 'charge'; e.dir = pdx < 0 ? -1 : 1; SFX.roar(); } }
        else if (e.st === 'charge') {
          e.vx = e.dir * (5 + rage * 0.8); moveBody(e);
          if (game.t % 4 === 0) burst(e.x + e.w / 2 - e.dir * 30, e.y + e.h, '#e8cf9a', 2, 2, 0, 5);
          if (clamp() || e.hitWall) { e.st = 'stun'; e.wait = 120 - rage * 15; e.vx = 0; game.shake = 10; noise(0.2, 0.18); burst(e.x + e.w / 2 + e.dir * 30, e.y + 20, '#e8cf9a', 14, 5); }
        } else { moveBody(e); if (--e.wait <= 0) { e.st = 'idle'; e.wait = 45; } }
      }
      break;
    }
    case 'ghost': { // creeps toward you, but freezes while you look at it
      const pl = nearestPlayer(e.x);
      if (!pl) break;
      const dx = pl.x - e.x, dy = pl.y + 10 - e.y, d = Math.hypot(dx, dy);
      e.dir = dx < 0 ? -1 : 1;
      e.shy = pl.face === (dx < 0 ? 1 : -1);
      if (!e.shy && d < 460 && d > 4) { e.x += dx / d * 1.15; e.y += dy / d * 1.15; }
      break;
    }
    case 'jelly': e.y = e.y0 + Math.sin(e.t * 0.04 + e.x) * 42; break;
    case 'bspawn': {
      if (--e.timer <= 0) { e.timer = 210; game.ents.push({ k: 'boulder', x: e.x + 2, y: e.y + 2, w: 28, h: 28, vx: e.dir * 2.3, vy: 0, stomp: false, alive: true, active: true, t: 0, rot: 0 }); }
      break;
    }
    case 'boulder': {
      e.vy = Math.min(12, e.vy + 0.6); const vx = e.vx; moveBody(e); e.rot += vx * 0.07;
      if (e.hitWall || e.y > H * T + 40 || e.t > 700) { e.remove = true; if (e.hitWall) { burst(e.x + 14, e.y + 14, '#b98a5a', 10, 4); noise(0.1, 0.1); } }
      break;
    }
    case 'b': {
      e.x += e.dir * 1.3;
      if (Math.abs(e.x - e.x0) > 3 * T) e.dir *= -1;
      e.y = e.y0 + Math.sin(e.t * 0.05) * 40;
      break;
    }
    case 'bullet': {
      e.x += e.vx;
      if (solid(tile(Math.floor((e.x + e.w / 2) / T), Math.floor((e.y + e.h / 2) / T))) || e.x < game.cam.x - 200 || e.x > game.cam.x + VW + 200) e.remove = true;
      break;
    }
    case 'spring': if (e.comp > 0) e.comp--; break;
    case 'mplat': case 'vplat': {
      const ox = e.x, oy = e.y, f = (1 - Math.cos(e.t * e.speed + e.phase)) / 2;
      if (e.axis === 'x') e.x = e.x0 + f * e.range; else e.y = e.y0 - f * e.range;
      e.dx = e.x - ox; e.dy = e.y - oy;
      break;
    }
    case 'fall': {
      e.dx = 0; const oy = e.y;
      if (e.respawn > 0) { e.respawn--; if (e.respawn === 0) { e.y = e.y0; e.falling = false; e.stood = 0; e.vy = 0; } }
      else if (e.falling) { e.vy = Math.min(10, e.vy + 0.35); e.y += e.vy; if (e.y > H * T + 40) e.respawn = 150; }
      else if (e.stood > 22) e.falling = true;
      e.dy = e.y - oy;
      break;
    }
    case 'firebar': e.ang += e.speed; break;
    case 'crusher': {
      if (e.st === 'idle') {
        const pl = game.players.find(p => !p.dead && p.x + p.w > e.x - 20 && p.x < e.x + e.w + 20 && p.y > e.y);
        if (pl) { e.st = 'warn'; e.wait = 18; }
      } else if (e.st === 'warn') { if (--e.wait <= 0) e.st = 'fall'; }
      else if (e.st === 'fall') {
        e.vy = Math.min(14, e.vy + 1); e.y += e.vy;
        const ty = Math.floor((e.y + e.h) / T);
        const tx0 = Math.floor(e.x / T), tx1 = Math.floor((e.x + e.w - 1) / T);
        if (solid(tile(tx0, ty)) || solid(tile(tx1, ty))) {
          e.y = ty * T - e.h; e.vy = 0; e.st = 'land'; e.wait = 45; SFX.bump(); noise(0.2, 0.15); game.shake = 10;
          burst(e.x + e.w / 2, e.y + e.h, '#bbb', 12, 4);
        }
      } else if (e.st === 'land') { if (--e.wait <= 0) e.st = 'rise'; }
      else if (e.st === 'rise') { e.y -= 1.5; if (e.y <= e.y0) { e.y = e.y0; e.st = 'cool'; e.wait = 50; } }
      else if (e.st === 'cool') { if (--e.wait <= 0) e.st = 'idle'; }
      break;
    }
    case 'icicle': {
      if (e.st === 'hang') {
        if (game.players.some(p => !p.dead && p.x + p.w > e.x - 36 && p.x < e.x + e.w + 36 && p.y > e.y)) { e.st = 'shake'; e.shake = 25; }
      } else if (e.st === 'shake') { if (--e.shake <= 0) e.st = 'fall'; }
      else if (e.st === 'fall') {
        e.vy = Math.min(12, e.vy + 0.7); e.y += e.vy;
        if (solid(tile(Math.floor((e.x + 8) / T), Math.floor((e.y + e.h) / T)))) { e.alive = false; e.remove = true; burst(e.x + 8, e.y + e.h, '#d9f3ff', 14, 4); noise(0.1, 0.1); }
      }
      break;
    }
    case 'item': {
      e.vy = Math.min(10, e.vy + 0.4);
      const vx = e.vx; moveBody(e); if (e.hitWall) e.vx = -vx;
      if (e.kind === 'star' && e.onGround) e.vy = -8;
      if (e.y > H * T + 40) e.remove = true;
      break;
    }
  }
}
function updateCannons() {
  const tx0 = Math.floor(game.cam.x / T), tx1 = tx0 + Math.ceil(VW / T);
  for (let ty = 0; ty < H; ty++) for (let tx = tx0; tx <= tx1; tx++) if (tile(tx, ty) === 'T') {
    const key = tx + ',' + ty; const t = (cannonTimers.get(key) || 60) - 1;
    if (t <= 0) {
      const pl = nearestPlayer(tx * T);
      if (pl && Math.abs(pl.x - tx * T) > 70) {
        const dir = Math.sign(pl.x - tx * T);
        if (!solid(tile(tx + dir, ty))) {
          game.ents.push({ k: 'bullet', x: tx * T + (dir > 0 ? T : -24), y: ty * T + 6, w: 24, h: 20, vx: dir * 2.6, vy: 0, alive: true, active: true, t: 0, stomp: true });
          SFX.shoot(); burst(tx * T + 16 + dir * 16, ty * T + 16, '#999', 6, 2, 0, 5);
        }
      }
      cannonTimers.set(key, 170);
    } else cannonTimers.set(key, t);
  }
}

// ---------------------------------------------------------------- menu / clicks
const menuButtons = [];
function onPress(code) {
  if (code === 'KeyM') { initAudio(); setMuted(!AU.muted); return; }
  if (code === 'KeyP' || code === 'Escape') { togglePause(); return; }
  if ((code === 'KeyX' || code === 'KeyC' || code === 'ShiftLeft' || code === 'ShiftRight') && game.state === 'play') { swapChar(game.players[0]); return; }
  const go = code === 'Enter' || code === 'Space' || code === 'Touch';
  if (game.state === 'title') {
    initAudio(); playSong('title');
    if (code === 'ArrowLeft' || code === 'KeyA') { game.sel = (game.sel + 2) % 3; SFX.select(); }
    if (code === 'ArrowRight' || code === 'KeyD') { game.sel = (game.sel + 1) % 3; SFX.select(); }
    if (code === 'ArrowUp' || code === 'KeyW') setDiff(game.diff + 2);
    if (code === 'ArrowDown' || code === 'KeyS') setDiff(game.diff + 1);
    const num = /^(Digit|Numpad)([1-9])$/.exec(code);
    if (num && +num[2] <= game.unlocked) { game.world = +num[2] - 1; SFX.select(); }
    if (go) chooseSel();
  } else if (game.state === 'done') { if (go && game.timer > 30) loadLevel(game.world + 1); }
  else if (game.state === 'gameover' || game.state === 'victory') {
    if (go && game.timer > 40) { if (game.state === 'gameover') { game.lives = 5; game.score = 0; game.coins = 0; game.players.forEach(p => p.hearts = 3); loadLevel(game.world); } else toTitle(); }
  }
  if (DEBUG && code === 'KeyN' && game.state === 'play') { const g = game.ents.find(e => e.k === 'goal'); const p = game.players[0]; p.x = g.x - 40; p.y = g.y + g.h - p.h; }
  if (DEBUG && code === 'KeyF' && game.state === 'play') { game.players.forEach(p => { p.x += 20 * T; p.y = 2 * T; }); }
}
function setDiff(d) { game.diff = (d + DIFFS.length) % DIFFS.length; SFX.select(); try { localStorage.setItem('ak_diff', game.diff); } catch (e) {} }
function chooseSel() {
  SFX.power();
  if (game.sel === 2) startGame(2); else startGame(1, game.sel === 0 ? 'ayla' : 'kameel');
}
function toTitle() { game.state = 'title'; game.timer = 0; game.world = Math.min(game.world, game.unlocked - 1); playSong('title'); }
function togglePause() {
  if (game.state === 'play') { game.state = 'paused'; }
  else if (game.state === 'paused') { game.state = 'play'; }
}
function onClick(pt) {
  if (game.state === 'paused') { togglePause(); return; }
  if (game.state === 'title') {
    playSong('title');
    for (const b of menuButtons) if (pt.x > b.x && pt.x < b.x + b.w && pt.y > b.y && pt.y < b.y + b.h) {
      if (b.act === 'sel') { game.sel = b.v; chooseSel(); }
      if (b.act === 'diff') setDiff(game.diff + b.v);
      if (b.act === 'world') { game.world = (game.world + b.v + game.unlocked) % game.unlocked; SFX.select(); }
      return;
    }
    return;
  }
  onPress('Touch');
}

// ---------------------------------------------------------------- drawing helpers
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function text(s, x, y, size, color = '#fff', align = 'center', stroke = '#2b1a3a', sw = 6) {
  ctx.font = `700 ${size}px Fredoka, system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = sw; ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
// Cartoon head, drawn to match the kid: x = center, y = chin, hh = height
function drawHead(who, x, y, hh) {
  const ch = CHARS[who], k = hh / 36, OL = '#2b1a3a';
  const blink = (game.t + (who === 'ayla' ? 0 : 97)) % 210 < 7;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 1.5; ctx.strokeStyle = OL;
  const shape = fill => { ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); };
  const HAIR = ch.hair, SHINE = ch.hairShine;
  if (who === 'ayla') {
    // long wavy hair behind the face, tucked back with wispy ends
    ctx.beginPath(); ctx.moveTo(0, -36);
    ctx.bezierCurveTo(-13, -37, -19, -27, -17.5, -17); ctx.bezierCurveTo(-19.5, -10, -17, -4, -19, 0.5);
    ctx.bezierCurveTo(-14.5, 0, -11, -2.5, -10, -7); ctx.lineTo(10, -7);
    ctx.bezierCurveTo(11, -2.5, 14.5, 0, 19, 0.5); ctx.bezierCurveTo(17, -4, 19.5, -10, 17.5, -17);
    ctx.bezierCurveTo(19, -27, 13, -37, 0, -36); ctx.closePath(); shape(HAIR);
  } else {
    // ears
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 13.2, -13.5, 3.2, 4.2, 0, 0, 7); shape(ch.skin); ctx.beginPath(); ctx.arc(s * 13.4, -13.5, 1.5, s > 0 ? -1.2 : 1.9, s > 0 ? 1.2 : 4.3); ctx.stroke(); }
  }
  // face
  ctx.beginPath(); ctx.moveTo(-12.5, -19); ctx.bezierCurveTo(-13, -8, -8, -0.5, 0, -0.5); ctx.bezierCurveTo(8, -0.5, 13, -8, 12.5, -19);
  ctx.bezierCurveTo(12, -30, -12, -30, -12.5, -19); ctx.closePath(); shape(ch.skin);
  // cheeks
  ctx.fillStyle = 'rgba(255,110,120,.35)'; ctx.beginPath(); ctx.ellipse(-8, -9.5, 3, 2, 0, 0, 7); ctx.ellipse(8, -9.5, 3, 2, 0, 0, 7); ctx.fill();
  if (who === 'ayla') {
    // hair on top, parted, with a headband
    ctx.beginPath(); ctx.moveTo(-13.2, -17); ctx.bezierCurveTo(-15, -30, -8, -36.5, 0, -36.5); ctx.bezierCurveTo(8, -36.5, 15, -30, 13.2, -17);
    ctx.bezierCurveTo(12, -23, 7, -27.5, 1, -27.5); ctx.bezierCurveTo(-6, -27.5, -11.5, -23, -13.2, -17); ctx.closePath(); shape(HAIR);
    ctx.strokeStyle = '#11101a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-13.5, -25.5); ctx.bezierCurveTo(-9, -35, 9, -35, 13.5, -25.5); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-6, -32.2); ctx.quadraticCurveTo(0, -33.6, 6, -32.2); ctx.stroke();
    // loose strands
    ctx.strokeStyle = HAIR; ctx.lineWidth = 1.3; ctx.beginPath();
    ctx.moveTo(-12.5, -21); ctx.quadraticCurveTo(-13.5, -14, -11.5, -9.5); ctx.moveTo(12.5, -21); ctx.quadraticCurveTo(13.5, -14, 11.5, -9.5);
    ctx.moveTo(-4, -36); ctx.quadraticCurveTo(-6, -39.5, -9, -39); ctx.moveTo(5, -36); ctx.quadraticCurveTo(8, -39.5, 10.5, -38); ctx.stroke();
  } else {
    // short hair with a straight fringe
    ctx.beginPath(); ctx.moveTo(-13.6, -15.5); ctx.bezierCurveTo(-17, -30, -9, -37, 0, -37); ctx.bezierCurveTo(9, -37, 17, -30, 13.6, -15.5);
    ctx.lineTo(11.2, -20.5); ctx.lineTo(8.8, -22.5); ctx.lineTo(6.2, -21); ctx.lineTo(3.4, -22.8); ctx.lineTo(0.6, -21.2); ctx.lineTo(-2.4, -22.8); ctx.lineTo(-5.4, -21); ctx.lineTo(-8.4, -22.6); ctx.lineTo(-11.2, -20.5);
    ctx.closePath(); shape(HAIR);
    ctx.strokeStyle = HAIR; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(1, -37); ctx.quadraticCurveTo(2, -40, 4.5, -40); ctx.moveTo(-2, -37); ctx.quadraticCurveTo(-2, -39.5, -4, -40); ctx.stroke();
  }
  // hair shine
  ctx.strokeStyle = SHINE; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-9, -29.5); ctx.quadraticCurveTo(-6, -33.3, -1.5, -33.8); ctx.stroke();
  // eyes
  ctx.strokeStyle = OL; ctx.lineWidth = 1.2;
  const ey = who === 'ayla' ? -15.5 : -15, er = who === 'ayla' ? 4.1 : 3.5;
  for (const s of [-1, 1]) {
    if (blink) { ctx.beginPath(); ctx.arc(s * 5.2, ey - 1, 3, 0.25, Math.PI - 0.25); ctx.stroke(); continue; }
    ctx.beginPath(); ctx.ellipse(s * 5.2, ey, er * 0.82, er, 0, 0, 7); shape('#fff');
    ctx.fillStyle = '#4a2a16'; ctx.beginPath(); ctx.arc(s * 5.2 + 0.5, ey + 0.4, er * 0.58, 0, 7); ctx.fill();
    ctx.fillStyle = '#16100c'; ctx.beginPath(); ctx.arc(s * 5.2 + 0.5, ey + 0.4, er * 0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 5.2 + 1.4, ey - 1, er * 0.22, 0, 7); ctx.fill();
  }
  // eyebrows
  ctx.strokeStyle = HAIR; ctx.lineWidth = who === 'ayla' ? 1.3 : 1.7;
  const by = who === 'ayla' ? -22 : (-20.2);
  if (who === 'ayla') { ctx.beginPath(); ctx.moveTo(-8.2, by + 1); ctx.quadraticCurveTo(-5.2, by - 1.4, -2.4, by + 0.6); ctx.moveTo(8.2, by + 1); ctx.quadraticCurveTo(5.2, by - 1.4, 2.4, by + 0.6); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(-8, by + 1.4); ctx.quadraticCurveTo(-5.2, by + 0.2, -2.6, by + 1.2); ctx.moveTo(8, by + 1.4); ctx.quadraticCurveTo(5.2, by + 0.2, 2.6, by + 1.2); ctx.stroke(); }
  // nose
  ctx.strokeStyle = 'rgba(70,35,20,.6)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(0, -11.4, 1.5, 0.3, Math.PI - 0.3); ctx.stroke();
  // big smile with teeth
  ctx.strokeStyle = OL; ctx.lineWidth = 1.2;
  const mw = who === 'ayla' ? 6.2 : 5.6, my = who === 'ayla' ? -8 : -7.6, md = who === 'ayla' ? 5.2 : 3.6;
  ctx.beginPath(); ctx.moveTo(-mw, my); ctx.quadraticCurveTo(0, my + 1.2, mw, my); ctx.quadraticCurveTo(0, my + md * 2 - 1.2, -mw, my); ctx.closePath(); shape('#8a2f3a');
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#fff'; ctx.fillRect(-mw, my - 1, mw * 2, 3.1);
  if (who === 'ayla') { ctx.fillStyle = '#8a2f3a'; ctx.fillRect(-0.55, my, 1.1, 2.4); ctx.fillStyle = '#ff8f9c'; ctx.beginPath(); ctx.ellipse(0, my + md + 1.2, 3.2, 2, 0, 0, 7); ctx.fill(); }
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(-mw, my); ctx.quadraticCurveTo(0, my + 1.2, mw, my); ctx.quadraticCurveTo(0, my + md * 2 - 1.2, -mw, my); ctx.stroke();
  ctx.restore();
}

// Draw a kid: x = center, y = feet. Cartoon head on a chunky cartoon hero body:
// overalls with gold buttons, a bright shirt, white gloves, big boots and an emblem.
function drawKid(who, x, y, o = {}) {
  const ch = CHARS[who];
  const face = o.face || 1, run = o.run || 0, air = o.air || false, scale = o.scale || 1;
  const squash = o.squash || 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face * scale * (1 + squash * 0.02), scale * (1 - squash * 0.025));
  const swing = air ? 0.6 : Math.sin(run) * 0.8;
  const OL = '#2b1a3a';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 1.6; ctx.strokeStyle = OL;
  const shape = (fill) => { ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); };
  const leg = (ang, back) => {
    ctx.save(); ctx.translate(back ? -3 : 3, -14); ctx.rotate(ang);
    rr(-4.5, -1, 9, 10, 3); shape(back ? ch.overallsDark : ch.overalls);
    rr(-5.5, 7, 13.5, 7.5, [3, 5, 3, 3]); shape(back ? ch.bootsDark : ch.boots);   // big boot
    ctx.fillStyle = 'rgba(255,255,255,.45)'; rr(2.5, 8.5, 4, 2, 1); ctx.fill();
    ctx.restore();
  };
  const arm = (ang, back) => {
    ctx.save(); ctx.translate(back ? 7 : -7, -27); ctx.rotate(ang);
    rr(-3.5, -1, 7, 10, 3.5); shape(back ? ch.shirtDark : ch.shirt);
    ctx.beginPath(); ctx.arc(0, 11.5, 4.6, 0, 7); shape('#fff');                      // glove
    ctx.strokeStyle = 'rgba(43,26,58,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3.6, 8.6); ctx.lineTo(3.6, 8.6); ctx.stroke();
    ctx.restore();
  };
  leg(air ? -0.55 : -swing, true);
  arm(air ? -2.5 : swing * 0.95, true);
  // shirt (round body)
  rr(-10.5, -32, 21, 20, 8); shape(ch.shirt);
  // overalls bib + straps
  ctx.beginPath();
  ctx.moveTo(-10.5, -21); ctx.lineTo(-7, -21); ctx.lineTo(-7, -30); ctx.lineTo(-3.5, -30); ctx.lineTo(-3.5, -24);
  ctx.lineTo(3.5, -24); ctx.lineTo(3.5, -30); ctx.lineTo(7, -30); ctx.lineTo(7, -21); ctx.lineTo(10.5, -21);
  ctx.lineTo(10.5, -16); ctx.quadraticCurveTo(10.5, -10.5, 5, -10.5); ctx.lineTo(-5, -10.5); ctx.quadraticCurveTo(-10.5, -10.5, -10.5, -16); ctx.closePath();
  shape(ch.overalls);
  // gold buttons
  for (const bx of [-5.2, 5.2]) { ctx.beginPath(); ctx.arc(bx, -23, 1.9, 0, 7); ctx.fillStyle = '#ffd84a'; ctx.fill(); ctx.lineWidth = 1; ctx.stroke(); }
  // emblem
  ctx.lineWidth = 1;
  if (ch.emblem === 'star') { star(0, -17, 4.6, 2.1); ctx.fillStyle = '#ffd84a'; ctx.fill(); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(1.6, -22); ctx.lineTo(-3.2, -16.4); ctx.lineTo(-0.3, -16.4); ctx.lineTo(-1.8, -12); ctx.lineTo(3.2, -17.8); ctx.lineTo(0.3, -17.8); ctx.closePath(); ctx.fillStyle = '#ffd84a'; ctx.fill(); ctx.stroke(); }
  ctx.lineWidth = 1.6;
  leg(air ? 0.4 : swing, false);
  arm(air ? -2.1 : -swing * 0.95, false);
  // head
  const bob = air ? 0 : Math.abs(Math.sin(run)) * -1.5;
  ctx.save(); ctx.translate(1, -28 + bob); ctx.rotate((o.tilt || 0));
  drawHead(who, 0, 0, 34);
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- draw world
function star(x, y, R, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  ctx.closePath();
}
function heart(x, y, s, c, outline = true) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.8);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.8);
  ctx.fillStyle = c; ctx.fill();
  if (outline) { ctx.strokeStyle = '#5a1a2a'; ctx.lineWidth = 2; ctx.stroke(); }
}

function drawStorm() {
  const edge = game.chaseX - game.cam.x, t = game.t; // screen x of the storm front
  if (edge < -500) return;
  if (edge < -40) { // off-screen but close: warn
    const a = 0.5 + Math.sin(t * 0.2) * 0.3;
    ctx.globalAlpha = a; ctx.fillStyle = '#5b2a86'; ctx.fillRect(0, 0, 10, VH); ctx.globalAlpha = 1;
    if (Math.floor(t / 20) % 2) text('⚡ STORM!', 16, VH / 2, 16, '#ffe14a', 'left', '#3a1a5a', 5);
    return;
  }
  const x = edge + 30;
  const g = ctx.createLinearGradient(x - 60, 0, x + 30, 0);
  g.addColorStop(0, 'rgba(50,25,85,.95)'); g.addColorStop(1, 'rgba(90,50,140,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 140, 0, 170, VH);
  ctx.fillStyle = '#4a2478';
  for (let i = 0; i < 9; i++) { const yy = i * 68 + Math.sin(t * 0.05 + i) * 8; ctx.beginPath(); ctx.arc(x - 34 + Math.sin(t * 0.07 + i * 2) * 6, yy, 44, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#6b3aa6';
  for (let i = 0; i < 9; i++) { const yy = i * 68 + 30 + Math.sin(t * 0.06 + i) * 8; ctx.beginPath(); ctx.arc(x - 20 + Math.cos(t * 0.05 + i) * 6, yy, 30, 0, 7); ctx.fill(); }
  // grumpy face
  const fy = VH * 0.42 + Math.sin(t * 0.05) * 10;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - 30, fy, 9, 11, 0, 0, 7); ctx.ellipse(x - 4, fy, 9, 11, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 27, fy + 2, 4, 0, 7); ctx.arc(x - 1, fy + 2, 4, 0, 7); ctx.fill();
  ctx.strokeStyle = '#1e0f33'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 42, fy - 16); ctx.lineTo(x - 22, fy - 9); ctx.moveTo(x + 8, fy - 16); ctx.lineTo(x - 12, fy - 9); ctx.stroke();
  ctx.beginPath(); ctx.arc(x - 16, fy + 30, 10, Math.PI + 0.3, -0.3); ctx.stroke();
  if (t % 50 < 6) { // lightning flicker
    ctx.strokeStyle = '#fff36b'; ctx.lineWidth = 3; ctx.beginPath(); const ly = (t * 37) % (VH - 120) + 20;
    ctx.moveTo(x - 20, ly); ctx.lineTo(x - 2, ly + 22); ctx.lineTo(x - 14, ly + 26); ctx.lineTo(x + 6, ly + 54); ctx.stroke();
  }
}

function drawPlayer(p) {
  if (p.gone) return;
  if (p.inv > 0 && Math.floor(p.inv / 4) % 2 === 0 && !p.dead) return;
  const x = p.x + p.w / 2 - Math.round(game.cam.x), y = p.y + p.h;
  if (p.onGround && !p.dead) shadow(x, y + 1, 15);
  if (p.star > 0) {
    drawGlow('rgba(255,240,150,.7)', 60, x, y - 28, 0.7);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = `hsl(${game.t * 12 % 360},100%,60%)`;
    ctx.beginPath(); ctx.ellipse(x, y - 26, 26, 34, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  if (p.wings && !p.dead) {
    ctx.save(); ctx.translate(x, y - 30); const f = p.onGround ? 0.1 : Math.sin(game.t * 0.5) * 0.5;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#7fc8ff'; ctx.lineWidth = 1.5;
    for (const s of [-1, 1]) { ctx.save(); ctx.scale(s, 1); ctx.rotate(f); ctx.beginPath(); ctx.ellipse(13, -4, 11, 6, -0.6, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
  drawKid(p.who, x, y, {
    face: p.face, run: p.anim, air: !p.onGround && !p.finished || p.dead, squash: p.squash,
    tilt: p.dead ? Math.sin(p.deadT * 0.3) * 0.4 : (p.onGround ? p.vx * 0.015 : 0)
  });
  if (game.mode === 2 && !p.dead) {
    text(p.idx === 0 ? 'P1' : 'P2', x, y - 70, 12, p.ch.color, 'center', '#222', 3);
  }
}

function drawHUD() {
  ctx.fillStyle = 'rgba(0,0,0,.28)'; rr(8, 8, 320 + (game.mode === 2 ? 150 : 44), 52, 12); ctx.fill();
  let hx = 18;
  for (const p of game.players) {
    drawHead(p.who, hx + 18, 54, 40);
    for (let i = 0; i < Math.max(3, p.hearts); i++) heart(hx + 46 + i * 20, 26, 8, i < p.hearts ? '#ff4d6d' : 'rgba(255,255,255,.3)');
    if (p.wings) text('🪽', hx + 46, 46, 14, '#fff', 'left', null);
    if (p.star > 0) text('⭐' + Math.ceil(p.star / 60), hx + 66, 46, 13, '#ffe14a', 'left', '#222', 3);
    hx += 150;
  }
  if (game.mode === 1) { // the friend waiting to tag in
    const p = game.players[0], other = p.who === 'ayla' ? 'kameel' : 'ayla';
    ctx.globalAlpha = 0.85; drawHead(other, hx + 6, 40, 26); ctx.globalAlpha = 1;
    text(TOUCH.on ? '⇄' : 'X ⇄', hx + 6, 51, 11, '#fff', 'center', '#222', 3);
    hx += 40;
  }
  // big stars
  for (let i = 0; i < 3; i++) {
    const low = VW / 2 - 60 < hx + 150, sx = low ? 28 + i * 34 : VW / 2 - 34 + i * 34, sy = low ? 82 : 28;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; star(sx, sy, 15, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (game.stars[i]) { ctx.fillStyle = '#ffd84a'; star(sx, sy, 13, 6); ctx.fill(); }
  }
  if (game.boss) {
    const bx = VW / 2 - 110;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(bx, VH - 54, 220, 40, 12); ctx.fill();
    text(BOSS[game.boss.kind].name, bx + 14, VH - 34, 13, '#ffb3c6', 'left', '#222', 3);
    for (let i = 0; i < 3; i++) heart(bx + 150 + i * 24, VH - 35, 9, i < game.boss.hp ? '#b14aed' : 'rgba(255,255,255,.25)');
  }
  text('×' + Math.max(0, game.lives), hx + 6, 34, 20, '#fff', 'left');
  ctx.save(); ctx.globalAlpha = 0.9; ctx.font = '700 12px Fredoka'; ctx.restore();
  text('lives', hx + 6, 50, 11, '#fff', 'left', '#222', 3);
  drawCoin(hx + 70, 33, 0, 10);
  text('×' + game.coins, hx + 86, 34, 20, '#fff', 'left');
  text(`World ${game.world + 1}: ${lv.name}  ·  ${diff().name}`, VW - 16, 88, 14, '#fff', 'right', '#222', 4);
  text('Score ' + game.score, VW - 16, 68, 18, '#ffe14a', 'right', '#222', 5);
  const secs = Math.max(0, Math.ceil(game.timeLeft / 60)), low = secs <= 30;
  const tcol = low ? (Math.floor(game.t / 15) % 2 ? '#ff5a5a' : '#fff') : '#fff';
  const tx0 = VW - 16, ty0 = 114, tsz = low ? 26 : 22;
  text(String(secs), tx0, ty0, tsz, tcol, 'right', '#222', 5);
  const tw = ctx.measureText(String(secs)).width;
  // little clock icon
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(tx0 - tw - 16, ty0, 9, 0, 7); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx0 - tw - 16, ty0 - 5.5); ctx.lineTo(tx0 - tw - 16, ty0); ctx.lineTo(tx0 - tw - 12, ty0 + 2); ctx.stroke();
}

function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(30,20,50,.82)'; rr(x, y, w, h, 20); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.stroke();
}

function drawTitle() {
  drawBackground('meadow', game.t * 1.2);
  // ground strip
  const scroll = Math.round(game.t * 1.2);
  for (let tx = Math.floor(scroll / 32); tx * 32 - scroll < VW; tx++) for (let r = 0; r < 3; r++) {
    const v = hash(tx, r) % 4;
    blit(sprite(`gmeadow${r ? 0 : 1}00${v}0`, 32, 32, 7, g => paintGround(g, 'meadow', r ? 0 : 1, 0, 0, v, 0)), tx * 32 - scroll, 466 + r * 32);
    if (!r && hash(tx * 13 + 5, 77) % 23 < DECOR.meadow.length) blit(sprite('dmeadow' + hash(tx * 13 + 5, 77) % 23, 32, 32, 2, DECOR.meadow[hash(tx * 13 + 5, 77) % 23]), tx * 32 - scroll, 434);
  }
  for (let i = 0; i < 12; i++) drawCoin(((i * 90 - game.t * 1.2) % 1080 + 1080) % 1080 - 60, 140 + Math.sin(i + game.t * 0.04) * 6, game.t + i * 10, 9);
  // title
  ctx.save(); ctx.translate(VW / 2, 70); ctx.rotate(Math.sin(game.t * 0.03) * 0.02);
  const tk = Math.min(1, VW / 860);
  text("AYLA & KAMEEL'S", 0, -14, 34 * tk, '#fff', 'center', '#7a2a9a', 9);
  text('SUPER OBSTACLE COURSE!', 0, 30, 46 * tk, '#ffe14a', 'center', '#c2185b', 10);
  ctx.restore();
  menuButtons.length = 0;
  const opts = [
    { who: ['ayla'], label: 'Ayla', sub: CHARS.ayla.tag, color: CHARS.ayla.color },
    { who: ['kameel'], label: 'Kameel', sub: CHARS.kameel.tag, color: CHARS.kameel.color },
    { who: ['ayla', 'kameel'], label: '2 Players', sub: 'Play together!', color: '#ffb02e' },
  ];
  opts.forEach((o, i) => {
    const bw = Math.min(240, (VW - 50) / 3 - 14), gap = Math.min(30, bw * 0.1), ks = bw / 240;
    const bx = (VW - 3 * bw - 2 * gap) / 2 + i * (bw + gap), by = 140, bh = 300, sel = game.sel === i;
    const lift = sel ? -8 + Math.sin(game.t * 0.1) * 3 : 0;
    ctx.fillStyle = sel ? o.color : 'rgba(255,255,255,.75)'; rr(bx, by + lift, bw, bh, 22); ctx.fill();
    ctx.strokeStyle = sel ? '#fff' : 'rgba(0,0,0,.15)'; ctx.lineWidth = sel ? 6 : 2; ctx.stroke();
    const n = o.who.length;
    o.who.forEach((w, k) => {
      const kx = bx + bw / 2 + (n === 2 ? (k ? 45 : -45) * ks : 0);
      const jump = sel ? Math.abs(Math.sin(game.t * 0.12 + k)) * -14 : 0;
      drawKid(w, kx, by + 215 + lift + jump, { scale: (n === 2 ? 2.1 : 2.8) * Math.max(0.8, ks), run: sel ? game.t * 0.25 : 0, face: n === 2 && k ? -1 : 1 });
    });
    text(o.label, bx + bw / 2, by + 245 + lift, Math.round(32 * ks), '#fff', 'center', '#2b1a3a', 7);
    text(o.sub, bx + bw / 2, by + 278 + lift, Math.round(18 * ks), sel ? '#fff' : '#5a3a7a', 'center', sel ? '#2b1a3a' : null, 4);
    menuButtons.push({ x: bx, y: by, w: bw, h: bh, act: 'sel', v: i });
  });
  // world chooser (left) and difficulty chooser (right)
  const wy = 478, wx = VW * 0.27, dx = VW * 0.75, aw = Math.min(150, VW * 0.19), fs = VW < 800 ? 17 : 21;
  if (game.unlocked > 1) {
    text('◀', wx - aw, wy + 22, 24, '#fff'); text('▶', wx + aw, wy + 22, 24, '#fff');
    menuButtons.push({ x: wx - aw - 30, y: wy - 4, w: 60, h: 52, act: 'world', v: -1 }, { x: wx + aw - 30, y: wy - 4, w: 60, h: 52, act: 'world', v: 1 });
  }
  const bs = game.bestStars[game.world] || 0;
  text(`World ${game.world + 1}: ${LEVELS[game.world].name}`, wx, wy + 12, fs, '#fff');
  text('★'.repeat(bs) + '☆'.repeat(3 - bs), wx, wy + 36, 17, '#ffe14a', 'center', '#222', 4);
  const df = diff();
  text('◀', dx - aw * 0.75, wy + 22, 24, '#fff'); text('▶', dx + aw * 0.75, wy + 22, 24, '#fff');
  menuButtons.push({ x: dx - aw * 0.75 - 30, y: wy - 4, w: 60, h: 52, act: 'diff', v: -1 }, { x: dx + aw * 0.75 - 30, y: wy - 4, w: 60, h: 52, act: 'diff', v: 1 });
  text(df.name, dx, wy + 12, fs + 3, df.color, 'center', '#222', 5);
  text(df.time[game.world] + ' seconds', dx, wy + 36, 15, '#fff', 'center', '#222', 4);
  const blink = Math.floor(game.t / 30) % 2;
  if (blink) text(TOUCH.on ? 'Tap a player to start!' : 'Click a player, or press ENTER, to start!', VW / 2, 452, 16, '#ffe14a', 'center', '#222', 4);
  text(game.best ? 'Best ' + game.best : '', VW - 12, 532, 13, '#fff', 'right', '#222', 3);
  if (!TOUCH.on && VW > 900) text('↑ ↓ difficulty  ·  1-4 world  ·  Space jump  ·  X swap kid', 12, 534, 12, '#fff', 'left', '#222', 3);
}

function drawIntro() {
  const a = Math.min(1, game.timer / 20);
  ctx.fillStyle = `rgba(20,10,40,${0.75 * (game.timer > 110 ? (130 - game.timer) / 20 : 1)})`; ctx.fillRect(0, 0, VW, VH);
  if (game.timer > 110) return;
  ctx.globalAlpha = a;
  text(`WORLD ${game.world + 1}`, VW / 2, 170, 34, '#ffe14a', 'center', '#c2185b', 8);
  text(lv.name, VW / 2, 225, 56, '#fff', 'center', '#7a2a9a', 10);
  game.players.forEach((p, i) => {
    const n = game.players.length;
    drawKid(p.who, VW / 2 + (n === 2 ? (i ? 60 : -60) : 0), 400 + Math.abs(Math.sin(game.t * 0.15 + i)) * -16, { scale: 2.2, run: game.t * 0.3, face: 1 });
  });
  text('Lives × ' + game.lives, VW / 2, 450, 22, '#fff');
  const swapTip = game.mode === 1 ? (TOUCH.on ? '  Tap ⇄ to swap kids!' : '  Press X to swap kids!') : '';
  text(THEMES[lv.theme].tip + (game.world === 0 ? swapTip : ''), VW / 2, 490, VW < 800 ? 15 : 18, '#bff', 'center', '#222', 4);
  ctx.globalAlpha = 1;
}

function drawDone() {
  panel(VW / 2 - 260, 110, 520, 320);
  text('LEVEL COMPLETE!', VW / 2, 160, 44, '#ffe14a', 'center', '#c2185b', 9);
  for (let i = 0; i < 3; i++) {
    const sx = VW / 2 - 70 + i * 70, on = game.stars[i] && game.timer > 20 + i * 18;
    ctx.fillStyle = 'rgba(255,255,255,.18)'; star(sx, 222, 28, 13); ctx.fill();
    if (on) { ctx.fillStyle = '#e8a800'; star(sx, 222, 28, 13); ctx.fill(); ctx.fillStyle = '#ffd84a'; star(sx, 222, 23, 11); ctx.fill(); }
  }
  game.players.forEach((p, i) => drawKid(p.who, VW / 2 + (i ? 190 : -190), 330 + Math.abs(Math.sin(game.t * 0.15 + i)) * -16, { scale: 1.7, run: game.t * 0.2, face: i ? -1 : 1 }));
  drawCoin(VW / 2 - 90, 300, game.t, 12);
  text(`${game.levelCoins} / ${game.totalCoins} coins`, VW / 2 + 10, 301, 24, '#fff');
  const s = Math.floor(game.levelTime / 60);
  text(`Time ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}   ·   Time bonus +${game.timeBonus || 0}   ·   Score ${game.score}`, VW / 2, 345, 18, '#fff');
  if (game.timer > 30 && Math.floor(game.t / 25) % 2) text(TOUCH.on ? 'Tap for the next world!' : 'Press ENTER for the next world!', VW / 2, 395, 18, '#bff', 'center', '#222', 4);
}
function drawGameOver() {
  ctx.fillStyle = 'rgba(20,10,40,.8)'; ctx.fillRect(0, 0, VW, VH);
  text('GAME OVER', VW / 2, 200, 64, '#ff6b8b', 'center', '#fff', 8);
  text("Don't give up! You can do it!", VW / 2, 270, 26, '#fff');
  game.players.forEach((p, i) => drawKid(p.who, VW / 2 + (game.players.length === 2 ? (i ? 60 : -60) : 0), 400, { scale: 2, tilt: Math.sin(game.t * 0.05) * 0.2 }));
  if (game.timer > 40 && Math.floor(game.t / 25) % 2) text('Press ENTER or tap to try again', VW / 2, 450, 20, '#ffe14a', 'center', '#222', 4);
}
function drawVictory() {
  const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#2a1a5a'); g.addColorStop(1, '#ff7db0');
  ctx.fillStyle = 'rgba(20,10,40,.55)'; ctx.fillRect(0, 0, VW, VH);
  text('YOU WON!!!', VW / 2, 120, 76, '#ffe14a', 'center', '#c2185b', 12);
  text('Ayla & Kameel saved the day!', VW / 2, 185, 30, '#fff', 'center', '#7a2a9a', 8);
  const both = ['ayla', 'kameel'];
  both.forEach((w, i) => drawKid(w, VW / 2 + (i ? 110 : -110), 400 + Math.abs(Math.sin(game.t * 0.13 + i * 1.5)) * -40, { scale: 3, run: game.t * 0.2, face: i ? -1 : 1 }));
  text('Final score: ' + game.score + '   ·   Coins: ' + game.coins, VW / 2, 445, 24, '#fff');
  if (game.timer > 40 && Math.floor(game.t / 25) % 2) text('Press ENTER or tap to play again', VW / 2, 490, 20, '#bff', 'center', '#222', 4);
  drawParticles();
}

function draw() {
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  layoutTouch();
  ctx.save();
  if (game.state === 'title') { drawTitle(); ctx.restore(); return; }
  if (game.shake > 0) { ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake); game.shake *= 0.85; if (game.shake < 0.5) game.shake = 0; }
  drawBackground(lv.theme, game.cam.x);
  drawTiles();
  for (const e of game.ents) if (e.k !== 'item') drawEnt(e);
  for (const e of game.ents) if (e.k === 'item') drawEnt(e);
  for (const p of game.players) drawPlayer(p);
  drawLights();
  if (game.chaseX !== null) drawStorm();
  drawParticles();
  ctx.restore();
  drawHUD();
  if (game.state === 'intro') drawIntro();
  if (game.state === 'done') drawDone();
  if (game.state === 'gameover') drawGameOver();
  if (game.state === 'victory') drawVictory();
  if (game.state === 'paused') { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, VW, VH); text('PAUSED', VW / 2, VH / 2 - 10, 60); text('Press P or tap to keep playing', VW / 2, VH / 2 + 45, 20, '#bff'); }
}

// ---------------------------------------------------------------- loop & sizing
let RS = 1; // render scale: canvas pixels per game unit
function fit() {
  const vv = window.visualViewport;
  const W = vv ? vv.width : innerWidth, Hh = vv ? vv.height : innerHeight;
  const portrait = Hh > W * 1.05;
  document.body.classList.toggle('portrait', portrait);
  // the view gets wider on wide screens (phones in landscape) so the game fills the display
  const aspect = portrait ? 1.36 : Math.max(1.45, Math.min(2.3, W / Hh));
  VW = Math.round(VH * aspect);
  const s = Math.min(W / VW, (Hh - (portrait ? 40 : 0)) / VH);
  cv.style.width = Math.floor(VW * s) + 'px'; cv.style.height = Math.floor(VH * s) + 'px';
  RS = Math.min(2, s * Math.min(2, window.devicePixelRatio || 1));
  cv.width = Math.round(VW * RS); cv.height = Math.round(VH * RS);
  TOUCH.sig = '';
}
addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 200));
if (window.visualViewport) visualViewport.addEventListener('resize', fit);
fit();

let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) {
    if (game.state === 'title') game.t++; else if (game.state !== 'paused') update();
    acc -= 1000 / 60;
  }
  draw();
  requestAnimationFrame(frame);
}
if (params.has('level') && DEBUG) { game.world = Math.max(0, Math.min(LEVELS.length - 1, +params.get('level') - 1)); }
requestAnimationFrame(frame);
Object.defineProperty(window, '__game', { get: () => game });
if (DEBUG) window.__dbg = {
  snap: () => structuredClone({ game, lv, bump: [...bumpAnim], cannon: [...cannonTimers] }),
  restore(st) {
    const c = structuredClone(st); game = c.game; lv = c.lv; parts = []; popups = [];
    bumpAnim.clear(); c.bump.forEach(([k, v]) => bumpAnim.set(k, v)); cannonTimers.clear(); c.cannon.forEach(([k, v]) => cannonTimers.set(k, v));
  },
  step(inp, n) { botInput = inp; for (let i = 0; i < n; i++) update(); },
  sim(v) { SIM = v; }, release() { botInput = null; },
};
