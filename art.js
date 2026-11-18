// Art for Ayla & Kameel's Super Obstacle Course.
// Everything is drawn with canvas shapes. Static pieces (tiles, scenery, background layers)
// are painted once into off-screen sprites at double resolution and then stamped each frame.
// Loaded before game.js; it uses game.js globals (ctx, game, lv, T, VW, VH ...) only at call time.
'use strict';

const OL = '#2b1a3a';               // the cartoon outline colour shared by everything
const SPR = new Map(), SS = 2;      // sprite cache, supersampling factor
function sprite(key, w, h, pad, paint) {
  let c = SPR.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = (w + pad * 2) * SS; c.height = (h + pad * 2) * SS;
    const g = c.getContext('2d'); g.scale(SS, SS); g.translate(pad, pad);
    g.lineJoin = 'round'; g.lineCap = 'round';
    paint(g); c.pad = pad; c.w = w; c.h = h; SPR.set(key, c);
  }
  return c;
}
let BL = null; // when set, blit() paints into this context instead of the screen
function blit(c, x, y) { (BL || ctx).drawImage(c, x - c.pad, y - c.pad, c.w + c.pad * 2, c.h + c.pad * 2); }
function hash(x, y = 0) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
function vgrad(g, y0, y1, a, b) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; }
function glow(color, r) { // soft additive light blob
  return sprite('glow' + color + r, r * 2, r * 2, 0, g => {
    const gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  });
}
function drawGlow(color, r, x, y, alpha = 1) {
  const c = glow(color, r); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.drawImage(c, x - r, y - r, r * 2, r * 2); ctx.restore();
}
function shadow(x, y, w) { ctx.fillStyle = 'rgba(20,10,40,.22)'; ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.28, 0, 0, 7); ctx.fill(); }

// ================================================================ tiles
const GROUND = {
  meadow: { body: '#a86c3d', dark: '#85522b', light: '#c48a56', cap: ['#9bee6c', '#4cbb33'], capDark: '#2c8a2a', capLight: '#d6ffab' },
  ice: { body: '#84abd1', dark: '#668cb6', light: '#aecde9', cap: ['#ffffff', '#d7ecff'], capDark: '#9cc4e6', capLight: '#ffffff' },
  sky: { body: '#b782e6', dark: '#9760cb', light: '#d3abf5', cap: ['#ffe6f8', '#ff9bd3'], capDark: '#e56cb3', capLight: '#ffffff' },
};
function paintGround(g, theme, top, left, right, v, deep) {
  const R = n => (hash(v * 31 + n, theme.length) % 1000) / 1000;
  g.save(); g.beginPath(); g.rect(-0.5, top ? -6 : -0.5, 33, top ? 38.5 : 33); g.clip();
  if (theme === 'castle') {
    g.fillStyle = '#34323f'; g.fillRect(-0.5, -0.5, 33, 33);
    const brick = (x, y, w, n) => {
      const sh = 104 + Math.floor(R(n) * 26);
      g.fillStyle = `rgb(${sh},${sh - 2},${sh + 20})`; g.fillRect(x + 1, y + 1, w - 2, 14);
      g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x + 1, y + 1, w - 2, 2); g.fillRect(x + 1, y + 1, 2, 14);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 1, y + 13, w - 2, 2); g.fillRect(x + w - 3, y + 1, 2, 14);
    };
    brick(0, 0, 16, 1); brick(16, 0, 16, 2); brick(-8, 16, 16, 3); brick(8, 16, 16, 4); brick(24, 16, 16, 3);
    if (R(9) > 0.86) { g.strokeStyle = 'rgba(20,18,30,.6)'; g.lineWidth = 1; g.beginPath(); const cx = 4 + R(10) * 20, cy = 3 + R(11) * 8; g.moveTo(cx, cy); g.lineTo(cx + 3, cy + 4); g.lineTo(cx + 1, cy + 7); g.lineTo(cx + 5, cy + 11); g.stroke(); }
    if (R(12) > 0.8) { g.fillStyle = 'rgba(90,160,90,.35)'; g.beginPath(); g.ellipse(8 + R(13) * 16, 30, 6, 3, 0, 0, 7); g.fill(); }
  } else {
    const th = GROUND[theme];
    g.fillStyle = th.body; g.fillRect(-0.5, -0.5, 33, 33);
    if (theme === 'sky') { // candy stripes
      g.fillStyle = th.light; g.globalAlpha = 0.45;
      for (let i = -2; i < 3; i++) { g.beginPath(); g.moveTo(i * 16, 33); g.lineTo(i * 16 + 8, 33); g.lineTo(i * 16 + 41, 0); g.lineTo(i * 16 + 33, 0); g.fill(); }
      g.globalAlpha = 1;
    } else if (theme === 'ice') { // frozen facets
      for (let i = 0; i < 3; i++) { const x = 3 + R(i) * 22, y = 12 + R(i + 5) * 14, s = 4 + R(i + 9) * 5; g.fillStyle = i % 2 ? th.light : th.dark; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s * 0.7); g.lineTo(x - s * 0.7, y); g.fill(); }
      g.globalAlpha = 1;
    } else { // pebbles and soil lumps
      for (let i = 0; i < 4; i++) { const x = 4 + R(i) * 24, y = 12 + R(i + 5) * 17, s = 2 + R(i + 9) * 3.5; g.fillStyle = i % 2 ? th.dark : th.light; g.beginPath(); g.ellipse(x, y, s * 1.3, s, R(i + 3), 0, 7); g.fill(); if (i % 2) { g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(x - s * 0.3, y - s * 0.4, s * 0.5, s * 0.3, 0, 0, 7); g.fill(); } }
    }
  }
  if (deep) { g.fillStyle = `rgba(20,8,40,${0.13 * deep})`; g.fillRect(-0.5, -0.5, 33, 33); }
  for (const [on, x0, x1] of [[left, 0, 9], [right, 32, 23]]) if (on) {
    const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, 'rgba(20,8,40,.42)'); gr.addColorStop(1, 'rgba(20,8,40,0)');
    g.fillStyle = gr; g.fillRect(Math.min(x0, x1), -0.5, 9, 33);
    g.fillStyle = OL; g.globalAlpha = 0.75; g.fillRect(x0 === 0 ? 0 : 30.5, top ? 2 : -0.5, 1.5, 33); g.globalAlpha = 1;
  }
  if (top) {
    g.fillStyle = vgrad(g, 6, 17, 'rgba(20,8,40,.38)', 'rgba(20,8,40,0)'); g.fillRect(-0.5, 6, 33, 11);
    if (theme === 'castle') {
      g.fillStyle = vgrad(g, -1, 7, '#b9b7cf', '#8a88a2'); g.fillRect(-0.5, -1, 33, 8);
      g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(-0.5, -1, 33, 1.8);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-0.5, 6, 33, 1.5); g.fillRect(15.3, 1, 1.2, 5);
      g.fillStyle = OL; g.fillRect(-0.5, -2.2, 33, 1.5);
    } else {
      const th = GROUND[theme], x0 = left ? -2.5 : -0.5, x1 = right ? 34.5 : 32.5;
      g.restore(); g.save();
      const cap = () => {
        g.beginPath(); g.moveTo(x0, 7); g.lineTo(x0, left ? 1 : -3.5); if (left) g.quadraticCurveTo(x0, -3.5, x0 + 4, -3.5);
        g.lineTo(right ? x1 - 4 : x1, -3.5); if (right) g.quadraticCurveTo(x1, -3.5, x1, 1); g.lineTo(x1, 7);
        const n = 4, w = (x1 - x0) / n;
        for (let i = n - 1; i >= 0; i--) { const d = theme === 'sky' ? 5 + ((v + i) % 3) * 2.2 : theme === 'ice' ? 3.5 : 3 + ((v + i) % 2) * 1.5; g.quadraticCurveTo(x0 + w * (i + 0.5), 7 + d * 1.7, x0 + w * i, 7); }
        g.closePath();
      };
      cap(); g.fillStyle = vgrad(g, -4, 13, th.cap[0], th.cap[1]); g.fill();
      g.strokeStyle = th.capDark; g.lineWidth = 1.3; g.stroke();
      g.fillStyle = th.capLight; g.globalAlpha = 0.85; g.beginPath(); g.roundRect(x0 + 2, -2.2, x1 - x0 - 4, 2.2, 1.1); g.fill(); g.globalAlpha = 1;
      g.fillStyle = OL; g.beginPath(); g.roundRect(left ? x0 + 2 : x0, -4.6, (x1 - x0) - (left ? 2 : 0) - (right ? 2 : 0), 1.5, 0.7); g.fill();
      if (theme === 'meadow') { // grass blades
        g.fillStyle = th.cap[1]; g.strokeStyle = th.capDark; g.lineWidth = 0.8;
        for (let i = 0; i < 3; i++) { const bx = 3 + R(20 + i) * 26, hgt = 3 + R(30 + i) * 3; g.beginPath(); g.moveTo(bx - 1.6, -4); g.quadraticCurveTo(bx - 0.5, -4 - hgt, bx + 1.2, -5 - hgt); g.quadraticCurveTo(bx + 1, -4 - hgt * 0.4, bx + 1.6, -4); g.fill(); }
      } else if (theme === 'sky') { // sprinkles
        const cols = ['#ff5a8a', '#4fb3ff', '#ffd84a', '#7dff9d'];
        for (let i = 0; i < 4; i++) { g.save(); g.translate(4 + R(40 + i) * 24, 1 + R(50 + i) * 5); g.rotate(R(60 + i) * 3); g.fillStyle = cols[(v + i) % 4]; g.beginPath(); g.roundRect(-2, -0.8, 4, 1.6, 0.8); g.fill(); g.restore(); }
      } else { g.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(4 + R(40 + i) * 24, 1 + R(50 + i) * 4, 0.9, 0, 7); g.fill(); } }
    }
  }
  g.restore();
}

const BRICK = { meadow: ['#e08748', '#b85a25', '#f7b27c'], ice: ['#9ed2f2', '#5d9cc9', '#d6f0ff'], sky: ['#ffa574', '#d2643a', '#ffd0b0'], castle: ['#8f6464', '#5c3a3a', '#b98c8c'] };
const TILE_PAINT = {
  I(g) {
    g.fillStyle = vgrad(g, 0, 32, '#d4f1ff', '#8fcdf2'); g.fillRect(-0.5, -0.5, 33, 33);
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(5, 27); g.lineTo(15, 6); g.lineTo(20, 6); g.lineTo(10, 27); g.fill();
    g.beginPath(); g.moveTo(15, 27); g.lineTo(21, 14); g.lineTo(23.5, 14); g.lineTo(17.5, 27); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(-0.5, -0.5, 33, 3);
    g.fillStyle = 'rgba(60,120,180,.35)'; g.fillRect(-0.5, 29.5, 33, 3); g.fillRect(29.5, -0.5, 3, 33);
    g.strokeStyle = '#4f8fc4'; g.lineWidth = 1.4; g.strokeRect(0.2, 0.2, 31.6, 31.6);
  },
  B(g, theme) {
    const [c, d, l] = BRICK[theme];
    g.fillStyle = d; g.fillRect(0, 0, 32, 32);
    const b = (x, y, w) => { g.fillStyle = c; g.fillRect(x + 1, y + 1, w - 2, 14); g.fillStyle = l; g.fillRect(x + 1, y + 1, w - 2, 2.2); g.fillRect(x + 1, y + 1, 2, 14); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x + 1, y + 12.8, w - 2, 2.2); g.fillRect(x + w - 3, y + 1, 2, 14); };
    g.save(); g.beginPath(); g.rect(0, 0, 32, 32); g.clip(); b(0, 0, 16); b(16, 0, 16); b(-8, 16, 16); b(8, 16, 16); b(24, 16, 16); g.restore();
    g.strokeStyle = OL; g.lineWidth = 1.5; g.strokeRect(0.4, 0.4, 31.2, 31.2);
  },
  Q(g) {
    g.beginPath(); g.roundRect(0.6, 0.6, 30.8, 30.8, 6); g.fillStyle = vgrad(g, 0, 32, '#ffe36a', '#f59f00'); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.roundRect(3, 2.6, 26, 4, 2); g.fill();
    g.fillStyle = 'rgba(160,80,0,.35)'; g.beginPath(); g.roundRect(3, 25.5, 26, 4, 2); g.fill();
    g.fillStyle = '#b86d00'; for (const [x, y] of [[5.5, 8], [26.5, 8], [5.5, 24], [26.5, 24]]) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
    g.beginPath(); g.roundRect(0.6, 0.6, 30.8, 30.8, 6); g.strokeStyle = OL; g.lineWidth = 1.6; g.stroke();
  },
  U(g) {
    g.beginPath(); g.roundRect(0.6, 0.6, 30.8, 30.8, 6); g.fillStyle = vgrad(g, 0, 32, '#a9794d', '#7a5130'); g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.roundRect(3, 2.6, 26, 3.5, 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.roundRect(3, 25.5, 26, 4, 2); g.fill();
    g.fillStyle = '#4e321c'; for (const [x, y] of [[6, 7.5], [26, 7.5], [6, 24.5], [26, 24.5]]) { g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); }
    g.beginPath(); g.roundRect(0.6, 0.6, 30.8, 30.8, 6); g.strokeStyle = OL; g.lineWidth = 1.6; g.stroke();
  },
  P(g, theme, l, r) { // one-way platform piece ('=')
    if (theme === 'sky') {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(8, 9, 9, 0, 7); g.arc(24, 9, 9, 0, 7); g.arc(16, 6, 9, 0, 7); g.rect(-0.5, 6, 33, 9); g.fill();
      g.fillStyle = 'rgba(190,150,230,.45)'; g.beginPath(); g.ellipse(16, 16, 15, 3.5, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(12, 3, 3, 0, 7); g.fill();
      return;
    }
    const cols = { meadow: ['#d9a566', '#a8713a', '#f0c88f'], ice: ['#d9f2ff', '#8cc6ea', '#ffffff'], castle: ['#8d6844', '#5d4028', '#b08a62'] }[theme];
    g.beginPath(); g.roundRect(l ? 0.6 : -1, 0.6, 32 + (l ? -0.6 : 1) + (r ? -0.6 : 1), 11, [l ? 4 : 0, r ? 4 : 0, r ? 4 : 0, l ? 4 : 0]);
    g.fillStyle = vgrad(g, 0, 12, cols[0], cols[1]); g.fill(); g.strokeStyle = OL; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = cols[2]; g.globalAlpha = 0.7; g.fillRect(2, 2, 28, 1.6); g.globalAlpha = 1;
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(16, 1.5); g.lineTo(16, 10.5); g.moveTo(4, 6.5); g.lineTo(11, 6.5); g.moveTo(21, 7.5); g.lineTo(28, 7.5); g.stroke();
    g.fillStyle = theme === 'castle' ? '#c9c9d6' : 'rgba(60,30,10,.6)'; for (const x of [3.5, 28.5]) { g.beginPath(); g.arc(x, 6, 1.2, 0, 7); g.fill(); }
  },
  S(g) {
    for (let i = 0; i < 4; i++) {
      const x = i * 8;
      const gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, '#f4f6fb'); gr.addColorStop(0.5, '#c3c9d6'); gr.addColorStop(1, '#7c8498');
      g.beginPath(); g.moveTo(x + 0.3, 32); g.lineTo(x + 4, 9); g.lineTo(x + 7.7, 32); g.closePath(); g.fillStyle = gr; g.fill(); g.strokeStyle = OL; g.lineWidth = 1.3; g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + 4, 11); g.lineTo(x + 3, 18); g.lineTo(x + 4.4, 17); g.fill();
    }
    g.fillStyle = '#5a6072'; g.fillRect(0, 29.5, 32, 2.5); g.fillStyle = OL; g.fillRect(0, 31, 32, 1);
  },
  T(g) {
    g.beginPath(); g.roundRect(1.5, 1.5, 29, 30, 7); g.fillStyle = vgrad(g, 0, 32, '#5a5a72', '#22222e'); g.fill(); g.strokeStyle = OL; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.roundRect(4, 3.5, 24, 3.5, 2); g.fill();
    g.beginPath(); g.arc(16, 16, 9.5, 0, 7); g.fillStyle = '#16161e'; g.fill(); g.strokeStyle = '#8a8aa6'; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.arc(16, 16, 4.5, 0, 7); g.fillStyle = '#ffcf3a'; g.fill();
    g.fillStyle = '#9a9ab2'; for (const [x, y] of [[5.5, 26.5], [26.5, 26.5]]) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
  },
  D(g) {
    g.fillStyle = '#1d1826'; g.fillRect(2, -0.5, 28, 33);
    for (const x of [5, 14, 23]) { const gr = g.createLinearGradient(x, 0, x + 5, 0); gr.addColorStop(0, '#c6cbe0'); gr.addColorStop(1, '#5d6278'); g.fillStyle = gr; g.fillRect(x, -0.5, 5, 33); g.fillStyle = OL; g.fillRect(x - 0.6, -0.5, 0.8, 33); g.fillRect(x + 4.8, -0.5, 0.8, 33); }
    g.fillStyle = vgrad(g, 12, 19, '#a5abc2', '#4f5468'); g.fillRect(2, 12.5, 28, 6); g.fillStyle = OL; g.fillRect(2, 12, 28, 0.9); g.fillRect(2, 18.2, 28, 0.9);
    g.fillStyle = '#e4e7f4'; for (const x of [7.5, 16.5, 25.5]) { g.beginPath(); g.arc(x, 15.5, 1.3, 0, 7); g.fill(); }
  },
  L(g, theme, v) {
    g.fillStyle = vgrad(g, 0, 32, '#ff7a00', '#e23c00'); g.fillRect(-0.5, -0.5, 33, 33);
    g.fillStyle = 'rgba(255,200,60,.5)'; g.beginPath(); g.ellipse(6 + (v * 7) % 18, 10 + (v * 5) % 14, 6, 2.5, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(160,20,0,.4)'; g.beginPath(); g.ellipse(22 - (v * 5) % 14, 22 - (v * 3) % 8, 7, 2.5, 0, 0, 7); g.fill();
  },
};

// small bits of scenery that sit on (or hang from) the ground; purely decorative
const DECOR = {
  meadow: [
    g => { for (const [x, s, c] of [[9, 9, '#3f9d38'], [22, 11, '#4fb445'], [15, 13, '#62c754']]) { g.beginPath(); g.arc(x, 32 - s * 0.7, s, 0, 7); g.fillStyle = c; g.fill(); g.strokeStyle = '#2a7a2c'; g.lineWidth = 1.2; g.stroke(); } g.fillStyle = '#ff6b8b'; for (const [x, y] of [[10, 20], [20, 16], [24, 26]]) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); } },
    g => { g.strokeStyle = '#2f8f2a'; g.lineWidth = 2; for (const [x, h, b] of [[10, 12, -3], [15, 17, 0], [20, 13, 4], [24, 8, 5]]) { g.beginPath(); g.moveTo(x, 32); g.quadraticCurveTo(x + b * 0.4, 32 - h * 0.6, x + b, 32 - h); g.stroke(); } },
    g => flower(g, 16, '#ff5f8f', '#ffe36a'),
    g => flower(g, 14, '#ffffff', '#ffc93c'),
    g => { g.beginPath(); g.ellipse(16, 28, 9, 6, 0, 0, 7); g.fillStyle = '#a9adba'; g.fill(); g.strokeStyle = '#5c6072'; g.lineWidth = 1.3; g.stroke(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(13, 25.5, 4, 2, -0.3, 0, 7); g.fill(); },
    g => flower(g, 18, '#b88cff', '#fff'),
  ],
  ice: [
    g => { g.beginPath(); g.ellipse(16, 30, 14, 7, 0, Math.PI, 0); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#a9cdea'; g.lineWidth = 1.2; g.stroke(); },
    g => { for (const [x, h, w] of [[10, 14, 4], [17, 22, 5], [24, 12, 4]]) { g.beginPath(); g.moveTo(x - w, 32); g.lineTo(x - w * 0.5, 32 - h * 0.7); g.lineTo(x, 32 - h); g.lineTo(x + w * 0.6, 32 - h * 0.7); g.lineTo(x + w, 32); g.closePath(); g.fillStyle = vgrad(g, 32 - h, 32, '#e9f8ff', '#8fcdf2'); g.fill(); g.strokeStyle = '#4f8fc4'; g.lineWidth = 1.1; g.stroke(); } },
    g => pine(g, 16, 32, 30, true),
    g => { g.fillStyle = '#fff'; g.strokeStyle = '#8fb8dc'; g.lineWidth = 1.3; for (const [y, r] of [[25, 8], [13, 6], [4.5, 4.4]]) { g.beginPath(); g.arc(16, y, r, 0, 7); g.fill(); g.stroke(); } g.fillStyle = '#222'; g.beginPath(); g.arc(14.5, 3.6, 0.8, 0, 7); g.arc(17.5, 3.6, 0.8, 0, 7); g.fill(); g.fillStyle = '#ff8a2a'; g.beginPath(); g.moveTo(16, 5); g.lineTo(21, 6); g.lineTo(16, 7); g.fill(); g.fillStyle = '#e8384f'; g.fillRect(10.5, 8.6, 11, 2.2); },
    g => { g.beginPath(); g.ellipse(12, 31, 8, 4, 0, Math.PI, 0); g.ellipse(22, 31, 7, 5, 0, Math.PI, 0); g.fillStyle = '#eaf6ff'; g.fill(); },
  ],
  sky: [
    g => { g.fillStyle = '#fff'; g.fillRect(15, 12, 2.4, 20); const cols = ['#ff5a8a', '#ffd84a', '#4fb3ff']; g.beginPath(); g.arc(16, 9, 9, 0, 7); g.fillStyle = cols[0]; g.fill(); g.strokeStyle = OL; g.lineWidth = 1.2; g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); for (let a = 0; a < 9; a += 0.2) { const r = a * 0.9; g.lineTo(16 + Math.cos(a) * r, 9 + Math.sin(a) * r); } g.stroke(); },
    g => { for (const [x, c] of [[9, '#ff7da8'], [17, '#7dd3ff'], [24, '#ffe36a']]) { g.beginPath(); g.moveTo(x - 5, 32); g.quadraticCurveTo(x - 5, 21, x, 21); g.quadraticCurveTo(x + 5, 21, x + 5, 32); g.fillStyle = c; g.fill(); g.strokeStyle = OL; g.lineWidth = 1.1; g.stroke(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(x - 1.5, 24.5, 1.4, 2, 0, 0, 7); g.fill(); } },
    g => { g.lineWidth = 4.5; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(14, 32); g.lineTo(14, 13); g.quadraticCurveTo(14, 5, 21, 5); g.quadraticCurveTo(26, 5, 26, 11); g.stroke(); g.lineWidth = 1.6; g.strokeStyle = '#ff4d6d'; for (let y = 28; y > 12; y -= 5) { g.beginPath(); g.moveTo(11.8, y); g.lineTo(16.2, y - 3); g.stroke(); } },
    g => { g.fillStyle = '#fff'; g.beginPath(); g.arc(9, 28, 6, 0, 7); g.arc(17, 25, 8, 0, 7); g.arc(25, 28, 6, 0, 7); g.fill(); },
  ],
  castle: [
    g => { for (const [x, y, r] of [[9, 29, 4.5], [17, 28, 6], [24, 30, 3.5], [14, 31, 3]]) { g.beginPath(); g.ellipse(x, y, r * 1.2, r, 0, 0, 7); g.fillStyle = '#77758c'; g.fill(); g.strokeStyle = '#3d3b4a'; g.lineWidth = 1.1; g.stroke(); } },
    g => { g.fillStyle = '#6a6880'; g.fillRect(13, 22, 6, 10); g.fillRect(10, 30, 12, 2); g.fillStyle = '#f2e9d0'; g.fillRect(14.3, 12, 3.4, 10); g.strokeStyle = OL; g.lineWidth = 1; g.strokeRect(14.3, 12, 3.4, 10); g.fillStyle = '#ff9c1a'; g.beginPath(); g.ellipse(16, 8, 2.8, 4.5, 0, 0, 7); g.fill(); g.fillStyle = '#ffe36a'; g.beginPath(); g.ellipse(16, 9, 1.4, 2.4, 0, 0, 7); g.fill(); },
    g => { g.strokeStyle = 'rgba(230,230,245,.35)'; g.lineWidth = 0.8; g.beginPath(); for (let i = 0; i < 5; i++) { g.moveTo(0, 32); g.lineTo(26 * Math.cos(i * 0.38), 32 - 26 * Math.sin(i * 0.38)); } for (const r of [8, 15, 22]) { g.moveTo(r, 32); g.arc(0, 32, r, 0, -Math.PI / 2, true); } g.stroke(); },
  ],
};
function flower(g, h, petal, mid) {
  g.strokeStyle = '#2f8f2a'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(16, 32); g.quadraticCurveTo(14, 32 - h * 0.5, 16, 32 - h); g.stroke();
  g.fillStyle = '#4fb445'; g.beginPath(); g.ellipse(19, 32 - h * 0.35, 3.5, 1.6, -0.5, 0, 7); g.fill();
  g.fillStyle = petal; g.strokeStyle = 'rgba(43,26,58,.5)'; g.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 0.4 - 1.57; g.beginPath(); g.arc(16 + Math.cos(a) * 3.4, 32 - h + Math.sin(a) * 3.4, 2.7, 0, 7); g.fill(); g.stroke(); }
  g.fillStyle = mid; g.beginPath(); g.arc(16, 32 - h, 2.3, 0, 7); g.fill();
}
function pine(g, x, y, h, snow, col = ['#2f7d5b', '#1f5c44']) {
  g.fillStyle = '#6b4a2c'; g.fillRect(x - h * 0.05, y - h * 0.18, h * 0.1, h * 0.18);
  for (let i = 0; i < 3; i++) {
    const w = h * (0.34 - i * 0.07), yy = y - h * (0.14 + i * 0.25), hh = h * 0.42;
    g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x, yy - hh); g.lineTo(x + w, yy); g.closePath(); g.fillStyle = col[0]; g.fill();
    g.beginPath(); g.moveTo(x, yy - hh); g.lineTo(x + w, yy); g.lineTo(x + w * 0.2, yy); g.closePath(); g.fillStyle = col[1]; g.fill();
    if (snow) { g.beginPath(); g.moveTo(x, yy - hh); g.lineTo(x - w * 0.45, yy - hh * 0.52); g.lineTo(x - w * 0.15, yy - hh * 0.62); g.lineTo(x + w * 0.1, yy - hh * 0.5); g.lineTo(x + w * 0.4, yy - hh * 0.58); g.closePath(); g.fillStyle = '#fff'; g.fill(); }
  }
}

function drawCoin(x, y, t, r = 10) {
  const sx = Math.abs(Math.cos(t * 0.08));
  const c = sprite('coin', 24, 24, 1, g => {
    g.beginPath(); g.arc(12, 12, 11, 0, 7); g.fillStyle = '#c98500'; g.fill(); g.strokeStyle = OL; g.lineWidth = 1.4; g.stroke();
    const gr = g.createRadialGradient(9, 8, 1, 12, 12, 10); gr.addColorStop(0, '#fff3a6'); gr.addColorStop(0.6, '#ffd23a'); gr.addColorStop(1, '#f2a900');
    g.beginPath(); g.arc(12, 12, 8.6, 0, 7); g.fillStyle = gr; g.fill();
    g.fillStyle = '#9a5f00'; g.beginPath(); g.arc(8.8, 9.6, 1.5, 0, 7); g.arc(15.2, 9.6, 1.5, 0, 7); g.fill();
    g.strokeStyle = '#9a5f00'; g.lineWidth = 1.7; g.beginPath(); g.arc(12, 12, 4.8, 0.35, Math.PI - 0.35); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(8, 6.5, 2.6, 1.3, -0.6, 0, 7); g.fill();
  });
  const k = r / 10, w = 26 * k * Math.max(0.16, sx);
  ctx.drawImage(c, x - w / 2, y - 13 * k, w, 26 * k);
}

// Tiles that never move are baked into screen-sized strips ("chunks") and only repainted
// when something in them changes; coins, ? blocks, lava and bumped blocks are drawn live.
const CHUNK = 16, chunks = new Map();
let chunkRS = 0, chunkLv = null, lastBump = [];
function dirtyTile(tx) { for (const ci of [Math.floor((tx - 1) / CHUNK), Math.floor(tx / CHUNK), Math.floor((tx + 1) / CHUNK)]) { const c = chunks.get(ci); if (c) c.dirty = true; } }
const LIVE = new Set(['?', '!', '*', '+', 'C', 'L']);
function paintStaticTile(c, tx, ty, x, y) {
  const th = lv.theme, sl = solid;
  switch (c) {
    case '#': {
      const above = tile(tx, ty - 1), top = !sl(above) && above !== 'L' ? 1 : 0;
      const left = sl(tile(tx - 1, ty)) ? 0 : 1, right = sl(tile(tx + 1, ty)) ? 0 : 1;
      const v = hash(tx, ty) % 4, deep = ty >= 15 && !top ? ty - 14 : 0;
      blit(sprite(`g${th}${top}${left}${right}${v}${deep}`, 32, 32, 7, g => paintGround(g, th, top, left, right, v, deep)), x, y);
      if (top && ty > 2 && tile(tx, ty - 2) === '.' && above === '.') { // scenery
        const list = DECOR[th], h = hash(tx * 13 + 5, 77) % 23;
        if (h < list.length && !(th === 'castle' && h === 2)) blit(sprite('d' + th + h, 32, 32, 2, list[h]), x, y - 32);
      }
      if (th === 'castle' && ty <= 1 && tile(tx, ty + 1) === '.') { // chains and cobwebs under the ceiling
        const h = hash(tx * 7 + 1, 99) % 9, g = BL || ctx;
        if (h === 0) { const n = 3 + hash(tx, 5) % 4; for (let i = 0; i < n; i++) { g.strokeStyle = i % 2 ? '#8d93a8' : '#5e6478'; g.lineWidth = 2; g.beginPath(); g.ellipse(x + 16, y + 36 + i * 7, i % 2 ? 1.6 : 3, 4.4, 0, 0, 7); g.stroke(); } }
        else if (h === 1) { g.save(); g.translate(x, y + 64); g.scale(1, -1); blit(sprite('dcastle2', 32, 32, 2, DECOR.castle[2]), 0, 0); g.restore(); }
      }
      break;
    }
    case 'I': blit(sprite('tI', 32, 32, 1, TILE_PAINT.I), x, y); break;
    case 'B': blit(sprite('tB' + th, 32, 32, 1, g => TILE_PAINT.B(g, th)), x, y); break;
    case 'U': blit(sprite('tU', 32, 32, 1, TILE_PAINT.U), x, y); break;
    case '=': {
      const l = tile(tx - 1, ty) !== '=' ? 1 : 0, r = tile(tx + 1, ty) !== '=' ? 1 : 0;
      blit(sprite(`tP${th}${l}${r}`, 32, 20, 10, g => TILE_PAINT.P(g, th, l, r)), x, y);
      break;
    }
    case 'S': blit(sprite('tS', 32, 32, 1, TILE_PAINT.S), x, y); break;
    case 'T': blit(sprite('tT', 32, 32, 1, TILE_PAINT.T), x, y); break;
    case 'D': blit(sprite('tD', 32, 32, 1, TILE_PAINT.D), x, y); break;
    case 'L': if (tile(tx, ty - 1) === 'L') { const v = hash(tx, ty) % 4; blit(sprite('tL' + v, 32, 32, 1, g => TILE_PAINT.L(g, th, v)), x, y); } break;
  }
}
function chunkCanvas(ci) {
  let c = chunks.get(ci);
  if (c && !c.dirty) return c;
  if (!c) {
    if (chunks.size >= 5) { let far = null; for (const k of chunks.keys()) if (far === null || Math.abs(k - ci) > Math.abs(far - ci)) far = k; chunks.delete(far); }
    c = document.createElement('canvas'); c.width = Math.ceil((CHUNK * T + 2) * RS); c.height = Math.ceil(VH * RS); chunks.set(ci, c);
  }
  const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.setTransform(RS, 0, 0, RS, 0, 0);
  g.lineJoin = 'round'; g.lineCap = 'round';
  BL = g;
  const ox = ci * CHUNK * T - 1;
  for (let ty = 0; ty < H; ty++) for (let tx = ci * CHUNK - 1; tx <= (ci + 1) * CHUNK; tx++) {
    const t = tile(tx, ty);
    if (t === '.' || t === 'C' || t === '?' || t === '!' || t === '*' || t === '+' || bumpAnim.has(tx + ',' + ty)) continue;
    paintStaticTile(t, tx, ty, tx * T - ox, ty * T);
  }
  BL = null; c.dirty = false;
  return c;
}

function drawTiles() {
  const camx = Math.round(game.cam.x), t = game.t;
  if (chunkRS !== RS || chunkLv !== lv) { chunks.clear(); chunkRS = RS; chunkLv = lv; }
  for (const k of lastBump) dirtyTile(k); lastBump = [];
  for (const k of bumpAnim.keys()) { const tx = +k.split(',')[0]; dirtyTile(tx); lastBump.push(tx); }
  const c0 = Math.floor(camx / (CHUNK * T)), c1 = Math.floor((camx + VW) / (CHUNK * T));
  for (let ci = c0; ci <= c1; ci++) devBlit(chunkCanvas(ci), ci * CHUNK * T - 1 - camx, 0);
  // live tiles
  const x0 = Math.floor(game.cam.x / T) - 1, x1 = x0 + Math.ceil(VW / T) + 2;
  for (let ty = 0; ty < H; ty++) for (let tx = x0; tx <= x1; tx++) {
    const c = tile(tx, ty); if (c === '.' || c === '#') continue;
    const bump = bumpAnim.get(tx + ',' + ty);
    if (!bump && !LIVE.has(c)) continue;
    const x = tx * T - camx; let y = ty * T; if (bump) y -= Math.sin(bump / 10 * Math.PI) * 8;
    switch (c) {
      case '?': case '!': case '*': case '+': {
        blit(sprite('tQ', 32, 32, 1, TILE_PAINT.Q), x, y);
        const ph = (t + tx * 9) % 120;
        if (ph < 24) { ctx.save(); ctx.beginPath(); ctx.roundRect(x + 1, y + 1, 30, 30, 6); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.55)'; const sx = x - 14 + ph * 2.4; ctx.beginPath(); ctx.moveTo(sx, y + 32); ctx.lineTo(sx + 8, y + 32); ctx.lineTo(sx + 20, y); ctx.lineTo(sx + 12, y); ctx.fill(); ctx.restore(); }
        text('?', x + 16, y + 16.5 + Math.sin(t * 0.08 + tx) * 0.8, 22, '#fff', 'center', '#a85f00', 4);
        break;
      }
      case 'L': {
        if (tile(tx, ty - 1) === 'L') break;
        ctx.fillStyle = '#ff7a00'; ctx.fillRect(x - 0.5, y + 9, 33, 23.5);
        ctx.beginPath(); ctx.moveTo(x - 0.5, y + 12);
        for (let i = 0; i <= 8; i++) ctx.lineTo(x + i * 4, y + 6 + Math.sin(t * 0.1 + (tx * 8 + i) * 0.55) * 3);
        ctx.lineTo(x + 32.5, y + 12); ctx.lineTo(x + 32.5, y + 16); ctx.lineTo(x - 0.5, y + 16); ctx.closePath();
        ctx.fillStyle = '#ffd23a'; ctx.fill();
        ctx.fillStyle = '#fff3a6'; for (let i = 0; i < 8; i += 2) ctx.fillRect(x + i * 4, y + 5.2 + Math.sin(t * 0.1 + (tx * 8 + i) * 0.55) * 3, 4, 1.6);
        const bp = (t + tx * 37) % 90;
        if ((tx * 7) % 3 === 0 && bp < 40) { ctx.beginPath(); ctx.arc(x + 10 + (tx * 5) % 14, y + 6 - bp * 0.35, 3.2 - bp * 0.05, 0, 7); ctx.fillStyle = '#ffe36a'; ctx.fill(); }
        if (tx % 2 === 0) drawGlow('rgba(255,120,0,.55)', 60, x + 32, y + 6, 0.5);
        break;
      }
      case 'C': drawCoin(x + 16, y + 16 + Math.sin(t * 0.07 + tx * 0.8) * 1.5, t + tx * 4); break;
      default: paintStaticTile(c, tx, ty, x, y); // a block mid-bump
    }
  }
}

// ================================================================ backgrounds
// Layers are painted once at the screen's own resolution and stamped 1:1 (no scaling), which is
// both the sharpest and the cheapest way to draw them. `top` crops the empty sky above a layer.
const LAYERS = new Map();
let layerRS = 0;
function devBlit(c, xg, yg) { // stamp a device-resolution canvas at game coordinates, pixel-aligned
  const m = ctx.getTransform();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(c, Math.round(m.e + xg * RS), Math.round(m.f + yg * RS)); ctx.restore();
}
function layer(key, w, top, paint) {
  if (layerRS !== RS) { LAYERS.clear(); layerRS = RS; }
  let c = LAYERS.get(key);
  if (!c) {
    if (LAYERS.size >= 8) LAYERS.delete(LAYERS.keys().next().value);
    c = document.createElement('canvas'); c.width = Math.round(w * RS); c.height = Math.ceil((VH - top) * RS); c.top = top;
    const g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round';
    g.scale(c.width / w, RS); g.translate(0, -top);
    for (const dx of [0, -w, w]) { g.save(); g.translate(dx, 0); paint(g, w); g.restore(); } // painted three times so it tiles
    LAYERS.set(key, c);
  }
  return c;
}
function drawLayer(c, camx, par) {
  const wd = c.width, m = ctx.getTransform();
  let x = -(Math.round(camx * par * RS) % wd); if (x > 0) x -= wd;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (; x < cv.width; x += wd) ctx.drawImage(c, x + Math.round(m.e), Math.round(m.f + c.top * RS));
  ctx.restore();
}
// a rolling ridge line that repeats every w pixels
function ridge(w, base, amp, seed) {
  const a = [1, 2, 3, 5].map((k, i) => ({ k, ph: (hash(seed, i) % 628) / 100, m: [0.5, 0.28, 0.15, 0.07][i] }));
  return x => base - a.reduce((s, o) => s + Math.abs(Math.sin(Math.PI * o.k * x / w + o.ph)) * o.m, 0) * amp;
}
function fillRidge(g, w, f, fill) { g.beginPath(); g.moveTo(0, VH); for (let x = 0; x <= w; x += 6) g.lineTo(x, f(x)); g.lineTo(w, VH); g.closePath(); g.fillStyle = fill; g.fill(); }
function snowcaps(g, w, f, line, col = '#fff') {
  g.save(); g.beginPath(); g.moveTo(0, VH); for (let x = 0; x <= w; x += 6) g.lineTo(x, f(x)); g.lineTo(w, VH); g.closePath(); g.clip();
  g.beginPath(); g.moveTo(0, 0); for (let x = 0; x <= w; x += 14) g.lineTo(x, line + ((x / 14) % 2 ? 16 : -6) + Math.sin(x * 0.02) * 22); g.lineTo(w, 0); g.closePath(); g.fillStyle = col; g.fill(); g.restore();
}
function roundTree(g, x, y, s, c1, c2, c3) {
  g.fillStyle = '#7a5230'; g.fillRect(x - s * 0.09, y - s * 0.5, s * 0.18, s * 0.5);
  for (const [dx, dy, r] of [[-0.28, -0.62, 0.3], [0.28, -0.62, 0.3], [0, -0.9, 0.38]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, 7); g.fillStyle = c1; g.fill(); }
  g.beginPath(); g.arc(x + 0.12 * s, y - 0.72 * s, 0.26 * s, 0, 7); g.fillStyle = c2; g.fill();
  g.beginPath(); g.arc(x - 0.1 * s, y - 1.0 * s, 0.17 * s, 0, 7); g.fillStyle = c3; g.fill();
}
function puff(g, x, y, s, c, shade) {
  g.fillStyle = c; g.beginPath(); g.arc(x, y, 24 * s, 0, 7); g.arc(x + 30 * s, y - 14 * s, 32 * s, 0, 7); g.arc(x + 66 * s, y - 2 * s, 26 * s, 0, 7); g.arc(x + 34 * s, y + 8 * s, 26 * s, 0, 7); g.rect(x, y, 66 * s, 22 * s); g.fill();
  if (shade) { g.fillStyle = shade; g.beginPath(); g.ellipse(x + 34 * s, y + 22 * s, 44 * s, 9 * s, 0, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(x + 22 * s, y - 24 * s, 10 * s, 0, 7); g.fill();
}
const BG = {
  meadow: {
    sky: ['#3aa7ff', '#a8e3ff', '#e9fbff'],
    layers: [
      [0.06, 1100, 110, (g, w) => { const f = ridge(w, 400, 260, 3); fillRidge(g, w, f, vgrad(g, 180, 460, '#8fc9f2', '#cfeefc')); snowcaps(g, w, f, 205, 'rgba(255,255,255,.8)'); }],
      [0.18, 1000, 290, (g, w) => {
        const f = ridge(w, 420, 90, 8); fillRidge(g, w, f, vgrad(g, 320, 544, '#b4ea96', '#8ed77a'));
        for (let i = 0; i < 16; i++) { const x = (hash(i, 4) % w); roundTree(g, x, f(x) + 6, 26 + hash(i, 6) % 14, '#79c765', '#93d97c', '#aee596'); }
      }],
      [0.36, 1000, 320, (g, w) => {
        const f = ridge(w, 470, 70, 15); fillRidge(g, w, f, vgrad(g, 390, 544, '#74cf5a', '#3f9f3c'));
        for (let i = 0; i < 9; i++) { const x = (hash(i, 14) % w); roundTree(g, x, f(x) + 8, 46 + hash(i, 16) % 26, '#3f9d38', '#57b848', '#7fd169'); }
        for (let i = 0; i < 40; i++) { const x = hash(i, 24) % w; g.fillStyle = ['#ff7da8', '#fff', '#ffe36a'][i % 3]; g.beginPath(); g.arc(x, f(x) + 14 + hash(i, 25) % 40, 2, 0, 7); g.fill(); }
      }],
    ],
  },
  ice: {
    sky: ['#5fa8e8', '#bfe2fb', '#f4fbff'],
    layers: [
      [0.06, 1100, 120, (g, w) => { const f = ridge(w, 400, 250, 21); fillRidge(g, w, f, vgrad(g, 150, 500, '#b9d6f0', '#e6f2fb')); snowcaps(g, w, f, 250); }],
      [0.18, 1000, 230, (g, w) => { const f = ridge(w, 450, 190, 27); fillRidge(g, w, f, vgrad(g, 250, 544, '#86b4de', '#c4def3')); snowcaps(g, w, f, 335, '#f4faff'); }],
      [0.36, 1000, 300, (g, w) => {
        const f = ridge(w, 490, 50, 33);
        for (let i = 0; i < 22; i++) { const x = hash(i, 34) % w; pine(g, x, f(x) + 10, 60 + hash(i, 35) % 50, true, ['#3b8a78', '#2a6a5e']); }
        fillRidge(g, w, f, vgrad(g, 430, 544, '#ffffff', '#cfe6f8'));
      }],
    ],
  },
  sky: {
    sky: ['#ff86c8', '#ffc0a0', '#fff0b8'],
    layers: [
      [0.05, 1400, 150, (g, w) => {
        for (let i = 0; i < 4; i++) { // floating islands far away
          const x = 120 + i * 350, y = 250 + (hash(i, 41) % 120), s = 0.7 + (hash(i, 42) % 6) / 10;
          g.beginPath(); g.moveTo(x - 60 * s, y); g.quadraticCurveTo(x - 20 * s, y + 70 * s, x, y + 78 * s); g.quadraticCurveTo(x + 24 * s, y + 60 * s, x + 60 * s, y); g.closePath(); g.fillStyle = '#c79bea'; g.fill();
          g.beginPath(); g.ellipse(x, y, 62 * s, 12 * s, 0, 0, 7); g.fillStyle = '#ffd9f1'; g.fill();
          roundTree(g, x - 10 * s, y - 2, 34 * s, '#ff9fd0', '#ffbfe0', '#ffe0f0');
        }
        for (let i = 0; i < 9; i++) puff(g, (hash(i, 43) % w), 440 + (hash(i, 44) % 70), 1.5, 'rgba(255,214,236,.9)');
      }],
      [0.2, 1000, 380, (g, w) => { for (let i = 0; i < 8; i++) puff(g, (hash(i, 51) % w), 470 + (hash(i, 52) % 60), 1.7, '#fff', 'rgba(210,170,235,.35)'); }],
    ],
  },
  castle: {
    sky: ['#14070f', '#2a0c12', '#4c1410'],
    layers: [
      [0.12, 1280, 0, (g, w) => {
        g.fillStyle = vgrad(g, 0, VH, '#2a1622', '#3a1818'); g.fillRect(0, 0, w, VH);
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
        for (let y = 0; y < VH; y += 40) for (let x = (y / 40 % 2) * 40 - 80; x < w; x += 80) g.strokeRect(x, y, 80, 40);
        g.fillStyle = 'rgba(255,255,255,.03)'; for (let i = 0; i < 60; i++) g.fillRect((hash(i, 61) % 16) * 80 + ((hash(i, 62) % 2) * 40), (hash(i, 63) % 13) * 40, 80, 40);
        for (let x = 160; x < w; x += 320) { // arched windows with a fiery sky behind
          g.save(); g.beginPath(); g.moveTo(x - 34, 250); g.lineTo(x - 34, 150); g.quadraticCurveTo(x - 34, 100, x, 100); g.quadraticCurveTo(x + 34, 100, x + 34, 150); g.lineTo(x + 34, 250); g.closePath();
          g.fillStyle = vgrad(g, 100, 250, '#3a0d1e', '#c2400c'); g.fill(); g.clip();
          g.fillStyle = 'rgba(255,170,60,.6)'; g.beginPath(); g.arc(x + 8, 232, 22, 0, 7); g.fill();
          g.fillStyle = '#1a0c14'; g.fillRect(x - 2, 100, 4, 150); g.fillRect(x - 34, 172, 68, 4);
          g.restore();
          g.strokeStyle = '#5a4250'; g.lineWidth = 6; g.beginPath(); g.moveTo(x - 34, 250); g.lineTo(x - 34, 150); g.quadraticCurveTo(x - 34, 100, x, 100); g.quadraticCurveTo(x + 34, 100, x + 34, 150); g.lineTo(x + 34, 250); g.closePath(); g.stroke();
        }
      }],
      [0.3, 1280, 56, (g, w) => {
        for (let x = 0; x < w; x += 320) { // pillars with torches, banners between
          const gr = g.createLinearGradient(x + 130, 0, x + 190, 0); gr.addColorStop(0, '#6a5868'); gr.addColorStop(0.45, '#4a3a4a'); gr.addColorStop(1, '#241824');
          g.fillStyle = gr; g.fillRect(x + 136, 60, 48, VH); g.fillRect(x + 126, 60, 68, 22); g.fillRect(x + 130, 82, 60, 10);
          g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 120; y < VH; y += 46) g.fillRect(x + 136, y, 48, 3);
          g.fillStyle = '#3a2a1a'; g.fillRect(x + 156, 246, 8, 30); g.fillStyle = '#6a5a4a'; g.fillRect(x + 150, 240, 20, 8);
          const bx = x + 290;
          g.fillStyle = '#7a1a2e'; g.beginPath(); g.moveTo(bx, 70); g.lineTo(bx + 60, 70); g.lineTo(bx + 60, 230); g.lineTo(bx + 30, 205); g.lineTo(bx, 230); g.closePath(); g.fill();
          g.fillStyle = '#a82840'; g.fillRect(bx + 6, 70, 10, 142); g.fillStyle = '#d9a82a'; g.fillRect(bx - 6, 64, 72, 8);
          g.beginPath(); g.arc(bx + 30, 132, 15, 0, 7); g.fill(); g.fillStyle = '#7a1a2e'; g.beginPath(); g.arc(bx + 25, 128, 2.5, 0, 7); g.arc(bx + 35, 128, 2.5, 0, 7); g.fill(); g.strokeStyle = '#7a1a2e'; g.lineWidth = 2.5; g.beginPath(); g.arc(bx + 30, 142, 7, Math.PI + 0.4, -0.4); g.stroke();
        }
      }],
    ],
  },
};
function sunSprite(smile) {
  return sprite('sun', 200, 200, 0, g => {
    const gr = g.createRadialGradient(100, 100, 30, 100, 100, 100); gr.addColorStop(0, 'rgba(255,250,190,.9)'); gr.addColorStop(1, 'rgba(255,250,190,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 200, 200);
    g.beginPath(); g.arc(100, 100, 44, 0, 7); const g2 = g.createRadialGradient(88, 86, 4, 100, 100, 46); g2.addColorStop(0, '#fffbd0'); g2.addColorStop(1, '#ffd84a'); g.fillStyle = g2; g.fill(); g.strokeStyle = '#f2a900'; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = '#7a4a00'; g.beginPath(); g.arc(86, 92, 4.5, 0, 7); g.arc(114, 92, 4.5, 0, 7); g.fill();
    g.strokeStyle = '#7a4a00'; g.lineWidth = 4; g.beginPath(); g.arc(100, 102, 18, 0.3, Math.PI - 0.3); g.stroke();
    g.fillStyle = 'rgba(255,120,120,.45)'; g.beginPath(); g.ellipse(76, 106, 7, 4, 0, 0, 7); g.ellipse(124, 106, 7, 4, 0, 0, 7); g.fill();
  });
}
function cloudSprite(i) { return sprite('cloud' + i, 150, 80, 6, g => puff(g, 22, 44, 1 + (i % 3) * 0.12, '#fff', 'rgba(150,190,230,.35)')); }

function drawBackground(theme, camx) {
  const b = BG[theme], t = game.t;
  const gr = ctx.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, b.sky[0]); gr.addColorStop(0.6, b.sky[1]); gr.addColorStop(1, b.sky[2]);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
  if (theme !== 'castle') { // sun with slowly turning rays
    const sx = VW - 150 - camx * 0.01, sy = theme === 'sky' ? 120 : 96;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.004); ctx.fillStyle = 'rgba(255,250,200,.35)';
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(52, -5); ctx.lineTo(84, 0); ctx.lineTo(52, 5); ctx.fill(); }
    ctx.restore();
    ctx.drawImage(sunSprite(), sx - 100, sy - 100, 200, 200);
  }
  if (theme === 'sky') { // rainbow
    ctx.save(); ctx.globalAlpha = 0.4; ctx.lineWidth = 12;
    ['#ff5a5a', '#ffb347', '#fff36b', '#7dff7d', '#6bc8ff', '#a77dff'].forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(320 - (camx * 0.04) % 2400, 580, 320 - i * 12, Math.PI, 0); ctx.stroke(); });
    ctx.restore();
  }
  b.layers.forEach(([par, w, top, paint], i) => {
    if (i === 1 && theme !== 'castle') { // clouds drift between the far and near layers
      for (let k = 0; k < 7; k++) { const span = VW + 400, x = (((k * 290 - camx * 0.1 + t * (0.12 + (k % 3) * 0.05)) % span) + span) % span - 200; const c = cloudSprite(k % 3), s = 0.8 + (k % 3) * 0.25; ctx.globalAlpha = theme === 'sky' ? 0.8 : 0.95; ctx.drawImage(c, x, 30 + (k * 67) % 170, 162 * s, 92 * s); }
      ctx.globalAlpha = 1;
    }
    drawLayer(layer(theme + i, w, top, paint), camx, par);
  });
  if (theme === 'ice') {
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 137 + t * (0.4 + (i % 3) * 0.2) - camx * 0.5) % VW + VW) % VW, sy = ((i * 89 + t * (1 + (i % 4) * 0.3)) % VH);
      ctx.beginPath(); ctx.arc(sx + Math.sin(t * 0.02 + i) * 6, sy, 1.2 + (i % 3) * 0.9, 0, 7); ctx.fill();
    }
  } else if (theme === 'sky') { // hot-air balloons
    for (let k = 0; k < 2; k++) {
      const span = VW + 300, x = (((k * 700 - camx * 0.15 - t * 0.15) % span) + span) % span - 150, y = 150 + k * 90 + Math.sin(t * 0.02 + k) * 10;
      const c = sprite('balloon' + k, 60, 90, 2, g => {
        const cols = k ? ['#4fb3ff', '#fff'] : ['#ff6fa8', '#ffe36a'];
        g.save(); g.beginPath(); g.moveTo(30, 62); g.bezierCurveTo(-6, 44, -2, 0, 30, 0); g.bezierCurveTo(62, 0, 66, 44, 30, 62); g.closePath(); g.clip();
        for (let i = 0; i < 6; i++) { g.fillStyle = cols[i % 2]; g.fillRect(i * 10, 0, 10, 64); }
        g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(18, 20, 6, 14, 0.3, 0, 7); g.fill(); g.restore();
        g.strokeStyle = '#7a5230'; g.lineWidth = 1; g.beginPath(); g.moveTo(22, 58); g.lineTo(25, 74); g.moveTo(38, 58); g.lineTo(35, 74); g.stroke();
        g.fillStyle = '#b8834a'; g.beginPath(); g.roundRect(23, 73, 14, 10, 2); g.fill();
      });
      ctx.drawImage(c, x, y, 64, 94);
    }
  } else if (theme === 'castle') {
    for (let x = -Math.round((camx * 0.3) % 320) - 320; x < VW + 320; x += 320) { // torch flames on the pillars
      const fx = x + 160, fl = Math.sin(t * 0.3 + x) * 3;
      drawGlow('rgba(255,150,40,.5)', 90, fx, 226, 0.7 + Math.sin(t * 0.2 + x) * 0.1);
      ctx.fillStyle = '#ff8a1a'; ctx.beginPath(); ctx.ellipse(fx, 228 + fl * 0.3, 9, 16 + fl, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe36a'; ctx.beginPath(); ctx.ellipse(fx, 233, 4.5, 8 + fl * 0.5, 0, 0, 7); ctx.fill();
    }
    const lg = ctx.createLinearGradient(0, VH - 200, 0, VH); lg.addColorStop(0, 'rgba(255,80,0,0)'); lg.addColorStop(1, 'rgba(255,90,0,.4)');
    ctx.fillStyle = lg; ctx.fillRect(0, VH - 200, VW, 200);
    for (let i = 0; i < 26; i++) { // drifting embers
      const ex = ((i * 97 - camx * 0.4 + Math.sin(t * 0.02 + i) * 20) % VW + VW) % VW, ey = VH - ((t * (0.5 + (i % 4) * 0.25) + i * 53) % VH);
      ctx.fillStyle = `rgba(255,${150 + (i % 3) * 40},60,${0.25 + (ey / VH) * 0.6})`; ctx.fillRect(ex, ey, 2.2, 2.2);
    }
  }
}

// ================================================================ characters & objects
function drawEnt(e) {
  const cx = Math.round(game.cam.x), x = e.x - cx, y = e.y, t = game.t;
  if (x + (e.w || 0) < -140 || x > VW + 140) return;
  const fs = (fill, lw = 1.6) => { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = OL; ctx.stroke(); };
  const el = (ex, ey, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, rot, 0, 7); };
  const eye = (ex, ey, r, dx = 0, dy = 0) => { el(ex, ey, r * 0.85, r); fs('#fff', 1.2); ctx.fillStyle = '#1c1420'; ctx.beginPath(); ctx.arc(ex + dx, ey + dy, r * 0.48, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + dx + r * 0.2, ey + dy - r * 0.22, r * 0.17, 0, 7); ctx.fill(); };
  const flip = () => { if (!e.alive) ctx.scale(1, e.how === 'stomp' ? 0.4 : -1); };
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (e.alive && e.onGround && 'gspj'.includes(e.k) && e.k.length === 1) shadow(x + e.w / 2, y + e.h + 1, e.w * 0.55);
  switch (e.k) {
    case 'g': { // Grumble
      ctx.save(); ctx.translate(x + 13, y + 26); flip();
      const step = Math.sin(e.t * 0.25) * 3, d = e.vx > 0 ? 1 : -1, bob = Math.abs(Math.sin(e.t * 0.25)) * -1.5;
      el(-7 + step, -2, 6.5, 4); fs('#5a2f78'); el(7 - step, -2, 6.5, 4); fs('#5a2f78');
      ctx.translate(0, bob);
      ctx.beginPath(); ctx.moveTo(-15, -8); ctx.bezierCurveTo(-16, -28, 16, -28, 15, -8); ctx.bezierCurveTo(14, -1, -14, -1, -15, -8); ctx.closePath(); fs('#9b59d0');
      ctx.save(); ctx.clip(); el(4, 2, 18, 9); ctx.fillStyle = '#7b3fb5'; ctx.fill(); el(-6, -20, 6, 3.4, -0.5); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill(); ctx.restore();
      eye(-5.5, -15, 4.6, d * 1.4, 0.6); eye(5.5, -15, 4.6, d * 1.4, 0.6);
      ctx.strokeStyle = OL; ctx.lineWidth = 2.8; ctx.beginPath(); ctx.moveTo(-11, -22.5); ctx.lineTo(-2, -18.5); ctx.moveTo(11, -22.5); ctx.lineTo(2, -18.5); ctx.stroke();
      ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, -3.5, 4.5, Math.PI + 0.35, -0.35); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-3, -7.2); ctx.lineTo(-1.6, -4.6); ctx.lineTo(-0.2, -7.6); ctx.fill();
      ctx.restore(); break;
    }
    case 's': { // Spiky
      ctx.save(); ctx.translate(x + 13, y + 24); flip();
      const step = Math.sin(e.t * 0.2) * 3, d = e.vx > 0 ? 1 : -1;
      el(-7 + step, -2, 5.5, 3.6); fs('#f2b56b'); el(7 - step, -2, 5.5, 3.6); fs('#f2b56b');
      el(d * 11, -7, 6.5, 6); fs('#ffd29a');
      for (let i = 0; i < 5; i++) { const a = Math.PI + 0.32 + i * 0.62; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.26) * 13, -9 + Math.sin(a - 0.26) * 11); ctx.lineTo(Math.cos(a) * 23, -9 + Math.sin(a) * 20); ctx.lineTo(Math.cos(a + 0.26) * 13, -9 + Math.sin(a + 0.26) * 11); ctx.closePath(); fs('#fff8e6', 1.3); }
      ctx.beginPath(); ctx.ellipse(0, -10, 14.5, 12, 0, Math.PI, 0); ctx.lineTo(14.5, -4); ctx.lineTo(-14.5, -4); ctx.closePath(); fs('#e8384f');
      ctx.save(); ctx.clip(); el(-5, -17, 6, 3, -0.4); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill(); ctx.fillStyle = '#b81f3a'; ctx.fillRect(-15, -7, 30, 4); ctx.restore();
      eye(d * 12.5, -8.5, 2.6, d * 0.6, 0);
      ctx.strokeStyle = OL; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(d * 9.5, -12.5); ctx.lineTo(d * 15, -11); ctx.stroke();
      ctx.restore(); break;
    }
    case 'p': { // sliding penguin
      ctx.save(); ctx.translate(x + 14, y + 28); flip(); ctx.scale(e.vx > 0 ? -1 : 1, 1); ctx.rotate(-0.15);
      el(11, -3, 6.5, 3.2, 0.3); fs('#ffa62b');
      el(0, -12.5, 13.5, 13.5); fs('#262a40');
      el(-1.5, -9.5, 8.5, 9.5); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.save(); ctx.translate(8, -11); ctx.rotate(0.5 + Math.sin(e.t * 0.3) * 0.25); el(0, 4, 3.6, 8); fs('#262a40'); ctx.restore();
      el(-4, -24, 3, 1.6, -0.3); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fill();
      eye(-6, -18.5, 3.2, -0.8, 0.2);
      ctx.beginPath(); ctx.moveTo(-10.5, -17.5); ctx.lineTo(-19, -14.5); ctx.lineTo(-10.5, -12.5); ctx.closePath(); fs('#ffa62b', 1.3);
      ctx.fillStyle = 'rgba(255,120,140,.6)'; el(-8, -12.5, 2.6, 1.6); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-11, -27.5, 15, 4.5, 2); fs('#ff4d8d', 1.2); ctx.beginPath(); ctx.roundRect(1, -26, 4, 9, 2); fs('#ff4d8d', 1.2);
      ctx.restore(); break;
    }
    case 'j': { // Boing
      ctx.save(); ctx.translate(x + 13, y + 26); flip();
      const up = !e.onGround && e.alive, sy = up ? 1.15 : (e.wait < 10 ? 0.8 : 1); ctx.scale(1 / sy, sy);
      el(-10, -2, 7.5, 4); fs('#2f9e44'); el(10, -2, 7.5, 4); fs('#2f9e44');
      el(0, -12, 15, 12.5); fs('#51cf66');
      ctx.save(); ctx.clip(); el(3, 0, 18, 8); ctx.fillStyle = '#37b24d'; ctx.fill(); ctx.restore();
      el(0, -7, 9, 6); ctx.fillStyle = '#c3fac8'; ctx.fill();
      eye(-7, -22.5, 5.6, e.dir * 1.4, 0); eye(7, -22.5, 5.6, e.dir * 1.4, 0);
      ctx.strokeStyle = OL; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, -12.5, 6, 0.25, Math.PI - 0.25); ctx.stroke();
      ctx.fillStyle = 'rgba(255,120,140,.5)'; el(-10, -11, 2.6, 1.6); ctx.fill(); el(10, -11, 2.6, 1.6); ctx.fill();
      ctx.restore(); break;
    }
    case 'b': { // bird
      ctx.save(); ctx.translate(x + 14, y + 11); if (!e.alive) ctx.scale(1, -1); ctx.scale(e.dir > 0 ? -1 : 1, 1);
      const flap = Math.sin(t * 0.4) * 0.9;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(20, -5); ctx.lineTo(18, 1); ctx.lineTo(21, 5); ctx.closePath(); fs('#ff9f1a', 1.3);
      el(0, 0, 12.5, 11.5); fs('#ffd43b');
      el(-2, 4.5, 7.5, 5.5); ctx.fillStyle = '#fff3bf'; ctx.fill();
      ctx.save(); ctx.translate(3, -2); ctx.rotate(flap); el(6, -6, 9.5, 5.2, -0.6); fs('#ffa41b', 1.4); ctx.restore();
      eye(-5, -3.5, 4, -1, 0);
      ctx.beginPath(); ctx.moveTo(-10.5, -0.5); ctx.lineTo(-19.5, 2); ctx.lineTo(-10.5, 4.5); ctx.closePath(); fs('#ff6b3a', 1.3);
      ctx.restore(); break;
    }
    case 'bullet': {
      ctx.save(); ctx.translate(x + 12, y + 10); if (!e.alive) ctx.scale(1, -1); ctx.scale(e.vx > 0 ? -1 : 1, 1);
      if (e.alive) for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(255,255,255,${0.35 - i * 0.1})`; ctx.beginPath(); ctx.arc(15 + i * 6 + Math.sin(t * 0.5 + i) * 1.5, 0, 4 - i, 0, 7); ctx.fill(); }
      ctx.beginPath(); ctx.roundRect(-12, -10, 24, 20, [10, 3, 3, 10]); fs('#2b2b38');
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.roundRect(-8, -8, 16, 3.5, 2); ctx.fill(); ctx.fillStyle = '#55556b'; ctx.fillRect(7, -9, 3, 18);
      eye(-4.5, -1.5, 4, -1, 0.3);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9.5, -8.5); ctx.lineTo(-1, -6); ctx.stroke();
      ctx.restore(); break;
    }
    case 'spring': {
      const c = e.comp > 0 ? Math.sin(e.comp / 12 * Math.PI) * 8 : 0;
      ctx.beginPath(); ctx.roundRect(x + 1, y + 16, 26, 5, 2); fs('#4a4f60', 1.3);
      for (const [col, lw] of [[OL, 5], ['#c9cfdc', 2.6]]) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); for (let i = 0; i <= 4; i++) ctx.lineTo(x + (i % 2 ? 6 : 22), y + 17 - i * (11 - c) / 4); ctx.stroke(); }
      ctx.beginPath(); ctx.roundRect(x - 1, y + 1 + c, 30, 7, 3.5); fs('#ff4d6d');
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.roundRect(x + 2, y + 2.3 + c, 24, 2, 1); ctx.fill();
      break;
    }
    case 'mplat': case 'vplat': case 'fall': {
      if (e.fall && e.respawn > 0) break;
      let sx = x; if (e.fall && e.stood > 10 && !e.falling) sx += Math.sin(t * 1.5) * 2;
      if (lv.theme === 'sky' && !e.fall) {
        ctx.fillStyle = 'rgba(190,150,230,.45)'; el(sx + e.w / 2, y + 17, e.w / 2 - 2, 4); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); for (let i = 0; i <= e.w; i += 16) ctx.arc(sx + i, y + 8 - (i % 32 ? 2 : 0), 10, 0, 7); ctx.rect(sx, y + 6, e.w, 10); ctx.fill();
        ctx.beginPath(); ctx.roundRect(sx + 6, y + 11, e.w - 12, 4.5, 2.2); ctx.fillStyle = '#ff9bd3'; ctx.fill();
      } else {
        const cols = e.fall ? ['#f0b455', '#c98428'] : lv.theme === 'castle' ? ['#a9a9c2', '#6f6f88'] : ['#7cc8ff', '#3f8fe0'];
        ctx.beginPath(); ctx.roundRect(sx, y, e.w, 14, 5); ctx.fillStyle = vgrad(ctx, y, y + 14, cols[0], cols[1]); ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = OL; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.roundRect(sx + 4, y + 2, e.w - 8, 2.2, 1); ctx.fill();
        ctx.fillStyle = 'rgba(43,26,58,.55)'; for (const rx of [6, e.w - 6]) { ctx.beginPath(); ctx.arc(sx + rx, y + 8.5, 1.6, 0, 7); ctx.fill(); }
        if (e.fall) { ctx.strokeStyle = 'rgba(90,40,0,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 14; i < e.w - 8; i += 14) { ctx.moveTo(sx + i, y + 2.5); ctx.lineTo(sx + i - 3, y + 7); ctx.lineTo(sx + i + 1, y + 11.5); } ctx.stroke(); }
        else { ctx.fillStyle = '#fff'; ctx.beginPath(); const mx = sx + e.w / 2; if (e.axis === 'x') { ctx.moveTo(mx - 13, y + 8); ctx.lineTo(mx - 6, y + 4); ctx.lineTo(mx - 6, y + 12); ctx.moveTo(mx + 13, y + 8); ctx.lineTo(mx + 6, y + 4); ctx.lineTo(mx + 6, y + 12); } else { ctx.moveTo(mx, y + 3.5); ctx.lineTo(mx - 6, y + 9.5); ctx.lineTo(mx + 6, y + 9.5); } ctx.fill(); }
      }
      break;
    }
    case 'check': {
      ctx.beginPath(); ctx.roundRect(x - 2, y + e.h - 7, 20, 7, 3); fs('#7d8296', 1.4);
      ctx.beginPath(); ctx.roundRect(x + 5.5, y, 5, e.h - 5, 2); fs('#e9ecf5', 1.4);
      ctx.beginPath(); ctx.arc(x + 8, y - 1, 4.5, 0, 7); fs(e.on ? '#ffd84a' : '#b9bdcc', 1.4);
      const wave = Math.sin(t * 0.15) * 3;
      ctx.beginPath(); ctx.moveTo(x + 10.5, y + 4); ctx.quadraticCurveTo(x + 26, y + 3 + wave, x + 42, y + 13 + wave); ctx.quadraticCurveTo(x + 26, y + 20 + wave * 0.5, x + 10.5, y + 26); ctx.closePath(); fs(e.on ? '#34d07f' : '#c9ccd8');
      if (e.on) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x + 17, y + 14.5); ctx.lineTo(x + 21, y + 18); ctx.lineTo(x + 27, y + 10.5); ctx.stroke(); drawGlow('rgba(90,255,160,.5)', 40, x + 22, y + 14, 0.5); }
      break;
    }
    case 'goal': {
      drawGlow('rgba(255,225,90,.5)', 70, x + 4, y - 6, 0.5 + Math.sin(t * 0.08) * 0.15);
      ctx.beginPath(); ctx.roundRect(x - 14, y + e.h - 14, 36, 14, 4); fs('#6b7086'); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x - 10, y + e.h - 12, 28, 2.5);
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, 8, e.h - 12, 3); ctx.clip();
      ctx.fillStyle = '#f4f6fb'; ctx.fillRect(x, y, 8, e.h); ctx.fillStyle = '#ff6fa8'; for (let i = -10; i < e.h; i += 22) { ctx.beginPath(); ctx.moveTo(x, y + i + 10); ctx.lineTo(x + 8, y + i); ctx.lineTo(x + 8, y + i + 9); ctx.lineTo(x, y + i + 19); ctx.fill(); }
      ctx.restore(); ctx.beginPath(); ctx.roundRect(x, y, 8, e.h - 12, 3); ctx.lineWidth = 1.6; ctx.strokeStyle = OL; ctx.stroke();
      ctx.save(); ctx.translate(x + 4, y - 7); ctx.rotate(t * 0.02); star(0, 0, 11, 5); fs('#ffd84a', 1.5); ctx.restore();
      const fy = y + 8 + e.flagY, wave = Math.sin(t * 0.15) * 4;
      ctx.beginPath(); ctx.moveTo(x + 8, fy); ctx.quadraticCurveTo(x + 34, fy + 2 + wave, x + 60, fy + 17 + wave); ctx.quadraticCurveTo(x + 34, fy + 28 + wave * 0.5, x + 8, fy + 36); ctx.closePath(); fs('#ff4d8d');
      ctx.beginPath(); ctx.arc(x + 26, fy + 18 + wave * 0.4, 7, 0, 7); fs('#ffd84a', 1.2);
      ctx.strokeStyle = '#9a5f00'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + 26, fy + 18 + wave * 0.4, 3.8, 0.3, Math.PI - 0.3); ctx.stroke();
      break;
    }
    case 'firebar': {
      for (let i = 0; i < e.len; i++) {
        const r = 14 + i * 15, fx = e.cx + Math.cos(e.ang) * r - cx, fy = e.cy + Math.sin(e.ang) * r, fl = 7 + Math.sin(t * 0.5 + i) * 1.2;
        drawGlow('rgba(255,130,20,.6)', 26, fx, fy, 0.8);
        ctx.beginPath(); ctx.arc(fx, fy, fl + 2, 0, 7); ctx.fillStyle = '#ff6a00'; ctx.fill(); ctx.strokeStyle = '#b02a00'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.beginPath(); ctx.arc(fx, fy, fl - 2, 0, 7); ctx.fillStyle = '#ffd23a'; ctx.fill();
        ctx.beginPath(); ctx.arc(fx - 1, fy - 1, fl - 5, 0, 7); ctx.fillStyle = '#fff8c8'; ctx.fill();
      }
      break;
    }
    case 'crusher': {
      const sh = e.st === 'warn' ? Math.sin(t * 2) * 2 : 0, angry = e.st !== 'idle' && e.st !== 'cool';
      ctx.strokeStyle = '#5e6478'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + e.w / 2, e.y0); ctx.lineTo(x + e.w / 2, y + 4); ctx.stroke();
      ctx.save(); ctx.translate(x + sh, y);
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(4 + i * 10.4, e.h - 2); ctx.lineTo(9.2 + i * 10.4, e.h + 7); ctx.lineTo(14.4 + i * 10.4, e.h - 2); ctx.closePath(); fs('#dfe3ee', 1.2); }
      ctx.beginPath(); ctx.roundRect(0, 0, e.w, e.h, 7); ctx.fillStyle = vgrad(ctx, 0, e.h, '#a7b3cc', '#66728c'); ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = OL; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.roundRect(4, 3, e.w - 8, 4, 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.roundRect(4, e.h - 8, e.w - 8, 5, 2); ctx.fill();
      ctx.fillStyle = '#4c566e'; for (const [a, b2] of [[7, 9], [e.w - 7, 9], [7, e.h - 12], [e.w - 7, e.h - 12]]) { ctx.beginPath(); ctx.arc(a, b2, 2.6, 0, 7); ctx.fill(); }
      ctx.translate(e.w / 2, 0);
      eye(-11, 25, angry ? 7 : 5, 0, angry ? 2 : 0); eye(11, 25, angry ? 7 : 5, 0, angry ? 2 : 0);
      ctx.strokeStyle = OL; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-21, 13); ctx.lineTo(-5, 19); ctx.moveTo(21, 13); ctx.lineTo(5, 19); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(-13, 39, 26, angry ? 11 : 6, 3); fs('#2b1a3a', 1.2);
      if (angry) { ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) ctx.fillRect(-11 + i * 6, 40, 4.5, 4); }
      ctx.restore(); break;
    }
    case 'icicle': {
      const sh = e.st === 'shake' ? Math.sin(t * 2) * 1.5 : 0;
      ctx.beginPath(); ctx.moveTo(x + sh - 1, y); ctx.lineTo(x + 17 + sh, y); ctx.lineTo(x + 8 + sh, y + 29); ctx.closePath();
      const gr = ctx.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#f4fcff'); gr.addColorStop(1, '#8fcdf2'); ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = '#4f8fc4'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + 3 + sh, y + 2); ctx.lineTo(x + 6 + sh, y + 2); ctx.lineTo(x + 7 + sh, y + 16); ctx.fill();
      break;
    }
    case 'item': {
      ctx.save(); ctx.translate(x + 12, y + 12);
      drawGlow('rgba(255,255,220,.5)', 28, x + 12, y + 12, 0.6);
      if (e.kind === 'wings') {
        const f = Math.sin(t * 0.3) * 0.4;
        for (const s of [-1, 1]) { ctx.save(); ctx.scale(s, 1); ctx.rotate(f); el(9, -2, 10.5, 6.2, -0.5); fs('#fff', 1.4); el(10, 4.5, 7, 4, -0.2); fs('#e3f4ff', 1.3); ctx.restore(); }
        ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, 7); fs('#7fc8ff', 1.3);
      } else if (e.kind === 'star') {
        ctx.rotate(Math.sin(t * 0.1) * 0.2); star(0, 0, 14, 6.5); fs(`hsl(${t * 8 % 360},100%,62%)`, 1.5);
        ctx.fillStyle = OL; ctx.beginPath(); ctx.roundRect(-4.2, -4, 2.4, 5.4, 1.2); ctx.roundRect(1.8, -4, 2.4, 5.4, 1.2); ctx.fill();
      } else { const s = 1 + Math.sin(t * 0.2) * 0.08; ctx.scale(s, s); heart(0, 0, 12, '#ff4d6d'); ctx.fillStyle = 'rgba(255,255,255,.6)'; el(-4.5, -4, 2.8, 1.8, -0.6); ctx.fill(); }
      ctx.restore(); break;
    }
    case 'big': {
      drawGlow('rgba(255,235,120,.75)', 44, x + 15, y + 15, 0.6 + Math.sin(t * 0.1) * 0.2);
      ctx.save(); ctx.translate(x + 15, y + 15);
      ctx.save(); ctx.rotate(t * 0.02); ctx.fillStyle = 'rgba(255,246,170,.55)'; for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(22, -2.5); ctx.lineTo(31, 0); ctx.lineTo(22, 2.5); ctx.fill(); } ctx.restore();
      ctx.rotate(Math.sin(t * 0.06) * 0.25);
      star(0, 0, 19, 9); fs('#f2a900', 1.8); star(0, 0, 15, 7.2); ctx.fillStyle = '#ffe14a'; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; el(-5, -8, 3.5, 1.8, -0.6); ctx.fill();
      ctx.fillStyle = '#7a4a00'; ctx.beginPath(); ctx.arc(-4, -1.5, 1.9, 0, 7); ctx.arc(4, -1.5, 1.9, 0, 7); ctx.fill();
      ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, 1, 5, 0.3, Math.PI - 0.3); ctx.stroke();
      ctx.restore(); break;
    }
    case 'fb': {
      const fy = y + 8 + Math.abs(Math.sin(e.t * 0.25)) * -6, d = Math.sign(e.vx);
      drawGlow('rgba(255,130,20,.6)', 30, x + 8, fy, 0.8);
      ctx.fillStyle = 'rgba(255,140,0,.55)'; ctx.beginPath(); ctx.moveTo(x + 8, fy - 8); ctx.lineTo(x + 8 - d * 24, fy); ctx.lineTo(x + 8, fy + 8); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 8, fy, 10, 0, 7); ctx.fillStyle = '#ff6a00'; ctx.fill(); ctx.strokeStyle = '#b02a00'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 8, fy, 6, 0, 7); ctx.fillStyle = '#ffd23a'; ctx.fill();
      ctx.fillStyle = OL; ctx.beginPath(); ctx.arc(x + 8 + d * 2.5, fy - 1.5, 1.3, 0, 7); ctx.arc(x + 8 + d * 6, fy - 1.5, 1.3, 0, 7); ctx.fill();
      break;
    }
    case 'boss': {
      if (e.alive && e.inv > 0 && Math.floor(e.inv / 4) % 2) break;
      if (e.alive && e.onGround) shadow(x + 32, y + 61, 38);
      ctx.save(); ctx.translate(x + 32, y + 60); if (!e.alive) ctx.scale(1, -1);
      const sy = e.st === 'idle' && e.wait < 14 ? 0.84 : (e.st === 'air' ? 1.08 : 1); ctx.scale(1 / sy, sy);
      const col = [['#e03a5a', '#b3203f'], ['#c44aa8', '#983483'], ['#9b59d0', '#7438ad']][Math.max(0, Math.min(2, e.hp - 1))];
      const awake = e.st !== 'sleep', pl = awake ? nearestPlayer(e.x + 32) : null, d = pl && pl.x < e.x + 32 ? -1 : 1;
      // cape
      ctx.beginPath(); ctx.moveTo(-26, -44); ctx.quadraticCurveTo(-44 - d * 4, -20, -40 + Math.sin(t * 0.1) * 3, -2); ctx.lineTo(40 + Math.sin(t * 0.1 + 1) * 3, -2); ctx.quadraticCurveTo(44 - d * 4, -20, 26, -44); ctx.closePath(); fs('#7a1a2e', 1.8);
      // feet and arms
      el(-18, -4, 14, 8); fs('#4a2a60', 1.8); el(18, -4, 14, 8); fs('#4a2a60', 1.8);
      const arm = e.st === 'air' ? -0.9 : Math.sin(t * 0.08) * 0.15;
      for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 31, -30); ctx.rotate(s * (0.5 + arm)); el(0, 9, 7, 11); fs(col[0], 1.8); el(0, 19, 6.5, 6); fs('#fff', 1.6); ctx.restore(); }
      // body
      el(0, -30, 35, 30); fs(col[0], 2);
      ctx.save(); ctx.clip(); el(6, -6, 40, 16); ctx.fillStyle = col[1]; ctx.fill(); el(-13, -47, 13, 7, -0.4); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fill(); ctx.restore();
      el(0, -17, 17, 12); ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fill();
      // crown
      ctx.beginPath(); ctx.moveTo(-21, -53); ctx.lineTo(-24, -77); ctx.lineTo(-11, -64); ctx.lineTo(0, -82); ctx.lineTo(11, -64); ctx.lineTo(24, -77); ctx.lineTo(21, -53); ctx.closePath(); fs('#ffd84a', 1.8);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-19, -58, 38, 2.2);
      for (const [gx, gy, gc] of [[0, -62, '#ff4d6d'], [-13, -59, '#4fb3ff'], [13, -59, '#51cf66']]) { ctx.beginPath(); ctx.arc(gx, gy, gx ? 2.6 : 3.8, 0, 7); fs(gc, 1.1); }
      for (const gx of [-24, 0, 24]) { ctx.beginPath(); ctx.arc(gx, gx ? -78 : -83, 2.8, 0, 7); fs('#fff3a6', 1.1); }
      if (!awake) {
        ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-12, -36, 7, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.beginPath(); ctx.arc(12, -36, 7, 0.2, Math.PI - 0.2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -19, 5, 0.2, Math.PI - 0.2); ctx.stroke();
        for (let i = 0; i < 3; i++) { const ph = (t + i * 30) % 90; text('Z', 32 + ph * 0.3, -66 - ph * 0.5, 12 + i * 4, `rgba(255,255,255,${1 - ph / 90})`, 'center', null); }
      } else {
        eye(-12, -37, 10, d * 3, 2); eye(12, -37, 10, d * 3, 2);
        ctx.strokeStyle = OL; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(-26, -52); ctx.lineTo(-4, -44); ctx.moveTo(26, -52); ctx.lineTo(4, -44); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(-16, -22, 32, 13, 5); fs('#3a1028', 1.6);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = OL; ctx.lineWidth = 1;
        for (const tx2 of [-11, -3, 5]) { ctx.beginPath(); ctx.moveTo(tx2, -22); ctx.lineTo(tx2 + 3, -15.5); ctx.lineTo(tx2 + 6, -22); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        for (const tx2 of [-7, 1]) { ctx.beginPath(); ctx.moveTo(tx2, -9); ctx.lineTo(tx2 + 3, -14.5); ctx.lineTo(tx2 + 6, -9); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      }
      ctx.restore(); break;
    }
  }
}

function drawParticles() {
  const cx = Math.round(game.cam.x);
  for (const q of parts) {
    if (q.coin) { drawCoin(q.x - cx, q.y, game.t * 3, 9); continue; }
    ctx.globalAlpha = Math.min(1, q.life / 20);
    ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x - cx, q.y, q.size * 0.62, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const q of popups) { ctx.globalAlpha = Math.min(1, q.life / 20); text(q.text, q.x - cx, q.y, 16, q.color, 'center', '#222', 4); }
  ctx.globalAlpha = 1;
}

// Castle only: a dark veil with pools of light around the heroes, fire and lava
let lightCv = null;
function drawLights() {
  if (lv.theme !== 'castle') return;
  const k = 4, w = Math.ceil(VW / k), h = Math.ceil(VH / k);
  if (!lightCv || lightCv.width !== w) { lightCv = document.createElement('canvas'); lightCv.width = w; lightCv.height = h; }
  const g = lightCv.getContext('2d'), cx = game.cam.x;
  g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(8,2,20,.52)'; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out';
  const light = (x, y, r, a = 1) => { const gr = g.createRadialGradient(x / k, y / k, 0, x / k, y / k, r / k); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect((x - r) / k, (y - r) / k, r * 2 / k, r * 2 / k); };
  for (const p of game.players) if (!p.gone) light(p.x + p.w / 2 - cx, p.y + 20, 190);
  for (const e of game.ents) {
    const ex = e.x - cx; if (ex < -200 || ex > VW + 200) continue;
    if (e.k === 'firebar') light(e.cx - cx, e.cy, 60 + e.len * 18, 0.9);
    else if (e.k === 'fb' || e.k === 'item' || e.k === 'big') light(ex + 10, e.y + 10, 90, 0.9);
    else if (e.k === 'boss') light(ex + 32, e.y + 20, 170, 0.8);
    else if (e.k === 'goal') light(ex, e.y + 120, 200, 0.9);
    else if (e.k === 'check' && e.on) light(ex + 10, e.y + 20, 110, 0.8);
    else if (e.k === 'crusher') light(ex + 30, e.y + 30, 80, 0.45);
  }
  for (let x = -Math.round((cx * 0.3) % 320) - 320; x < VW + 320; x += 320) light(x + 160, 226, 150, 0.75); // torches
  const lg = g.createLinearGradient(0, (VH - 150) / k, 0, h); lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,.75)'); g.fillStyle = lg; g.fillRect(0, (VH - 150) / k, w, 150 / k);
  ctx.drawImage(lightCv, 0, 0, VW, VH);
}
