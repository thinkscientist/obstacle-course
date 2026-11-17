// Ayla & Kameel's Super Obstacle Course
// A canvas platformer. No libraries, no build step.
'use strict';

const T = 32, H = 17, VW = 960, VH = 544, GT = 14;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

// ---------------------------------------------------------------- images
const IMG = {};
function loadImg(k, src) { const i = new Image(); i.src = src; IMG[k] = i; }
loadImg('ayla', 'assets/ayla-head.png');
loadImg('kameel', 'assets/kameel-head.png');

// ---------------------------------------------------------------- characters
const CHARS = {
  ayla: {
    name: 'Ayla', speed: 4.1, jump: 11.8, tag: 'Super Jumper!',
    skin: '#c08a66', shirt: '#ece1d0', pants: '#e6dac8', trim: '#d8cbb6',
    longSleeves: true, longPants: true, socks: null, print: 'penguin', color: '#ff6fa8'
  },
  kameel: {
    name: 'Kameel', speed: 4.9, jump: 11.0, tag: 'Super Speedy!',
    skin: '#b07a5a', shirt: '#e9dfca', pants: '#e3d8c2', trim: '#d3c6ae',
    longSleeves: false, longPants: false, socks: '#f4f4f4', print: 'smiley', color: '#4fb3ff'
  }
};

// ---------------------------------------------------------------- audio
const AU = { ctx: null, master: null, muted: false, music: null, step: 0, next: 0, timer: null };
try { AU.muted = localStorage.getItem('ak_muted') === '1'; } catch (e) {}
function initAudio() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
    AU.master = AU.ctx.createGain();
    AU.master.gain.value = AU.muted ? 0 : 0.5;
    AU.master.connect(AU.ctx.destination);
  } catch (e) { AU.ctx = null; }
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function tone(freq, dur, type = 'square', vol = 0.12, slide = null, when = 0) {
  if (!AU.ctx) return;
  const t0 = when || AU.ctx.currentTime;
  const o = AU.ctx.createOscillator(), g = AU.ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(g); g.connect(AU.master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur, vol = 0.15) {
  if (!AU.ctx) return;
  const n = AU.ctx.sampleRate * dur, b = AU.ctx.createBuffer(1, n, AU.ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = AU.ctx.createBufferSource(), g = AU.ctx.createGain();
  s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(AU.master); s.start();
}
const SFX = {
  jump: () => tone(380, 0.16, 'square', 0.08, 760),
  dbl: () => { tone(600, 0.12, 'triangle', 0.12, 1200); },
  coin: () => { tone(988, 0.07, 'square', 0.07); const t = AU.ctx && AU.ctx.currentTime + 0.07; tone(1319, 0.22, 'square', 0.07, null, t); },
  stomp: () => tone(260, 0.14, 'square', 0.13, 70),
  bump: () => tone(140, 0.08, 'square', 0.12, 90),
  brk: () => noise(0.18, 0.2),
  spring: () => tone(180, 0.35, 'triangle', 0.18, 900),
  hurt: () => tone(420, 0.35, 'sawtooth', 0.12, 110),
  die: () => { if (!AU.ctx) return; const t = AU.ctx.currentTime; [72, 67, 64, 60, 55].forEach((m, i) => tone(mtof(m), 0.18, 'square', 0.1, null, t + i * 0.13)); },
  power: () => { if (!AU.ctx) return; const t = AU.ctx.currentTime; [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => tone(mtof(m), 0.1, 'square', 0.08, null, t + i * 0.06)); },
  check: () => { if (!AU.ctx) return; const t = AU.ctx.currentTime; [72, 76, 79].forEach((m, i) => tone(mtof(m), 0.15, 'triangle', 0.15, null, t + i * 0.09)); },
  win: () => { if (!AU.ctx) return; const t = AU.ctx.currentTime; [67, 72, 76, 79, 84, 79, 84, 88].forEach((m, i) => tone(mtof(m), 0.22, 'square', 0.09, null, t + i * 0.12)); },
  shoot: () => noise(0.12, 0.12),
  oneup: () => { if (!AU.ctx) return; const t = AU.ctx.currentTime; [76, 79, 88, 84, 86, 91].forEach((m, i) => tone(mtof(m), 0.12, 'square', 0.08, null, t + i * 0.09)); },
  select: () => tone(660, 0.08, 'square', 0.08, 990),
};

const SONGS = {
  title: { tempo: 128, mel: [72,0,76,79,84,0,79,0,81,0,77,81,79,0,0,0,76,0,79,84,88,0,86,84,83,0,79,83,84,0,0,0],
           bass: [48,0,55,0,52,0,55,0,53,0,57,0,55,0,59,0,48,0,55,0,57,0,53,0,55,0,50,0,48,0,55,0] },
  meadow: { tempo: 140, mel: [72,0,76,79,81,0,79,76,74,0,77,81,79,0,0,0,72,0,76,79,84,0,83,81,79,77,76,74,72,0,0,0],
            bass: [48,0,55,0,53,0,55,0,50,0,57,0,55,0,59,0,48,0,55,0,53,0,57,0,55,0,55,0,48,0,55,0] },
  ice: { tempo: 124, mel: [69,0,72,76,74,72,71,0,67,0,71,74,72,71,69,0,69,0,72,76,79,77,76,74,72,71,69,71,69,0,0,0],
         bass: [45,0,52,0,43,0,50,0,41,0,48,0,40,0,47,0,45,0,52,0,43,0,50,0,41,0,40,0,45,0,52,0], wave: 'triangle' },
  sky: { tempo: 150, mel: [77,81,84,81,77,0,72,0,74,77,81,77,74,0,0,0,76,79,84,79,76,0,72,0,77,76,74,72,77,0,0,0],
         bass: [41,0,48,0,41,0,48,0,38,0,45,0,38,0,45,0,36,0,43,0,36,0,43,0,41,0,43,0,41,0,48,0] },
  castle: { tempo: 160, mel: [62,0,62,65,62,0,69,68,67,0,65,0,64,65,64,61,62,0,62,65,62,0,70,69,67,65,64,65,62,0,0,0],
            bass: [38,38,0,38,38,0,38,0,34,34,0,34,36,0,37,0,38,38,0,38,38,0,38,0,34,34,0,34,33,0,37,0] },
  win: { tempo: 150, mel: [72,76,79,84,79,76,72,76,77,81,84,89,84,81,77,81,79,83,86,91,86,83,79,83,84,0,84,0,84,0,0,0],
         bass: [48,0,48,0,48,0,48,0,53,0,53,0,53,0,53,0,55,0,55,0,55,0,55,0,48,0,55,0,48,0,0,0] },
};
function playSong(name) {
  if (AU.music === name) return;
  AU.music = name; AU.step = 0;
  if (AU.ctx) AU.next = AU.ctx.currentTime + 0.05;
  if (!AU.timer) AU.timer = setInterval(musicTick, 25);
}
function stopSong() { AU.music = null; }
function musicTick() {
  if (!AU.ctx || !AU.music) return;
  const s = SONGS[AU.music];
  const fast = game && game.state === 'play' && game.players.some(p => p.star > 0);
  const stepDur = 60 / (s.tempo * (fast ? 1.35 : 1)) / 2;
  if (AU.next < AU.ctx.currentTime) AU.next = AU.ctx.currentTime + 0.02;
  while (AU.next < AU.ctx.currentTime + 0.12) {
    const i = AU.step % s.mel.length;
    if (s.mel[i]) tone(mtof(s.mel[i] + (fast ? 12 : 0)), stepDur * 0.9, s.wave || 'square', 0.045, null, AU.next);
    if (s.bass[i]) tone(mtof(s.bass[i]), stepDur * 0.95, 'triangle', 0.09, null, AU.next);
    if (i % 4 === 0) { /* soft tick */ tone(2000, 0.02, 'square', 0.006, null, AU.next); }
    AU.next += stepDur; AU.step++;
  }
}
function setMuted(m) {
  AU.muted = m;
  if (AU.master) AU.master.gain.value = m ? 0 : 0.5;
  document.getElementById('mute').textContent = m ? '🔇' : '🔊';
  try { localStorage.setItem('ak_muted', m ? '1' : '0'); } catch (e) {}
}

// ---------------------------------------------------------------- themes
const THEMES = {
  meadow: { song: 'meadow', sky: ['#5fbfff', '#c9efff'], dirt: '#9a6232', dirtDark: '#7a4a22', top: '#5ccf4a', topDark: '#3a9e33',
            brick: '#d0703a', brickLine: '#8a3f17', plank: '#b8834a' },
  ice: { song: 'ice', sky: ['#86c5f2', '#eef8ff'], dirt: '#7fa9cf', dirtDark: '#5f88b0', top: '#ffffff', topDark: '#cfe6f8',
         brick: '#8fc6ea', brickLine: '#4f8cb8', plank: '#bfe3fa' },
  sky: { song: 'sky', sky: ['#ff9fd0', '#ffe8b0'], dirt: '#b77de0', dirtDark: '#935cc0', top: '#ffd4f2', topDark: '#f3a8de',
         brick: '#ff9c6b', brickLine: '#c4572b', plank: '#fff' },
  castle: { song: 'castle', sky: ['#1c0b18', '#4a1414'], dirt: '#6d6c7d', dirtDark: '#4b4a5a', top: '#8b8aa0', topDark: '#5e5d72',
            brick: '#7f5a5a', brickLine: '#3e2626', plank: '#7a5a3a' },
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
      .e('s', 118, 13).e('g', 122, 13).e('g', 125, 13)
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
      .row(125, 135, 6, 'I').e('icicle', 127, 7).e('icicle', 130, 7).e('icicle', 133, 7).e('g', 129, 13).coins(126, 134, 11)
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
      .e('g', 117, 10).e('g', 120, 10).e('g', 122, 10).e('g', 124, 10)
      .row(128, 131, 9, '=').row(134, 137, 7, '=').row(140, 143, 9, '=').coins(128, 131, 8).coins(134, 137, 6).coins(140, 143, 8)
      .e('b', 132, 5).e('b', 139, 4)
      .e('vplat', 146, 11, { w: 3, range: 4 * T }).t(147, 4, '+')
      .ground(151, 195, 12).e('check', 152, 11).e('s', 158, 11)
      .stairs(162, 6, 1, 12).e('goal', 174, 11);
    L.push(b.lv);
  }
  // ---------- World 4: Lava Castle
  {
    const b = builder(196, 'castle', 'Lava Castle');
    b.fill(0, 0, 195, 1, '#').ground(0, 20).coins(4, 7, 11)
      .t(12, 11, 'U').e('firebar', 12, 11, { len: 3, speed: 0.035 })
      .lava(21, 24).ground(26, 45).e('crusher', 30, 2).e('crusher', 36, 2)
      .t(40, 10, '?').t(41, 10, '+').t(44, 13, 'T')
      .lava(46, 50).e('mplat', 46, 11, { w: 2, range: 2.5 * T })
      .ground(51, 80).e('check', 52, 13).t(58, 10, 'U').e('firebar', 58, 10, { len: 4, speed: -0.03 })
      .e('s', 63, 13).e('s', 67, 13).row(70, 74, 10, 'B').t(72, 10, '*').t(76, 13, 'S').t(77, 13, 'S')
      .lava(81, 88).e('fall', 82, 11, { w: 2 }).e('fall', 85, 10, { w: 2 }).coins(82, 83, 9).coins(85, 86, 8)
      .ground(89, 120).t(95, 13, '#').t(95, 12, 'T').e('crusher', 100, 2).e('crusher', 105, 2).e('crusher', 110, 2)
      .e('g', 102, 13).e('g', 108, 13).e('check', 116, 13)
      .lava(121, 127).e('vplat', 122, 12, { w: 2, range: 3 * T }).e('vplat', 125, 9, { w: 2, range: 3 * T, phase: Math.PI })
      .ground(128, 195).t(135, 10, 'U').e('firebar', 135, 10, { len: 5, speed: 0.04 }).coins(132, 138, 7)
      .t(145, 10, 'U').e('firebar', 145, 10, { len: 4, speed: -0.045 }).t(141, 6, '+')
      .t(150, 13, 'S').t(151, 13, 'S').t(155, 13, 'T').e('s', 158, 13)
      .stairs(163, 6).e('goal', 176, 13);
    L.push(b.lv);
  }
  return L;
}
const LEVELS = buildLevels();

// ---------------------------------------------------------------- input
const keys = {};
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) onPress(e.code);
  keys[e.code] = true; initAudio();
});
addEventListener('keyup', e => { keys[e.code] = false; });
const touch = { l: false, r: false, j: false };
function bindTouch(id, k) {
  const el = document.getElementById(id);
  const on = e => { e.preventDefault(); touch[k] = true; el.classList.add('down'); initAudio(); if (k === 'j') onPress('Touch'); };
  const off = e => { e.preventDefault(); touch[k] = false; el.classList.remove('down'); };
  el.addEventListener('touchstart', on, { passive: false }); el.addEventListener('touchend', off); el.addEventListener('touchcancel', off);
  el.addEventListener('mousedown', on); el.addEventListener('mouseup', off); el.addEventListener('mouseleave', off);
}
bindTouch('tl', 'l'); bindTouch('tr', 'r'); bindTouch('tj', 'j');
addEventListener('touchstart', () => { document.getElementById('touch').classList.add('on'); }, { once: true });

function canvasPoint(e) {
  const r = cv.getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  return { x: (p.clientX - r.left) / r.width * VW, y: (p.clientY - r.top) / r.height * VH };
}
cv.addEventListener('mousedown', e => { initAudio(); onClick(canvasPoint(e)); });
cv.addEventListener('touchstart', e => { initAudio(); onClick(canvasPoint(e)); e.preventDefault(); }, { passive: false });
document.getElementById('mute').onclick = () => { initAudio(); setMuted(!AU.muted); };
document.getElementById('pause').onclick = () => togglePause();
setMuted(AU.muted);

function readInput(p) {
  let l, r, j;
  if (game.mode === 2) {
    if (p.idx === 0) { l = keys.KeyA; r = keys.KeyD; j = keys.KeyW || keys.Space; }
    else { l = keys.ArrowLeft; r = keys.ArrowRight; j = keys.ArrowUp || keys.Enter; }
    if (p.idx === 0) { l = l || touch.l; r = r || touch.r; j = j || touch.j; }
  } else {
    l = keys.ArrowLeft || keys.KeyA || touch.l;
    r = keys.ArrowRight || keys.KeyD || touch.r;
    j = keys.ArrowUp || keys.KeyW || keys.Space || keys.KeyZ || touch.j;
  }
  const inp = p.input;
  inp.jPressed = !!j && !inp.j;
  inp.l = !!l; inp.r = !!r; inp.j = !!j;
}

// ---------------------------------------------------------------- world helpers
const SOLID = new Set(['#', 'B', 'U', '?', '!', '*', '+', 'I', 'T']);
let lv = null;
function tile(tx, ty) {
  if (tx < 0 || tx >= lv.w) return '#';
  if (ty < 0 || ty >= H) return '.';
  return lv.g[ty][tx];
}
function setTile(tx, ty, c) { if (tx >= 0 && tx < lv.w && ty >= 0 && ty < H) lv.g[ty][tx] = c; }
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
  fireworks: [], best: 0, levelTime: 0,
};
try { game.unlocked = Math.max(1, Math.min(LEVELS.length, +localStorage.getItem('ak_unlocked') || 1)); game.best = +localStorage.getItem('ak_best') || 0; } catch (e) {}
if (DEBUG) game.unlocked = LEVELS.length;

function makePlayer(who, idx) {
  return { who, idx, ch: CHARS[who], x: 0, y: 0, w: 22, h: 50, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, jbuf: 0,
    hearts: 3, inv: 0, wings: false, usedDbl: false, star: 0, dead: false, deadT: 0, gone: false, anim: 0, squash: 0,
    plat: null, finished: false, input: { l: false, r: false, j: false, jPressed: false }, groundTile: null, blink: 0 };
}

function startGame(mode, who) {
  game.mode = mode;
  game.players = mode === 2 ? [makePlayer('ayla', 0), makePlayer('kameel', 1)] : [makePlayer(who, 0)];
  game.score = 0; game.coins = 0; game.lives = 5;
  loadLevel(game.world);
}

function loadLevel(i) {
  game.world = i;
  const src = LEVELS[i];
  lv = { w: src.w, theme: src.theme, name: src.name, g: src.g.map(r => r.slice()), start: src.start };
  game.ents = []; parts = []; popups = []; game.fireworks = [];
  game.totalCoins = 0; game.levelCoins = 0; game.levelTime = 0;
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
  p.inv = 100; p.vy = -7; p.vx = -p.face * 3; SFX.hurt();
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
  else { p.x = game.check.x; p.y = game.check.y - p.h; }
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

function defeat(e, p, how = 'stomp') {
  if (!e.alive) return;
  e.alive = false; e.deadT = 0; e.how = how;
  if (how !== 'stomp') { e.vy = -7; e.vx = (p ? Math.sign(e.x - p.x) || 1 : 1) * 2; }
  game.score += 200; popup(e.x + e.w / 2, e.y, '+200', '#fff');
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
  game.levelTime++;

  // entities first (platforms move, riders carried)
  for (const e of game.ents) updateEnt(e);
  for (const p of game.players) updatePlayer(p);
  if (game.mode === 2) coopClamp();
  updateCamera(false);
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
  else tx = live[0].x - VW * 0.38;
  tx = Math.max(0, Math.min(lv.w * T - VW, tx));
  game.cam.x = snap ? tx : game.cam.x + (tx - game.cam.x) * 0.12;
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
  const max = ch.speed * (p.star > 0 ? 1.15 : 1);
  if (inp.l && !inp.r) { p.vx = Math.max(-max, p.vx - accel); p.face = -1; }
  else if (inp.r && !inp.l) { p.vx = Math.min(max, p.vx + accel); p.face = 1; }
  else { if (Math.abs(p.vx) <= fric) p.vx = 0; else p.vx -= Math.sign(p.vx) * fric * (p.onGround ? 1 : 1) * (icy ? 1 : 1.2); }

  if (p.onGround) { p.coyote = 7; p.usedDbl = false; } else if (p.coyote > 0) p.coyote--;
  if (inp.jPressed) p.jbuf = 8; else if (p.jbuf > 0) p.jbuf--;
  if (p.jbuf > 0 && p.coyote > 0) {
    p.vy = -ch.jump; p.coyote = 0; p.jbuf = 0; p.onGround = false; p.squash = -8; SFX.jump();
  } else if (inp.jPressed && !p.onGround && p.coyote <= 0 && p.wings && !p.usedDbl) {
    p.vy = -ch.jump * 0.92; p.usedDbl = true; p.jbuf = 0; SFX.dbl();
    for (let i = 0; i < 8; i++) parts.push({ x: p.x + p.w / 2 + (Math.random() - 0.5) * 20, y: p.y + p.h, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2, life: 30, color: '#fff', size: 5, grav: 0 });
  }
  const grav = (inp.j && p.vy < 0) ? 0.45 : 0.9;
  p.vy = Math.min(13, p.vy + grav);

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
        burst(e.x + 8, e.y + 10, '#7dff7d', 16, 4); popup(e.x + 8, e.y - 10, 'CHECKPOINT!', '#7dff7d');
        game.players.forEach(q => { if (!q.dead) q.hearts = Math.max(q.hearts, 3); });
      }
      continue;
    }
    if (e.k === 'goal') { if (p.x + p.w > e.x && p.x < e.x + e.w + 4) reachGoal(p, e); continue; }
    if (e.plat) continue;
    if (e.k === 'firebar') {
      for (let i = 0; i < e.len; i++) {
        const r = 14 + i * 15, fx = e.cx + Math.cos(e.ang) * r, fy = e.cy + Math.sin(e.ang) * r;
        if (fx > p.x - 6 && fx < p.x + p.w + 6 && fy > p.y - 6 && fy < p.y + p.h + 6) { hurt(p); break; }
      }
      continue;
    }
    if (!overlap(p, e)) continue;
    if (e.k === 'crusher' || e.k === 'icicle') { if (p.star > 0 && e.k === 'icicle') { e.alive = false; burst(e.x + 8, e.y + 14, '#bfe9ff', 12); } else hurt(p); continue; }
    // enemies
    if (p.star > 0) { defeat(e, p, 'star'); SFX.stomp(); continue; }
    const stompable = e.stomp;
    if (stompable && p.vy > 0 && p.prevBottom <= e.y + 10) {
      defeat(e, p, 'stomp'); SFX.stomp();
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
  game.score += bonus; popup(e.x, p.y - 10, '+' + bonus, '#ffe14a');
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
  const go = code === 'Enter' || code === 'Space' || code === 'Touch';
  if (game.state === 'title') {
    initAudio(); playSong('title');
    if (code === 'ArrowLeft' || code === 'KeyA') { game.sel = (game.sel + 2) % 3; SFX.select(); }
    if (code === 'ArrowRight' || code === 'KeyD') { game.sel = (game.sel + 1) % 3; SFX.select(); }
    if (code === 'ArrowUp' || code === 'KeyW') { game.world = (game.world + game.unlocked - 1) % game.unlocked; SFX.select(); }
    if (code === 'ArrowDown' || code === 'KeyS') { game.world = (game.world + 1) % game.unlocked; SFX.select(); }
    if (go) chooseSel();
  } else if (game.state === 'done') { if (go && game.timer > 30) loadLevel(game.world + 1); }
  else if (game.state === 'gameover' || game.state === 'victory') {
    if (go && game.timer > 40) { if (game.state === 'gameover') { game.lives = 5; game.score = 0; game.coins = 0; game.players.forEach(p => p.hearts = 3); loadLevel(game.world); } else toTitle(); }
  }
  if (DEBUG && code === 'KeyN' && game.state === 'play') { const g = game.ents.find(e => e.k === 'goal'); const p = game.players[0]; p.x = g.x - 40; p.y = g.y + g.h - p.h; }
  if (DEBUG && code === 'KeyF' && game.state === 'play') { game.players.forEach(p => { p.x += 20 * T; p.y = 2 * T; }); }
}
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
      if (b.act === 'sel') { if (game.sel === b.v) chooseSel(); else { game.sel = b.v; SFX.select(); } }
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
function drawHead(who, x, y, hh) {
  const im = IMG[who];
  if (im.complete && im.naturalWidth) {
    const w = hh * im.naturalWidth / im.naturalHeight;
    ctx.drawImage(im, x - w / 2, y - hh, w, hh);
  } else { ctx.fillStyle = CHARS[who].skin; ctx.beginPath(); ctx.arc(x, y - hh / 2, hh / 2, 0, 7); ctx.fill(); }
}

// Draw a kid: x = center, y = feet
function drawKid(who, x, y, o = {}) {
  const ch = CHARS[who];
  const face = o.face || 1, run = o.run || 0, air = o.air || false, scale = o.scale || 1;
  const squash = o.squash || 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face * scale * (1 + squash * 0.02), scale * (1 - squash * 0.025));
  const swing = air ? 0.6 : Math.sin(run) * 0.75;
  const outline = '#3a2a2a';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // legs
  const leg = (ang, back) => {
    ctx.save(); ctx.translate(back ? -2 : 2, -16); ctx.rotate(ang);
    if (ch.longPants) {
      ctx.fillStyle = back ? ch.trim : ch.pants; rr(-4, 0, 8, 13, 3); ctx.fill();
      ctx.fillStyle = ch.skin; rr(-3.5, 11, 9, 4, 2); ctx.fill(); // bare feet
    } else {
      ctx.fillStyle = back ? ch.trim : ch.pants; rr(-4.5, 0, 9, 7, 3); ctx.fill();
      ctx.fillStyle = ch.skin; ctx.fillRect(-3, 6, 6, 6);
      ctx.fillStyle = ch.socks; rr(-3.5, 10, 10, 5, 2.5); ctx.fill();
    }
    ctx.restore();
  };
  leg(air ? -0.5 : -swing, true);
  // back arm
  const arm = (ang, back) => {
    ctx.save(); ctx.translate(0, -27); ctx.rotate(ang);
    if (ch.longSleeves) { ctx.fillStyle = back ? ch.trim : ch.shirt; rr(-3, 0, 6, 11, 3); ctx.fill(); ctx.fillStyle = ch.skin; ctx.beginPath(); ctx.arc(0, 12, 3, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = back ? ch.trim : ch.shirt; rr(-3.5, 0, 7, 5, 2); ctx.fill(); ctx.fillStyle = ch.skin; rr(-2.5, 4, 5, 9, 2.5); ctx.fill(); }
    ctx.restore();
  };
  arm(air ? -2.4 : swing * 0.9, true);
  // torso
  ctx.fillStyle = ch.shirt; rr(-8, -30, 16, 16, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1; ctx.stroke();
  // print
  if (ch.print === 'penguin') {
    for (const [px, py] of [[-3, -25], [3.5, -19]]) {
      ctx.fillStyle = '#1d1d26'; ctx.beginPath(); ctx.ellipse(px, py, 2.6, 3.4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(px, py + 0.8, 1.5, 2.2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#f2b233'; ctx.fillRect(px - 0.6, py - 2.4, 1.4, 1);
    }
  } else {
    ctx.strokeStyle = '#3b3b3b'; ctx.lineWidth = 0.8;
    for (const [px, py] of [[-3.5, -25], [3, -20], [-2, -17.5]]) {
      ctx.beginPath(); ctx.arc(px, py, 2, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py + 0.2, 1.1, 0.3, Math.PI - 0.3); ctx.stroke();
    }
  }
  // hips / bottoms band
  ctx.fillStyle = ch.pants; rr(-7.5, -17, 15, 5, 2); ctx.fill();
  leg(air ? 0.35 : swing, false);
  arm(air ? -2.0 : -swing * 0.9, false);
  // head (photo)
  const bob = air ? 0 : Math.abs(Math.sin(run)) * -1.5;
  ctx.save(); ctx.translate(1, -26 + bob); ctx.rotate((o.tilt || 0));
  drawHead(who, 0, 0, 34);
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- draw world
function drawBackground(theme, camx) {
  const th = THEMES[theme];
  const gr = ctx.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, th.sky[0]); gr.addColorStop(1, th.sky[1]);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
  const t = game.t;
  if (theme === 'meadow') {
    sun(820 - camx * 0.02, 90, '#fff27a');
    clouds(camx * 0.15, 0.9);
    hills(camx * 0.25, 380, 70, '#8fdc7a', 0.006);
    hills(camx * 0.45, 430, 50, '#6cc95c', 0.011);
  } else if (theme === 'ice') {
    mountains(camx * 0.15, 300, '#b9d8f0', '#fff');
    mountains(camx * 0.3, 360, '#9cc4e6', '#f2fbff', 1.7);
    // snow
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 70; i++) {
      const sx = ((i * 137 + t * (0.4 + (i % 3) * 0.2) - camx * 0.5) % VW + VW) % VW;
      const sy = ((i * 89 + t * (1 + (i % 4) * 0.3)) % VH);
      ctx.beginPath(); ctx.arc(sx + Math.sin(t * 0.02 + i) * 6, sy, 1.5 + (i % 3), 0, 7); ctx.fill();
    }
  } else if (theme === 'sky') {
    sun(780 - camx * 0.02, 110, '#ffe36a', true);
    clouds(camx * 0.1, 1.3, 'rgba(255,255,255,.7)');
    clouds(camx * 0.3 + 300, 1.0, '#fff', 380);
    // rainbow
    ctx.save(); ctx.globalAlpha = 0.35; ctx.lineWidth = 12;
    ['#ff5a5a', '#ffb347', '#fff36b', '#7dff7d', '#6bc8ff', '#a77dff'].forEach((c, i) => {
      ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(300 - camx * 0.05 % 2000, 560, 300 - i * 12, Math.PI, 0); ctx.stroke();
    });
    ctx.restore();
  } else if (theme === 'castle') {
    const off = -(camx * 0.3) % 64;
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
    for (let y = 0; y < VH; y += 32) for (let x = off - 64 + (y / 32 % 2) * 32; x < VW; x += 64) { ctx.strokeRect(x, y, 64, 32); }
    for (let i = 0; i < 6; i++) {
      const wx = ((i * 260 - camx * 0.3) % 1560 + 1560) % 1560 - 100;
      ctx.fillStyle = '#12060c'; rr(wx, 140, 50, 80, [25, 25, 0, 0]); ctx.fill();
      // torch
      const fl = Math.sin(t * 0.3 + i) * 3;
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(wx + 100, 200, 8, 26);
      ctx.fillStyle = '#ff9c1a'; ctx.beginPath(); ctx.ellipse(wx + 104, 192 + fl * 0.3, 8, 13 + fl, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe36a'; ctx.beginPath(); ctx.ellipse(wx + 104, 196, 4, 7, 0, 0, 7); ctx.fill();
    }
    const lg = ctx.createLinearGradient(0, VH - 160, 0, VH);
    lg.addColorStop(0, 'rgba(255,90,0,0)'); lg.addColorStop(1, 'rgba(255,90,0,.35)');
    ctx.fillStyle = lg; ctx.fillRect(0, VH - 160, VW, 160);
  }
}
function sun(x, y, c, smiley) {
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 44, 0, 7); ctx.fill();
  ctx.strokeStyle = c; ctx.lineWidth = 5;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + game.t * 0.005; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 54, y + Math.sin(a) * 54); ctx.lineTo(x + Math.cos(a) * 68, y + Math.sin(a) * 68); ctx.stroke(); }
  if (smiley || true) {
    ctx.fillStyle = '#5a3a10'; ctx.beginPath(); ctx.arc(x - 14, y - 8, 4, 0, 7); ctx.arc(x + 14, y - 8, 4, 0, 7); ctx.fill();
    ctx.strokeStyle = '#5a3a10'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y + 2, 18, 0.3, Math.PI - 0.3); ctx.stroke();
  }
}
function cloud(x, y, s, c) {
  ctx.fillStyle = c; ctx.beginPath();
  ctx.arc(x, y, 24 * s, 0, 7); ctx.arc(x + 28 * s, y - 12 * s, 30 * s, 0, 7); ctx.arc(x + 60 * s, y, 24 * s, 0, 7); ctx.arc(x + 30 * s, y + 8 * s, 24 * s, 0, 7);
  ctx.fill();
}
function clouds(off, s, c = '#fff', yb = 0) {
  for (let i = 0; i < 8; i++) {
    const x = ((i * 310 - off) % 2480 + 2480) % 2480 - 200;
    cloud(x, 70 + yb + (i * 53 % 120), s * (0.7 + (i % 3) * 0.2), c);
  }
}
function hills(off, base, amp, c, f) {
  ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, VH);
  for (let x = 0; x <= VW; x += 8) ctx.lineTo(x, base - Math.abs(Math.sin((x + off) * f)) * amp - Math.sin((x + off) * f * 0.37) * amp * 0.4);
  ctx.lineTo(VW, VH); ctx.fill();
}
function mountains(off, base, c, cap, k = 1) {
  for (let i = -1; i < 8; i++) {
    const w = 300 / k * 1.4, x = ((i * w - off) % (w * 7) + w * 7) % (w * 7) - w;
    const hgt = 160 + (i * 71 % 90);
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, VH); ctx.lineTo(x + w / 2, base - hgt); ctx.lineTo(x + w, VH); ctx.fill();
    ctx.fillStyle = cap; ctx.beginPath(); ctx.moveTo(x + w / 2, base - hgt); ctx.lineTo(x + w / 2 - 40, base - hgt + 60); ctx.lineTo(x + w / 2 - 12, base - hgt + 48); ctx.lineTo(x + w / 2 + 6, base - hgt + 62); ctx.lineTo(x + w / 2 + 40, base - hgt + 60); ctx.fill();
  }
}

function drawCoin(x, y, t, r = 10) {
  const sx = Math.abs(Math.cos(t * 0.08));
  ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.15, sx), 1);
  ctx.fillStyle = '#e8a800'; ctx.beginPath(); ctx.arc(0, 0, r + 1.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(0, 0, r - 0.5, 0, 7); ctx.fill();
  if (sx > 0.45) { // smiley!
    ctx.fillStyle = '#a86a00'; ctx.beginPath(); ctx.arc(-3.5, -2.5, 1.6, 0, 7); ctx.arc(3.5, -2.5, 1.6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#a86a00'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, 0.5, 5, 0.35, Math.PI - 0.35); ctx.stroke();
  }
  ctx.restore();
}

function drawTiles() {
  const th = THEMES[lv.theme];
  const x0 = Math.floor(game.cam.x / T), x1 = x0 + Math.ceil(VW / T) + 1;
  for (let ty = 0; ty < H; ty++) for (let tx = x0; tx <= x1; tx++) {
    const c = tile(tx, ty); if (c === '.') continue;
    let x = tx * T - Math.round(game.cam.x), y = ty * T;
    const bump = bumpAnim.get(tx + ',' + ty); if (bump) y -= Math.sin(bump / 10 * Math.PI) * 8;
    switch (c) {
      case '#': {
        const above = tile(tx, ty - 1), top = !solid(above) && above !== 'L';
        if (lv.theme === 'castle') {
          ctx.fillStyle = th.dirt; ctx.fillRect(x, y, T, T);
          ctx.fillStyle = th.dirtDark; ctx.fillRect(x, y + 15, T, 2); ctx.fillRect(x + (ty % 2 ? 8 : 24), y, 2, 15); ctx.fillRect(x + (ty % 2 ? 24 : 8), y + 17, 2, 15);
          if (top) { ctx.fillStyle = th.top; ctx.fillRect(x, y, T, 5); }
          break;
        }
        ctx.fillStyle = th.dirt; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = th.dirtDark;
        const s = (tx * 7 + ty * 13) % 5;
        ctx.fillRect(x + 6 + s * 3, y + 8 + s, 4, 4); ctx.fillRect(x + 20 - s, y + 22 - s, 5, 3);
        if (top) {
          ctx.fillStyle = th.topDark; rr(x - 1, y - 2, T + 2, 13, 5); ctx.fill();
          ctx.fillStyle = th.top; rr(x - 1, y - 3, T + 2, 10, 5); ctx.fill();
          if (lv.theme === 'meadow' && (tx % 4 === 1)) { // little flowers
            ctx.fillStyle = tx % 8 === 1 ? '#ff7db0' : '#fff36b'; ctx.beginPath(); ctx.arc(x + 16, y - 6, 3.5, 0, 7); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 16, y - 6, 1.3, 0, 7); ctx.fill();
          }
          if (lv.theme === 'sky') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 8, y + 9, 3, 0, 7); ctx.arc(x + 24, y + 9, 3, 0, 7); ctx.fill(); }
        }
        break;
      }
      case 'I': {
        ctx.fillStyle = '#a9dcf7'; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = '#d8f2ff'; ctx.fillRect(x, y, T, 6);
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.moveTo(x + 6, y + 26); ctx.lineTo(x + 14, y + 10); ctx.lineTo(x + 18, y + 10); ctx.lineTo(x + 10, y + 26); ctx.fill();
        ctx.strokeStyle = '#6fb4dd'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
        break;
      }
      case 'B': {
        ctx.fillStyle = th.brick; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = th.brickLine;
        ctx.fillRect(x, y, T, 2); ctx.fillRect(x, y + 15, T, 2); ctx.fillRect(x, y + 30, T, 2);
        ctx.fillRect(x + 15, y, 2, 15); ctx.fillRect(x + 6, y + 15, 2, 15); ctx.fillRect(x + 24, y + 15, 2, 15);
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x + 2, y + 2, 12, 3); ctx.fillRect(x + 18, y + 2, 12, 3);
        break;
      }
      case '?': case '!': case '*': case '+': {
        const glow = Math.sin(game.t * 0.1) * 0.5 + 0.5;
        ctx.fillStyle = '#b86d00'; rr(x, y, T, T, 5); ctx.fill();
        ctx.fillStyle = `rgb(255,${190 + glow * 30},${40 + glow * 30})`; rr(x + 1, y + 1, T - 2, T - 4, 5); ctx.fill();
        ctx.fillStyle = '#b86d00'; [[4, 4], [26, 4], [4, 24], [26, 24]].forEach(([a, b2]) => ctx.fillRect(x + a, y + b2, 2.5, 2.5));
        text('?', x + 16, y + 15, 22, '#fff', 'center', '#b86d00', 4);
        break;
      }
      case 'U': {
        ctx.fillStyle = '#7a5130'; rr(x, y, T, T, 5); ctx.fill();
        ctx.fillStyle = '#9a6a40'; rr(x + 2, y + 2, T - 4, T - 6, 4); ctx.fill();
        ctx.fillStyle = '#5a3a20'; [[5, 5], [25, 5], [5, 23], [25, 23]].forEach(([a, b2]) => ctx.fillRect(x + a, y + b2, 2.5, 2.5));
        break;
      }
      case '=': {
        if (lv.theme === 'sky') { cloud(x + 4, y + 10, 0.32, '#fff'); ctx.fillStyle = '#fff'; rr(x, y + 4, T, 14, 7); ctx.fill(); }
        else {
          ctx.fillStyle = th.plank; rr(x, y, T, 11, 3); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x, y + 8, T, 3); ctx.fillRect(x + 15, y, 2, 11);
        }
        break;
      }
      case 'S': {
        ctx.fillStyle = '#d9dde6'; ctx.strokeStyle = '#6a7080'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * 8, y + T); ctx.lineTo(x + i * 8 + 4, y + 10); ctx.lineTo(x + i * 8 + 8, y + T); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        break;
      }
      case 'L': {
        const top = tile(tx, ty - 1) !== 'L';
        ctx.fillStyle = '#ff5a00'; ctx.fillRect(x, y + (top ? 6 : 0), T, T);
        if (top) {
          ctx.fillStyle = '#ffb000'; ctx.beginPath(); ctx.moveTo(x, y + 10);
          for (let i = 0; i <= 8; i++) ctx.lineTo(x + i * 4, y + 6 + Math.sin(game.t * 0.12 + (tx * 8 + i) * 0.7) * 3);
          ctx.lineTo(x + T, y + 14); ctx.lineTo(x, y + 14); ctx.fill();
          if ((tx * 31 + Math.floor(game.t / 40)) % 7 === 0) { ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.arc(x + 16, y + 2 - (game.t % 40) * 0.2, 3, 0, 7); ctx.fill(); }
        } else { ctx.fillStyle = '#e04000'; ctx.fillRect(x + (tx * 5 % 20), y + 12, 6, 4); }
        break;
      }
      case 'T': {
        ctx.fillStyle = '#2b2b38'; rr(x + 2, y + 2, T - 4, T - 2, 6); ctx.fill();
        ctx.fillStyle = '#454558'; ctx.beginPath(); ctx.arc(x + 16, y + 15, 9, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.arc(x + 16, y + 15, 4, 0, 7); ctx.fill();
        ctx.fillStyle = '#5a5a70'; ctx.fillRect(x, y + 26, T, 6);
        break;
      }
      case 'C': drawCoin(x + 16, y + 16, game.t + tx * 4); break;
    }
  }
}

function drawEnt(e) {
  const cx = Math.round(game.cam.x);
  const x = e.x - cx, y = e.y;
  if (x + (e.w || 0) < -100 || x > VW + 100) return;
  const t = game.t;
  switch (e.k) {
    case 'g': {
      // Grumble: purple grumpy blob
      const sq = !e.alive && e.how === 'stomp';
      ctx.save(); ctx.translate(x + 13, y + 26); if (!e.alive && e.how !== 'stomp') ctx.scale(1, -1);
      const hh = sq ? 10 : 26, step = Math.sin(e.t * 0.25) * 3;
      ctx.fillStyle = '#4a2a60'; ctx.beginPath(); ctx.ellipse(-7 + step, -2, 6, 4, 0, 0, 7); ctx.ellipse(7 - step, -2, 6, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#9b59d0'; ctx.beginPath(); ctx.ellipse(0, -hh / 2 - 2, 15, hh / 2 + 1, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#b97ce8'; ctx.beginPath(); ctx.ellipse(-4, -hh / 2 - 6, 6, hh / 5, -0.4, 0, 7); ctx.fill();
      if (!sq) {
        const d = e.vx > 0 ? 2 : -2;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-5, -16, 4, 5, 0, 0, 7); ctx.ellipse(5, -16, 4, 5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-5 + d, -15, 2, 0, 7); ctx.arc(5 + d, -15, 2, 0, 7); ctx.fill();
        ctx.strokeStyle = '#2a1238'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-10, -23); ctx.lineTo(-2, -20); ctx.moveTo(10, -23); ctx.lineTo(2, -20); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -4, 4, Math.PI + 0.4, -0.4); ctx.stroke();
      } else { ctx.strokeStyle = '#2a1238'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(-3, -5); ctx.moveTo(8, -8); ctx.lineTo(3, -5); ctx.stroke(); }
      ctx.restore(); break;
    }
    case 's': {
      ctx.save(); ctx.translate(x + 13, y + 24); if (!e.alive) ctx.scale(1, -1);
      const step = Math.sin(e.t * 0.2) * 3;
      ctx.fillStyle = '#f2c38b'; ctx.beginPath(); ctx.ellipse(-7 + step, -2, 5, 3.5, 0, 0, 7); ctx.ellipse(7 - step, -2, 5, 3.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 5; i++) { const a = Math.PI + 0.3 + i * 0.6; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.25) * 13, -10 + Math.sin(a - 0.25) * 12); ctx.lineTo(Math.cos(a) * 22, -10 + Math.sin(a) * 20); ctx.lineTo(Math.cos(a + 0.25) * 13, -10 + Math.sin(a + 0.25) * 12); ctx.fill(); }
      ctx.fillStyle = '#e8384f'; ctx.beginPath(); ctx.ellipse(0, -11, 14, 11, 0, Math.PI, 0); ctx.lineTo(14, -4); ctx.lineTo(-14, -4); ctx.fill();
      const d = e.vx > 0 ? 1 : -1;
      ctx.fillStyle = '#f2c38b'; ctx.beginPath(); ctx.arc(d * 11, -7, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(d * 13, -8, 1.8, 0, 7); ctx.fill();
      ctx.restore(); break;
    }
    case 'p': {
      // sliding penguin (like the ones on Ayla's PJs!)
      ctx.save(); ctx.translate(x + 14, y + 28); if (!e.alive) ctx.scale(1, e.how === 'stomp' ? 0.4 : -1);
      ctx.scale(e.vx > 0 ? -1 : 1, 1);
      ctx.rotate(-0.15);
      ctx.fillStyle = '#1e2030'; ctx.beginPath(); ctx.ellipse(0, -12, 13, 13, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-1, -9, 8, 9, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#222'; for (const [a, b2] of [[-3, -12], [1, -8], [-4, -5], [2, -13]]) { ctx.beginPath(); ctx.arc(a, b2, 0.9, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-6, -19, 3.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-7, -19, 1.7, 0, 7); ctx.fill();
      ctx.fillStyle = '#f5a623'; ctx.beginPath(); ctx.moveTo(-11, -17); ctx.lineTo(-18, -15); ctx.lineTo(-11, -13); ctx.fill();
      ctx.fillStyle = '#ff4d8d'; ctx.fillRect(-10, -26, 12, 4);
      ctx.fillStyle = '#5fd0c0'; ctx.beginPath(); ctx.ellipse(10, -2, 6, 3, 0.3, 0, 7); ctx.fill();
      ctx.restore(); break;
    }
    case 'b': {
      ctx.save(); ctx.translate(x + 14, y + 11); if (!e.alive) ctx.scale(1, -1); ctx.scale(e.dir > 0 ? -1 : 1, 1);
      const flap = Math.sin(t * 0.4) * 0.9;
      ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffa41b'; ctx.save(); ctx.translate(3, -2); ctx.rotate(flap); ctx.beginPath(); ctx.ellipse(6, -6, 9, 5, -0.6, 0, 7); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-5, -3, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-6, -3, 2, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff6b3a'; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-19, 2); ctx.lineTo(-11, 4); ctx.fill();
      ctx.restore(); break;
    }
    case 'bullet': {
      ctx.save(); ctx.translate(x + 12, y + 10); if (!e.alive) ctx.scale(1, -1); ctx.scale(e.vx > 0 ? -1 : 1, 1);
      ctx.fillStyle = '#26262f'; rr(-12, -10, 24, 20, [10, 3, 3, 10]); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4, -3, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-5, -3, 2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(-1, -7); ctx.stroke();
      ctx.restore(); break;
    }
    case 'spring': {
      const c = e.comp > 0 ? Math.sin(e.comp / 12 * Math.PI) * 8 : 0;
      ctx.strokeStyle = '#9aa0ad'; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i <= 4; i++) { const yy = y + 20 - i * (14 - c) / 4 - 2; ctx.lineTo(x + (i % 2 ? 6 : 22), yy); }
      ctx.stroke();
      ctx.fillStyle = '#ff4d6d'; rr(x, y + 2 + c, 28, 7, 3); ctx.fill();
      ctx.fillStyle = '#444'; rr(x + 2, y + 17, 24, 4, 2); ctx.fill();
      break;
    }
    case 'mplat': case 'vplat': case 'fall': {
      if (e.fall && e.respawn > 0) break;
      let sx = x; if (e.fall && e.stood > 10 && !e.falling) sx += Math.sin(t * 1.5) * 2;
      const th = THEMES[lv.theme];
      if (lv.theme === 'sky' && !e.fall) { ctx.fillStyle = '#fff'; rr(sx, y, e.w, 16, 8); ctx.fill(); ctx.fillStyle = '#f3a8de'; rr(sx + 4, y + 10, e.w - 8, 5, 3); ctx.fill(); }
      else {
        ctx.fillStyle = e.fall ? '#e0a040' : (lv.theme === 'castle' ? '#8a8aa0' : '#5fb7ff');
        rr(sx, y, e.w, 14, 4); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(sx, y + 10, e.w, 4);
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(sx + 4, y + 2, e.w - 8, 2);
        if (e.fall) { ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 8; i < e.w - 4; i += 12) ctx.fillRect(sx + i, y + 3, 2, 7); }
        else { ctx.fillStyle = '#fff'; ctx.beginPath(); const mx = sx + e.w / 2; if (e.axis === 'x') { ctx.moveTo(mx - 12, y + 7); ctx.lineTo(mx - 6, y + 3); ctx.lineTo(mx - 6, y + 11); ctx.moveTo(mx + 12, y + 7); ctx.lineTo(mx + 6, y + 3); ctx.lineTo(mx + 6, y + 11); } else { ctx.moveTo(mx, y + 2); ctx.lineTo(mx - 5, y + 7); ctx.lineTo(mx + 5, y + 7); } ctx.fill(); }
      }
      void th; break;
    }
    case 'check': {
      ctx.fillStyle = '#ddd'; ctx.fillRect(x + 6, y, 4, e.h);
      ctx.fillStyle = '#888'; rr(x, y + e.h - 6, 16, 6, 2); ctx.fill();
      const wave = Math.sin(t * 0.15) * 3;
      ctx.fillStyle = e.on ? '#45d483' : '#c9c9c9';
      ctx.beginPath(); ctx.moveTo(x + 10, y + 2); ctx.lineTo(x + 40, y + 12 + wave); ctx.lineTo(x + 10, y + 24); ctx.fill();
      if (e.on) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 20, y + 13, 4, 0, 7); ctx.fill(); }
      break;
    }
    case 'goal': {
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(x + 1, y, 6, e.h);
      ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(x + 4, y - 4, 8, 0, 7); ctx.fill();
      ctx.fillStyle = '#4a4a4a'; rr(x - 12, y + e.h - 12, 32, 12, 3); ctx.fill();
      const fy = y + 8 + e.flagY, wave = Math.sin(t * 0.15) * 4;
      ctx.fillStyle = '#ff4d8d'; ctx.beginPath(); ctx.moveTo(x + 6, fy); ctx.lineTo(x + 56, fy + 16 + wave); ctx.lineTo(x + 6, fy + 34); ctx.fill();
      ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(x + 24, fy + 17, 6, 0, 7); ctx.fill();
      ctx.strokeStyle = '#a86a00'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + 24, fy + 17, 3.5, 0.3, Math.PI - 0.3); ctx.stroke();
      break;
    }
    case 'firebar': {
      for (let i = 0; i < e.len; i++) {
        const r = 14 + i * 15, fx = e.cx + Math.cos(e.ang) * r - cx, fy = e.cy + Math.sin(e.ang) * r;
        const fl = 7 + Math.sin(t * 0.5 + i) * 1.2;
        ctx.fillStyle = '#ff6a00'; ctx.beginPath(); ctx.arc(fx, fy, fl + 2, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(fx, fy, fl - 2.5, 0, 7); ctx.fill();
      }
      break;
    }
    case 'crusher': {
      const sh = e.st === 'warn' ? Math.sin(t * 2) * 2 : 0;
      ctx.save(); ctx.translate(x + sh, y);
      ctx.fillStyle = '#7d8aa3'; rr(0, 0, e.w, e.h, 6); ctx.fill();
      ctx.fillStyle = '#5c6880'; for (const [a, b2] of [[4, 4], [e.w - 10, 4], [4, e.h - 10], [e.w - 10, e.h - 10]]) { ctx.fillRect(a, b2, 6, 6); }
      ctx.fillStyle = '#c4ccdb'; ctx.fillRect(4, e.h - 4, e.w - 8, 4);
      // face
      const angry = e.st !== 'idle' && e.st !== 'cool';
      ctx.fillStyle = '#fff'; ctx.fillRect(12, 18, 10, angry ? 10 : 6); ctx.fillRect(e.w - 22, 18, 10, angry ? 10 : 6);
      ctx.fillStyle = '#222'; ctx.fillRect(15, 21, 4, 4); ctx.fillRect(e.w - 19, 21, 4, 4);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(10, 12); ctx.lineTo(24, 17); ctx.moveTo(e.w - 10, 12); ctx.lineTo(e.w - 24, 17); ctx.stroke();
      ctx.fillStyle = '#222'; ctx.fillRect(18, 38, e.w - 36, angry ? 8 : 4);
      ctx.restore(); break;
    }
    case 'icicle': {
      const sh = e.st === 'shake' ? Math.sin(t * 2) * 1.5 : 0;
      ctx.fillStyle = '#cdeeff'; ctx.strokeStyle = '#7fc0e6'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x + sh, y); ctx.lineTo(x + 16 + sh, y); ctx.lineTo(x + 8 + sh, y + 28); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'item': {
      if (e.kind === 'wings') {
        ctx.save(); ctx.translate(x + 12, y + 12);
        const f = Math.sin(t * 0.3) * 0.4;
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#7fc8ff'; ctx.lineWidth = 2;
        for (const s of [-1, 1]) { ctx.save(); ctx.scale(s, 1); ctx.rotate(f); ctx.beginPath(); ctx.ellipse(8, -2, 10, 6, -0.5, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(9, 4, 7, 4, -0.2, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
        ctx.fillStyle = '#7fc8ff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
        ctx.restore();
      } else if (e.kind === 'star') {
        ctx.save(); ctx.translate(x + 12, y + 12); ctx.rotate(Math.sin(t * 0.1) * 0.2);
        ctx.fillStyle = `hsl(${t * 8 % 360},100%,62%)`; star(0, 0, 14, 6.5); ctx.fill();
        ctx.fillStyle = '#222'; ctx.fillRect(-4, -4, 2.5, 5); ctx.fillRect(2, -4, 2.5, 5);
        ctx.restore();
      } else {
        ctx.save(); ctx.translate(x + 12, y + 12); const s = 1 + Math.sin(t * 0.2) * 0.08; ctx.scale(s, s);
        heart(0, 0, 12, '#ff4d6d'); ctx.restore();
      }
      break;
    }
  }
}
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

function drawPlayer(p) {
  if (p.gone) return;
  if (p.inv > 0 && Math.floor(p.inv / 4) % 2 === 0 && !p.dead) return;
  const x = p.x + p.w / 2 - Math.round(game.cam.x), y = p.y + p.h;
  if (p.star > 0) {
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

function drawParticles() {
  const cx = Math.round(game.cam.x);
  for (const q of parts) {
    if (q.coin) { drawCoin(q.x - cx, q.y, game.t * 3, 9); continue; }
    ctx.globalAlpha = Math.min(1, q.life / 20);
    ctx.fillStyle = q.color; ctx.fillRect(q.x - cx - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;
  for (const q of popups) { ctx.globalAlpha = Math.min(1, q.life / 20); text(q.text, q.x - cx, q.y, 16, q.color, 'center', '#222', 4); }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  ctx.fillStyle = 'rgba(0,0,0,.28)'; rr(8, 8, 340 + (game.mode === 2 ? 150 : 0), 52, 12); ctx.fill();
  let hx = 18;
  for (const p of game.players) {
    drawHead(p.who, hx + 18, 54, 40);
    for (let i = 0; i < Math.max(3, p.hearts); i++) heart(hx + 46 + i * 20, 26, 8, i < p.hearts ? '#ff4d6d' : 'rgba(255,255,255,.3)');
    if (p.wings) text('🪽', hx + 46, 46, 14, '#fff', 'left', null);
    if (p.star > 0) text('⭐' + Math.ceil(p.star / 60), hx + 66, 46, 13, '#ffe14a', 'left', '#222', 3);
    hx += 150;
  }
  text('×' + Math.max(0, game.lives), hx + 6, 34, 20, '#fff', 'left');
  ctx.save(); ctx.globalAlpha = 0.9; ctx.font = '700 12px Fredoka'; ctx.restore();
  text('lives', hx + 6, 50, 11, '#fff', 'left', '#222', 3);
  drawCoin(hx + 70, 33, 0, 10);
  text('×' + game.coins, hx + 86, 34, 20, '#fff', 'left');
  text(`World ${game.world + 1}: ${lv.name}`, VW - 20, 74, 16, '#fff', 'right', '#222', 4);
  text('Score ' + game.score, VW - 20, 52, 20, '#ffe14a', 'right', '#222', 5);
}

function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(30,20,50,.82)'; rr(x, y, w, h, 20); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.stroke();
}

function drawTitle() {
  drawBackground('meadow', game.t * 1.2);
  // ground strip
  ctx.fillStyle = '#9a6232'; ctx.fillRect(0, 470, VW, 80);
  ctx.fillStyle = '#5ccf4a'; ctx.fillRect(0, 462, VW, 14);
  for (let i = 0; i < 12; i++) drawCoin(((i * 90 - game.t * 1.2) % 1080 + 1080) % 1080 - 60, 140 + Math.sin(i + game.t * 0.04) * 6, game.t + i * 10, 9);
  // title
  ctx.save(); ctx.translate(VW / 2, 70); ctx.rotate(Math.sin(game.t * 0.03) * 0.02);
  text("AYLA & KAMEEL'S", 0, -14, 34, '#fff', 'center', '#7a2a9a', 9);
  text('SUPER OBSTACLE COURSE!', 0, 30, 46, '#ffe14a', 'center', '#c2185b', 10);
  ctx.restore();
  menuButtons.length = 0;
  const opts = [
    { who: ['ayla'], label: 'Ayla', sub: CHARS.ayla.tag, color: CHARS.ayla.color },
    { who: ['kameel'], label: 'Kameel', sub: CHARS.kameel.tag, color: CHARS.kameel.color },
    { who: ['ayla', 'kameel'], label: '2 Players', sub: 'Play together!', color: '#ffb02e' },
  ];
  opts.forEach((o, i) => {
    const bx = 90 + i * 270, by = 140, bw = 240, bh = 300, sel = game.sel === i;
    const lift = sel ? -8 + Math.sin(game.t * 0.1) * 3 : 0;
    ctx.fillStyle = sel ? o.color : 'rgba(255,255,255,.75)'; rr(bx, by + lift, bw, bh, 22); ctx.fill();
    ctx.strokeStyle = sel ? '#fff' : 'rgba(0,0,0,.15)'; ctx.lineWidth = sel ? 6 : 2; ctx.stroke();
    const n = o.who.length;
    o.who.forEach((w, k) => {
      const kx = bx + bw / 2 + (n === 2 ? (k ? 45 : -45) : 0);
      const jump = sel ? Math.abs(Math.sin(game.t * 0.12 + k)) * -14 : 0;
      drawKid(w, kx, by + 215 + lift + jump, { scale: n === 2 ? 2.1 : 2.8, run: sel ? game.t * 0.25 : 0, face: n === 2 && k ? -1 : 1 });
    });
    text(o.label, bx + bw / 2, by + 245 + lift, 32, '#fff', 'center', '#2b1a3a', 7);
    text(o.sub, bx + bw / 2, by + 278 + lift, 18, sel ? '#fff' : '#5a3a7a', 'center', sel ? '#2b1a3a' : null, 4);
    menuButtons.push({ x: bx, y: by, w: bw, h: bh, act: 'sel', v: i });
  });
  // world chooser
  const wy = 478;
  if (game.unlocked > 1) {
    text('◀', VW / 2 - 190, wy + 22, 26, '#fff'); text('▶', VW / 2 + 190, wy + 22, 26, '#fff');
    menuButtons.push({ x: VW / 2 - 220, y: wy, w: 60, h: 44, act: 'world', v: -1 }, { x: VW / 2 + 160, y: wy, w: 60, h: 44, act: 'world', v: 1 });
  }
  text(`World ${game.world + 1}: ${LEVELS[game.world].name}`, VW / 2, wy + 22, 24, '#fff');
  const blink = Math.floor(game.t / 30) % 2;
  if (blink) text('Tap a player or press ENTER to start!', VW / 2, 518, 16, '#ffe14a', 'center', '#222', 4);
  text(game.best ? 'Best ' + game.best : '', VW - 16, 528, 14, '#fff', 'right', '#222', 3);
  text('← → choose  ·  Space jump  ·  2P: A/D/W + ←/→/↑', 16, 528, 13, '#fff', 'left', '#222', 3);
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
  const tips = ['Stomp the grumpy Grumbles! Hit ? blocks for goodies!', "Ice is slippery! Watch out for falling icicles!", 'Bounce on springs and ride the clouds!', 'Dodge fire bars, crushers and lava!'];
  text(tips[game.world], VW / 2, 490, 18, '#bff', 'center', '#222', 4);
  ctx.globalAlpha = 1;
}

function drawDone() {
  panel(VW / 2 - 260, 110, 520, 320);
  text('LEVEL COMPLETE!', VW / 2, 160, 44, '#ffe14a', 'center', '#c2185b', 9);
  game.players.forEach((p, i) => drawKid(p.who, VW / 2 + (game.players.length === 2 ? (i ? 60 : -60) : 0), 310 + Math.abs(Math.sin(game.t * 0.15 + i)) * -16, { scale: 1.8, run: game.t * 0.2 }));
  drawCoin(VW / 2 - 90, 345, game.t, 12);
  text(`${game.levelCoins} / ${game.totalCoins} coins`, VW / 2 + 10, 346, 24, '#fff');
  const s = Math.floor(game.levelTime / 60);
  text(`Time ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}   ·   Score ${game.score}`, VW / 2, 380, 20, '#fff');
  if (game.timer > 30 && Math.floor(game.t / 25) % 2) text('Press ENTER or tap for the next world!', VW / 2, 412, 18, '#bff', 'center', '#222', 4);
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
  ctx.save();
  if (game.state === 'title') { drawTitle(); ctx.restore(); return; }
  if (game.shake > 0) { ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake); game.shake *= 0.85; if (game.shake < 0.5) game.shake = 0; }
  drawBackground(lv.theme, game.cam.x);
  drawTiles();
  for (const e of game.ents) if (e.k !== 'item') drawEnt(e);
  for (const e of game.ents) if (e.k === 'item') drawEnt(e);
  for (const p of game.players) drawPlayer(p);
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
function fit() {
  const s = Math.min(innerWidth / VW, innerHeight / VH);
  cv.style.width = Math.floor(VW * s) + 'px'; cv.style.height = Math.floor(VH * s) + 'px';
}
addEventListener('resize', fit); fit();

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
window.__game = game;
