// Reglas puras de Palitos (sin pantalla): se prueban con `npm test`. El juego (game.js) solo dibuja lo que pasa aquí.
// La hoja es un carril de 0 a 100: el dibujo azul está a la izquierda y el rojo a la derecha.

export const CFG = {
  countdown: 10,      // segundos para elegir bando antes de pelear
  roundTime: 210,     // la ronda dura 3 min y medio
  endTime: 12,        // pantalla del ganador
  baseHp: 2500,
  towerDmg: 14,       // el dibujo se defiende: le pega a los 3 rivales más cercanos
  towerRange: 14,
  towerEvery: 0.5,
  towerHits: 3,
  baseMaxDps: 22,     // por más palitos que lo ataquen, el dibujo no pierde más que esto por segundo: borrarlo entero toma casi 2 minutos y da tiempo a remontar
  baseX: { azul: 7, rojo: 93 },
  inkStart: 30,
  inkPerSec: 5,       // tinta que sube sola
  inkPerLike: 2,
  fewerBonus: 0.15,   // tinta extra por cada persona de diferencia entre bandos (el juego la aplica al bando chico)
  comebackMax: 2,     // el bando que va perdiendo recibe hasta el triple de tinta
  maxFree: 3,         // palitos gratis vivos por persona (comentarios)
  maxGift: 8,         // palitos de regalo vivos por persona; lo que sobra se vuelve tinta
  commentEvery: 4,    // segundos entre un palito gratis y el siguiente de la misma persona
  maxTeam: 45,        // tope de palitos por bando (para que no se trabe ni se llene la hoja)
  eraserDmg: 160,     // el Borrador
  eraserWidth: 34,
};

// hp, daño, alcance, velocidad (por segundo), espera entre golpes, costo en tinta del ejército automático
export const UNITS = {
  rayon:      { name: 'Rayón',      hp: 45,  dmg: 9,  range: 3,  speed: 9,   cd: 0.8, cost: 22 },
  tapa:       { name: 'Tapa',       hp: 150, dmg: 6,  range: 3,  speed: 6,   cd: 1.0, cost: 40 },
  tirachinas: { name: 'Tirachinas', hp: 30,  dmg: 10, range: 22, speed: 7,   cd: 1.3, cost: 45 },
  compas:     { name: 'Compás',     hp: 85,  dmg: 12, range: 4,  speed: 8,   cd: 1.1, cost: 70, area: 5 },
  plumon:     { name: 'Plumón',     hp: 380, dmg: 32, range: 4,  speed: 4.5, cd: 1.6, cost: 150, vsBase: 2.5 },
  // el mago: su rayo de resaltador atraviesa y le pega a todos los rivales que tiene delante
  resaltador: { name: 'Resaltador', hp: 40,  dmg: 9,  range: 18, speed: 6,   cd: 1.8, cost: 95, pierce: true },
  // el curandero: no pelea; tapa con corrector las heridas del compañero más golpeado
  corrector:  { name: 'Corrector',  hp: 55,  dmg: 0,  range: 12, speed: 7,   cd: 1.1, cost: 65, heal: 16 },
};

// Piedra, papel o tijera: cuánto más (o menos) pega cada uno contra cada cual. Lo que no está vale 1.
const MULT = {
  rayon:      { tirachinas: 1.6, resaltador: 1.6, corrector: 1.5, tapa: 0.5 },
  tapa:       { rayon: 1.4 },
  tirachinas: { tapa: 1.7, compas: 1.5, rayon: 0.8 },
  compas:     { tapa: 1.5 },
  plumon:     {},
  resaltador: { rayon: 1.3 },
  corrector:  {},
};
export const damage = (attacker, target) => UNITS[attacker].dmg * (MULT[attacker][target] ?? 1);

// El ejército automático de cada bando gasta la tinta en este orden (así siempre hay pelea aunque comenten pocos).
const AUTO = ['rayon', 'rayon', 'tapa', 'rayon', 'tirachinas', 'rayon', 'compas', 'corrector', 'rayon', 'resaltador'];

export const other = team => (team === 'azul' ? 'rojo' : 'azul');

// "azul", "rojo", "1" o "2" al inicio del comentario (también en inglés). Devuelve el bando o null.
export function teamOf(text) {
  const t = String(text ?? '').trim().toLowerCase();
  if (/^(azul|blue|1)(\W|$)/.test(t) || /\bazul\b/.test(t)) return 'azul';
  if (/^(rojo|red|2)(\W|$)/.test(t) || /\brojo\b/.test(t)) return 'rojo';
  return null;
}

// Qué manda cada regalo según sus diamantes. power: 'borrador' pasa el borrador sobre los rivales.
export function giftPack(diamonds) {
  if (diamonds >= 299) return { units: ['plumon', 'plumon', 'plumon', 'compas', 'compas'], power: 'borrador', label: 'HOJA NUEVA' };
  if (diamonds >= 99) return { units: ['plumon'], power: 'borrador', label: 'BORRADOR' };
  if (diamonds >= 20) return { units: ['plumon'], label: 'PLUMÓN' };
  if (diamonds >= 10) return { units: ['resaltador', 'corrector'], label: 'MAGO RESALTADOR' };
  if (diamonds >= 5) return { units: ['compas', 'tapa'], label: 'COMPÁS' };
  if (diamonds >= 1) return { units: ['tirachinas'], label: 'TIRACHINAS' };
  return { units: [] };
}

// Tinta extra para el que va perdiendo: 1 si va igual o ganando, hasta 1 + comebackMax si le queda mucho menos dibujo.
export function comeback(myHp, enemyHp) {
  return 1 + Math.min(CFG.comebackMax, Math.max(0, (enemyHp - myHp) / CFG.baseHp) * 2);
}

export function createState() {
  return {
    t: 0, nextId: 1, units: [],
    hp: { azul: CFG.baseHp, rojo: CFG.baseHp },
    ink: { azul: CFG.inkStart, rojo: CFG.inkStart },
    auto: { azul: 0, rojo: 0 },
    tower: { azul: 0, rojo: 0 },
    budget: { azul: 0, rojo: 0 }, // daño que el dibujo todavía puede recibir (se rellena con baseMaxDps)
    score: {}, // persona → daño hecho en la ronda
  };
}

export const countOf = (s, team, owner, gift) => s.units.filter(u => u.team === team && (owner === undefined || (u.owner === owner && !!u.gift === !!gift))).length;

// Dibuja un palito. owner: de quién es (undefined = del ejército automático). Devuelve la unidad, o null si el bando está lleno.
export function spawn(s, team, kind, owner, gift = false, rand = Math.random) {
  if (countOf(s, team) >= CFG.maxTeam) return null;
  const u = { id: s.nextId++, team, kind, owner, gift, x: CFG.baseX[team] + (team === 'azul' ? 3 : -3), row: rand(), hp: UNITS[kind].hp, cd: 0, born: s.t };
  s.units.push(u);
  return u;
}

// Un palito de alguien del público, respetando los topes. Si ya no le caben, el regalo se vuelve tinta (nunca se pierde).
export function spawnFor(s, team, kind, owner, gift, rand) {
  const cap = gift ? CFG.maxGift : CFG.maxFree;
  if (countOf(s, team, owner, gift) >= cap) {
    if (gift) s.ink[team] += UNITS[kind].cost;
    return null;
  }
  const u = spawn(s, team, kind, owner, gift, rand);
  if (!u && gift) s.ink[team] += UNITS[kind].cost;
  return u;
}

// El Borrador: daña a todos los rivales en una franja alrededor del que va más adelante. Devuelve el centro de la franja.
export function eraser(s, team, events = []) {
  const foes = s.units.filter(u => u.team !== team);
  if (!foes.length) return null;
  const dir = team === 'azul' ? -1 : 1; // los rivales de azul avanzan hacia la izquierda
  const front = foes.reduce((a, b) => (a.x * dir > b.x * dir ? a : b)).x;
  const center = front - dir * CFG.eraserWidth / 2 + dir * 3;
  for (const u of foes) if (Math.abs(u.x - center) <= CFG.eraserWidth / 2) hurt(s, u, CFG.eraserDmg, undefined, events);
  s.units = s.units.filter(u => u.hp > 0);
  return center;
}

function hurt(s, u, dmg, by, events) {
  u.hp -= dmg;
  u.hurtAt = s.t; // para dibujar el golpe
  if (by?.owner) s.score[by.owner] = (s.score[by.owner] ?? 0) + dmg;
  if (u.hp <= 0) events.push({ type: 'die', unit: u, by });
}

// Avanza la pelea dt segundos. Devuelve lo que pasó, para dibujarlo y que suene: golpes, disparos, muertes, daño al dibujo.
export function step(s, dt, rand = Math.random) {
  const events = [];
  s.t += dt;
  for (const team of ['azul', 'rojo']) {
    s.budget[team] = Math.min(CFG.baseMaxDps, s.budget[team] + CFG.baseMaxDps * dt);
    s.ink[team] += CFG.inkPerSec * comeback(s.hp[team], s.hp[other(team)]) * dt;
    const kind = AUTO[s.auto[team] % AUTO.length];
    if (s.ink[team] >= UNITS[kind].cost && spawn(s, team, kind, undefined, false, rand)) {
      s.ink[team] -= UNITS[kind].cost;
      s.auto[team]++;
      events.push({ type: 'spawn', team, kind });
    }
  }
  for (const team of ['azul', 'rojo']) { // cada dibujo se defiende: sin esto, el que gana el medio arrasa en segundos
    if ((s.tower[team] -= dt) > 0) continue;
    const bx = CFG.baseX[team];
    const foes = s.units.filter(u => u.team !== team && u.hp > 0 && Math.abs(u.x - bx) <= CFG.towerRange).sort((a, b) => Math.abs(a.x - bx) - Math.abs(b.x - bx)).slice(0, CFG.towerHits);
    if (!foes.length) continue;
    s.tower[team] = CFG.towerEvery;
    for (const foe of foes) {
      events.push({ type: 'tower', team, target: foe });
      hurt(s, foe, CFG.towerDmg, undefined, events);
    }
  }
  for (const u of s.units) {
    if (u.hp <= 0) continue;
    const def = UNITS[u.kind], dir = u.team === 'azul' ? 1 : -1, foeBase = CFG.baseX[other(u.team)];
    u.cd -= dt;
    let target = null, best = Infinity;
    for (const o of s.units) {
      if (o.team === u.team || o.hp <= 0) continue;
      const d = Math.abs(o.x - u.x);
      if (d <= def.range && d < best) { target = o; best = d; }
    }
    const atBase = Math.abs(foeBase - u.x) <= def.range;
    if (def.heal) { // el curandero: se queda detrás de la pelea y cura al más golpeado que tenga cerca
      if (u.cd <= 0) {
        const hurtOne = s.units.filter(o => o.team === u.team && o !== u && o.hp > 0 && o.hp < UNITS[o.kind].hp && Math.abs(o.x - u.x) <= def.range)
          .sort((a, b) => a.hp / UNITS[a.kind].hp - b.hp / UNITS[b.kind].hp)[0];
        if (hurtOne) {
          u.cd = def.cd; u.hitAt = s.t;
          hurtOne.hp = Math.min(UNITS[hurtOne.kind].hp, hurtOne.hp + def.heal);
          events.push({ type: 'heal', unit: u, target: hurtOne });
        }
      }
      if (!target && !atBase) u.x += dir * def.speed * dt;
      continue;
    }
    if (target) {
      if (u.cd <= 0) {
        u.cd = def.cd; u.hitAt = s.t;
        events.push({ type: def.pierce ? 'beam' : def.range > 10 ? 'shot' : 'hit', unit: u, target });
        const hits = def.area ? s.units.filter(o => o.team !== u.team && o.hp > 0 && Math.abs(o.x - target.x) <= def.area)
          : def.pierce ? s.units.filter(o => o.team !== u.team && o.hp > 0 && Math.abs(o.x - u.x) <= def.range)
          : [target];
        for (const o of hits) hurt(s, o, damage(u.kind, o.kind), u, events);
      }
    } else if (atBase) {
      if (u.cd <= 0) {
        u.cd = def.cd; u.hitAt = s.t;
        const foe = other(u.team), dmg = Math.min(def.dmg * (def.vsBase ?? 1), s.budget[foe]);
        s.budget[foe] -= dmg;
        s.hp[foe] = Math.max(0, s.hp[foe] - dmg);
        if (u.owner) s.score[u.owner] = (s.score[u.owner] ?? 0) + dmg;
        events.push({ type: 'base', team: foe, unit: u });
      }
    } else {
      u.x += dir * def.speed * dt;
    }
  }
  s.units = s.units.filter(u => u.hp > 0);
  return events;
}

// Quién gana: al que le borran el dibujo pierde; si se acaba el tiempo, gana el que tiene más dibujo. null = sigue.
export function winner(s, timeLeft) {
  if (s.hp.azul <= 0 || s.hp.rojo <= 0) return s.hp.azul > s.hp.rojo ? 'azul' : s.hp.rojo > s.hp.azul ? 'rojo' : 'empate';
  if (timeLeft > 0) return null;
  return s.hp.azul > s.hp.rojo ? 'azul' : s.hp.rojo > s.hp.azul ? 'rojo' : 'empate';
}

// El mejor palito de la ronda: quien más daño hizo.
export function mvp(s) {
  const top = Object.entries(s.score).sort((a, b) => b[1] - a[1])[0];
  return top ? { name: top[0], dmg: Math.round(top[1]) } : null;
}
