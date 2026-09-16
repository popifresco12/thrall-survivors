/* ==========================================================================
   Thrall Survivors — prototipo fan (sin afiliación con Blizzard)
   Motor: HTML5 Canvas + JS vanilla. Todo el arte se dibuja por código.
   ========================================================================== */
(() => {
'use strict';

// ---------------------------------------------------------------- canvas
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  VW = window.innerWidth; VH = window.innerHeight;
  cv.width = Math.floor(VW * DPR); cv.height = Math.floor(VH * DPR);
  cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

// ---------------------------------------------------------------- utils
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------- config
const WORLD = { w: 2600, h: 2600 };
const RUN_TIME = (typeof window !== 'undefined' && window.__RUN_TIME) || 300;  // segundos hasta el jefe
const PLAYER = { r: 19, speed: 196, hp: 130 };
const HAMMER = { cd: 0.85, range: 66, arc: 1.9, dmg: 22 };
const BOLT = { cd: 2.6, range: 270, targets: 3, dmg: 20, falloff: 0.86 };
// hooks de test (opcionales): window.__RUN_TIME y window.__BOSS_HP
const BOSS_HP = (typeof window !== 'undefined' && window.__BOSS_HP) || 1250;

const ENEMY_TYPES = {
  kobold: { name:'Kobold', r:15, hp:22,  spd:62,  dmg:6,  xp:2, color:'#b98a4f', from:0,   weight:5 },
  murloc: { name:'Murloc', r:14, hp:15,  spd:99,  dmg:5,  xp:2, color:'#5fb7a6', from:20,  weight:4 },
  gnoll:  { name:'Gnoll',  r:18, hp:44,  spd:56,  dmg:11, xp:4, color:'#8a6a45', from:55,  weight:3 },
  wolf:   { name:'Lobo',   r:16, hp:26,  spd:130, dmg:8,  xp:3, color:'#9aa0a6', from:90,  weight:3 },
};

const UPGRADES = [
  { id:'dmg',    ico:'🔨', name:'Furia del martillo', desc:'+25% daño del martillo',            apply:s => s.dmgMul *= 1.25 },
  { id:'haste',  ico:'⚡', name:'Ritmo de guerra',    desc:'+18% velocidad de ataque',          apply:s => s.atkSpd *= 1.18 },
  { id:'cdr',    ico:'🌩️', name:'Tormenta',           desc:'-18% enfriamiento de habilidad',    apply:s => s.cdMul *= 0.82 },
  { id:'chain',  ico:'🔗', name:'Cadena mayor',       desc:'+1 objetivo en la cadena',          apply:s => s.chain += 1 },
  { id:'bolt',   ico:'✨', name:'Bendición elemental', desc:'+18% daño de la habilidad',        apply:s => s.boltMul *= 1.18 },
  { id:'area',   ico:'🌀', name:'Marea',              desc:'+20% alcance y área del martillo',  apply:s => s.areaMul *= 1.20 },
  { id:'hp',     ico:'🛡️', name:'Piel de piedra',     desc:'+28 vida máxima y te cura 28',      apply:s => { s.maxhp += 28; s.hp = Math.min(s.maxhp, s.hp + 28); } },
  { id:'regen',  ico:'🌿', name:'Espíritu sanador',   desc:'Regeneras 0,8 vida por segundo',    apply:s => s.regen += 0.8 },
  { id:'speed',  ico:'💨', name:'Viento veloz',       desc:'+12% velocidad de movimiento',      apply:s => s.speed *= 1.12 },
  { id:'magnet', ico:'🧲', name:'Imán ancestral',     desc:'+45% radio de recogida',            apply:s => s.magnet *= 1.45 },
];

// ---------------------------------------------------------------- state
let S = null;
function newState() {
  return {
    t: 0, over: false, win: false, paused: false, started: false,
    // stats del jugador
    dmgMul: 1, atkSpd: 1, cdMul: 1, boltMul: 1, areaMul: 1, regen: 0,
    chain: 0, speed: PLAYER.speed, maxhp: PLAYER.hp, hp: PLAYER.hp, magnet: 78,
    x: WORLD.w / 2, y: WORLD.h / 2, r: PLAYER.r, face: 0, walk: 0,
    // progresión
    level: 1, xp: 0, xpNext: 6, kills: 0, wave: 1, pending: 0,
    // sistemas
    atkCd: 0, boltCd: 0, swing: 0, swingDir: 0,
    enemies: [], orbs: [], pickups: [], parts: [], bolts: [], texts: [],
    spawn: 0, spawnRate: 1.1, bossSpawned: false, boss: null,
    cam: { x: 0, y: 0 }, shake: 0, flash: 0,
    decor: [], draft: [],
  };
}

// decoración determinista del mapa
function buildDecor() {
  let seed = 1337;
  const r = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const arr = [];
  for (let i = 0; i < 460; i++) {
    const x = r() * WORLD.w, y = r() * WORLD.h;
    const t = r();
    arr.push({ x, y, s: 0.9 + r() * 1.0, kind: t < 0.42 ? 'bush' : t < 0.82 ? 'tree' : 'rock' });
  }
  return arr;
}

// ---------------------------------------------------------------- input
const keys = new Set();
let touch = null;                         // {ox,oy,x,y}
window.addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.key === 'p' || e.key === 'p') togglePause();
  if (e.key === ' ') togglePause();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

cv.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; touch = { ox:t.clientX, oy:t.clientY, x:t.clientX, y:t.clientY }; }, {passive:false});
cv.addEventListener('touchmove',  e => { e.preventDefault(); if (!touch) return; const t = e.changedTouches[0]; touch.x = t.clientX; touch.y = t.clientY; }, {passive:false});
cv.addEventListener('touchend',   e => { e.preventDefault(); touch = null; }, {passive:false});

function moveVector() {
  let mx = 0, my = 0;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  if (touch) {
    const dx = touch.x - touch.ox, dy = touch.y - touch.oy;
    const m = Math.hypot(dx, dy);
    if (m > 12) { mx += dx / m; my += dy / m; }
  }
  const m = Math.hypot(mx, my);
  return m > 1 ? { x: mx / m, y: my / m } : { x: mx, y: my };
}

// ---------------------------------------------------------------- helpers
function toast(x, y, txt, col) { S.texts.push({ x, y, txt, col, life: 0.9 }); }
function particles(x, y, n, col, spd = 150, life = 0.45) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), v = rnd(spd * 0.3, spd);
    S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, col, r: rnd(1.6, 3.4) });
  }
}

// ---------------------------------------------------------------- spawn
function spawnEnemy(type) {
  const T = ENEMY_TYPES[type];
  // fuera de cámara
  let x, y, tries = 0;
  do {
    const a = rnd(0, TAU), d = rnd(Math.max(VW, VH) * 0.62, Math.max(VW, VH) * 0.95);
    x = clamp(S.x + Math.cos(a) * d, 30, WORLD.w - 30);
    y = clamp(S.y + Math.sin(a) * d, 30, WORLD.h - 30);
  } while (dist2({x,y}, S) < 260 * 260 && ++tries < 12);
  const hpMul = 1 + S.t / 100, dmgMul = 1 + S.t / 260;
  S.enemies.push({
    type, x, y, r: T.r, hp: T.hp * hpMul, max: T.hp * hpMul,
    spd: T.spd * (1 + S.t / 900), dmg: T.dmg * dmgMul, xp: T.xp,
    color: T.color, hit: 0, wob: rnd(0, TAU), boss: false,
  });
}

function spawnBoss() {
  const a = rnd(0, TAU), d = Math.max(VW, VH) * 0.7;
  const x = clamp(S.x + Math.cos(a) * d, 60, WORLD.w - 60);
  const y = clamp(S.y + Math.sin(a) * d, 60, WORLD.h - 60);
  S.boss = { type:'khan', x, y, r:34, hp:BOSS_HP, max:BOSS_HP, spd:54, dmg:24, xp:150,
             color:'#a2703f', hit:0, wob:0, boss:true };
  S.enemies.push(S.boss);
  S.bossSpawned = true;
  S.flash = 0.6; S.shake = 14;
  toast(S.x, S.y - 60, '¡Khan de los Centauros!', '#ffd479');
}

// ---------------------------------------------------------------- daño
function damage(e, dmg, srcX, srcY) {
  e.hp -= dmg; e.hit = 0.12;
  particles(e.x, e.y, 5, '#c9463c', 190, 0.35);
  if (srcX !== undefined && !e.boss) {
    const dx = e.x - srcX, dy = e.y - srcY, m = Math.hypot(dx, dy) || 1;
    e.x += dx / m * 5; e.y += dy / m * 5;
  }
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true;
  particles(e.x, e.y, e.boss ? 40 : 12, e.color, e.boss ? 320 : 200, e.boss ? 0.9 : 0.5);
  S.kills++;
  if (e.boss) { S.shake = 22; S.flash = 0.5; endRun(true); return; }
  // orbes de xp
  const n = e.xp >= 4 ? 3 : e.xp >= 3 ? 2 : 1;
  for (let i = 0; i < n; i++) S.orbs.push({ x: e.x + rnd(-10,10), y: e.y + rnd(-10,10), v: e.xp / n, r: 5, ph: rnd(0, TAU) });
  // drops
  const roll = Math.random();
  if (roll < 0.045) S.pickups.push({ kind:'heal', x: e.x, y: e.y, r: 11, ph: 0 });
  else if (roll < 0.075) S.pickups.push({ kind:'surge', x: e.x, y: e.y, r: 11, ph: 0 });
}

// ---------------------------------------------------------------- habilidad
function castChain() {
  const range2 = BOLT.range * BOLT.range;
  let pool = S.enemies.filter(e => !e.dead && dist2(e, S) < range2)
                      .sort((a, b) => dist2(a, S) - dist2(b, S));
  if (!pool.length) { S.boltCd = 0.5; return; }
  const targets = Math.min(BOLT.targets + S.chain, pool.length);
  let prev = { x: S.x, y: S.y };
  let dmg = BOLT.dmg * S.boltMul;
  for (let i = 0; i < targets; i++) {
    const e = pool[i];
    S.bolts.push({ ax: prev.x, ay: prev.y, bx: e.x, by: e.y, life: 0.22, max: 0.22, seg: boltPath(prev, e) });
    damage(e, dmg, S.x, S.y);
    toast(e.x, e.y - e.r - 6, Math.round(dmg), '#8fd0ff');
    dmg *= BOLT.falloff;
    prev = e;
  }
  S.shake = Math.max(S.shake, 5);
}

function boltPath(a, b) {
  const pts = [{ x: a.x, y: a.y }], segs = 6;
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const jx = rnd(-14, 14), jy = rnd(-14, 14);
    pts.push({ x: a.x + (b.x - a.x) * t + jx, y: a.y + (b.y - a.y) * t + jy });
  }
  pts.push({ x: b.x, y: b.y });
  return pts;
}

// ---------------------------------------------------------------- nivel
function gainXp(v) {
  S.xp += v;
  while (S.xp >= S.xpNext) {
    S.xp -= S.xpNext; S.level++; S.xpNext = Math.round(6 + S.level * 4.2);
    S.hp = Math.min(S.maxhp, S.hp + 8);           // +8 vida por nivel
    S.pending++;                       // niveles encolados: se eligen uno a uno
  }
  if (S.pending > 0 && !S.paused && !S.over) openDraft();
}

function openDraft() {
  if (S.pending > 0) S.pending--;
  const n = Math.min(3, UPGRADES.length);
  const pool = [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, n);
  S.draft = pool;
  const box = document.getElementById('cards');
  box.innerHTML = pool.map((u, i) =>
    `<div class="card" data-i="${i}"><div class="ico">${u.ico}</div><div><h3>${u.name}</h3><p>${u.desc}</p></div></div>`).join('');
  box.querySelectorAll('.card').forEach(el => el.addEventListener('click', () => choose(parseInt(el.dataset.i, 10))));
  document.getElementById('lvlNum').textContent = S.level;
  document.getElementById('levelScreen').classList.remove('hide');
  S.paused = true;
}

function choose(i) {
  const u = S.draft[i]; if (!u) return;
  u.apply(S);
  document.getElementById('levelScreen').classList.add('hide');
  if (S.pending > 0) { openDraft(); return; }   // quedaban niveles por elegir
  S.paused = false;
}

// ---------------------------------------------------------------- run
function startRun() {
  S = newState(); S.decor = buildDecor(); S.started = true;
  S.cam.x = S.x - VW / 2; S.cam.y = S.y - VH / 2;
  document.getElementById('startScreen').classList.add('hide');
  document.getElementById('endScreen').classList.add('hide');
  S.last = performance.now();
}

function endRun(win) {
  S.over = true; S.win = win;
  document.getElementById('endTitle').textContent = win ? '¡Azeroth a salvo!' : 'Has caído';
  document.getElementById('endSub').textContent = win
    ? 'El Khan ha caído ante la Cadena de Relámpagos.'
    : 'Los enemigos de la Horda te han superado.';
  document.getElementById('endStats').innerHTML =
    `<div><span>Tiempo</span><b>${fmt(S.t)}</b></div>
     <div><span>Nivel</span><b>${S.level}</b></div>
     <div><span>Bajas</span><b>${S.kills}</b></div>`;
  setTimeout(() => document.getElementById('endScreen').classList.remove('hide'), win ? 700 : 350);
}

function togglePause() {
  if (!S || !S.started || S.over) return;
  S.paused = !S.paused;
  if (!S.paused) S.last = performance.now();
}

const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- update
function update(dt) {
  if (!S.started || S.paused || S.over) return;

  S.t += dt;
  if (S.t >= RUN_TIME && !S.bossSpawned) spawnBoss();

  // --- jugador
  const mv = moveVector();
  S.x = clamp(S.x + mv.x * S.speed * dt, 24, WORLD.w - 24);
  S.y = clamp(S.y + mv.y * S.speed * dt, 24, WORLD.h - 24);
  if (mv.x || mv.y) { S.face = Math.atan2(mv.y, mv.x); S.walk += dt * 9; }
  if (S.regen) S.hp = Math.min(S.maxhp, S.hp + S.regen * dt);

  // --- oleadas
  S.wave = 1 + Math.floor(S.t / 40);
  S.spawnRate = 1.05 + S.t / 42;
  S.spawn += S.spawnRate * dt;
  const available = Object.entries(ENEMY_TYPES).filter(([, T]) => S.t >= T.from);
  while (S.spawn >= 1 && S.enemies.length < 190) {
    S.spawn -= 1;
    const total = available.reduce((a, [, T]) => a + T.weight, 0);
    let r = Math.random() * total, chosen = available[0][0];
    for (const [k, T] of available) { r -= T.weight; if (r <= 0) { chosen = k; break; } }
    spawnEnemy(chosen);
  }

  // --- ataque básico (martillo en arco frontal)
  S.atkCd -= dt;
  if (S.atkCd <= 0) {
    const range = HAMMER.range * S.areaMul, half = HAMMER.arc / 2;
    let hitAny = false;
    for (const e of S.enemies) {
      if (e.dead) continue;
      const d = Math.sqrt(dist2(e, S));
      if (d > range + e.r) continue;
      const ang = Math.atan2(e.y - S.y, e.x - S.x);
      let diff = Math.abs(((ang - S.face + Math.PI * 3) % TAU) - Math.PI);
      if (diff <= half + 0.25) { damage(e, HAMMER.dmg * S.dmgMul * rnd(0.92, 1.08), S.x, S.y); hitAny = true; }
    }
    S.atkCd = HAMMER.cd / S.atkSpd;
    S.swing = 0.18; S.swingDir = S.face;
    if (hitAny) S.shake = Math.max(S.shake, 2.5);
  }
  if (S.swing > 0) S.swing -= dt;

  // --- habilidad
  S.boltCd -= dt;
  if (S.boltCd <= 0) { castChain(); S.boltCd = BOLT.cd * S.cdMul; }

  // --- enemigos
  for (const e of S.enemies) {
    if (e.dead) continue;
    e.hit = Math.max(0, e.hit - dt);
    const dx = S.x - e.x, dy = S.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d > S.r + e.r - 4) {
      e.x += dx / d * e.spd * dt;
      e.y += dy / d * e.spd * dt;
    } else {
      // contacto: daño con cadencia por enemigo
      e.touch = (e.touch || 0) - dt;
      if (e.touch <= 0) {
        S.hp -= e.dmg * 0.85; e.touch = 0.6;
        S.shake = Math.max(S.shake, 4); S.flash = Math.max(S.flash, 0.12);
        particles(S.x, S.y, 4, '#e14b3a', 140, 0.3);
        if (S.hp <= 0) { S.hp = 0; endRun(false); return; }
      }
    }
    // separación simple: solo contra los siguientes del array (coste acotado)
    const idx = S.enemies.indexOf(e);
    for (let k = 1; k <= 8; k++) {
      const o = S.enemies[idx + k];
      if (!o || o.dead) continue;
      const ddx = o.x - e.x, ddy = o.y - e.y;
      const dd2 = ddx * ddx + ddy * ddy, minD = e.r + o.r;
      if (dd2 > 0 && dd2 < minD * minD) {
        const dd = Math.sqrt(dd2), push = (minD - dd) * 0.5;
        e.x -= ddx / dd * push * 0.35; e.y -= ddy / dd * push * 0.35;
      }
    }
  }
  S.enemies = S.enemies.filter(e => !e.dead);

  // --- orbes
  const mag = S.magnet, mag2 = mag * mag;
  for (const o of S.orbs) {
    o.ph += dt * 4;
    if (dist2(o, S) < mag2) {
      const dx = S.x - o.x, dy = S.y - o.y, d = Math.hypot(dx, dy) || 1;
      const pull = 220 + (1 - d / mag) * 420;
      o.x += dx / d * pull * dt; o.y += dy / d * pull * dt;
    }
    if (dist2(o, S) < (S.r + 8) ** 2) { o.dead = true; gainXp(o.v); }
  }
  S.orbs = S.orbs.filter(o => !o.dead);

  // --- pickups
  for (const p of S.pickups) {
    p.ph += dt * 3;
    if (dist2(p, S) < (S.r + p.r + 4) ** 2) {
      p.dead = true;
      if (p.kind === 'heal') { S.hp = Math.min(S.maxhp, S.hp + 30); toast(S.x, S.y - 34, '+30', '#7ddc7d'); }
      else { S.boltCd = 0; toast(S.x, S.y - 34, '⚡ lista', '#8fd0ff'); }
      particles(p.x, p.y, 10, p.kind === 'heal' ? '#7ddc7d' : '#8fd0ff', 150, 0.4);
    }
  }
  S.pickups = S.pickups.filter(p => !p.dead);

  // --- partículas / textos / rayos
  for (const q of S.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; }
  S.parts = S.parts.filter(q => q.life > 0);
  for (const q of S.texts) { q.life -= dt; q.y -= 26 * dt; }
  S.texts = S.texts.filter(q => q.life > 0);
  for (const b of S.bolts) b.life -= dt;
  S.bolts = S.bolts.filter(b => b.life > 0);

  // --- cámara / efectos
  const tx = clamp(S.x - VW / 2, 0, WORLD.w - VW), ty = clamp(S.y - VH / 2, 0, WORLD.h - VH);
  S.cam.x += (tx - S.cam.x) * Math.min(1, dt * 8);
  S.cam.y += (ty - S.cam.y) * Math.min(1, dt * 8);
  S.shake = Math.max(0, S.shake - dt * 40);
  S.flash = Math.max(0, S.flash - dt * 2.2);

  updateHud();
}

function updateHud() {
  document.getElementById('hpFill').style.width = (S.hp / S.maxhp * 100) + '%';
  document.getElementById('xpFill').style.width = (S.xp / S.xpNext * 100) + '%';
  document.getElementById('lvl').textContent = S.level;
  document.getElementById('kills').textContent = S.kills;
  document.getElementById('waveChip').textContent = S.bossSpawned ? '¡JEFE!' : 'Oleada ' + S.wave;
  document.getElementById('timer').textContent = S.bossSpawned ? 'JEFE' : fmt(Math.max(0, RUN_TIME - S.t));
  const cd = clamp(1 - S.boltCd / (BOLT.cd * S.cdMul), 0, 1);
  document.getElementById('skillCd').style.transform = `scaleY(${1 - cd})`;
}

// ---------------------------------------------------------------- render
function render() {
  const cam = S.cam;
  ctx.save();
  if (S.shake > 0.2) ctx.translate(rnd(-S.shake, S.shake) * 0.5, rnd(-S.shake, S.shake) * 0.5);

  drawGround(cam);
  for (const d of S.decor) drawDecor(d, cam);
  for (const o of S.orbs) drawOrb(o, cam);
  for (const p of S.pickups) drawPickup(p, cam);
  for (const e of S.enemies) drawEnemy(e, cam);
  drawPlayer(cam);
  for (const b of S.bolts) drawBolt(b, cam);
  for (const q of S.parts) { ctx.globalAlpha = q.life / q.max; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x - cam.x, q.y - cam.y, q.r, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.font = '700 13px system-ui,sans-serif'; ctx.textAlign = 'center';
  for (const q of S.texts) { ctx.globalAlpha = clamp(q.life, 0, 1); ctx.fillStyle = q.col; ctx.fillText(q.txt, q.x - cam.x, q.y - cam.y); }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (S.flash > 0.01) { ctx.fillStyle = `rgba(255,80,60,${S.flash * 0.5})`; ctx.fillRect(0, 0, VW, VH); }
  drawFloatingJoystick();
}

function drawGround(cam) {
  ctx.fillStyle = '#3b5c33'; ctx.fillRect(0, 0, VW, VH);

  // manchas de hierba (bajo contraste: dan textura sin parecer manchas)
  const g = 68, x0 = Math.floor(cam.x / g) * g, y0 = Math.floor(cam.y / g) * g;
  for (let x = x0; x < cam.x + VW + g; x += g) {
    for (let y = y0; y < cam.y + VH + g; y += g) {
      const h = ((x * 73856093) ^ (y * 19349663)) & 255;
      if (h < 150) {
        ctx.fillStyle = h < 60 ? 'rgba(76,116,60,.42)' : 'rgba(44,72,36,.34)';
        ctx.beginPath();
        ctx.ellipse(x - cam.x + (h % 21), y - cam.y + (h % 13), 32, 21, 0, 0, TAU);
        ctx.fill();
      }
    }
  }

  // briznas finas (detalle de cerca)
  const g2 = 30, bx = Math.floor(cam.x / g2) * g2, by = Math.floor(cam.y / g2) * g2;
  ctx.strokeStyle = 'rgba(130,180,95,.28)'; ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let x = bx; x < cam.x + VW + g2; x += g2) {
    for (let y = by; y < cam.y + VH + g2; y += g2) {
      const h = ((x * 374761393) ^ (y * 668265263)) & 255;
      if (h < 70) {
        const px = x - cam.x + (h % 17), py = y - cam.y + (h % 9);
        ctx.moveTo(px, py); ctx.lineTo(px + ((h % 5) - 2), py - 4 - (h % 3));
        ctx.moveTo(px + 3, py); ctx.lineTo(px + 3 + ((h % 5) - 2), py - 3 - (h % 4));
      }
    }
  }
  ctx.stroke();

  // camino de tierra
  ctx.strokeStyle = '#6a5a3e'; ctx.lineWidth = 62; ctx.lineCap = 'round'; ctx.globalAlpha = 0.38;
  ctx.beginPath();
  ctx.moveTo(WORLD.w * 0.5 - cam.x, -cam.y);
  ctx.bezierCurveTo(WORLD.w * 0.62 - cam.x, WORLD.h * 0.3 - cam.y, WORLD.w * 0.36 - cam.x, WORLD.h * 0.68 - cam.y, WORLD.w * 0.52 - cam.x, WORLD.h - cam.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawDecor(d, cam) {
  const x = d.x - cam.x, y = d.y - cam.y, s = d.s;
  if (x < -80 || y < -80 || x > VW + 80 || y > VH + 80) return;
  if (d.kind === 'tree') {
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(x, y + 2 * s, 13 * s, 5 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2c1c'; ctx.fillRect(x - 3.4 * s, y - 8 * s, 6.8 * s, 18 * s);
    ctx.fillStyle = '#2c5222'; ctx.beginPath(); ctx.arc(x, y - 19 * s, 17 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#437c2d'; ctx.beginPath(); ctx.arc(x - 6 * s, y - 26 * s, 11 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4f8d36'; ctx.beginPath(); ctx.arc(x + 7 * s, y - 22 * s, 7 * s, 0, TAU); ctx.fill();
  } else if (d.kind === 'rock') {
    ctx.fillStyle = '#4a4f52'; ctx.beginPath(); ctx.ellipse(x, y, 11 * s, 8 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5c6266'; ctx.beginPath(); ctx.ellipse(x - 2 * s, y - 3 * s, 7 * s, 5 * s, 0, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = '#33502a'; ctx.beginPath(); ctx.arc(x, y, 7 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3f6234'; ctx.beginPath(); ctx.arc(x + 4 * s, y + 2 * s, 4.5 * s, 0, TAU); ctx.fill();
  }
}

function shadow(x, y, r) { ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.75, r * 0.95, r * 0.42, 0, 0, TAU); ctx.fill(); }

function drawPlayer(cam) {
  const x = S.x - cam.x, y = S.y - cam.y;
  const R = S.r;
  const fx = Math.cos(S.face), fy = Math.sin(S.face);
  const px = -fy, py = fx;                       // perpendicular (eje de los hombros)

  shadow(x, y, R);

  // capa de lobo, detrás
  ctx.fillStyle = '#4a3520';
  ctx.beginPath();
  ctx.ellipse(x - fx * 4, y - fy * 4 + 4, R * 0.92, R * 1.05, S.face, 0, TAU);
  ctx.fill();

  // cuerpo de orco
  ctx.fillStyle = '#5f8f3e';
  ctx.beginPath(); ctx.arc(x, y, R * 0.88, 0, TAU); ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = '#2d4a1c'; ctx.stroke();

  // hombreras de cuero
  ctx.fillStyle = '#6b4a2a';
  ctx.beginPath(); ctx.arc(x + px * R * 0.85, y + py * R * 0.85, R * 0.34, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x - px * R * 0.85, y - py * R * 0.85, R * 0.34, 0, TAU); ctx.fill();

  // cabeza, ligeramente adelantada
  const hx = x + fx * R * 0.35, hy = y + fy * R * 0.35 - R * 0.15;
  ctx.fillStyle = '#7cb253';
  ctx.beginPath(); ctx.arc(hx, hy, R * 0.62, 0, TAU); ctx.fill();
  ctx.lineWidth = 1.8; ctx.strokeStyle = '#2d4a1c'; ctx.stroke();

  // coleta corta (detrás de la cabeza)
  ctx.fillStyle = '#191410';
  ctx.beginPath();
  ctx.ellipse(hx - fx * R * 0.54, hy - fy * R * 0.54, R * 0.19, R * 0.14, S.face, 0, TAU);
  ctx.fill();

  // ojos rojos
  ctx.fillStyle = '#ff5a3c';
  ctx.beginPath();
  ctx.arc(hx + fx * R * 0.33 + px * R * 0.23, hy + fy * R * 0.33 + py * R * 0.23, R * 0.135, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx + fx * R * 0.33 - px * R * 0.23, hy + fy * R * 0.33 - py * R * 0.23, R * 0.135, 0, TAU);
  ctx.fill();

  // martillo grande (arma icónica)
  const swing = S.swing > 0 ? (1 - S.swing / 0.18) : 0;
  const a = S.swing > 0 ? S.swingDir - HAMMER.arc / 2 + HAMMER.arc * swing : S.face + 0.85;
  // brazo hacia el arma
  ctx.strokeStyle = '#4f7a34'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + px * R * 0.5, y + py * R * 0.5);
  ctx.lineTo(x + Math.cos(a) * (R + 7), y + Math.sin(a) * (R + 7)); ctx.stroke();

  ctx.save();
  ctx.translate(x + Math.cos(a) * (R + 7), y + Math.sin(a) * (R + 7));
  ctx.rotate(a);
  ctx.fillStyle = '#6b4a2a'; ctx.fillRect(-3.2, -20, 6.4, 36);
  ctx.fillStyle = '#6f7c85'; ctx.fillRect(-11, -27, 22, 13);
  ctx.fillStyle = '#9fb0ba'; ctx.fillRect(-11, -27, 22, 5);
  ctx.strokeStyle = '#2d3a42'; ctx.lineWidth = 1.4; ctx.strokeRect(-11, -27, 22, 13);
  ctx.restore();

  // estela del golpe
  if (S.swing > 0) {
    ctx.strokeStyle = `rgba(255,225,160,${S.swing / 0.18 * 0.5})`; ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y, HAMMER.range * S.areaMul * 0.72, S.swingDir - HAMMER.arc / 2, S.swingDir + HAMMER.arc / 2);
    ctx.stroke();
  }
}

function drawEnemy(e, cam) {
  const x = e.x - cam.x, y = e.y - cam.y;
  if (x < -60 || y < -60 || x > VW + 60 || y > VH + 60) return;
  const wob = Math.sin(S.t * 9 + e.wob) * 1.6;
  shadow(x, y, e.r);
  const c = e.hit > 0 ? '#ffffff' : e.color;
  ctx.fillStyle = c;
  if (e.type === 'wolf' || e.type === 'khan') {
    // cuerpo alargado
    ctx.beginPath(); ctx.ellipse(x, y + wob * 0.3, e.r * 1.25, e.r * 0.95, 0, 0, TAU); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(x, y + wob * 0.3, e.r, 0, TAU); ctx.fill();
  }
  // detalles por tipo
  if (e.type === 'kobold') {
    ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(x + e.r * 0.6, y - e.r * 0.8, 3.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd479'; ctx.beginPath(); ctx.arc(x + e.r * 0.6, y - e.r * 1.2, 2.4, 0, TAU); ctx.fill();
  } else if (e.type === 'murloc') {
    ctx.fillStyle = '#0d2b2b';
    ctx.beginPath(); ctx.arc(x - 4, y - 3, 3.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4, y - 3, 3.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8f7f4'; ctx.beginPath(); ctx.arc(x - 4, y - 3.4, 1.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4, y - 3.4, 1.3, 0, TAU); ctx.fill();
  } else if (e.type === 'gnoll') {
    ctx.fillStyle = '#5d452c'; ctx.beginPath(); ctx.moveTo(x - e.r, y - 2); ctx.lineTo(x - e.r * 1.7, y - e.r * 1.1); ctx.lineTo(x - e.r * 0.7, y - e.r * 0.9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + e.r, y - 2); ctx.lineTo(x + e.r * 1.7, y - e.r * 1.1); ctx.lineTo(x + e.r * 0.7, y - e.r * 0.9); ctx.fill();
  } else if (e.type === 'khan') {
    ctx.fillStyle = '#6d4a24'; ctx.beginPath(); ctx.arc(x, y - e.r * 0.45, e.r * 0.72, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3b2a17'; ctx.beginPath(); ctx.moveTo(x - e.r * 0.8, y - e.r * 0.9); ctx.lineTo(x - e.r * 1.5, y - e.r * 1.6); ctx.lineTo(x - e.r * 0.3, y - e.r * 1.15); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + e.r * 0.8, y - e.r * 0.9); ctx.lineTo(x + e.r * 1.5, y - e.r * 1.6); ctx.lineTo(x + e.r * 0.3, y - e.r * 1.15); ctx.fill();
    ctx.fillStyle = '#ffcf5c'; ctx.beginPath(); ctx.arc(x - 7, y - e.r * 0.45, 3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 7, y - e.r * 0.45, 3, 0, TAU); ctx.fill();
  }
  // barra de vida (solo jefe o dañados)
  if (e.boss || e.hp < e.max * 0.99) {
    const w = e.boss ? Math.min(320, VW * 0.6) : e.r * 2.1, hp = Math.max(0, e.hp / e.max);
    const bx = e.boss ? VW / 2 - w / 2 : x - w / 2, by = e.boss ? 44 : y - e.r - 13;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(bx, by, w, e.boss ? 12 : 4);
    ctx.fillStyle = e.boss ? '#c9463c' : '#e0844b'; ctx.fillRect(bx, by, w * hp, e.boss ? 12 : 4);
  }
}

function drawOrb(o, cam) {
  const x = o.x - cam.x, y = o.y - cam.y + Math.sin(o.ph) * 2;
  ctx.fillStyle = '#6ce07a'; ctx.beginPath(); ctx.arc(x, y, o.r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(180,255,190,.85)'; ctx.beginPath(); ctx.arc(x - 1.4, y - 1.4, o.r * 0.45, 0, TAU); ctx.fill();
}

function drawPickup(p, cam) {
  const x = p.x - cam.x, y = p.y - cam.y + Math.sin(p.ph) * 3;
  const col = p.kind === 'heal' ? '#e14b3a' : '#4ea8ff';
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(x, y + 9, 8, 0, TAU); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, p.r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(x - 3, y - 3, 3, 0, TAU); ctx.fill();
}

function drawBolt(b, cam) {
  const a = b.life / b.max;
  ctx.save(); ctx.globalAlpha = a;
  ctx.strokeStyle = '#8fd0ff'; ctx.lineWidth = 3.4; ctx.shadowColor = '#4ea8ff'; ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(b.seg[0].x - cam.x, b.seg[0].y - cam.y);
  for (let i = 1; i < b.seg.length; i++) ctx.lineTo(b.seg[i].x - cam.x, b.seg[i].y - cam.y);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.shadowBlur = 0; ctx.stroke();
  ctx.restore();
}

function drawFloatingJoystick() {
  if (!touch) return;
  ctx.save(); ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(touch.ox, touch.oy, 42, 0, TAU); ctx.stroke();
  const dx = touch.x - touch.ox, dy = touch.y - touch.oy, m = Math.min(42, Math.hypot(dx, dy)) || 0;
  const a = Math.atan2(dy, dx);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.beginPath(); ctx.arc(touch.ox + Math.cos(a) * m, touch.oy + Math.sin(a) * m, 16, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S) { update(dt); render(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- UI hooks
document.getElementById('btnStart').addEventListener('click', startRun);
document.getElementById('btnRetry').addEventListener('click', startRun);
S = newState(); S.decor = buildDecor(); S.cam.x = S.x - VW / 2; S.cam.y = S.y - VH / 2;
render();

})();
