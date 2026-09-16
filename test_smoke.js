/* Test de humo COMPLETO: mock DOM+canvas, elección automática de mejoras
   e input simulado. Recorre la partida entera (oleadas → jefe → final). */
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');

const noop = () => {};
const ctxMock = new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'createLinearGradient') return () => ({ addColorStop: noop });
    return noop;
  },
  set(t, k, v) { t[k] = v; return true; }
});

const listeners = {};
const cardEls = [];                 // cartas del draft (mock)
let cardHandlers = [];

function mkEl(id) {
  const el = {
    id, textContent: '', _html: '', dataset: {},
    style: new Proxy({}, { set(t, k, v) { t[k] = v; return true; }, get(t, k) { return t[k] || ''; } }),
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    addEventListener(ev, fn) { (listeners[id] ||= {})[ev] = fn; },
    querySelectorAll() { return id === 'cards' ? cardEls : []; },
    getContext: () => ctxMock,
    width: 1280, height: 800,
    set innerHTML(v) {
      this._html = v;
      if (id === 'cards') {                    // el juego pinta 3 cartas
        cardEls.length = 0; cardHandlers = [];
        const n = (v.match(/class="card"/g) || []).length;
        for (let i = 0; i < n; i++) {
          const c = { dataset: { i: String(i) }, addEventListener: (ev, fn) => { cardHandlers[i] = fn; } };
          cardEls.push(c);
        }
      }
    },
    get innerHTML() { return this._html; },
  };
  return el;
}
const els = {};
const document = {
  getElementById: id => (els[id] ||= mkEl(id)),
  createElement: () => mkEl('tmp'),
  addEventListener: (ev, fn) => { (listeners['doc'] ||= {})[ev] = fn; },
};
let rafQueue = [];
const window = {
  __RUN_TIME: process.env.RUN_TIME ? Number(process.env.RUN_TIME) : undefined,
  __BOSS_HP: process.env.BOSS_HP ? Number(process.env.BOSS_HP) : undefined,
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
  addEventListener: (ev, fn) => { (listeners['win'] ||= {})[ev] = fn; },
};
let now = 0;
const performance = { now: () => now };
const pendingTimeouts = [];
const setTimeoutMock = (fn) => { pendingTimeouts.push(fn); return pendingTimeouts.length; };
const requestAnimationFrame = fn => rafQueue.push(fn);
const errors = [];

new Function('document', 'window', 'performance', 'requestAnimationFrame', 'setTimeout', 'console', code)(
  document, window, performance, requestAnimationFrame, setTimeoutMock, console);

// --- arrancar
listeners['btnStart'].click();

// --- helpers de input simulado
const keydown = k => listeners['win'].keydown({ key: k, preventDefault: noop });
const keyup = k => listeners['win'].keyup({ key: k, preventDefault: noop });
const DIRS = ['w', 'd', 's', 'a'];
let dir = 0, picks = 0, milestones = {};
keydown(DIRS[0]);

const STEP = 1000 / 60, MAX = 60 * 400;      // hasta 400 s simulados
let frames = 0;
for (let i = 0; i < MAX; i++) {
  now += STEP;
  // cambia de dirección cada ~1,2 s (huida circular)
  if (i % 72 === 0) { keyup(DIRS[dir]); dir = (dir + 1) % 4; keydown(DIRS[dir]); }

  const q = rafQueue; rafQueue = [];
  for (const fn of q) {
    try { fn(now); frames++; } catch (e) {
      errors.push(`frame ${i}: ${e.message} :: ${(e.stack || '').split('\n')[1] || ''}`);
      i = MAX; break;
    }
  }

  // ¿pantalla de subida de nivel? elige la primera carta
  const lvlScreen = els['levelScreen'];
  if (lvlScreen && !lvlScreen.classList.contains('hide') && cardHandlers[0]) {
    const h = cardHandlers[0]; cardHandlers = []; picks++;
    try { h(); } catch (e) { errors.push('al elegir carta: ' + e.message); }
  }
  // hitos
  const t = parseFloat((els['timer'].textContent || '0').replace(':','.')) || 0;
  if (els['waveChip'].textContent === '¡JEFE!' && !milestones.boss) milestones.boss = frames;
  if (!els['endScreen'].classList.contains('hide') && !milestones.end) {
    milestones.end = frames;
    milestones.endTitle = els['endTitle'].textContent;
    i = MAX;
  }
  if (errors.length) break;
}

// ejecutar los setTimeout pendientes (pantalla de fin) para conocer el resultado
while (pendingTimeouts.length) { try { pendingTimeouts.shift()(); } catch (e) { errors.push('timeout: ' + e.message); } }
if (!milestones.endTitle && !els['endScreen'].classList.contains('hide')) milestones.endTitle = els['endTitle'].textContent;
console.log('frames ejecutados  :', frames);
console.log('errores JS         :', errors.length);
if (errors.length) console.log(errors.slice(0, 3).join('\n---\n'));
console.log('mejoras elegidas   :', picks);
console.log('nivel final        :', els['lvl'].textContent);
console.log('bajas              :', els['kills'].textContent);
console.log('estado oleada      :', els['waveChip'].textContent);
console.log('jefe apareció      :', milestones.boss ? `sí (frame ${milestones.boss})` : 'no');
console.log('final              :', milestones.endTitle || '(partida sin terminar)');
console.log(errors.length === 0 && frames > 1000 ? '\n✅ MOTOR OK — flujo completo sin excepciones' : '\n❌ REVISAR');
