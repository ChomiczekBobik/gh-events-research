// Five Nights at Homka — pixel minigames after each night (FNaF 2/3/4 style).
// Rendered on a 320x180 canvas and scaled up without smoothing.
'use strict';

const MG = (() => {
  const LW = 320, LH = 180, S = 6; // low-res size and upscale factor (320*6 = 1920)
  const low = document.createElement('canvas');
  low.width = LW; low.height = LH;
  const g = low.getContext('2d');

  // ------------------------------------------------------------ pixel sprites
  const PAL = {
    h: '#6b4a2b', s: '#e8b894', K: '#141414', R: '#c8102e', p: '#202020', b: '#3a3a3a', M: '#a0605a',
    B: '#7fb7e6', w: '#eeeeee', g: '#8a8a8a', W: '#f2efe8', n: '#ff8fa0', Y: '#e0bb6a', r: '#b0202a',
    G: '#1f7a3a', c: '#6b3d1f', y: '#e8c040', o: '#e07a20', L: '#4aa0e0', e: '#3a8a2a',
  };
  function sprite(rows) {
    const w = Math.max(...rows.map(r => r.length));
    const c = document.createElement('canvas');
    c.width = w; c.height = rows.length;
    const x = c.getContext('2d');
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const col = PAL[r[i]]; if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); } } });
    return c;
  }
  const HOMKA_TOP = [
    '..hhhhhh..', '.hhhhhhhh.', '.hhssssss.', '.sKssssKs.', '.ssssssss.', '..ssMMss..', '...ssss...',
    '.RRKKRRKK.', 'RRKKRRKKRR', 'KKRRKKRRKK', 'sRKKRRKKRs', 'sKRRKKRRKs', '.pppppppp.',
  ];
  const BRO_TOP = [
    '..KKKKKK..', '.KKKKKKKK.', '.KssssssK.', '.sKssssKs.', '.ssssssss.', '..ssMMss..', '...ssss...',
    '.KKKKKKKK.', 'KKKKGGKKKK', 'KKKKGGKKKK', 'sKKKKKKKKs', 'sKKKKKKKKs', '.BBBBBBBB.',
  ];
  const SPR = {
    homka: [sprite([...HOMKA_TOP, '.ppp..ppp.', '.ppp..ppp.', '.bbb..bbb.']),
      sprite([...HOMKA_TOP, '..pp..pp..', '.pp....pp.', 'bbb....bbb'])],
    bro: [sprite([...BRO_TOP, '.BBB..BBB.', '.sss..sss.', '.www..www.']),
      sprite([...BRO_TOP, '..BB..BB..', '.ss....ss.', 'ww......ww'])],
    ham: [sprite(['..gg....gg..', '.gWWWWWWWWg.', 'gWWWWWWWWWWg', 'gWWKWWWWKWWg', 'gWWWWnnWWWWg', 'gWWWWWWWWWWg', '.gWWWWWWWWg.', '..gggggggg..', '..nn....nn..']),
      sprite(['..gg....gg..', '.gWWWWWWWWg.', 'gWWWWWWWWWWg', 'gWWKWWWWKWWg', 'gWWWWnnWWWWg', 'gWWWWWWWWWWg', '.gWWWWWWWWg.', '..gggggggg..', '...nn..nn...'])],
    lyud: sprite(['.YYYYYYYY.', 'YYYYYYYYYY', 'YYssssssYY', 'YsKssssKsY', 'YssssssssY', 'YYssMMssYY', '.Y.ssss.Y.',
      '.rrrKKrrr.', 'rrrrKKrrrr', 'srrrrrrrrs', 'srrrrrrrrs', '.rrrrrrrr.']),
    guard: sprite(['..LLLLLL..', '.LLLLLLLL.', '.KKKKKKKK.', '.ssssssss.', '.sKssssKs.', '..ssssss..', '.LLLyLLLL.',
      'LLLLLLLLLL', 'sLLLLLLLLs', '.pppppppp.', '.ppp..ppp.', '.bbb..bbb.']),
    bar: sprite(['cccccccc', 'cyRRRRyc', 'cyRRRRyc', 'cccccccc']),
    coffee: sprite(['.WWWW.', 'WWWWWW', '.WWWW.', '.WGGW.', '.GWWG.', '.WGGW.', '.cccc.', '.WWWW.']),
    milk: sprite(['.WW.', '.WW.', 'WWWW', 'WLLW', 'WLLW', 'WWWW', 'WWWW']),
    bread: sprite(['.oooooo.', 'oyyyyyyo', 'oyyyyyyo', '.oooooo.']),
    apple: sprite(['..e..', '.rRr.', 'RRRRR', 'RRRRR', '.RRR.']),
  };
  const ITEMS = ['bar', 'coffee', 'milk', 'bread', 'apple'];
  const PRICE = { bar: 4, coffee: 12, milk: 3, bread: 2, apple: 1 };

  function put(spr, x, y, scale = 2, flip = false) {
    g.save();
    if (flip) { g.translate(Math.round(x) + spr.width * scale, Math.round(y)); g.scale(-1, 1); g.drawImage(spr, 0, 0, spr.width * scale, spr.height * scale); }
    else g.drawImage(spr, Math.round(x), Math.round(y), spr.width * scale, spr.height * scale);
    g.restore();
  }
  function ptext(s, x, y, col = '#fff', align = 'left', size = 8) {
    g.font = `bold ${size}px "Courier New", monospace`;
    g.textAlign = align; g.textBaseline = 'top';
    g.fillStyle = '#000'; g.fillText(s, x + 1, y + 1);
    g.fillStyle = col; g.fillText(s, x, y);
  }
  const L = () => keys.has('ArrowLeft') || keys.has('KeyA');
  const R = () => keys.has('ArrowRight') || keys.has('KeyD');
  const U = () => keys.has('ArrowUp') || keys.has('KeyW');
  const D = () => keys.has('ArrowDown') || keys.has('KeyS');
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ------------------------------------------------------------ 1: Homka collects bars & coffee (platformer)
  const G1 = {
    title: 'СОБЕРИ 10 БАТОНЧИКОВ И КОФЕ',
    plats: [[0, 164, 320], [24, 134, 64], [128, 120, 64], [232, 134, 64], [70, 96, 52], [198, 96, 52], [124, 70, 72], [16, 62, 44], [260, 62, 44]],
    init(s) { Object.assign(s, { x: 150, y: 132, vx: 0, vy: 0, ground: true, flip: false, items: [], got: 0 }); while (s.items.length < 3) this.spawn(s); },
    spawn(s) {
      const p = this.plats[1 + Math.floor(Math.random() * (this.plats.length - 1))];
      const k = Math.random() < 0.5 ? 'bar' : 'coffee';
      s.items.push({ x: p[0] + 6 + Math.random() * (p[2] - 24), y: p[1] - (k === 'bar' ? 10 : 18), k });
    },
    key(s, code) {
      if (['Space', 'KeyW', 'ArrowUp'].includes(code) && s.ground) { s.vy = -205; s.ground = false; play('mg_jump', 0.5); }
    },
    update(s, dt) {
      s.vx = (R() - L()) * 85;
      if (s.vx) s.flip = s.vx < 0;
      const py = s.y + 32;
      s.vy += 470 * dt;
      s.x = Math.max(0, Math.min(LW - 20, s.x + s.vx * dt));
      s.y += s.vy * dt;
      s.ground = false;
      for (const [x, y, w] of this.plats) {
        if (s.vy >= 0 && py <= y + 1 && s.y + 32 >= y && s.x + 16 > x && s.x + 4 < x + w) { s.y = y - 32; s.vy = 0; s.ground = true; }
      }
      const me = { x: s.x + 2, y: s.y, w: 16, h: 32 };
      s.items = s.items.filter(it => {
        const box = { x: it.x, y: it.y, w: it.k === 'bar' ? 16 : 12, h: it.k === 'bar' ? 8 : 16 };
        if (hit(me, box)) { s.got++; play('mg_pick', 0.6); return false; }
        return true;
      });
      while (s.items.length < 3 && s.got + s.items.length < 10) this.spawn(s);
      if (s.got >= 10) return 'win';
    },
    draw(s) {
      g.fillStyle = '#0d0b14'; g.fillRect(0, 0, LW, LH);
      for (let x = 0; x < LW; x += 8) { g.fillStyle = (x / 8) % 2 ? '#e8e8e8' : '#151515'; g.fillRect(x, 30, 8, 6); g.fillStyle = (x / 8) % 2 ? '#151515' : '#e8e8e8'; g.fillRect(x, 36, 8, 6); }
      g.fillStyle = '#7a1018'; g.fillRect(0, 28, LW, 2); g.fillRect(0, 42, LW, 2);
      ptext('СКЛАД ZOVKA', 160, 12, '#c8a040', 'center');
      for (const [x, y, w] of this.plats) { g.fillStyle = '#5a3a1a'; g.fillRect(x, y, w, 3); g.fillStyle = '#2a2a2a'; g.fillRect(x, y + 3, w, 2); }
      for (const it of s.items) put(SPR[it.k], it.x, it.y + Math.sin(s.t * 4 + it.x) * 1.5);
      put(SPR.homka[s.ground && s.vx ? Math.floor(s.t * 8) % 2 : 0], s.x, s.y, 2, s.flip);
      ptext(`${s.got}/10`, 8, 6, '#fff');
    },
  };

  // ------------------------------------------------------------ 2: the twin catches Homka (top-down chase)
  const G2 = {
    title: 'ДОГОНИ БРАТА',
    walls: [[40, 46, 70, 10], [200, 46, 80, 10], [40, 124, 80, 10], [190, 124, 90, 10], [150, 80, 20, 30]],
    init(s) { Object.assign(s, { x: 20, y: 140, hx: 280, hy: 20, hdx: -1, hdy: 1, rt: 0, flip: false, hflip: true, caught: 0 }); },
    blocked(x, y) {
      if (x < 4 || y < 14 || x + 20 > LW - 4 || y + 32 > LH - 4) return true;
      const me = { x, y: y + 20, w: 20, h: 12 };
      return this.walls.some(([wx, wy, ww, wh]) => hit(me, { x: wx, y: wy, w: ww, h: wh }));
    },
    move(s, kx, ky, dx, dy) { // axis-separated so you slide along shelves
      if (!this.blocked(s[kx] + dx, s[ky])) s[kx] += dx;
      if (!this.blocked(s[kx], s[ky] + dy)) s[ky] += dy;
    },
    update(s, dt) {
      let dx = R() - L(), dy = D() - U();
      if (dx && dy) { dx *= 0.707; dy *= 0.707; }
      if (dx) s.flip = dx < 0;
      this.move(s, 'x', 'y', dx * 82 * dt, dy * 82 * dt);
      s.moving = dx || dy;
      // Homka flees: every 0.25 s pick the free direction that keeps him furthest away
      s.rt -= dt;
      if (s.rt <= 0) {
        s.rt = 0.25;
        let best = null;
        for (let a = 0; a < 8; a++) {
          const ax = Math.cos(a * Math.PI / 4), ay = Math.sin(a * Math.PI / 4);
          const nx = s.hx + ax * 18, ny = s.hy + ay * 18;
          if (this.blocked(nx, ny)) continue;
          const sc = Math.hypot(nx - s.x, ny - s.y) + rnd(0, 14);
          if (!best || sc > best.sc) best = { sc, ax, ay };
        }
        if (best) { s.hdx = best.ax; s.hdy = best.ay; }
      }
      const sp = 62 * dt;
      this.move(s, 'hx', 'hy', s.hdx * sp, s.hdy * sp);
      if (s.hdx) s.hflip = s.hdx < 0;
      if (Math.hypot(s.hx - s.x, s.hy - s.y) < 14) { play('mg_win', 0.6); return 'win'; }
    },
    draw(s) {
      for (let y = 0; y < LH; y += 12) for (let x = 0; x < LW; x += 12) { g.fillStyle = ((x + y) / 12) % 2 ? '#1c1c1c' : '#2c2c2c'; g.fillRect(x, y, 12, 12); }
      g.strokeStyle = '#5a1018'; g.lineWidth = 4; g.strokeRect(2, 12, LW - 4, LH - 14);
      for (const [x, y, w, h] of this.walls) {
        g.fillStyle = '#5a3a1a'; g.fillRect(x, y, w, h);
        for (let i = x + 2; i < x + w - 3; i += 6) { g.fillStyle = ['#c8102e', '#e8c040', '#eeeeee', '#1f7a3a'][(i / 6 | 0) % 4]; g.fillRect(i, y + 2, 4, Math.max(2, h - 4)); }
      }
      put(SPR.homka[Math.floor(s.t * 8) % 2], s.hx, s.hy, 2, s.hflip);
      put(SPR.bro[s.moving ? Math.floor(s.t * 8) % 2 : 0], s.x, s.y, 2, s.flip);
    },
  };

  // ------------------------------------------------------------ 3: Zovyanchik runs the wheel to power the store
  const G3 = {
    title: 'ВЫРАБОТАЙ ЭЛЕКТРИЧЕСТВО: ЖМИ ← → ПО ОЧЕРЕДИ',
    init(s) { Object.assign(s, { speed: 0, ang: 0, energy: 0, last: '' }); },
    key(s, code) {
      const side = (code === 'ArrowLeft' || code === 'KeyA') ? 'L' : (code === 'ArrowRight' || code === 'KeyD') ? 'R' : '';
      if (!side) return;
      if (side !== s.last) { s.speed = Math.min(10, s.speed + 1.1); s.last = side; }
      else s.speed = Math.max(0, s.speed - 0.6); // mashing one key doesn't work
    },
    update(s, dt) {
      s.speed = Math.max(0, s.speed - 1.6 * dt);
      s.ang += s.speed * dt * 1.2;
      if (s.speed > 0.5) s.energy += s.speed * 1.7 * dt;
      else s.energy = Math.max(0, s.energy - 2 * dt);
      if (s.energy >= 100) { s.energy = 100; play('mg_win', 0.6); return 'win'; }
    },
    draw(s) {
      g.fillStyle = '#0a0a10'; g.fillRect(0, 0, LW, LH);
      // the store dark/light depending on energy
      const lit = Math.floor(s.energy / 10);
      for (let i = 0; i < 10; i++) {
        const on = i < lit;
        g.fillStyle = on ? '#ffe680' : '#333'; g.fillRect(170 + i * 14, 24, 8, 8);
        if (on) { g.fillStyle = 'rgba(255,230,128,0.15)'; g.fillRect(166 + i * 14, 32, 16, 40); }
        g.fillStyle = '#555'; g.fillRect(173 + i * 14, 18, 2, 6);
      }
      g.fillStyle = '#222'; g.fillRect(170, 76, 136, 60);
      ptext('ZOVKA', 238, 98, lit >= 10 ? '#ffe680' : '#444', 'center', 12);
      // wire
      g.fillStyle = '#c8a040'; g.fillRect(136, 100, 34, 2);
      // wheel
      const cx = 90, cy = 98, r = 50;
      g.strokeStyle = '#9a9a9a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 1;
      for (let i = 0; i < 16; i++) {
        const a = s.ang + i * Math.PI / 8;
        g.strokeStyle = '#666'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke();
      }
      g.fillStyle = '#444'; g.fillRect(cx - 3, cy - 3, 6, 6); g.fillRect(cx - 2, cy, 4, 70);
      put(SPR.ham[s.speed > 0.5 ? Math.floor(s.ang * 3) % 2 : 0], cx - 12, cy + r - 20, 2);
      // battery
      g.strokeStyle = '#fff'; g.strokeRect(170, 150, 120, 14); g.fillStyle = '#fff'; g.fillRect(290, 154, 4, 6);
      g.fillStyle = s.energy < 30 ? '#c8102e' : s.energy < 70 ? '#e8c040' : '#3ac84a';
      g.fillRect(172, 152, 116 * s.energy / 100, 10);
      ptext(`${Math.floor(s.energy)}%`, 230, 138, '#fff', 'center');
    },
  };

  // ------------------------------------------------------------ 4: Lyudmila scans groceries at till #5
  const G4 = {
    title: 'ПРОБЕЙ 12 ТОВАРОВ: ПРОБЕЛ, КОГДА ТОВАР НА СКАНЕРЕ',
    zone: [84, 108],
    init(s) { Object.assign(s, { items: [], next: 0.5, scanned: 0, total: 0, missed: 0, flash: 0, err: 0 }); },
    key(s, code) {
      if (code !== 'Space' && code !== 'Enter') return;
      const it = s.items.find(i => !i.done && i.x + 8 >= this.zone[0] && i.x + 8 <= this.zone[1]);
      if (it) { it.done = true; s.scanned++; s.total += PRICE[it.k]; s.flash = 0.15; play('mg_scan', 0.6); }
      else { s.err = 0.3; play('mg_err', 0.4); }
    },
    update(s, dt) {
      const v = 42 + s.scanned * 3;
      s.next -= dt;
      if (s.next <= 0) { s.items.push({ x: LW + 4, k: ITEMS[Math.floor(Math.random() * ITEMS.length)], done: false }); s.next = rnd(1.3, 2.1) - s.scanned * 0.04; }
      for (const it of s.items) it.x -= v * dt;
      s.items = s.items.filter(it => {
        if (it.x < 40) { if (!it.done) s.missed++; return false; }
        return true;
      });
      s.flash = Math.max(0, s.flash - dt); s.err = Math.max(0, s.err - dt);
      if (s.scanned >= 12) { play('mg_win', 0.6); return 'win'; }
    },
    draw(s) {
      g.fillStyle = '#121018'; g.fillRect(0, 0, LW, LH);
      for (let x = 0; x < LW; x += 8) { g.fillStyle = (x / 8) % 2 ? '#e8e8e8' : '#151515'; g.fillRect(x, 50, 8, 5); g.fillStyle = (x / 8) % 2 ? '#151515' : '#e8e8e8'; g.fillRect(x, 55, 8, 5); }
      g.fillStyle = '#e8c040'; g.fillRect(10, 8, 22, 18); ptext('5', 21, 11, '#141414', 'center', 12);
      // Lyudmila behind the counter, ghostly flicker
      g.globalAlpha = 0.85 + Math.sin(s.t * 13) * 0.1;
      put(SPR.lyud, 20, 76, 3);
      g.globalAlpha = 1;
      // counter + belt
      g.fillStyle = '#3a3a3a'; g.fillRect(0, 128, LW, 52);
      g.fillStyle = '#181818'; g.fillRect(60, 120, LW - 60, 10);
      for (let x = 60 - (s.t * (42 + s.scanned * 3)) % 10; x < LW; x += 10) { g.fillStyle = '#2a2a2a'; g.fillRect(x, 121, 5, 8); }
      // scanner
      g.fillStyle = s.err > 0 ? '#ff2020' : '#a01010'; g.fillRect(this.zone[0], 110, this.zone[1] - this.zone[0], 2);
      g.fillStyle = s.flash > 0 ? 'rgba(255,40,40,0.6)' : 'rgba(255,40,40,0.18)'; g.fillRect(this.zone[0], 112, this.zone[1] - this.zone[0], 8);
      for (const it of s.items) {
        const spr = SPR[it.k];
        put(spr, it.x, 120 - spr.height * 2);
        if (it.done) ptext('✓', it.x + 4, 120 - spr.height * 2 - 10, '#3ac84a');
      }
      // till display
      g.fillStyle = '#000'; g.fillRect(200, 6, 112, 30); g.strokeStyle = '#3ac84a'; g.strokeRect(200, 6, 112, 30);
      ptext(`ПРОБИТО ${s.scanned}/12`, 206, 10, '#3ac84a');
      ptext(`ИТОГО ${s.total} zł`, 206, 22, '#3ac84a');
    },
  };

  // ------------------------------------------------------------ 5: the end — real scare faces lie on the floor, music box plays
  const FACES = [['homka', 'homka_scare'], ['brother', 'brother'], ['lyud', 'lyud_face'], ['zov', 'zov'], ['mell', 'ms0']];
  let faceCrops = null;
  function buildFaces() {
    faceCrops = FACES.map(([who, key]) => {
      const im = IMG[key];
      const [fx, fy, ff] = SCARE_FACE[who];
      const size = Math.min(im.width, im.height, ff * im.height * 1.45);
      const c = document.createElement('canvas');
      c.width = c.height = 220;
      const x = c.getContext('2d');
      x.drawImage(im, fx * im.width - size / 2, Math.max(0, fy * im.height - size / 2), size, size, 0, 0, 220, 220);
      return c;
    });
  }
  const G5 = {
    title: '',
    init(s) { Object.assign(s, { lines: 0 }); if (!faceCrops) buildFaces(); loop('mg_drone', false); loop('mg_ending', true, 0.8); },
    update(s) {
      for (const p of clickQueue) if (s.t > 12) s.leave = true;
      clickQueue = [];
      if (s.leave || s.t > 40) return 'win';
    },
    draw(s) {
      g.fillStyle = '#050407'; g.fillRect(0, 0, LW, LH);
      // back wall with checker stripe, floor
      for (let x = 0; x < LW; x += 8) { g.fillStyle = (x / 8) % 2 ? '#3a3a3a' : '#0c0c0c'; g.fillRect(x, 80, 8, 5); g.fillStyle = (x / 8) % 2 ? '#0c0c0c' : '#3a3a3a'; g.fillRect(x, 85, 8, 5); }
      g.fillStyle = '#100c10'; g.fillRect(0, 100, LW, 80);
      for (let y = 100; y < LH; y += 10) for (let x = (y / 10) % 2 ? 0 : 10; x < LW; x += 20) { g.fillStyle = '#18141a'; g.fillRect(x, y, 10, 10); }
      // hanging lamp + cone
      g.fillStyle = '#444'; g.fillRect(159, 0, 2, 22); g.fillStyle = '#c8a040'; g.fillRect(152, 22, 16, 4);
      const flick = Math.random() < 0.03 ? 0.4 : 1;
      g.fillStyle = `rgba(255,220,140,${0.08 * flick})`;
      g.beginPath(); g.moveTo(152, 26); g.lineTo(168, 26); g.lineTo(290, 170); g.lineTo(30, 170); g.closePath(); g.fill();
      put(SPR.guard, 268, 70, 2);
      if (s.t > 6) ptext('ОНИ ВСЕ ЗДЕСЬ.', 160, 40, `rgba(255,255,255,${Math.min(1, (s.t - 6) / 3)})`, 'center');
      if (s.t > 16) ptext('СМЕНА ОКОНЧЕНА.', 160, 52, `rgba(200,40,40,${Math.min(1, (s.t - 16) / 3)})`, 'center');
    },
    overlay(s) { // non-pixel faces drawn on the full-res canvas
      const pos = [[420, 830, -0.35], [700, 900, 0.25], [960, 850, -0.1], [1220, 905, 0.4], [1480, 840, -0.25]];
      faceCrops.forEach((c, i) => {
        const [x, y, a] = pos[i];
        ctx.save();
        ctx.translate(x, y); ctx.rotate(a); ctx.scale(1, 0.8);
        ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 18;
        ctx.globalAlpha = Math.min(1, s.t / 3) * (0.82 + Math.random() * 0.04);
        ctx.drawImage(c, -110, -110, 220, 220);
        ctx.restore();
      });
      const v = ctx.createRadialGradient(960, 760, 200, 960, 760, 1100);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    },
  };

  const GAMES = { 1: G1, 2: G2, 3: G3, 4: G4, 5: G5 };
  let cur = null, S_ = null, onDone = null;

  function start(n, done) {
    cur = GAMES[n];
    onDone = done;
    S_ = { n, t: 0, phase: 'intro', pt: 0 };
    cur.init(S_);
    stopAllLoops();
    if (n !== 5) loop('mg_drone', true, 0.5);
  }
  function finish() {
    if (!S_ || S_.phase === 'out') return;
    S_.phase = 'out'; S_.pt = 0;
    play('static', 0.6);
  }
  function key(code) {
    if (!S_ || S_.phase !== 'play') return;
    if (cur.key) cur.key(S_, code);
  }
  function frame(dt) {
    const s = S_;
    s.t += dt; s.pt += dt;
    if (s.phase === 'intro' && s.pt > (s.n === 5 ? 0.5 : 2.2)) { s.phase = 'play'; s.pt = 0; }
    if (s.phase === 'play' && cur.update(s, dt) === 'win') { s.phase = 'won'; s.pt = 0; }
    if (s.phase === 'won' && s.pt > (s.n === 5 ? 0.1 : 2.2)) finish();
    if (s.n !== 5) clickQueue = [];
    cur.draw(s);
    if (s.phase === 'intro' && cur.title) {
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(0, 70, LW, 34);
      if (Math.floor(s.pt * 4) % 2 || s.pt > 1) ptext(cur.title, 160, 82, '#fff', 'center');
    }
    if (s.phase === 'won' && s.n !== 5) ptext('ГОТОВО', 160, 82, '#3ac84a', 'center', 12);
    // upscale without smoothing, then CRT-ish lines
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(low, 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    if (cur.overlay) cur.overlay(s);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < H; y += S) ctx.fillRect(0, y, W, 2);
    if (s.phase === 'intro' && s.pt < 0.35) staticOverlay(1 - s.pt / 0.35);
    if (Math.random() < 0.01) staticOverlay(0.25); // FNaF 2 minigame glitch
    if (s.phase === 'out') {
      staticOverlay(1);
      if (s.pt > 0.6) { loop('mg_drone', false); loop('mg_ending', false); S_ = null; const d = onDone; onDone = null; d && d(); }
    }
  }
  // switch to another minigame but keep where the current one was going to return to
  function jump(n) { const d = onDone; loop('mg_ending', false); start(n, d); }
  return { start, jump, frame, key, finish, get active() { return !!S_; }, get s() { return S_; } };
})();
