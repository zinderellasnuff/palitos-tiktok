// Palitos: Azul vs Rojo. Dibuja la pelea en una hoja de cuaderno y recibe los eventos del live.
// Las reglas viven en logic.js (probadas con `npm test`); aquí solo se dibuja, suena y se lee al público.
// `window.handle(ev)` es la entrada única: ev = { type: 'comment'|'like'|'gift'|'follow'|'share', user, avatar, text, diamonds, count }
import { CFG, UNITS, teamOf, giftPack, createState, spawnFor, step, eraser, winner, mvp, other, countOf } from './logic.js';

const $ = s => document.querySelector(s);
const cv = $('#hoja');
let c = cv.getContext('2d'); // `let`: el fondo de la hoja se dibuja una vez en otro lienzo con las mismas funciones
const W = 720, H = 1280;
const FONT = '"Patrick Hand", "Comic Sans MS", cursive';
const COLOR = { azul: '#1d4fc4', rojo: '#d02a2a' }, LIGHT = { azul: '#1d4fc433', rojo: '#d02a2a33' }, NAME = { azul: 'AZUL', rojo: 'ROJO' };
const PENCIL = '#3a3a44';
// Zonas: arriba y abajo TikTok pone sus botones y su chat; lo importante va en el medio.
const FIELD = { top: 610, bottom: 890 };
const X = x => 30 + x * 6.6, Y = row => FIELD.top + 30 + row * (FIELD.bottom - FIELD.top - 40);

// ---------- sonido (sintetizado; el navegador lo activa con el primer clic, OBS lo deja sonar solo) ----------
let ac = null, muted = false;
function tone(freq, dur, type = 'triangle', vol = 0.12, slide = 0) {
  if (muted) return;
  try {
    ac ??= new AudioContext();
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur);
  } catch { /* sin audio: el juego sigue igual */ }
}
const SFX = {
  draw: () => tone(900, 0.07, 'sawtooth', 0.03, -500),
  hit: () => tone(180, 0.06, 'square', 0.04, -80),
  base: () => tone(90, 0.18, 'sawtooth', 0.09, -40),
  gift: () => { tone(660, 0.12); setTimeout(() => tone(990, 0.2), 110); },
  eraser: () => tone(300, 0.6, 'sawtooth', 0.08, -220),
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'triangle', 0.14), i * 150)),
  tick: () => tone(500, 0.05, 'square', 0.05),
};

// ---------- estado ----------
let s = createState();
let phase = 'countdown', phaseT = CFG.countdown, timeLeft = CFG.roundTime, won = null, best = null;
const viewers = new Map(); // nombre → { team, img, lastFree, initial }
const pending = [];        // palitos pedidos en la cuenta regresiva: salen al empezar
const fx = [];             // efectos: migas de borrador, bolitas de papel, golpes
const feedLines = [];
const announces = [];      // regalos en grande, uno a la vez
const shake = { azul: 0, rojo: 0 };
let eraserFx = null, flipFx = null, quake = 0;
const marks = [];          // lo que queda en la hoja: manchas de borrador, rayas de plumón, franjas limpias
const mark = m => { marks.push(m); if (marks.length > 90) marks.shift(); };
const wins = JSON.parse(localStorage.getItem('palitos-wins') || '{"azul":0,"rojo":0}');
const week = () => Math.floor((Date.now() / 86400000 + 3) / 7);
let ranking = JSON.parse(localStorage.getItem('palitos-rank') || '{}');
if (ranking.week !== week()) ranking = { week: week(), pts: {} };
const save = () => { localStorage.setItem('palitos-rank', JSON.stringify(ranking)); localStorage.setItem('palitos-wins', JSON.stringify(wins)); };

function feed(text, team) {
  feedLines.unshift({ text, team, t: performance.now() });
  feedLines.length = Math.min(feedLines.length, 3);
}

function viewer(name, avatar) {
  let v = viewers.get(name);
  if (!v) {
    v = { team: null, img: null, lastFree: -99, initial: (name[0] || '?').toUpperCase() };
    viewers.set(name, v);
    if (avatar) { // foto real de TikTok; si no carga se queda la inicial
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { v.img = img; };
      img.src = avatar;
    }
  }
  return v;
}
const members = team => [...viewers.values()].filter(v => v.team === team).length;
const smaller = () => (members('azul') <= members('rojo') ? 'azul' : 'rojo');

function send(name, v, kind, gift) {
  if (phase === 'countdown') { pending.push({ name, team: v.team, kind, gift }); return true; }
  if (phase !== 'playing') return false;
  const u = spawnFor(s, v.team, kind, name, gift);
  if (u) { SFX.draw(); entrance(u); }
  return !!u;
}

// Entrada con espectáculo: el Plumón llega pintando una raya gruesa y hace temblar la hoja.
function entrance(u) {
  if (u?.kind !== 'plumon') return;
  mark({ type: 'stroke', team: u.team, row: u.row, t0: s.t });
  quake = Math.max(quake, 0.25);
}

// ---------- entrada única ----------
function handle(ev) {
  const name = String(ev.user || '').trim().slice(0, 20);
  if (!name) return;
  const v = viewer(name, ev.avatar);
  if (ev.type === 'comment') {
    const t = teamOf(ev.text);
    if (t && (!v.team || phase === 'countdown')) { // el bando se elige una vez; solo se cambia entre rondas
      if (v.team !== t) feed(`${name} se unió a ${NAME[t]}`, t);
      v.team = t;
    }
    if (!v.team) return;
    if (s.t - v.lastFree >= CFG.commentEvery || phase === 'countdown' && !pending.some(p => p.name === name)) {
      if (send(name, v, 'rayon', false)) v.lastFree = s.t;
    }
  } else if (ev.type === 'like') {
    if (v.team) s.ink[v.team] += CFG.inkPerLike * Math.min(20, Number(ev.count) || 1);
  } else if (ev.type === 'follow' || ev.type === 'share') {
    v.team ??= smaller();
    const kind = ev.type === 'follow' ? 'tapa' : 'corrector';
    send(name, v, kind, true);
    feed(`${name} ${ev.type === 'follow' ? 'siguió' : 'compartió'}: ${UNITS[kind].name} para ${NAME[v.team]}`, v.team);
  } else if (ev.type === 'gift') {
    const pack = giftPack(Number(ev.diamonds) || 0);
    if (!pack.units.length) return;
    v.team ??= smaller(); // un regalo nunca se pierde: si no eligió bando, va al que tiene menos gente
    for (const kind of pack.units) send(name, v, kind, true);
    if (pack.power === 'borrador' && phase === 'playing') {
      const events = [];
      const center = eraser(s, v.team, events);
      if (center !== null) { eraserFx = { x: center, t: 0 }; SFX.eraser(); onEvents(events); quake = Math.max(quake, 0.5); }
      if (pack.label === 'HOJA NUEVA') flipFx = { team: other(v.team), t: 0 };
    }
    announces.push({ name, v, label: pack.label, t: 0 });
    feed(`${name} mandó ${pack.label} a ${NAME[v.team]}`, v.team);
    SFX.gift();
  }
}
window.handle = handle;

const PAF = ['¡PAF!', '¡ZAS!', '¡POW!', '¡TOC!', '¡PUM!'];
function onEvents(events) {
  for (const e of events) {
    if (e.type === 'die') {
      const x = X(e.unit.x), y = Y(e.unit.row), col = COLOR[e.unit.team];
      for (let i = 0; i < 6; i++) fx.push({ kind: 'crumb', x: x + (Math.random() - 0.5) * 24, y: y - Math.random() * 40, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 60, t: 0, life: 0.7 });
      for (let i = 0; i < 5; i++) fx.push({ kind: 'piece', x, y: y - 10 - i * 8, vx: (Math.random() - 0.5) * 110, vy: -40 - Math.random() * 90, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 14, col, t: 0, life: 0.6 }); // se desarma en rayitas
      fx.push({ kind: 'mini', x, y, t: -0.35, life: 0.45 }); // y un borrador chiquito lo limpia
    } else if (e.type === 'shot') {
      fx.push({ kind: 'ball', x0: X(e.unit.x), y0: Y(e.unit.row) - 34, x1: X(e.target.x), y1: Y(e.target.row) - 24, t: 0, life: 0.18 });
    } else if (e.type === 'tower') {
      fx.push({ kind: 'ball', x0: X(CFG.baseX[e.team]), y0: FIELD.bottom - 200, x1: X(e.target.x), y1: Y(e.target.row) - 24, t: 0, life: 0.2 });
    } else if (e.type === 'beam') {
      const dir = e.unit.team === 'azul' ? 1 : -1;
      fx.push({ kind: 'beam', x0: X(e.unit.x) + dir * 14, x1: X(e.unit.x + dir * UNITS.resaltador.range), y: Y(e.unit.row) - 28, t: 0, life: 0.35 });
    } else if (e.type === 'heal') {
      fx.push({ kind: 'plus', x: X(e.target.x), y: Y(e.target.row) - 60, t: 0, life: 0.6 });
    } else if (e.type === 'hit') {
      const heavy = e.unit.kind === 'plumon' || e.unit.kind === 'compas';
      if (heavy || Math.random() < 0.22) fx.push({ kind: 'paf', x: X(e.target.x), y: Y(e.target.row) - 34, word: PAF[Math.floor(Math.random() * PAF.length)], rot: (Math.random() - 0.5) * 0.6, big: heavy, t: 0, life: 0.4 });
      if (e.unit.kind === 'plumon') quake = Math.max(quake, 0.12);
      if (Math.random() < 0.3) SFX.hit();
    } else if (e.type === 'base') {
      shake[e.team] = 0.25;
      if (e.unit.kind === 'plumon') quake = Math.max(quake, 0.15);
      if (Math.random() < 0.4) SFX.base();
    }
  }
}

function startRound() {
  s = createState();
  phase = 'countdown'; phaseT = CFG.countdown; timeLeft = CFG.roundTime; won = null; best = null;
  pending.length = 0; fx.length = 0; marks.length = 0; eraserFx = flipFx = null;
  for (const v of viewers.values()) v.lastFree = -99;
}

function endRound(w) {
  phase = 'end'; phaseT = CFG.endTime; won = w; best = mvp(s);
  if (w !== 'empate') wins[w]++;
  for (const [name, dmg] of Object.entries(s.score)) ranking.pts[name] = (ranking.pts[name] ?? 0) + Math.round(dmg / 10);
  save();
  SFX.win();
}

// ---------- dibujo ----------
// Número "al azar" fijo para una semilla: así cada trazo tiembla siempre igual dentro de un mismo cuadro de animación.
const hash = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
let boil = 0; // cambia 7 veces por segundo: la línea "hierve" como dibujo animado a mano
function line(x1, y1, x2, y2, seed = 0) {
  const j = 1.6, k = seed * 13 + boil;
  c.beginPath();
  c.moveTo(x1 + (hash(k) - 0.5) * j, y1 + (hash(k + 1) - 0.5) * j);
  c.quadraticCurveTo((x1 + x2) / 2 + (hash(k + 2) - 0.5) * j * 3, (y1 + y2) / 2 + (hash(k + 3) - 0.5) * j * 3, x2 + (hash(k + 4) - 0.5) * j, y2 + (hash(k + 5) - 0.5) * j);
  c.stroke();
}
function text(str, x, y, size, color = PENCIL, align = 'center') {
  c.font = `${size}px ${FONT}`; c.textAlign = align; c.fillStyle = color;
  c.fillText(str, x, y);
}

// La hoja se dibuja una sola vez (cuadrícula, margen y garabatos de cuaderno) y después solo se pega en cada cuadro.
let bg = null;
function buildPaper() {
  bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  const main = c; c = bg.getContext('2d');
  c.fillStyle = '#fbf7ea'; c.fillRect(0, 0, W, H);
  c.lineWidth = 1; c.strokeStyle = '#bcd6ee';
  c.beginPath();
  for (let x = 0; x <= W; x += 36) { c.moveTo(x, 0); c.lineTo(x, H); }
  for (let y = 0; y <= H; y += 36) { c.moveTo(0, y); c.lineTo(W, y); }
  c.stroke();
  c.strokeStyle = '#f0a0a0'; c.lineWidth = 2; // margen rojo de cuaderno
  c.beginPath(); c.moveTo(0, 150); c.lineTo(W, 150); c.stroke();
  c.fillStyle = '#e9e2cf'; // huecos de la hoja
  for (const y of [210, 640, 1070]) { c.beginPath(); c.arc(14, y, 7, 0, 7); c.fill(); }
  c.lineCap = 'round';
  // mancha de café
  c.strokeStyle = 'rgba(140,90,40,0.16)'; c.lineWidth = 10;
  c.beginPath(); c.arc(590, 1100, 62, 0.3, 5.6); c.stroke();
  c.fillStyle = 'rgba(140,90,40,0.05)'; c.beginPath(); c.arc(590, 1100, 58, 0, 7); c.fill();
  // solcito en la esquina
  c.strokeStyle = 'rgba(58,58,68,0.45)'; c.lineWidth = 2.5;
  c.beginPath(); c.arc(660, 62, 22, 0, 7); c.stroke();
  for (let i = 0; i < 10; i++) { const a = i * 0.63; line(660 + Math.cos(a) * 30, 62 + Math.sin(a) * 30, 660 + Math.cos(a) * 44, 62 + Math.sin(a) * 44, 300 + i); }
  text('Cuaderno de guerra', 130, 128, 24, 'rgba(58,58,68,0.55)');
  // "Juan + María", tachado
  c.save(); c.translate(150, 1040); c.rotate(-0.07);
  text('Juan', -52, 0, 30, 'rgba(58,58,68,0.6)'); text('María', 62, 0, 30, 'rgba(58,58,68,0.6)');
  c.strokeStyle = 'rgba(208,42,42,0.6)'; c.lineWidth = 2.5; // corazón
  c.beginPath(); c.moveTo(4, 2); c.bezierCurveTo(-14, -14, -8, -26, 4, -14); c.bezierCurveTo(16, -26, 22, -14, 4, 2); c.stroke();
  c.strokeStyle = 'rgba(58,58,68,0.6)'; line(-90, -6, 104, -12, 320); line(-88, -14, 100, -2, 321);
  c.restore();
  // una suma mal hecha, corregida con rojo
  text('7 x 8 = 54', 130, 1150, 32, 'rgba(58,58,68,0.6)');
  c.strokeStyle = 'rgba(208,42,42,0.7)'; c.lineWidth = 2.5; line(168, 1128, 204, 1156, 330);
  text('56', 222, 1128, 28, 'rgba(208,42,42,0.75)');
  // michi (tres en raya)
  c.strokeStyle = 'rgba(58,58,68,0.5)'; c.lineWidth = 2.5;
  line(350, 1090, 350, 1180, 340); line(382, 1090, 382, 1180, 341); line(320, 1120, 412, 1120, 342); line(320, 1150, 412, 1150, 343);
  text('X', 335, 1114, 24, 'rgba(29,79,196,0.6)'); text('O', 366, 1144, 24, 'rgba(208,42,42,0.6)'); text('X', 397, 1174, 24, 'rgba(29,79,196,0.6)'); text('O', 335, 1174, 24, 'rgba(208,42,42,0.6)');
  // estrella y espiral
  c.strokeStyle = 'rgba(58,58,68,0.45)';
  c.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * 2.513; c.lineTo(470 + Math.cos(a) * 26, 1220 + Math.sin(a) * 26); } c.stroke();
  c.beginPath(); for (let a = 0; a < 16; a += 0.3) c.lineTo(80 + Math.cos(a) * a * 1.8, 1220 + Math.sin(a) * a * 1.8); c.stroke();
  c = main;
}
function paper() {
  if (!bg) buildPaper();
  c.drawImage(bg, 0, 0);
  // lo que la pelea va dejando en la hoja
  for (const m of marks) {
    if (m.type === 'smudge') { c.fillStyle = 'rgba(120,120,130,0.10)'; c.beginPath(); c.ellipse(m.x, m.y, 20, 7, m.rot, 0, 7); c.fill(); }
    else if (m.type === 'clean') {
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(m.x - m.w / 2, FIELD.top - 40, m.w, FIELD.bottom - FIELD.top + 50);
      c.strokeStyle = 'rgba(150,150,160,0.25)'; c.lineWidth = 1.5; // arrugas
      for (let i = 0; i < 5; i++) line(m.x - m.w / 2 + hash(m.x + i) * m.w, FIELD.top - 30, m.x - m.w / 2 + hash(m.x + i + 9) * m.w, FIELD.bottom, 700 + i);
    } else if (m.type === 'stroke') { // la raya del Plumón: se pinta rápido y se va secando
      const age = s.t - m.t0, k = Math.min(1, age / 0.5), fade = Math.max(0, 1 - Math.max(0, age - 4) / 4);
      if (fade <= 0) continue;
      const x0 = X(CFG.baseX[m.team]), x1 = x0 + (W / 2 - x0) * k * 0.9, y = Y(m.row) + 4;
      c.strokeStyle = COLOR[m.team]; c.globalAlpha = 0.22 * fade; c.lineWidth = 16; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
      c.globalAlpha = 1;
    }
  }
  c.strokeStyle = PENCIL; c.lineWidth = 2.5; c.lineCap = 'round'; // el piso de la pelea
  line(20, FIELD.bottom + 6, W - 20, FIELD.bottom + 6, 900);
}

function castle(team) {
  const hp = s.hp[team] / CFG.baseHp, x = X(CFG.baseX[team]) + (shake[team] > 0 ? (Math.random() - 0.5) * 10 : 0);
  const w = 84, h = 230, top = FIELD.bottom - h, col = COLOR[team], seed = team === 'azul' ? 100 : 200;
  // lo ya borrado queda como marca gris de borrador
  c.save();
  c.globalAlpha = 0.18; c.strokeStyle = '#888'; c.lineWidth = 3;
  drawCastle(x, top, w, h, seed);
  c.restore();
  // lo que queda del dibujo: se va borrando de arriba hacia abajo
  c.save();
  c.beginPath(); c.rect(x - w, top + h * (1 - hp) - 40 * hp, w * 2, h + 60); c.clip();
  c.strokeStyle = col; c.lineWidth = 4; c.fillStyle = LIGHT[team];
  c.fillRect(x - w / 2, top + 30, w, h - 30);
  drawCastle(x, top, w, h, seed);
  c.restore();
}
function drawCastle(x, top, w, h, seed) {
  const l = x - w / 2, r = x + w / 2, b = top + h;
  line(l, b, l, top + 30, seed); line(r, b, r, top + 30, seed + 1);
  for (let i = 0; i < 4; i++) { // almenas
    const a = l + (w / 4) * i, m = a + w / 8, z = a + w / 4;
    line(a, top + 30, a, top + 8, seed + 10 + i); line(a, top + 8, m, top + 8, seed + 20 + i); line(m, top + 8, m, top + 30, seed + 30 + i); line(m, top + 30, z, top + 30, seed + 40 + i);
  }
  line(x - 14, b, x - 14, b - 50, seed + 50); line(x + 14, b, x + 14, b - 50, seed + 51); // puerta
  c.beginPath(); c.arc(x, b - 50, 14, Math.PI, 0); c.stroke();
  line(x, top + 8, x, top - 46, seed + 60); // bandera
  c.beginPath(); c.moveTo(x, top - 46); c.lineTo(x + 34, top - 34); c.lineTo(x, top - 22); c.stroke();
}

function palito(u) {
  const def = UNITS[u.kind], dir = u.team === 'azul' ? 1 : -1, big = u.kind === 'plumon' ? 1.6 : 1;
  const x = X(u.x), y = Y(u.row), col = COLOR[u.team], age = s.t - u.born;
  const hitting = s.t - (u.hitAt ?? -9) < 0.18, moving = !hitting && s.t - (u.hitAt ?? -9) > def.cd + 0.1;
  const swing = moving ? Math.sin(s.t * 11 + u.id) * 8 : 0;
  c.save();
  const hurtNow = s.t - (u.hurtAt ?? -9) < 0.12; // recibe un golpe: retrocede un poquito y parpadea
  c.translate(x - (hurtNow ? dir * 5 : 0), y); c.scale(big, big);
  if (age < 0.45) c.globalAlpha = age / 0.45; // se va trazando al nacer
  else if (hurtNow) c.globalAlpha = 0.55;
  c.strokeStyle = col; c.lineWidth = u.kind === 'plumon' ? 5 : 3; c.lineCap = 'round';
  const id = u.id;
  c.beginPath(); c.arc(0, -44, 8, 0, 7); c.stroke();          // cabeza
  line(0, -36, 0, -16, id);                                   // cuerpo
  line(0, -16, -7 + swing, 0, id + 1); line(0, -16, 7 - swing, 0, id + 2); // piernas
  const reach = hitting ? 16 : 9;
  line(0, -30, dir * reach, -24 - (hitting ? 6 : 0), id + 3); // brazo de adelante
  line(0, -30, -dir * 7, -20, id + 4);                        // brazo de atrás
  const hx = dir * reach, hy = -24 - (hitting ? 6 : 0);
  if (u.kind === 'rayon') line(hx, hy + 4, hx + dir * (hitting ? 16 : 6), hy - (hitting ? 4 : 22), id + 5);
  else if (u.kind === 'tapa') { c.fillStyle = '#fbf7ea'; c.beginPath(); c.roundRect(dir * 12 - 5, -40, 10, 34, 5); c.fill(); c.stroke(); }
  else if (u.kind === 'tirachinas') { line(hx, hy, hx, hy - 12, id + 5); line(hx, hy - 12, hx - 6, hy - 22, id + 6); line(hx, hy - 12, hx + 6, hy - 22, id + 7); }
  else if (u.kind === 'compas') { const a = hitting ? s.t * 30 : 0.5; line(hx, hy - 18, hx + Math.cos(a) * 16, hy + Math.sin(a) * 16 - 2, id + 5); line(hx, hy - 18, hx - Math.cos(a) * 16, hy + Math.abs(Math.sin(a)) * 16 - 2, id + 6); }
  else if (u.kind === 'plumon') { c.lineWidth = 7; line(hx, hy, hx + dir * 14, hy - 16, id + 5); }
  else if (u.kind === 'resaltador') { // mago: sombrero en punta y un resaltador amarillo
    line(-11, -51, 11, -51, id + 5); line(-8, -51, 0, -72, id + 6); line(8, -51, 0, -72, id + 7);
    c.strokeStyle = '#e8c400'; c.lineWidth = 7; line(hx, hy, hx + dir * 12, hy - 4, id + 8);
  } else if (u.kind === 'corrector') { // curandero: frasquito de corrector y una cruz en la cabeza
    c.fillStyle = '#fff'; c.beginPath(); c.roundRect(hx - 5, hy - 14, 10, 16, 3); c.fill(); c.stroke();
    c.strokeStyle = '#2a9d4a'; line(-4, -58, 4, -58, id + 5); line(0, -62, 0, -54, id + 6);
  }
  if (age < 0.45) { c.fillStyle = col; c.beginPath(); c.arc(Math.cos(age * 30) * 14, -24 + Math.sin(age * 30) * 22, 2.5, 0, 7); c.fill(); } // la punta del lapicero
  c.restore();
  if (u.hp < def.hp) { // vida: una rayita debajo
    c.strokeStyle = '#0003'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 12, y + 7); c.lineTo(x + 12, y + 7); c.stroke();
    c.strokeStyle = col; c.beginPath(); c.moveTo(x - 12, y + 7); c.lineTo(x - 12 + 24 * Math.max(0, u.hp / def.hp), y + 7); c.stroke();
  }
  if (u.owner) text(u.owner, x, y - 58 * big, u.gift ? 17 : 14, col);
}

function avatar(v, x, y, r, team) {
  c.save();
  c.beginPath(); c.arc(x, y, r, 0, 7); c.closePath();
  c.fillStyle = '#fff'; c.fill();
  if (v.img) { c.save(); c.clip(); c.drawImage(v.img, x - r, y - r, r * 2, r * 2); c.restore(); } else text(v.initial, x, y + r * 0.35, r * 1.2, COLOR[team]);
  c.strokeStyle = COLOR[team]; c.lineWidth = 4; c.stroke();
  c.restore();
}

function hud() {
  text('PALITOS', W / 2, 205, 62, PENCIL);
  text(`${wins.azul}`, W / 2 - 150, 205, 44, COLOR.azul); text(`${wins.rojo}`, W / 2 + 150, 205, 44, COLOR.rojo);
  // vida de cada dibujo y su tinta
  for (const team of ['azul', 'rojo']) {
    const left = team === 'azul', x0 = left ? 40 : W / 2 + 20, w = W / 2 - 60, hp = s.hp[team] / CFG.baseHp;
    c.strokeStyle = COLOR[team]; c.lineWidth = 3; c.fillStyle = LIGHT[team];
    c.strokeRect(x0, 232, w, 30);
    c.fillStyle = COLOR[team];
    if (left) c.fillRect(x0, 232, w * hp, 30); else c.fillRect(x0 + w * (1 - hp), 232, w * hp, 30);
    text(`${NAME[team]} · ${members(team)} en el bando`, left ? x0 : x0 + w, 292, 26, COLOR[team], left ? 'left' : 'right');
    text(`tinta ${Math.floor(Math.max(0, s.ink[team]))} · palitos ${countOf(s, team)}`, left ? x0 : x0 + w, 320, 20, COLOR[team], left ? 'left' : 'right');
  }
  const big = phase === 'countdown' ? `Elige bando: ${Math.ceil(phaseT)}` : phase === 'playing' ? `${Math.floor(timeLeft / 60)}:${String(Math.floor(timeLeft % 60)).padStart(2, '0')}` : '';
  text(big, W / 2, 364, 36, PENCIL);
  // cómo se juega (sin emojis: en algunas PC salen como cuadritos)
  const tips = [['Comenta AZUL o ROJO', 'mandas un Rayón'], ['Likes', 'tinta para tu bando'], ['Seguir', 'un Tapa con escudo'], ['Compartir', 'un Corrector que cura']];
  tips.forEach(([a, b], i) => {
    const y = 398 + i * 23;
    text(a, W / 2 - 12, y, 21, PENCIL, 'right'); text('→ ' + b, W / 2, y, 20, '#6a6a78', 'left');
  });
  text('Regalos: 1 Tirachinas · 5 Compás · 10 Mago · 20 Plumón · 99 BORRADOR', W / 2, 492, 21, PENCIL);
  // lo último que pasó
  feedLines.forEach((f, i) => { c.globalAlpha = 1 - i * 0.3; text(f.text, W / 2, FIELD.bottom + 48 + i * 30, 24, f.team ? COLOR[f.team] : PENCIL); });
  c.globalAlpha = 1;
}

function announce(dt) {
  const a = announces[0];
  if (!a) return;
  a.t += dt;
  if (a.t > (announces.length > 1 ? 1.3 : 2.6)) { announces.shift(); return; } // si hay fila de regalos, pasan más rápido para no atrasarse
  const k = Math.min(1, a.t / 0.2), team = a.v.team, y = 546;
  c.save();
  c.translate(W / 2, y); c.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k); c.rotate(-0.03);
  c.fillStyle = '#fffdf2'; c.strokeStyle = COLOR[team]; c.lineWidth = 5;
  c.beginPath(); c.roundRect(-300, -50, 600, 100, 18); c.fill(); c.stroke();
  avatar(a.v, -240, 0, 38, team);
  text(a.name, 50, -6, 40, COLOR[team]);
  text(`mandó ${a.label}`, 50, 34, 30, PENCIL);
  c.restore();
}

function effects(dt) {
  for (const f of fx) {
    f.t += dt;
    const k = f.t / f.life;
    if (f.kind === 'crumb') { c.fillStyle = `rgba(215,130,150,${1 - k})`; c.fillRect(f.x + f.vx * f.t, f.y + f.vy * f.t + 160 * f.t * f.t, 5, 3); }
    else if (f.t < 0) continue;
    else if (f.kind === 'piece') { c.save(); c.translate(f.x + f.vx * f.t, f.y + f.vy * f.t + 260 * f.t * f.t); c.rotate(f.rot + f.spin * f.t); c.globalAlpha = 1 - k; c.strokeStyle = f.col; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.stroke(); c.restore(); }
    else if (f.kind === 'mini') { c.fillStyle = '#f29bb0'; c.strokeStyle = '#b85c74'; c.lineWidth = 2; c.beginPath(); c.roundRect(f.x - 22 + 44 * k, f.y - 8 + Math.sin(k * 12) * 3, 20, 12, 3); c.fill(); c.stroke(); }
    else if (f.kind === 'paf') {
      c.save(); c.translate(f.x, f.y); c.rotate(f.rot); c.scale(0.5 + k * 0.8, 0.5 + k * 0.8); c.globalAlpha = 1 - k * k;
      c.strokeStyle = PENCIL; c.lineWidth = 2;
      for (let i = 0; i < 8; i++) { const a = i * 0.785; c.beginPath(); c.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); c.lineTo(Math.cos(a) * (f.big ? 30 : 22), Math.sin(a) * (f.big ? 30 : 22)); c.stroke(); }
      text(f.word, 0, 6, f.big ? 24 : 17, PENCIL);
      c.restore();
    } else if (f.kind === 'beam') { c.strokeStyle = `rgba(255,225,0,${0.55 * (1 - k)})`; c.lineWidth = 16; c.lineCap = 'butt'; c.beginPath(); c.moveTo(f.x0, f.y); c.lineTo(f.x0 + (f.x1 - f.x0) * Math.min(1, k * 4), f.y); c.stroke(); c.lineCap = 'round'; }
    else if (f.kind === 'plus') { c.globalAlpha = 1 - k; text('+', f.x, f.y - k * 24, 30, '#2a9d4a'); c.globalAlpha = 1; }
    else if (f.kind === 'ball') { c.fillStyle = PENCIL; c.beginPath(); c.arc(f.x0 + (f.x1 - f.x0) * k, f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 30, 4, 0, 7); c.fill(); }
  }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t >= fx[i].life) {
    if (fx[i].kind === 'mini') mark({ type: 'smudge', x: fx[i].x, y: fx[i].y - 4, rot: Math.random() - 0.5 }); // queda la marca del borrador
    fx.splice(i, 1);
  }
  if (eraserFx) { // el borrador gigante baja borrando la franja
    eraserFx.t += dt;
    const k = eraserFx.t / 0.7, x = X(eraserFx.x), w = CFG.eraserWidth * 6.6;
    c.fillStyle = 'rgba(251,247,234,0.75)'; c.fillRect(x - w / 2, FIELD.top - 40, w, (FIELD.bottom - FIELD.top + 50) * Math.min(1, k));
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.ellipse(x + 14, FIELD.bottom + 14, w / 2, 12, 0, 0, 7); c.fill(); // sombra
    c.fillStyle = '#f29bb0'; c.strokeStyle = '#b85c74'; c.lineWidth = 4;
    c.beginPath(); c.roundRect(x - w / 2 - 6, FIELD.top - 100 + (FIELD.bottom - FIELD.top + 50) * Math.min(1, k), w + 12, 64, 12); c.fill(); c.stroke();
    if (k > 1.3) { mark({ type: 'clean', x, w }); eraserFx = null; }
  }
  if (flipFx) { // "Hoja nueva": la página se voltea encima de la mitad del rival
    flipFx.t += dt;
    const k = Math.min(1, flipFx.t / 0.8), left = flipFx.team === 'azul', edge = left ? (W / 2) * k : W - (W / 2) * k;
    c.fillStyle = `rgba(255,253,244,${0.9 * (1 - Math.max(0, flipFx.t - 0.8) / 0.5)})`;
    c.beginPath();
    if (left) { c.moveTo(0, FIELD.top - 60); c.lineTo(edge, FIELD.top - 60); c.lineTo(edge - 60, FIELD.bottom + 30); c.lineTo(0, FIELD.bottom + 30); }
    else { c.moveTo(W, FIELD.top - 60); c.lineTo(edge, FIELD.top - 60); c.lineTo(edge + 60, FIELD.bottom + 30); c.lineTo(W, FIELD.bottom + 30); }
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 3; c.beginPath(); c.moveTo(edge, FIELD.top - 60); c.lineTo(edge + (left ? -60 : 60), FIELD.bottom + 30); c.stroke();
    if (flipFx.t > 1.3) flipFx = null;
  }
}

function endScreen() {
  c.fillStyle = 'rgba(251,247,234,0.88)'; c.fillRect(0, 380, W, 620);
  const col = won === 'empate' ? PENCIL : COLOR[won];
  text(won === 'empate' ? '¡EMPATE!' : `¡GANÓ ${NAME[won]}!`, W / 2, 480, 84, col);
  if (best) {
    const v = viewers.get(best.name);
    if (v?.team) avatar(v, W / 2, 570, 50, v.team);
    text(`Mejor palito: ${best.name}`, W / 2, 664, 40, PENCIL);
  }
  text('Ranking de la semana', W / 2, 730, 30, '#6a6a78');
  Object.entries(ranking.pts).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([n, p], i) => text(`${i + 1}. ${n} · ${p} pts`, W / 2, 772 + i * 36, 30, PENCIL));
  text(`Nueva ronda en ${Math.ceil(phaseT)}`, W / 2, 972, 28, '#6a6a78');
}

// ---------- bucle ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  boil = Math.floor(now / 140);
  if (phase === 'countdown') {
    const before = Math.ceil(phaseT);
    phaseT -= dt;
    if (Math.ceil(phaseT) !== before && phaseT < 3 && phaseT > 0) SFX.tick();
    if (phaseT <= 0) {
      phase = 'playing';
      for (const p of pending) entrance(spawnFor(s, p.team, p.kind, p.name, p.gift));
      pending.length = 0;
    }
  } else if (phase === 'playing') {
    timeLeft -= dt;
    const diff = members('azul') - members('rojo'); // el bando con menos gente recibe tinta extra: que no gane siempre el más grande
    if (diff) s.ink[diff > 0 ? 'rojo' : 'azul'] += CFG.inkPerSec * dt * Math.min(1.5, Math.abs(diff) * CFG.fewerBonus);
    onEvents(step(s, dt));
    const w = winner(s, timeLeft);
    if (w) endRound(w);
  } else if ((phaseT -= dt) <= 0) startRound();
  for (const t of ['azul', 'rojo']) shake[t] = Math.max(0, shake[t] - dt);
  quake = Math.max(0, quake - dt);

  c.save();
  if (quake > 0) c.translate((Math.random() - 0.5) * quake * 40, (Math.random() - 0.5) * quake * 40); // la hoja tiembla con los golpes grandes
  paper();
  hud();
  castle('azul'); castle('rojo');
  for (const u of [...s.units].sort((a, b) => a.row - b.row)) palito(u);
  effects(dt);
  announce(dt);
  if (phase === 'end') endScreen();
  c.restore();
  requestAnimationFrame(frame);
}
// se espera la letra de cuaderno antes de dibujar: el fondo se pinta una sola vez y saldría con otra letra
document.fonts.load(`30px ${FONT}`).catch(() => {}).then(() => requestAnimationFrame(frame));

// ---------- simulador ----------
const params = new URLSearchParams(location.search);
if (params.has('clean')) document.body.classList.add('clean');
const me = () => $('#sim-user').value.trim() || 'Espectador';
$('#sim-azul').onclick = () => handle({ type: 'comment', user: me(), text: 'azul' });
$('#sim-rojo').onclick = () => handle({ type: 'comment', user: me(), text: 'rojo' });
$('#sim-like').onclick = () => handle({ type: 'like', user: me(), count: 5 });
$('#sim-follow').onclick = () => handle({ type: 'follow', user: me() });
$('#sim-share').onclick = () => handle({ type: 'share', user: me() });
document.querySelectorAll('[data-gift]').forEach(b => { b.onclick = () => handle({ type: 'gift', user: me(), diamonds: +b.dataset.gift }); });
$('#sim-reset').onclick = startRound;
$('#sim-clear').onclick = () => { ranking = { week: week(), pts: {} }; wins.azul = wins.rojo = 0; save(); };
const soundBox = $('#sim-sound');
if (params.has('mudo')) soundBox.checked = false;
muted = !soundBox.checked;
soundBox.onchange = () => { muted = !soundBox.checked; };

if (params.has('live')) {
  const es = new EventSource('/events'); // se reconecta solo si server.js se reinicia
  es.onmessage = m => {
    const ev = JSON.parse(m.data);
    if (ev.type === 'status') $('#live-status').textContent = ev.text;
    else handle(ev);
  };
}

const botsBox = $('#sim-bots');
if (params.has('clean') || params.has('live')) botsBox.checked = false;
const BOTS = ['Brayan_777', 'Valeria.pe', 'ElTioJuan', 'Camila_love', 'PepeLucho', 'Rosita.qq', 'Marco_P', 'Ximena_22', 'Alonso.p', 'Dani.fx', 'Sofi.art', 'Renzo10', 'Lucia.cuy', 'Kiara_m'];
const pick = a => a[Math.floor(Math.random() * a.length)];
setInterval(() => {
  if (!botsBox.checked || phase === 'end') return;
  const user = pick(BOTS), r = Math.random() * 100;
  if (r < 55) handle({ type: 'comment', user, text: pick(['azul', 'rojo', '1', '2', 'vamos!!']) });
  else if (r < 85) handle({ type: 'like', user, count: 3 });
  else if (r < 88) handle({ type: pick(['follow', 'share']), user });
  else if (r < 95) handle({ type: 'gift', user, diamonds: 1 });
  else if (r < 97.5) handle({ type: 'gift', user, diamonds: 5 });
  else if (r < 98.8) handle({ type: 'gift', user, diamonds: 10 });
  else if (r < 99.6) handle({ type: 'gift', user, diamonds: 20 });
  else handle({ type: 'gift', user, diamonds: 99 });
}, 450);
