"""Synthesize the game's sound effects (no external samples needed).

Usage: python tools/make_sounds.py <ambient.wav> [mell_voice.wav]
Writes mp3 files to fnah/assets/sfx/.
"""
import os
import subprocess
import sys
import wave

import numpy as np

SR = 44100
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "fnah", "assets", "sfx"))
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def t(d):
    return np.arange(int(SR * d)) / SR


def env(n, a=0.005, decay=5.0):
    x = np.arange(n) / SR
    e = np.exp(-x * decay)
    ai = int(a * SR)
    if ai:
        e[:ai] *= np.linspace(0, 1, ai)
    return e


def lowpass(x, cutoff):
    # one-pole low-pass, cheap and good enough for noise shaping
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def bandnoise(n, lo, hi):
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(spec, n)
    return y / (np.abs(y).max() + 1e-9)


def norm(x, peak=0.9):
    return x / (np.abs(x).max() + 1e-9) * peak


def write(name, x, br="128k", fmt="mp3", sr=SR):
    x = np.clip(x, -1, 1)
    if sr != SR:
        x = np.interp(np.arange(0, len(x), SR / sr), np.arange(len(x)), x)
    tmp = f"/tmp/_snd_{name}.wav"
    with wave.open(tmp if fmt == "mp3" else os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
    if fmt == "mp3":
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-b:a", br, os.path.join(OUT, name + ".mp3")], check=True)


def mix(n, *parts):
    y = np.zeros(n)
    for off, p in parts:
        o = int(off * SR)
        m = min(len(p), n - o)
        y[o:o + m] += p[:m]
    return y


# door slam: thump + metal clang
d = 0.9
x = t(d)
thump = np.sin(2 * np.pi * (70 - 30 * x) * x) * env(len(x), 0.002, 9)
clang = sum(np.sin(2 * np.pi * f * x) * env(len(x), 0.001, k) for f, k in [(310, 7), (547, 9), (893, 11), (1271, 14), (1720, 18)])
write("door", norm(thump * 1.4 + clang * 0.25 + bandnoise(len(x), 200, 5000) * env(len(x), 0.001, 30) * 0.6))

# light buzz loop (exactly 1s; wav so the loop has no mp3 padding gap)
x = t(1.0)
hum = sum(np.sign(np.sin(2 * np.pi * 120 * k * x)) / k ** 1.5 for k in range(1, 6))
crackle = (rng.random(len(x)) > 0.9992) * rng.standard_normal(len(x)) * 3
write("light", norm(hum * 0.5 + bandnoise(len(x), 2000, 8000) * 0.15 + crackle, 0.5), fmt="wav", sr=22050)

# office fan loop (FNaF 1 desk fan): circular FFT noise + blade whoosh + motor hum, 4 s, seamless
n = 4 * SR
x = t(4.0)
air = bandnoise(n, 60, 1800)
air = air * 0.7 + bandnoise(n, 120, 500) * 0.6
blades = 0.75 + 0.25 * np.sin(2 * np.pi * 14.0 * x) ** 2  # integer cycles per loop -> seamless
motor = 0.18 * np.sin(2 * np.pi * 50 * x) + 0.08 * np.sin(2 * np.pi * 100 * x) + 0.03 * np.sin(2 * np.pi * 150 * x)
rattle = bandnoise(n, 900, 3000) * 0.06 * (np.sin(2 * np.pi * 28 * x) > 0.6)
write("fan", norm(air * blades + motor + rattle, 0.7), fmt="wav", sr=22050)

# old phone ringing (two rings)
d = 4.2
x = t(d)
gate = ((x % 2.0) < 1.1).astype(float)
bell = (np.sin(2 * np.pi * 440 * x) + np.sin(2 * np.pi * 480 * x)) * (np.sin(2 * np.pi * 20 * x) > 0)
write("ring", norm(np.tanh(bell * 1.5) * gate * np.clip((d - x) * 4, 0, 1), 0.5))

# call hang-up / line static
x = t(1.2)
write("hangup", norm(bandnoise(len(x), 300, 3400) * env(len(x), 0.002, 2.5) * 0.6 + np.sin(2 * np.pi * 425 * x) * (x > 0.4) * env(len(x), 0.3, 1.5) * 0.4, 0.6))

# camera switch blip
x = t(0.14)
write("blip", norm(np.sign(np.sin(2 * np.pi * 1350 * x)) * env(len(x), 0.001, 30) * 0.5 + bandnoise(len(x), 1000, 9000) * env(len(x), 0.001, 60)), "96k")

# tablet up / down: filtered swoosh + plastic click
for name, rev in [("tablet_up", False), ("tablet_down", True)]:
    n = int(0.4 * SR)
    sw = bandnoise(n, 300, 4000) * np.sin(np.linspace(0, np.pi, n)) ** 2
    clk = np.zeros(n)
    clk[-2000:] = bandnoise(2000, 1500, 7000) * env(2000, 0.0005, 80)
    y = sw * 0.4 + clk
    write(name, norm(y[::-1] if rev else y, 0.6), "96k")

# camera static loop
n = 2 * SR
st = bandnoise(n, 800, 9000) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 3.1 * t(2))))
write("static", norm(st, 0.35), fmt="wav", sr=22050)

# jumpscare scream: detuned wobbling saws, distorted
d = 1.7
x = t(d)
f0 = 520 + 260 * np.sin(2 * np.pi * 11 * x) + 300 * x
ph = np.cumsum(f0) / SR
saw = sum(((ph * k * r) % 1.0) * 2 - 1 for k, r in [(1, 1.0), (1, 1.013), (2, 0.991), (3, 1.007)])
sc = np.tanh((saw * 0.6 + bandnoise(len(x), 500, 9000) * 1.2) * 4)
sc *= np.minimum(1, x * 40) * np.clip((d - x) * 3, 0, 1)
write("scream", norm(sc, 0.95))

# window-scare sting: short dissonant stab
x = t(0.9)
stab = sum(np.sign(np.sin(2 * np.pi * f * x)) for f in (233, 247, 330, 349))
write("sting", norm(np.tanh(stab * 0.8) * env(len(x), 0.002, 4) + bandnoise(len(x), 300, 6000) * env(len(x), 0.001, 12) * 0.5, 0.85))

# Mellstroy scare: his voice (if provided) on top of the scream
if len(sys.argv) > 2 and os.path.exists(sys.argv[2]):
    with wave.open(sys.argv[2]) as w:
        v = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
    v = norm(v, 1.0)
    n = max(len(v), len(sc))
    write("mell_scare", norm(mix(n, (0, np.tanh(v * 2.5)), (0.15, sc * 0.55)), 0.95))
    write("mell_voice", norm(v, 0.9))

# 6 AM: bell strikes + cheering
d = 7.0
x = t(d)
bells = np.zeros(len(x))
for i in range(6):
    o = int((0.2 + i * 0.75) * SR)
    bt = t(3.0)
    b = sum(np.sin(2 * np.pi * f * bt) * a for f, a in [(523, 1), (1046, 0.5), (1376, 0.3), (2093, 0.15)]) * env(len(bt), 0.003, 1.6)
    m = min(len(b), len(x) - o)
    bells[o:o + m] += b[:m]
cheer = bandnoise(len(x), 600, 4000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 7 * x)))
cheer *= np.clip((x - 4.5) * 2, 0, 1) * np.clip((d - x) * 0.8, 0, 1)
write("chimes", norm(bells * 0.5 + cheer * 0.35))

# music box: "Pop Goes the Weasel" (public domain), music-box timbre
NOTE = {"C4": 261.63, "D4": 293.66, "F4": 349.23, "G4": 392.0, "A4": 440.0, "Bb4": 466.16, "C5": 523.25, "D5": 587.33}
mel = [("C4", 1), ("F4", 2), ("F4", 1), ("G4", 2), ("G4", 1), ("A4", 1), ("C5", 1), ("A4", 1), ("F4", 2),
       ("C4", 1), ("F4", 2), ("F4", 1), ("G4", 2), ("G4", 1), ("A4", 3), ("F4", 2),
       ("C4", 1), ("F4", 2), ("F4", 1), ("G4", 2), ("G4", 1), ("A4", 1), ("C5", 1), ("A4", 1), ("F4", 2),
       ("D5", 3), ("G4", 2), ("Bb4", 1), ("A4", 3), ("F4", 3)]
beat = 0.19
total = sum(b for _, b in mel) * beat + 1.0
y = np.zeros(int(total * SR))
pos = 0.0
for nt, b in mel:
    f = NOTE[nt]
    nx = t(1.2)
    tone = (np.sin(2 * np.pi * f * nx) + 0.35 * np.sin(2 * np.pi * f * 2 * nx) + 0.12 * np.sin(2 * np.pi * f * 4.07 * nx)) * env(len(nx), 0.002, 4.5)
    o = int(pos * SR)
    m = min(len(tone), len(y) - o)
    y[o:o + m] += tone[:m]
    pos += b * beat
write("musicbox", norm(y, 0.6))

# knock (Mellstroy banging the door)
n = int(1.3 * SR)
k = np.zeros(n)
for o in [0.0, 0.33, 0.66]:
    kn = np.sin(2 * np.pi * 85 * t(0.35)) * env(int(0.35 * SR), 0.001, 14) + bandnoise(int(0.35 * SR), 100, 2500) * env(int(0.35 * SR), 0.001, 25) * 0.6
    k = mix(n, (0, k), (o, kn))
write("knock", norm(k))

# footsteps
n = int(2.2 * SR)
fs = np.zeros(n)
for i in range(4):
    st_ = bandnoise(int(0.25 * SR), 60, 900) * env(int(0.25 * SR), 0.003, 18)
    fs = mix(n, (0, fs), (0.1 + i * 0.5, st_ * (0.6 + 0.1 * i)))
write("steps", norm(fs, 0.7))

# vent crawl: metallic scraping
x = t(1.8)
scr = bandnoise(len(x), 900, 5000) * (0.4 + 0.6 * (np.sin(2 * np.pi * 2.3 * x) > 0)) + 0.3 * np.sin(2 * np.pi * (700 + 90 * np.sin(2 * np.pi * 3 * x)) * x)
write("vent", norm(scr * np.sin(np.linspace(0, np.pi, len(x))), 0.6))

# shutter (vent door) mechanical ratchet
n = int(0.55 * SR)
sh = np.zeros(n)
for i in range(9):
    sh = mix(n, (0, sh), (i * 0.05, bandnoise(1500, 1200, 8000) * env(1500, 0.0005, 70)))
sh += np.sin(2 * np.pi * 95 * t(0.55)) * 0.3 * env(n, 0.01, 4)
write("shutter", norm(sh, 0.7), "96k")

# music box winding click loop
n = int(0.5 * SR)
wd = np.zeros(n)
for i in range(5):
    wd = mix(n, (0, wd), (i * 0.1, bandnoise(900, 2500, 9000) * env(900, 0.0003, 90)))
write("wind", norm(wd, 0.6), "96k")

# power out: descending whine + big clunk
x = t(2.4)
wh = np.sin(2 * np.pi * np.cumsum(900 * np.exp(-x * 1.6) + 40) / SR) * np.clip(1.6 - x, 0, 1)
cl = np.zeros(len(x))
cl[int(1.5 * SR):int(1.5 * SR) + int(0.8 * SR)] = np.sin(2 * np.pi * 50 * t(0.8)) * env(int(0.8 * SR), 0.001, 6) + bandnoise(int(0.8 * SR), 80, 3000) * env(int(0.8 * SR), 0.001, 20)
write("powerout", norm(wh * 0.4 + cl))

# ambient from the provided wav (re-encode only)
if len(sys.argv) > 1:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", sys.argv[1], "-ac", "2", "-b:a", "112k", os.path.join(OUT, "ambient.mp3")], check=True)
print("sfx ->", OUT)
