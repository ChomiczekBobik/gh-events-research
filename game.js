// Five Nights at Homka — browser prototype (FNaF 1/2 style)
'use strict';

const W = 1920, H = 1080;
const OFFICE_W = 2880, CAM_W = 2500;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const Q = new URLSearchParams(location.search);
const HOUR_LEN = Q.has('fast') ? 12 : 60; // seconds per in-game hour

// ---------------------------------------------------------------- layout
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  cv.style.width = W * s + 'px';
  cv.style.height = H * s + 'px';
}
addEventListener('resize', fit); fit();

// ---------------------------------------------------------------- assets
const IMG = {};
const imgList = [];
const addImg = (k, p) => imgList.push([k, 'assets/' + p]);
for (let n = 1; n <= 11; n++) addImg('cam' + n, `cams/cam${n}.jpg`);
addImg('cam5_empty', 'cams/cam5_empty.jpg');
addImg('cam3_empty', 'cams/cam3_empty.jpg');
addImg('office', 'office/office.jpg');
addImg('vent_light', 'vent/vent_light.webp');
for (let i = 1; i <= 17; i++) addImg('sh' + i, `vent/shutter${i}.webp`);
for (let i = 1; i <= 19; i++) { addImg('dl' + i, `door/l${i}.webp`); addImg('dr' + i, `door/r${i}.webp`); }
for (let i = 1; i <= 11; i++) addImg('tab' + i, `tablet/t${i}.webp`);
for (let i = 1; i <= 9; i++) addImg('st' + i, `fx/static${i}.webp`);
for (let v = 0; v <= 100; v += 10) addImg('bat' + v, `ui/bat${v}.png`);
for (const h of [12, 1, 2, 3, 4, 5, 6]) addImg('time' + h, `ui/time${h}.png`);
for (let i = 1; i <= 6; i++) addImg('use' + i, `ui/usage${i}.png`);
for (let i = 1; i <= 9; i++) addImg('box' + i, `box/box${i}.png`);
addImg('map', 'ui/map.png');
for (let n = 1; n <= 11; n++) addImg('c' + n, `ui/c${n}.png`);
for (let i = 1; i <= 5; i++) addImg('face' + i, `menu/face${i}.webp`);
addImg('title', 'menu/title.webp');
addImg('gazeta', 'menu/gazeta.jpg');
for (const k of ['homka_walk', 'homka_crawl', 'homka_crawl2', 'homka_crouch', 'homka_door', 'homka_scare', 'homka_low',
  'lyud_body', 'lyud_face', 'brother', 'zov']) addImg(k, `chars/${k}.webp`);
for (let i = 0; i < 23; i++) addImg('ms' + i, `mell/scare${i}.webp`);
for (let i = 0; i < 3; i++) addImg('mi' + i, `mell/idle${i}.webp`);

const SND_NAMES = ['ambient', 'blip', 'chimes', 'door', 'fan', 'hangup', 'knock', 'light', 'mell_scare', 'musicbox', 'powerout',
  'ring', 'scream', 'shutter', 'static', 'steps', 'tablet_down', 'tablet_up', 'vent', 'wind', 'sting',
  'mg_jump', 'mg_pick', 'mg_scan', 'mg_err', 'mg_win', 'mg_drone', 'mg_ending'];
const SND_WAV = new Set(['fan', 'light', 'static', 'mg_drone']); // loops: wav has no mp3 padding gap
const SND = {};
let muted = false;

function loadAll(onProgress) {
  let done = 0;
  const total = imgList.length + SND_NAMES.length;
  const tick = () => onProgress(++done / total);
  const imgs = imgList.map(([k, src]) => new Promise(res => {
    const im = new Image();
    im.onload = () => { IMG[k] = im; tick(); res(); };
    im.onerror = () => { console.warn('missing', src); tick(); res(); };
    im.src = src;
  }));
  const snds = SND_NAMES.map(n => new Promise(res => {
    const a = new Audio();
    a.preload = 'auto';
    const fin = () => { tick(); res(); };
    a.addEventListener('canplaythrough', fin, { once: true });
    a.addEventListener('error', fin, { once: true });
    setTimeout(fin, 4000); // do not block on slow audio
    a.src = `assets/sfx/${n}.${SND_WAV.has(n) ? 'wav' : 'mp3'}`;
    SND[n] = a;
  }));
  return Promise.all([...imgs, ...snds]);
}

function play(name, vol = 1) {
  const a = SND[name];
  if (!a || muted) return null;
  const c = a.cloneNode();
  c.volume = Math.max(0, Math.min(1, vol));
  c.play().catch(() => {});
  return c;
}
const loops = {};
function loop(name, on, vol = 1) {
  const a = SND[name];
  if (!a) return;
  if (on && !muted) {
    a.loop = true;
    a.volume = Math.max(0, Math.min(1, vol));
    if (a.paused) a.play().catch(() => {});
    loops[name] = true;
  } else if (!a.paused) {
    a.pause();
    a.currentTime = 0;
    loops[name] = false;
  }
}
function stopAllLoops() {
  for (const n of SND_NAMES) loop(n, false);
  if (G && G.call) { // the phone call is not a loop, but must go quiet with everything else
    if (G.call.voice) G.call.voice.pause();
    if (G.call.ring) G.call.ring.pause();
  }
}

// darkened copies of sprites so characters blend into dark camera feeds
const darkCache = new Map();
function dark(img, b) {
  const key = img.src + '|' + b.toFixed(2);
  let c = darkCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = `rgba(0,0,0,${1 - b})`;
  x.fillRect(0, 0, c.width, c.height);
  darkCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- helpers
const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function drawH(img, cx, bottom, h, alpha = 1) { // draw sprite by centre-x, bottom-y and height
  if (!img) return;
  const w = img.width * h / img.height;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, cx - w / 2, bottom - h, w, h);
  ctx.globalAlpha = 1;
}
function text(s, x, y, size = 40, color = '#fff', align = 'left', font = 'Consolas, "Courier New", monospace') {
  ctx.font = `bold ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}
function staticOverlay(alpha) {
  const im = IMG['st' + ri(1, 7)];
  if (!im) return;
  ctx.globalAlpha = alpha;
  const fx = Math.random() < 0.5 ? -1 : 1;
  ctx.save();
  ctx.translate(fx < 0 ? W : 0, 0); ctx.scale(fx, 1);
  ctx.drawImage(im, 0, ri(-30, 0), W, H + 30);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- input
const mouse = { x: W / 2, y: H / 2, down: false };
let clickQueue = [];
function toCanvas(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
cv.addEventListener('pointermove', e => Object.assign(mouse, toCanvas(e)));
cv.addEventListener('pointerdown', e => { Object.assign(mouse, toCanvas(e)); mouse.down = true; clickQueue.push({ ...mouse }); });
addEventListener('pointerup', () => { mouse.down = false; });
const keys = new Set();
addEventListener('keydown', e => {
  if (e.repeat) return;
  keys.add(e.code);
  onKey(e.code);
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
const inRect = (p, x, y, w, h) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;

// ---------------------------------------------------------------- save
const save = {
  get night() { return clamp(+localStorage.getItem('fnah_night') || 1, 1, 5); },
  set night(v) { localStorage.setItem('fnah_night', v); },
  get beaten() { return localStorage.getItem('fnah_beaten') === '1'; },
  set beaten(v) { localStorage.setItem('fnah_beaten', v ? '1' : '0'); },
};

// ---------------------------------------------------------------- game data
// AI levels per night (0 = inactive): homka, brother, zov, mell; box drain %/s; extra power drain %/s
const NIGHTS = {
  1: { homka: 3, brother: 0, zov: 0, mell: 0, box: 0.42, extra: 0 },
  2: { homka: 6, brother: 3, zov: 0, mell: 3, box: 0.55, extra: 0.01 },
  3: { homka: 9, brother: 6, zov: 5, mell: 6, box: 0.7, extra: 0.02 },
  4: { homka: 12, brother: 10, zov: 9, mell: 9, box: 0.85, extra: 0.03 },
  5: { homka: 16, brother: 14, zov: 13, mell: 13, box: 1.0, extra: 0.04 },
  6: { homka: 20, brother: 19, zov: 18, mell: 18, box: 1.25, extra: 0.05 },
};
const CAM_NAMES = {
  1: 'Вход / Касса', 2: 'Ряд NEGRO', 3: 'Батончики', 4: 'Торговый зал', 5: 'Выпечка', 6: 'Правый коридор',
  7: 'Левый коридор', 8: 'Клетка', 9: 'Запасной выход', 10: 'Подсобка', 11: 'Вентиляция',
};
// camera buttons on the tablet map (coordinates on the 934x614 map image)
const MAP_BTN = {
  1: [52, 124], 2: [257, 54], 3: [347, 54], 4: [430, 54], 5: [522, 300], 6: [460, 561], 7: [274, 561],
  8: [165, 468], 9: [642, 85], 10: [776, 143], 11: [373, 590],
};
const MAP_S = 0.62, MAP_X = W - 934 * MAP_S - 60, MAP_Y = H - 614 * MAP_S - 105;
const BTN_W = 46, BTN_H = 31;

// office hotspots (office image coordinates)
const DOOR_L_X = 163, DOOR_R_X = 2420, DOOR_W = 297;
const BTN = { // measured from the office art (red/yellow button blobs), padded for easier clicking
  doorL: [470, 495, 110, 140], lightL: [470, 645, 110, 140],
  doorR: [2270, 495, 110, 140], lightR: [2270, 645, 110, 140],
};

// pre-rendered "lit" pieces of the office (built once after loading)
const LIGHT = {};
function buildLighting() {
  const lit = document.createElement('canvas');
  lit.width = OFFICE_W; lit.height = H;
  const lx = lit.getContext('2d');
  lx.drawImage(IMG.office, 0, 0);
  // warm incandescent boost via compositing (no getImageData: canvas is tainted when opened from file://)
  lx.globalCompositeOperation = 'lighter';
  lx.drawImage(IMG.office, 0, 0);
  lx.drawImage(IMG.office, 0, 0);
  lx.fillStyle = 'rgb(26,18,6)';
  lx.fillRect(0, 0, OFFICE_W, H);
  lx.globalCompositeOperation = 'multiply';
  lx.fillStyle = 'rgb(255,232,190)';
  lx.fillRect(0, 0, OFFICE_W, H);
  lx.globalCompositeOperation = 'source-over';
  // soft elliptical spot cut out of the lit office
  const spot = (cx, cy, rx, ry, extra = {}) => {
    const x0 = Math.max(0, Math.floor(cx - rx)), y0 = Math.max(0, Math.floor(cy - ry));
    const w = Math.min(OFFICE_W, Math.ceil(cx + rx)) - x0, h = Math.min(H, Math.ceil(cy + ry)) - y0;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.drawImage(lit, x0, y0, w, h, 0, 0, w, h);
    x.globalCompositeOperation = 'destination-in';
    x.translate(cx - x0, cy - y0); x.scale(1, ry / rx);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(-rx, -rx, rx * 2, rx * 2);
    return { c, x: x0, y: y0, cx, cy, r: Math.min(rx, ry), ...extra };
  };
  LIGHT.doorL = spot(DOOR_L_X + DOOR_W / 2, 470, 260, 620);
  LIGHT.doorR = spot(DOOR_R_X + DOOR_W / 2, 470, 260, 620);
  LIGHT.btnDoorL = spot(527, 566, 62, 74, { glow: 'rgba(255,40,30,0.55)' });
  LIGHT.btnDoorR = spot(2320, 566, 62, 74, { glow: 'rgba(255,40,30,0.55)' });
  LIGHT.btnLightL = spot(528, 713, 62, 74, { glow: 'rgba(255,230,60,0.45)' });
  LIGHT.btnLightR = spot(2319, 713, 62, 74, { glow: 'rgba(255,230,60,0.45)' });
  LIGHT.btnVentShut = spot(VENT_BTN.shut[0], VENT_BTN.shut[1], 50, 50, { glow: 'rgba(255,80,40,0.4)' });
  LIGHT.btnVentLight = spot(VENT_BTN.light[0], VENT_BTN.light[1], 50, 50, { glow: 'rgba(255,240,150,0.4)' });
}
const VENT_BTN = { shut: [1649, 821], light: [1649, 932] };
const VENT_WIN = [1321, 816, 226, 159];
const BOX_CAM = 10; // the music box sits in the back room
const BOX_BTN = [80, 600, 300, 110]; // "wind up" button on CAM 10 (screen coords, above the battery HUD)

// where each character stands on each camera: [sprite, centre-x, bottom-y, height, brightness]
const POS = {
  homka: {
    1: ['homka_walk', 600, 1055, 815, 0.75], 2: ['homka_walk', 1250, 880, 380, 0.55], 4: ['homka_crouch', 1500, 980, 520, 0.6],
    5: ['homka_walk', 520, 1010, 560, 0.55], 6: ['homka_crawl', 1250, 1060, 640, 0.5], 7: ['homka_crawl2', 1150, 1040, 600, 0.45],
    8: ['homka_crouch', 650, 1080, 520, 0.35],
  },
  brother: {
    10: ['brother', 1300, 1010, 650, 0.55], 9: ['brother', 1250, 1080, 760, 0.3], 4: ['brother', 850, 1000, 600, 0.6],
    5: ['brother', 860, 1000, 480, 0.55], 6: ['brother', 1550, 1070, 800, 0.45],
  },
  zov: { 7: ['zov', 1300, 960, 190, 0.5], 11: ['zov', 1320, 690, 170, 0.45] },
};
const HOMKA_GRAPH = { 1: ['2'], 2: ['4'], 4: ['5'], 5: ['6', '8'], 6: ['RDOOR'], 8: ['7'], 7: ['LDOOR'] };
const BRO_GRAPH = { 10: ['9'], 9: ['4'], 4: ['5'], 5: ['6'], 6: ['RDOOR'] };
const ZOV_GRAPH = { 5: ['7'], 7: ['11'], 11: ['VENT'] };

// phone calls, night cards and endings live in story.js
const CALLS = STORY.calls;
const CALL_START = 4.5; // seconds of ringing before the call picks up
const lineText = l => (typeof l === 'string' ? l : l.t);
const lineDur = l => Math.max(3.2, lineText(l).length * 0.062);

// ---------------------------------------------------------------- state
let state = 'loading';
let stateT = 0;
let loadP = 0;
let G = null;
let menu = { face: 1, faceT: 0, glitch: 0, hover: -1 };

function newNight(n) {
  const cfg = NIGHTS[n];
  G = {
    night: n, cfg, t: 0, power: 100,
    doorL: false, doorR: false, doorLF: 19, doorRF: 19,
    lightL: false, lightR: false, ventLight: false, ventClosed: false, ventF: 17,
    tablet: false, tabF: 0, cam: 1, glitch: 0, camT: 0, inBar: true,
    ox: 480, flicker: 0, knocks: 0,
    homka: { pos: '1', ai: cfg.homka, timer: 4.97, inOffice: false, attackT: 0 },
    brother: { pos: '10', ai: cfg.brother, timer: 4.98, inOffice: false, attackT: 0 },
    zov: { pos: '5', ai: cfg.zov, timer: 5.03, attackT: 0 },
    mell: { ai: cfg.mell, timer: 5.01, stage: 0, mode: 'cove', frozen: 0, runT: 0, anim: 0 },
    lyud: { box: 100, out: false, outT: 0 },
    pout: null, // power-out sequence
    seen: {}, // window-scare stings already played
    call: { lines: CALLS[n] || [], idx: -1, t: 0, done: !(CALLS[n] || []).length, ring: null },
  };
  if (G.call.lines.length) G.call.ring = play('ring', 0.6);
  if (Q.has('debugpos')) { G.homka.pos = Q.get('debugpos'); }
}

function setState(s) { state = s; stateT = 0; }

// ---------------------------------------------------------------- key handling
// cheat: Z, O, V in a row during a night -> skip to 6 AM (next night). Uses key codes, so it works on any layout.
const CHEAT = ['KeyZ', 'KeyO', 'KeyV'];
let cheatBuf = [], cheatT = 0;
function checkCheat(code) {
  const now = performance.now();
  if (now - cheatT > 2000) cheatBuf = [];
  cheatT = now;
  cheatBuf = [...cheatBuf, code].slice(-CHEAT.length);
  if (cheatBuf.join() !== CHEAT.join()) return false;
  if (state === 'night' && G) { cheatBuf = []; win(); return true; }
  if (state === 'mini') { cheatBuf = []; MG.finish(); return true; }
  return false;
}

function onKey(code) {
  if (checkCheat(code)) return;
  if (code === 'KeyM') { muted = !muted; if (muted) stopAllLoops(); return; }
  if (state === 'mini') { MG.key(code); return; }
  if (state === 'night' && G && !G.pout) {
    if (code === 'Space' || code === 'KeyS') toggleTablet();
    if (G.tablet) {
      const m = code.match(/^Digit(\d)$/);
      if (m) switchCam(+m[1] === 0 ? 10 : +m[1]);
      if (code === 'Minus') switchCam(11);
      return;
    }
    if (code === 'KeyA') pressDoor('L');
    if (code === 'KeyD') pressDoor('R');
    if (code === 'KeyQ') pressLight('L');
    if (code === 'KeyE') pressLight('R');
    if (code === 'KeyF') pressVent();
    if (code === 'KeyR') pressVentLight();
  }
}

function anyoneInOffice() { return G.homka.inOffice || G.brother.inOffice; }
function pressDoor(side) {
  if (anyoneInOffice()) { play('blip', 0.5); return; }
  const k = side === 'L' ? 'doorL' : 'doorR';
  G[k] = !G[k];
  play('door', 0.8);
}
function pressLight(side) {
  if (anyoneInOffice()) { play('blip', 0.5); return; }
  const k = side === 'L' ? 'lightL' : 'lightR';
  const on = !G[k];
  G.lightL = G.lightR = G.ventLight = false;
  G[k] = on;
}
function pressVent() { G.ventClosed = !G.ventClosed; play('shutter', 0.8); }
function pressVentLight() { const on = !G.ventLight; G.lightL = G.lightR = false; G.ventLight = on; }
function toggleTablet() {
  if (G.pout) return;
  G.tablet = !G.tablet;
  play(G.tablet ? 'tablet_up' : 'tablet_down', 0.7);
  if (G.tablet) { G.lightL = G.lightR = G.ventLight = false; G.glitch = 0.3; }
}
function switchCam(n) {
  if (n < 1 || n > 11 || n === G.cam) return;
  G.cam = n; G.glitch = 0.3; G.camT = 0;
  play('blip', 0.6);
}

// ---------------------------------------------------------------- AI
function camGlitchIf(...cams) {
  if (G.tablet && cams.map(String).includes(String(G.cam))) { G.glitch = Math.max(G.glitch, 0.6); }
}
function roll(ai) { return ai > 0 && ri(1, 20) <= ai; }

function walker(c, graph, retreat, name) {
  c.timer -= G.dt;
  if (c.timer > 0 || c.inOffice) return;
  c.timer += name === 'homka' ? 4.97 : 4.98;
  if (!roll(c.ai)) return;
  const old = c.pos;
  if (old === 'LDOOR' || old === 'RDOOR') {
    const closed = old === 'LDOOR' ? G.doorL : G.doorR;
    if (closed) { c.pos = retreat; play('steps', 0.35); }
    else { c.inOffice = true; c.attackT = G.tablet ? rand(1.5, 4) : rand(0.4, 1.2); G.lightL = G.lightR = false; }
  } else {
    const nx = pick(graph[old]);
    c.pos = nx;
    if (['6', '7', 'LDOOR', 'RDOOR'].includes(nx)) play('steps', nx.includes('DOOR') ? 0.8 : 0.45);
  }
  camGlitchIf(old, c.pos);
}

function updateAI(dt) {
  const ext = Math.floor(G.t / HOUR_LEN); // AI rises a bit at 2, 3 and 4 AM
  for (const k of ['homka', 'brother', 'zov', 'mell']) {
    const base = G.cfg[k];
    G[k].ai = base ? clamp(base + (ext >= 2) + (ext >= 3) + (ext >= 4), 0, 20) : 0;
  }
  walker(G.homka, HOMKA_GRAPH, '4', 'homka');
  walker(G.brother, BRO_GRAPH, '9', 'brother');

  for (const c of [G.homka, G.brother]) {
    if (!c.inOffice) continue;
    c.attackT -= dt;
    if (c.attackT <= 0) {
      if (G.tablet) { G.tablet = false; play('tablet_down', 0.7); }
      else if (G.tabF <= 0.01) return scare(c === G.homka ? 'homka' : 'brother');
    }
  }

  // Zovyanchik — crawls into the vent
  const z = G.zov;
  z.timer -= dt;
  if (z.timer <= 0) {
    z.timer += 5.03;
    if (roll(z.ai)) {
      const old = z.pos;
      if (old === 'VENT') {
        if (G.ventClosed || G.ventF < 16) { z.pos = '7'; play('vent', 0.5); }
        else return scare('zov');
      } else {
        z.pos = pick(ZOV_GRAPH[old]);
        if (z.pos === '11' || z.pos === 'VENT') play('vent', z.pos === 'VENT' ? 0.9 : 0.5);
      }
      camGlitchIf(old, z.pos);
    }
  }

  // Mellstroy — Foxy-like, sits in the cage on CAM 8
  const m = G.mell;
  if (G.tablet) m.frozen = rand(1, 8); else m.frozen -= dt;
  if (m.mode === 'cove') {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.timer += 5.01;
      if (m.frozen <= 0 && roll(m.ai)) {
        m.stage++;
        camGlitchIf(8);
        if (m.stage >= 3) { m.mode = 'out'; m.runT = rand(10, 20); }
      }
    }
  } else if (m.mode === 'out') {
    m.runT -= dt;
    if ((G.tablet && G.cam === 7) || m.runT <= 0) { m.mode = 'run'; m.anim = 0; play('steps', 1); }
  } else if (m.mode === 'run') {
    m.anim += dt;
    if (m.anim >= 1.6) {
      if (G.doorL) {
        play('knock', 1);
        G.power -= 2 + 4 * G.knocks++;
        m.mode = 'cove'; m.stage = ri(0, 1);
      } else return scare('mell');
    }
  }

  // Lyudmila — music box on CAM 10, her ghost stands on CAM 3
  const l = G.lyud;
  if (!l.out) {
    const winding = G.tablet && G.tabF >= 11 && G.cam === BOX_CAM && (keys.has('KeyW') || (mouse.down && inRect(mouse, ...BOX_BTN)));
    G.winding = winding;
    if (winding) l.box = Math.min(100, l.box + 22 * dt);
    else l.box -= G.cfg.box * dt;
    if (l.box <= 0) { l.box = 0; l.out = true; l.outT = 0; play('musicbox', 0.9); camGlitchIf(3, BOX_CAM); }
  } else {
    G.winding = false;
    l.outT += dt;
    if (l.outT > 11) {
      if (G.tablet) { G.tablet = false; play('tablet_down', 0.7); }
      else if (G.tabF <= 0.01) return scare('lyud');
    }
  }
}

function lyudCam() { // where the flying Lyudmila is drawn while she is out
  const t = G.lyud.outT;
  if (!G.lyud.out) return null;
  return t < 3 ? null : t < 6 ? '4' : t < 9 ? '5' : '6';
}

// ---------------------------------------------------------------- night update
function updateNight(dt) {
  G.dt = dt;
  G.t += dt;
  stateT += dt;

  // phone call (subtitles; some lines trigger sounds)
  updateCall(dt);

  if (G.t >= 6 * HOUR_LEN) return win();

  // power
  const usage = usageLevel();
  if (!G.pout) {
    G.power -= (usage * 0.1 + G.cfg.extra) * dt;
    if (G.power <= 0) startPowerOut();
  }
  if (G.pout) return updatePowerOut(dt);

  // animations
  G.doorLF = approach(G.doorLF, G.doorL ? 1 : 19, 70 * dt);
  G.doorRF = approach(G.doorRF, G.doorR ? 1 : 19, 70 * dt);
  G.ventF = approach(G.ventF, G.ventClosed ? 1 : 17, 60 * dt);
  G.tabF = approach(G.tabF, G.tablet ? 11 : 0, 50 * dt);
  G.glitch = Math.max(0, G.glitch - dt);
  G.camT += dt;
  G.flicker = Math.random() < 0.004 ? rand(0.05, 0.15) : Math.max(0, G.flicker - dt);

  // office panning
  if (!G.tablet && G.tabF < 1) {
    const edge = 560;
    if (mouse.x < edge) G.ox -= (edge - mouse.x) / edge * 1100 * dt;
    if (mouse.x > W - edge) G.ox += (mouse.x - (W - edge)) / edge * 1100 * dt;
    G.ox = clamp(G.ox, 0, OFFICE_W - W);
  }

  // tablet hover bar (FNaF style: move the mouse over the bar to flip the tablet)
  const inBar = inRect(mouse, 560, 990, 800, 80);
  if (inBar && !G.inBar) toggleTablet();
  G.inBar = inBar;

  for (const p of clickQueue) handleNightClick(p);
  clickQueue = [];

  // window scare sting when a light reveals someone
  const atL = G.homka.pos === 'LDOOR', atR = G.homka.pos === 'RDOOR' || G.brother.pos === 'RDOOR';
  const revealL = G.lightL && !G.doorL && atL, revealR = G.lightR && !G.doorR && atR;
  const revealV = G.ventLight && G.ventF > 16 && G.zov.pos === 'VENT';
  for (const [k, v] of [['L', revealL], ['R', revealR], ['V', revealV]]) {
    if (v && !G.seen[k]) { play('sting', 0.9); G.seen[k] = true; }
    if (!v) G.seen[k] = false;
  }

  // loops
  loop('fan', true, 0.5);
  loop('light', G.lightL || G.lightR || G.ventLight, 0.35);
  loop('static', G.tablet && G.tabF >= 11, 0.18);
  loop('wind', !!G.winding, 0.7);

  updateAI(dt);
}
function approach(v, target, step) { return v < target ? Math.min(target, v + step) : Math.max(target, v - step); }
function usageLevel() {
  if (!G || G.pout) return 0;
  return 1 + G.doorL + G.doorR + G.ventClosed + (G.lightL || G.lightR || G.ventLight ? 1 : 0) + (G.tablet ? 1 : 0);
}

function handleNightClick(p) {
  if (!G.call.done && G.call.idx >= 0 && inRect(p, ...SKIP_BTN)) return skipCall();
  if (G.tablet && G.tabF >= 11) {
    for (const [n, [mx, my]] of Object.entries(MAP_BTN)) {
      const x = MAP_X + mx * MAP_S - BTN_W / 2, y = MAP_Y + my * MAP_S - BTN_H / 2;
      if (inRect(p, x - 4, y - 4, BTN_W + 8, BTN_H + 8)) return switchCam(+n);
    }
    return;
  }
  if (G.tablet) return;
  const o = { x: p.x + G.ox, y: p.y };
  if (inRect(o, ...BTN.doorL)) return pressDoor('L');
  if (inRect(o, ...BTN.lightL)) return pressLight('L');
  if (inRect(o, ...BTN.doorR)) return pressDoor('R');
  if (inRect(o, ...BTN.lightR)) return pressLight('R');
  if (Math.hypot(o.x - VENT_BTN.shut[0], o.y - VENT_BTN.shut[1]) < 48) return pressVent();
  if (Math.hypot(o.x - VENT_BTN.light[0], o.y - VENT_BTN.light[1]) < 48) return pressVentLight();
}

// ---------------------------------------------------------------- power out
function startPowerOut() {
  G.power = 0;
  G.pout = { t: 0, phase: 0, next: rand(4, 9) };
  G.doorL = G.doorR = G.lightL = G.lightR = G.ventLight = false;
  G.tablet = false;
  stopAllLoops();
  G.call.done = true;
  play('powerout', 1);
}
function updatePowerOut(dt) {
  const p = G.pout;
  p.t += dt;
  G.doorLF = approach(G.doorLF, 19, 70 * dt);
  G.doorRF = approach(G.doorRF, 19, 70 * dt);
  G.tabF = approach(G.tabF, 0, 50 * dt);
  clickQueue = [];
  if (p.phase === 0 && p.t > p.next) { p.phase = 1; p.t = 0; p.music = play('musicbox', 0.9); }
  else if (p.phase === 1 && p.t > rand(6, 9)) { p.phase = 2; p.t = 0; if (p.music) p.music.pause(); }
  else if (p.phase === 2 && p.t > rand(1.5, 3.5)) scare('homka');
}

// ---------------------------------------------------------------- scare / win
let scareWho = null;
function scare(who) {
  scareWho = who;
  stopAllLoops();
  play(who === 'mell' ? 'mell_scare' : 'scream', 1);
  setState('scare');
}
function win() {
  stopAllLoops();
  play('chimes', 1);
  setState('win');
}

// ---------------------------------------------------------------- drawing: office
function drawOffice() {
  const ox = Math.round(G.ox);
  ctx.drawImage(IMG.office, -ox, 0);

  // doorways: the hall light reveals a brightened, warm cone of the office art
  const buzz = Math.random() < 0.06; // the bulb flickers like in FNaF
  for (const side of ['L', 'R']) {
    const dx = (side === 'L' ? DOOR_L_X : DOOR_R_X) - ox;
    const lit = (side === 'L' ? G.lightL : G.lightR) && !buzz;
    const doorF = Math.round(side === 'L' ? G.doorLF : G.doorRF);
    if (lit && doorF > 12) {
      const sp = LIGHT['door' + side];
      ctx.drawImage(sp.c, sp.x - ox, sp.y);
      // the hallway art is pure black, so add the bulb's own warm pool of light
      ctx.save();
      ctx.beginPath(); ctx.rect(dx, 0, DOOR_W, H); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      const cx = dx + DOOR_W / 2;
      const g1 = ctx.createRadialGradient(cx, 300, 10, cx, 300, 420);
      g1.addColorStop(0, 'rgba(255,210,140,0.30)'); g1.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = g1; ctx.fillRect(dx, 0, DOOR_W, H);
      ctx.translate(cx, 960); ctx.scale(1, 0.32);
      const g2 = ctx.createRadialGradient(0, 0, 10, 0, 0, 260);
      g2.addColorStop(0, 'rgba(255,215,150,0.40)'); g2.addColorStop(1, 'rgba(255,200,130,0)');
      ctx.fillStyle = g2; ctx.fillRect(-300, -300, 600, 600);
      ctx.restore();
      const who = [];
      if (side === 'L' && G.homka.pos === 'LDOOR') who.push(['homka_door', 0]);
      if (side === 'R' && G.homka.pos === 'RDOOR') who.push(['homka_door', -30]);
      if (side === 'R' && G.brother.pos === 'RDOOR') who.push(['brother', 40]);
      for (const [k, off] of who) {
        ctx.save();
        ctx.beginPath(); ctx.rect(dx, 0, DOOR_W, H); ctx.clip();
        drawH(dark(IMG[k], 0.78), dx + DOOR_W / 2 + off, 1010, 820);
        const v = ctx.createRadialGradient(dx + DOOR_W / 2, 470, 120, dx + DOOR_W / 2, 470, 620);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = v; ctx.fillRect(dx, 0, DOOR_W, H);
        ctx.restore();
      }
    } else if (doorF > 12) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(dx, 0, DOOR_W, H);
    }
    const dimg = IMG[(side === 'L' ? 'dl' : 'dr') + doorF];
    if (dimg && doorF < 19) ctx.drawImage(dimg, dx, -5);
  }

  // pressed buttons light up in their own shape (brightened art + soft glow)
  const lightBtn = (key, on) => {
    if (!on) return;
    const sp = LIGHT[key];
    ctx.drawImage(sp.c, sp.x - ox, sp.y);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(sp.cx - ox, sp.cy, 0, sp.cx - ox, sp.cy, sp.r * 1.6);
    g.addColorStop(0, sp.glow); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sp.cx - ox - sp.r * 1.6, sp.cy - sp.r * 1.6, sp.r * 3.2, sp.r * 3.2);
    ctx.globalCompositeOperation = 'source-over';
  };
  lightBtn('btnDoorL', G.doorL);
  lightBtn('btnDoorR', G.doorR);
  lightBtn('btnLightL', G.lightL);
  lightBtn('btnLightR', G.lightR);
  lightBtn('btnVentShut', G.ventClosed);
  lightBtn('btnVentLight', G.ventLight);

  // vent window under the desk
  const [vx, vy, vw, vh] = VENT_WIN;
  const vf = Math.round(G.ventF);
  if (vf < 17) ctx.drawImage(IMG['sh' + vf], vx - ox, vy, vw, vh);
  else if (G.ventLight) {
    ctx.drawImage(IMG.vent_light, vx - ox, vy, vw, vh);
    if (G.zov.pos === 'VENT') {
      ctx.save(); ctx.beginPath(); ctx.rect(vx - ox, vy, vw, vh); ctx.clip();
      drawH(dark(IMG.zov, 0.75), vx - ox + vw / 2, vy + vh - 8, 120);
      ctx.restore();
    }
  } else ctx.drawImage(IMG.sh17, vx - ox, vy, vw, vh);

  if (G.flicker > 0) { ctx.fillStyle = `rgba(0,0,0,${0.25})`; ctx.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- drawing: cameras
function drawCamera() {
  const cam = G.cam;
  let bg = IMG['cam' + cam];
  if (cam === 5 && G.zov.pos !== '5') bg = IMG.cam5_empty;
  if (cam === 3 && G.lyud.out) bg = IMG.cam3_empty;
  const pan = (CAM_W - W) / 2 * (1 + Math.sin(G.t * 0.32));
  ctx.save();
  ctx.translate(-pan, 0);
  ctx.drawImage(bg, 0, 0);

  const put = (who, c) => {
    const p = POS[who] && POS[who][c];
    if (!p) return;
    drawH(dark(IMG[p[0]], p[4]), p[1], p[2], p[3]);
  };
  if (G.homka.pos === String(cam)) put('homka', cam);
  if (G.brother.pos === String(cam)) put('brother', cam);
  if (G.zov.pos === String(cam) && cam !== 5) put('zov', cam);
  if (cam === 8 && G.mell.mode === 'cove') {
    const s = [[1250, 640, 230, 0.3], [1300, 820, 420, 0.42], [1360, 1080, 720, 0.55]][G.mell.stage];
    drawH(dark(IMG['mi' + (Math.floor(G.t * 2) % 3)], s[3]), s[0], s[1], s[2]);
  }
  if (cam === 7 && G.mell.mode === 'run') {
    const k = G.mell.anim / 1.6;
    drawH(dark(IMG['ms' + (Math.floor(G.mell.anim * 14) % 23)], 0.6), 700 + k * 1300, 760 + k * 320, 300 + k * 700);
  }
  if (lyudCam() === String(cam)) {
    ctx.save();
    ctx.translate(1250, 620); ctx.rotate(-0.35 + Math.sin(G.t * 3) * 0.08);
    drawH(dark(IMG.lyud_body, 0.5), 0, 380, 700, 0.75);
    ctx.restore();
  }
  ctx.restore();

  // camera feed effects
  staticOverlay(0.13);
  if (G.glitch > 0) {
    const im = IMG['st' + clamp(Math.ceil((1 - G.glitch / 0.6) * 9), 1, 9)];
    if (im) ctx.drawImage(im, 0, 0, W, H);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = (G.t * 60) % 6; y < H; y += 6) ctx.fillRect(0, y, W, 2);

  // frame + labels
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  if (Math.floor(G.t * 1.5) % 2) { ctx.fillStyle = '#e00'; ctx.beginPath(); ctx.arc(95, 100, 18, 0, 7); ctx.fill(); }
  text('REC', 125, 113, 38);
  text(`CAM ${cam}`, 80, 190, 56);
  text(CAM_NAMES[cam], 80, 245, 34, '#ddd');

  // map
  ctx.globalAlpha = 0.85;
  ctx.drawImage(IMG.map, MAP_X, MAP_Y, 934 * MAP_S, 614 * MAP_S);
  ctx.globalAlpha = 1;
  for (const [n, [mx, my]] of Object.entries(MAP_BTN)) {
    const x = MAP_X + mx * MAP_S - BTN_W / 2, y = MAP_Y + my * MAP_S - BTN_H / 2;
    ctx.drawImage(IMG['c' + n], x, y, BTN_W, BTN_H);
    if (+n === cam) {
      ctx.fillStyle = Math.floor(G.t * 3) % 2 ? 'rgba(80,255,80,0.55)' : 'rgba(80,255,80,0.25)';
      ctx.fillRect(x, y, BTN_W, BTN_H);
    }
  }

  // music box on CAM 10 — FNaF 2 style: just the timer dial and a small camera-feed button
  if (cam === BOX_CAM && !G.lyud.out) {
    const [bx, by, bw, bh] = BOX_BTN;
    ctx.fillStyle = G.winding ? 'rgba(150,150,150,0.55)' : 'rgba(20,20,20,0.45)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
    ctx.drawImage(IMG['box' + boxFrame()], bx + 8, by + 6, bh - 12, bh - 12);
    text('WIND UP', bx + bh + 10, by + 44, 26, 'rgba(255,255,255,0.8)');
    text('MUSIC BOX', bx + bh + 10, by + 76, 26, 'rgba(255,255,255,0.8)');
  }
}
function boxFrame() { return clamp(9 - Math.ceil(G.lyud.box / 100 * 8), 1, 9); }

// ---------------------------------------------------------------- drawing: HUD
function drawHUD() {
  const hour = Math.min(6, Math.floor(G.t / HOUR_LEN));
  const ti = IMG['time' + (hour === 0 ? 12 : hour)];
  if (ti) ctx.drawImage(ti, W - 456 * 0.7 - 40, 30, 456 * 0.7, 128 * 0.7);
  text(`Ночь ${G.night}`, W - 50, 165, 36, '#fff', 'right');

  const pw = Math.max(0, G.power);
  const bimg = IMG['bat' + clamp(Math.floor(pw / 10) * 10, 0, 100)];
  if (bimg) ctx.drawImage(bimg, 40, H - 250, 343 * 0.6, 144 * 0.6);
  text(`Энергия: ${Math.ceil(pw)}%`, 50, H - 130, 32);
  const u = usageLevel();
  text('Нагрузка:', 50, H - 75, 28);
  if (u > 0 && IMG['use' + u]) ctx.drawImage(IMG['use' + u], 215, H - 108, 540 * 0.45, 100 * 0.45);

  // tablet bar
  if (!G.pout) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(560, 1000, 800, 60);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(560, 1000, 800, 60);
    text(G.tablet ? '▼  ▼  ▼' : '▲  КАМЕРЫ  ▲', W / 2, 1042, 30, '#fff', 'center');
  }
  // music box warning (FNaF 2 style)
  if (!G.lyud.out && G.lyud.box < 30 && Math.floor(G.t * 2.5) % 2) {
    ctx.globalAlpha = 0.85;
    ctx.drawImage(IMG.box9, 1380, 990, 70, 70);
    ctx.globalAlpha = 1;
  }
  // phone call: the current sentence as plain shadowed text (no panel), plus a small "mute call" button
  const c = G.call;
  if (!c.done && c.idx >= 0) {
    const rows = wrap(subtitleNow(), 1400, 28);
    const top = 900 - rows.length * 38;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
    rows.forEach((r, i) => text(r, W / 2, top + i * 38, 28, 'rgba(235,235,220,0.92)', 'center'));
    ctx.restore();
  }
  if (!c.done && c.idx >= 0) {
    const [bx, by, bw, bh] = SKIP_BTN;
    ctx.fillStyle = inRect(mouse, bx, by, bw, bh) ? 'rgba(110,110,110,0.6)' : 'rgba(40,40,40,0.45)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
    text('MUTE CALL', bx + bw / 2, by + 30, 22, 'rgba(255,255,255,0.75)', 'center');
  }
}

const SKIP_BTN = [40, 26, 170, 44];
function wrap(s, maxW, size) {
  ctx.font = `bold ${size}px Consolas, "Courier New", monospace`;
  const words = s.split(' '), rows = [];
  let cur = '';
  for (const w of words) {
    const t2 = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t2).width > maxW && cur) { rows.push(cur); cur = w; } else cur = t2;
  }
  if (cur) rows.push(cur);
  return rows;
}
// Subtitles follow the actual audio: a line ends when its voice clip ends, and inside a line the shown
// sentence is picked from the clip's playback position using per-sentence start times from make_voice.py.
const LINE_GAP = 0.35;
function updateCall(dt) {
  const c = G.call;
  if (c.done) return;
  c.t += dt;
  const next = () => {
    c.idx++; c.t = 0; c.clipT = 0; c.ended = null;
    if (c.idx >= c.lines.length) { c.done = true; return; }
    const l = c.lines[c.idx];
    if (l.sfx) play(l.sfx, l.sfx === 'scream' ? 0.6 : 0.8);
    c.voice = voiceLine(G.night, c.idx);
  };
  if (c.idx < 0) { if (c.t > CALL_START) next(); return; }
  const v = c.voice;
  const info = voiceInfo(G.night, c.idx);
  if (v && !v.error && !(v.paused && v.currentTime === 0 && c.t > 2)) {
    c.clipT = v.currentTime; // audio drives the subtitles
    if (v.ended) { c.ended = c.ended ?? c.t; if (c.t - c.ended > LINE_GAP) next(); }
  } else {
    // no audio (muted, blocked or missing): fall back to the clip's known length
    c.clipT = c.t;
    if (c.t > (info ? info.d : lineDur(c.lines[c.idx])) + LINE_GAP) next();
  }
}
function splitSentences(s) { // must match sentences() in tools/make_voice.py
  const parts = s.trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
  const out = [];
  let buf = '';
  for (const p of parts) {
    buf = (buf + ' ' + p).trim();
    if (buf.length >= 14) { out.push(buf); buf = ''; }
  }
  if (buf) { if (out.length) out[out.length - 1] += ' ' + buf; else out.push(buf); }
  return out;
}
function subtitleNow() {
  const c = G.call, l = c.lines[c.idx];
  const shown = splitSentences(lineText(l));
  const info = voiceInfo(G.night, c.idx);
  if (!info || shown.length < 2) return shown.join(' ');
  let starts = info.s;
  if (starts.length !== shown.length) { // displayed text split differently from the spoken one: spread evenly by length
    const total = shown.reduce((a, s) => a + s.length, 0);
    let acc = 0;
    starts = shown.map(s => { const st = acc / total * info.d; acc += s.length; return st; });
  }
  let k = 0;
  for (let i = 0; i < starts.length; i++) if (c.clipT >= starts[i] - 0.05) k = i;
  return shown[k];
}
// voiced lines are generated by tools/make_voice.py (assets/voice/<night>_<line>.mp3)
function voiceKey(n, i) { return `${n}_${i}`; }
function voiceInfo(n, i) {
  const v = typeof VOICE !== 'undefined' && VOICE[voiceKey(n, i)];
  if (!v) return null;
  return typeof v === 'number' ? { d: v, s: [0] } : v;
}
function voiceLine(n, i) {
  if (muted || !voiceInfo(n, i)) return null;
  const a = new Audio(`assets/voice/${voiceKey(n, i)}.mp3`);
  a.volume = 1;
  a.play().catch(() => {});
  return a;
}
function skipCall() {
  const c = G.call;
  if (c.ring) c.ring.pause();
  if (c.voice) c.voice.pause();
  c.done = true;
  play('hangup', 0.6);
}

function drawNight() {
  if (G.tabF < 11) drawOffice();
  if (G.tabF > 0 && G.tabF < 11) {
    const im = IMG['tab' + clamp(Math.ceil(G.tabF), 1, 11)];
    if (im) ctx.drawImage(im, 0, 0, W, H);
  }
  if (G.tabF >= 11) drawCamera();
  if (G.pout) {
    const p = G.pout;
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, 0, W, H);
    if (p.phase === 1 && Math.random() < 0.55) { // Homka's face flickers in the left doorway
      const dx = DOOR_L_X - G.ox;
      ctx.save(); ctx.beginPath(); ctx.rect(dx, 0, DOOR_W, H); ctx.clip();
      drawH(dark(IMG.homka_door, 0.6), dx + DOOR_W / 2, 1010, 820);
      ctx.restore();
    }
    if (p.phase === 2) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    const tm = IMG['time' + (Math.min(6, Math.floor(G.t / HOUR_LEN)) || 12)];
    if (tm && p.phase < 2) { ctx.globalAlpha = 0.5; ctx.drawImage(tm, W - 456 * 0.7 - 40, 30, 456 * 0.7, 128 * 0.7); ctx.globalAlpha = 1; }
    return;
  }
  drawHUD();
}

// ---------------------------------------------------------------- jumpscare
// where the face is on each jumpscare sprite: [x, y] as fractions of the sprite, face height as fraction
const SCARE_FACE = {
  homka: [0.48, 0.075, 0.12], brother: [0.48, 0.07, 0.11], lyud: [0.52, 0.42, 0.5],
  zov: [0.5, 0.3, 0.85], mell: [0.55, 0.19, 0.36],
};
function drawScare() {
  const t = stateT;
  if (G && G.tabF < 11) drawOffice(); else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const amp = t < 0.25 ? 45 : 22;
  const sx = rand(-amp, amp), sy = rand(-amp * 0.8, amp * 0.8);
  const k = Math.min(1, t / 0.16);
  const ease = 1 - Math.pow(1 - k, 3);
  let im = { homka: IMG.homka_scare, brother: IMG.brother, zov: IMG.zov, lyud: IMG.lyud_face }[scareWho];
  if (scareWho === 'mell') im = IMG['ms' + (Math.floor(t * 15) % 23)];
  const [fx, fy, ff] = SCARE_FACE[scareWho] || [0.5, 0.2, 0.3];
  if (im) {
    // the face lunges at the camera and ends up filling the screen, centred slightly above the middle
    const faceH = 240 + ease * 660 + Math.sin(t * 38) * 25;
    const sh = faceH / ff, sw = im.width * sh / im.height;
    ctx.drawImage(im, W / 2 + sx - fx * sw, H * 0.44 + sy - fy * sh, sw, sh);
  }
  if (t < 0.06) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(0, 0, W, H); }
  if (Math.random() < 0.45) staticOverlay(0.3 + Math.random() * 0.3);
  ctx.fillStyle = `rgba(255,0,0,${0.08 + Math.random() * 0.12})`; ctx.fillRect(0, 0, W, H);
  if (t > 1.7) setState('dead');
}

// ---------------------------------------------------------------- screens
const MENU_ITEMS = () => {
  const items = [['Новая игра', 'new'], [`Продолжить   Ночь ${save.night}`, 'cont']];
  if (save.beaten) items.push(['6-я ночь', 'n6']);
  return items;
};
function drawMenu(dt) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  menu.faceT -= dt;
  if (menu.faceT <= 0) {
    menu.face = ri(1, 5); menu.faceT = rand(0.6, 2.6);
    if (Math.random() < 0.6) menu.glitch = 0.15;
  }
  menu.glitch = Math.max(0, menu.glitch - dt);
  const f = IMG['face' + menu.face];
  const jit = menu.glitch > 0 ? rand(-12, 12) : 0;
  ctx.globalAlpha = 0.85 + Math.random() * 0.1;
  if (f) ctx.drawImage(f, W - 872 - 40 + jit, H - 1035, 872, 1035);
  ctx.globalAlpha = 1;
  staticOverlay(menu.glitch > 0 ? 0.5 : 0.16);
  if (IMG.title) ctx.drawImage(IMG.title, 90, 60, 483 * 0.9, 600 * 0.9);

  const items = MENU_ITEMS();
  menu.hover = -1;
  items.forEach(([label], i) => {
    const y = 720 + i * 80;
    if (inRect(mouse, 90, y - 50, 700, 70)) menu.hover = i;
    text((menu.hover === i ? '>> ' : '   ') + label, 90, y, 50, '#fff');
  });
  text('ПРОБЕЛ — камеры   A / D — двери   Q / E — свет   F / R — вентиляция   W — шкатулка (CAM 10)   M — звук', 90, H - 30, 20, '#555');
  loop('ambient', true, 0.7);
  loop('static', true, 0.08);

  for (const p of clickQueue) {
    items.forEach(([, act], i) => {
      if (!inRect(p, 90, 720 + i * 80 - 50, 700, 70)) return;
      stopAllLoops();
      if (act === 'new') { save.night = 1; menu.next = 1; setState('paper'); }
      if (act === 'cont') { menu.next = save.night; setState('intro'); }
      if (act === 'n6') { menu.next = 6; setState('intro'); }
    });
  }
  clickQueue = [];
}

function drawPaper(dt) {
  stateT += dt;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const a = Math.min(1, stateT / 1.2, Math.max(0, (8 - stateT) / 1.2));
  ctx.globalAlpha = a;
  ctx.drawImage(IMG.gazeta, 0, 0, W, H);
  ctx.globalAlpha = 1;
  if (stateT > 8 || (clickQueue.length && stateT > 0.5)) setState('intro');
  clickQueue = [];
}

function drawIntro(dt) {
  stateT += dt;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  text('12:00 AM', W / 2, H / 2 - 90, 80, '#fff', 'center');
  text(`${menu.next}-я ночь`, W / 2, H / 2, 56, '#fff', 'center');
  const card = (STORY.cards[menu.next] || []);
  ctx.globalAlpha = clamp((stateT - 0.8) / 0.8, 0, 1);
  card.forEach((s, i) => text(s, W / 2, H / 2 + 110 + i * 46, 30, '#aaa', 'center'));
  ctx.globalAlpha = 1;
  if (stateT < 0.7) staticOverlay(1 - stateT / 0.7);
  if (stateT > 3 + card.length * 1.8 || (clickQueue.length && stateT > 0.5)) {
    newNight(menu.next);
    setState('night');
    play('blip', 0.3);
  }
  clickQueue = [];
}

function drawDead(dt) {
  stateT += dt;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  staticOverlay(Math.max(0.25, 1 - stateT));
  if (stateT > 1) {
    text('ИГРА ОКОНЧЕНА', W / 2, H / 2 - 20, 90, '#fff', 'center');
    text(STORY.death[scareWho] || '', W / 2, H / 2 + 60, 40, '#bbb', 'center');
    text('Нажми, чтобы вернуться в меню', W / 2, H / 2 + 160, 28, '#777', 'center');
  }
  loop('static', true, 0.25);
  if ((clickQueue.length && stateT > 1.2) || stateT > 12) { stopAllLoops(); setState('menu'); }
  clickQueue = [];
}

function drawWin(dt) {
  stateT += dt;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const k = clamp((stateT - 1) / 2, 0, 1); // 5 -> 6 roll
  ctx.save();
  ctx.beginPath(); ctx.rect(0, H / 2 - 90, W, 140); ctx.clip();
  text('5', W / 2 - 60, H / 2 + 30 - k * 140, 130, '#fff', 'center');
  text('6', W / 2 - 60, H / 2 + 170 - k * 140, 130, '#fff', 'center');
  ctx.restore();
  text('AM', W / 2 + 70, H / 2 + 30, 130, '#fff', 'center');
  if (stateT > 7.5 || (clickQueue.length && stateT > 3.5)) {
    const n = G.night;
    if (n <= 5) {
      // progress is saved before the minigame, so quitting during it loses nothing
      if (n < 5) save.night = n + 1; else { save.beaten = true; save.night = 5; }
      MG.start(n, () => {
        if (n < 5) { menu.next = n + 1; setState('intro'); } else { menu.ending = 5; setState('pay'); }
      });
      setState('mini');
    } else { menu.ending = n; setState('pay'); }
  }
  clickQueue = [];
}

function drawPay(dt) {
  stateT += dt;
  const e = STORY.endings[menu.ending] || STORY.endings[5];
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
  const h = 260 + e.lines.length * 62;
  const y0 = (H - h) / 2;
  ctx.globalAlpha = clamp(stateT / 1.2, 0, 1);
  ctx.fillStyle = '#e8e2cf'; ctx.fillRect(360, y0, 1200, h);
  text(e.title, 960, y0 + 80, 40, '#222', 'center');
  e.lines.forEach((s, i) => {
    const rows = wrap(s, 1080, 30);
    rows.forEach((r, j) => text(r, i === 0 ? 960 : 420, y0 + 150 + i * 62 + j * 34, i === 0 ? 36 : 30, '#222', i === 0 ? 'center' : 'left'));
  });
  text(e.footer, 960, y0 + h - 40, 34, '#a00', 'center');
  ctx.globalAlpha = 1;
  if ((clickQueue.length && stateT > 1.5) || stateT > 25) setState('menu');
  clickQueue = [];
}

function drawLoading() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  text('Five Nights at Homka', W / 2, H / 2 - 80, 64, '#fff', 'center');
  ctx.strokeStyle = '#fff'; ctx.strokeRect(W / 2 - 400, H / 2, 800, 30);
  ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 400, H / 2, 800 * loadP, 30);
  if (loadP >= 1) {
    text('Нажми, чтобы начать (лучше в наушниках)', W / 2, H / 2 + 110, 34, '#bbb', 'center');
    if (clickQueue.length) {
      clickQueue = [];
      if (Q.has('mg')) { MG.start(clamp(+Q.get('mg'), 1, 5), () => setState('menu')); setState('mini'); }
      else if (Q.has('night')) { menu.next = clamp(+Q.get('night'), 1, 6); newNight(menu.next); setState('night'); }
      else setState('menu');
      if (document.documentElement.requestFullscreen && !Q.has('nofs')) document.documentElement.requestFullscreen().catch(() => {});
    }
  }
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  switch (state) {
    case 'loading': drawLoading(); break;
    case 'menu': drawMenu(dt); break;
    case 'paper': drawPaper(dt); break;
    case 'intro': drawIntro(dt); break;
    case 'night': updateNight(dt); if (state === 'night') drawNight(); break;
    case 'scare': stateT += dt; drawScare(); break;
    case 'dead': drawDead(dt); break;
    case 'win': drawWin(dt); break;
    case 'pay': drawPay(dt); break;
    case 'mini': MG.frame(dt); break;
  }
  if (Q.has('debug') && G) {
    text(`homka:${G.homka.pos}${G.homka.inOffice ? '!' : ''} bro:${G.brother.pos} zov:${G.zov.pos} mell:${G.mell.mode}${G.mell.stage} box:${G.lyud.box.toFixed(0)} pwr:${G.power.toFixed(1)}`,
      20, 30, 22, '#0f0');
  }
  requestAnimationFrame(frame);
}
loadAll(p => { loadP = p; }).then(() => { buildLighting(); loadP = 1; });
requestAnimationFrame(frame);

// test hooks
window.__fnah = { get G() { return G; }, get state() { return state; }, scare, switchCam, toggleTablet, newNight, setState };
