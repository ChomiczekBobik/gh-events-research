// Вся музыка и звуки генерируются через WebAudio — никаких файлов.
window.GameAudio = (() => {
  let ctx = null, master = null, musicBus = null, sfxBus = null, muted = false, started = false;

  function noiseBuffer(sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function init() {
    if (ctx) { ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    startMusic();
  }

  function startMusic() {
    if (started) return; started = true;
    const t = ctx.currentTime;

    // Низкий гул: расстроенные пилы через фильтр с медленным LFO
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(lp.frequency); lfo.start(t);
    const droneGain = ctx.createGain(); droneGain.gain.value = 0.0;
    droneGain.gain.linearRampToValueAtTime(0.22, t + 6);
    [55, 55.4, 82.4, 41.2].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i === 3 ? 'sine' : 'sawtooth'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = i === 3 ? 0.6 : 0.25;
      o.connect(g).connect(lp); o.start(t);
    });
    lp.connect(droneGain).connect(musicBus);

    // Ветер с пылью
    const wind = ctx.createBufferSource(); wind.buffer = noiseBuffer(4); wind.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.7;
    const wl = ctx.createOscillator(); wl.frequency.value = 0.11;
    const wlg = ctx.createGain(); wlg.gain.value = 300; wl.connect(wlg).connect(bp.frequency); wl.start(t);
    const wg = ctx.createGain(); wg.gain.value = 0.05;
    wind.connect(bp).connect(wg).connect(musicBus); wind.start(t);

    // Эхо для «музыкальной шкатулки»
    const delay = ctx.createDelay(2); delay.delayTime.value = 0.55;
    const fb = ctx.createGain(); fb.gain.value = 0.45;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 1800;
    delay.connect(fb).connect(dl).connect(delay);
    const bell = ctx.createGain(); bell.gain.value = 0.18;
    bell.connect(musicBus); bell.connect(delay); delay.connect(musicBus);

    // Ля-минор, с тритоном для тревоги
    const scale = [220, 246.9, 261.6, 311.1, 329.6, 392, 440, 523.3, 622.3];
    const loop = () => {
      const now = ctx.currentTime;
      const n = Math.random() < 0.3 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.2 ? 0.5 : 1);
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = ctx.createGain(); const st = now + k * 0.28;
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(0.5, st + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, st + 2.6);
        o.connect(g).connect(bell); o.start(st); o.stop(st + 2.7);
      }
      setTimeout(loop, 1800 + Math.random() * 4200);
    };
    setTimeout(loop, 3000);
  }

  function thump(at, freq = 90, vol = 1) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.8, at); o.frequency.exponentialRampToValueAtTime(freq * 0.6, at + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.2);
    o.connect(g).connect(sfxBus); o.start(at); o.stop(at + 0.25);
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.1);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(vol * 0.6, at); ng.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
    n.connect(f).connect(ng).connect(sfxBus); n.start(at);
  }

  return {
    init,
    knock() { if (!ctx) return; const t = ctx.currentTime; [0, 0.22, 0.44].forEach(d => thump(t + d, 85 + Math.random() * 20)); },
    slam() { if (!ctx) return; const t = ctx.currentTime; thump(t, 55, 1.4); thump(t + 0.05, 120, 0.6); },
    creak() {
      if (!ctx) return; const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(180, t); o.frequency.linearRampToValueAtTime(260, t + 0.5); o.frequency.linearRampToValueAtTime(140, t + 1.1);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 12;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.1); g.gain.linearRampToValueAtTime(0, t + 1.2);
      o.connect(f).connect(g).connect(sfxBus); o.start(t); o.stop(t + 1.3);
    },
    geiger(dose) {
      if (!ctx) return; const t = ctx.currentTime; const dur = 1.8;
      const rate = Math.min(140, 3 + dose * 16);
      let x = 0; const buf = noiseBuffer(0.01);
      while (x < dur) {
        x += -Math.log(1 - Math.random()) / rate;
        const s = ctx.createBufferSource(); s.buffer = buf;
        const g = ctx.createGain(); g.gain.value = 0.5;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2000;
        s.connect(hp).connect(g).connect(sfxBus); s.start(t + x);
      }
    },
    sting() {
      if (!ctx) return; const t = ctx.currentTime;
      [110, 116.5, 155.6].forEach(f => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.15, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
        o.connect(g).connect(sfxBus); o.start(t); o.stop(t + 2.6);
      });
    },
    blip() {
      if (!ctx) return; const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 660;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(g).connect(sfxBus); o.start(t); o.stop(t + 0.1);
    },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.8; return muted; },
  };
})();
