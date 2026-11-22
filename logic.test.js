import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CFG, UNITS, teamOf, giftPack, comeback, createState, spawn, spawnFor, step, eraser, winner, mvp, damage, countOf } from './logic.js';

const zero = () => 0.5;
const run = (s, secs) => { for (let i = 0; i < secs * 20; i++) step(s, 0.05, zero); };

test('teamOf entiende azul, rojo, 1 y 2', () => {
  assert.equal(teamOf('AZUL!!'), 'azul');
  assert.equal(teamOf('vamos rojo'), 'rojo');
  assert.equal(teamOf('1'), 'azul');
  assert.equal(teamOf('2 2 2'), 'rojo');
  assert.equal(teamOf('hola'), null);
  assert.equal(teamOf('12'), null);
});

test('giftPack: más diamantes, mejor paquete', () => {
  assert.deepEqual(giftPack(0).units, []);
  assert.deepEqual(giftPack(1).units, ['tirachinas']);
  assert.equal(giftPack(20).units[0], 'plumon');
  assert.equal(giftPack(99).power, 'borrador');
  assert.equal(giftPack(500).units.length, 5);
});

test('comeback: solo ayuda al que va perdiendo y con tope', () => {
  assert.equal(comeback(1000, 1000), 1);
  assert.equal(comeback(1500, 200), 1);
  assert.ok(comeback(600, 1200) > 1);
  assert.equal(comeback(0, CFG.baseHp), 1 + CFG.comebackMax);
});

test('el dibujo no pierde más de baseMaxDps por segundo aunque lo ataquen muchos', () => {
  const s = createState();
  s.ink.azul = s.ink.rojo = -1e9;
  for (let i = 0; i < 30; i++) spawn(s, 'azul', 'plumon', 'ana', true, zero).x = CFG.baseX.rojo - 3;
  run(s, 10);
  assert.ok(CFG.baseHp - s.hp.rojo <= CFG.baseMaxDps * 11);
});

test('piedra, papel o tijera', () => {
  assert.ok(damage('rayon', 'tirachinas') > damage('rayon', 'tapa'));
  assert.ok(damage('tirachinas', 'tapa') > UNITS.tirachinas.dmg);
});

test('los palitos avanzan, pelean y uno muere', () => {
  const s = createState();
  s.ink.azul = s.ink.rojo = -1e9; // sin ejército automático
  const a = spawn(s, 'azul', 'rayon', 'ana', false, zero);
  spawn(s, 'rojo', 'tapa', 'beto', false, zero);
  const x0 = a.x;
  run(s, 2);
  assert.ok(a.x > x0);
  for (let i = 0; i < 600 && s.units.length > 1; i++) step(s, 0.05, zero); // hasta que caiga uno (después el castillo remataría al que queda)
  assert.equal(s.units.length, 1);
  assert.equal(s.units[0].kind, 'tapa'); // el Tapa le gana al Rayón
  assert.ok(s.score.beto > 0);
});

test('sin rivales, llegan al dibujo y lo borran; gana ese bando', () => {
  const s = createState();
  s.ink.azul = s.ink.rojo = -1e9;
  for (let k = 0; k < 8 && s.hp.rojo > 0; k++) { // oleadas de plumones hasta borrar el dibujo (el castillo se defiende)
    for (let i = 0; i < 6; i++) spawn(s, 'azul', 'plumon', 'ana', true, zero);
    run(s, 60);
  }
  assert.equal(s.hp.rojo, 0);
  assert.equal(winner(s, 50), 'azul');
  assert.equal(mvp(s).name, 'ana');
});

test('si se acaba el tiempo gana el que tiene más dibujo', () => {
  const s = createState();
  assert.equal(winner(s, 10), null);
  assert.equal(winner(s, 0), 'empate');
  s.hp.azul = 10;
  assert.equal(winner(s, 0), 'rojo');
});

test('topes por persona: lo gratis se corta y el regalo que no cabe se vuelve tinta', () => {
  const s = createState();
  for (let i = 0; i < 10; i++) spawnFor(s, 'azul', 'rayon', 'ana', false, zero);
  assert.equal(countOf(s, 'azul', 'ana', false), CFG.maxFree);
  const ink = s.ink.azul;
  for (let i = 0; i < CFG.maxGift + 1; i++) spawnFor(s, 'azul', 'plumon', 'ana', true, zero);
  assert.equal(countOf(s, 'azul', 'ana', true), CFG.maxGift);
  assert.equal(s.ink.azul, ink + UNITS.plumon.cost);
});

test('el ejército automático gasta la tinta y no pasa el tope del bando', () => {
  const s = createState();
  s.ink.azul = 1e6;
  run(s, 30);
  assert.ok(countOf(s, 'azul') > 5);
  assert.ok(countOf(s, 'azul') <= CFG.maxTeam);
});

test('el borrador daña solo a los rivales de la franja de adelante', () => {
  const s = createState();
  s.ink.azul = s.ink.rojo = -1e9;
  const near = spawn(s, 'rojo', 'rayon', 'x', false, zero); near.x = 30;
  const far = spawn(s, 'rojo', 'plumon', 'y', false, zero); far.x = 90;
  const mine = spawn(s, 'azul', 'rayon', 'z', false, zero); mine.x = 28;
  assert.ok(eraser(s, 'azul') !== null);
  assert.ok(!s.units.includes(near));
  assert.ok(s.units.includes(far) && far.hp === UNITS.plumon.hp);
  assert.ok(s.units.includes(mine));
});

test('una ronda entera con dos ejércitos automáticos termina sin trabarse', () => {
  const s = createState();
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < CFG.roundTime * 20 && !winner(s, 1); i++) step(s, 0.05, rand);
  assert.ok(s.units.length <= CFG.maxTeam * 2);
  assert.ok(Number.isFinite(s.hp.azul) && Number.isFinite(s.hp.rojo));
});

test('el Resaltador atraviesa: le pega a todos los que tiene delante', () => {
  const s = createState();
  s.ink.azul = s.ink.rojo = -1e9;
  const mago = spawn(s, 'azul', 'resaltador', 'ana', true, zero); mago.x = 40;
  const a = spawn(s, 'rojo', 'plumon', 'x', true, zero); a.x = 50;
  const b = spawn(s, 'rojo', 'plumon', 'y', true, zero); b.x = 56;
  step(s, 0.05, zero);
  assert.ok(a.hp < UNITS.plumon.hp && b.hp < UNITS.plumon.hp);
});

test('el Corrector cura al compañero golpeado y no ataca', () => {
  const s = createState();
  s.ink.azul = s.ink.rojo = -1e9;
  const cura = spawn(s, 'azul', 'corrector', 'ana', true, zero); cura.x = 40;
  const amigo = spawn(s, 'azul', 'plumon', 'z', true, zero); amigo.x = 44; amigo.hp = 100;
  step(s, 0.05, zero);
  assert.equal(amigo.hp, 100 + UNITS.corrector.heal);
  assert.equal(giftPack(10).units[0], 'resaltador');
});
