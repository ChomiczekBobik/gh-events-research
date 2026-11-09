"""Voice the phone calls from fnah/story.js with Piper TTS (offline, Russian voices).

Usage: python tools/make_voice.py <voices_dir>
voices_dir must contain ru_RU-{dmitri,irina,denis}-medium.onnx(.json) from
https://huggingface.co/rhasspy/piper-voices/tree/main/ru/ru_RU
Writes fnah/assets/voice/<night>_<line>.mp3 and fnah/assets/voice/index.json (durations).
"""
import json
import os
import re
import subprocess
import sys
import wave

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "fnah", "assets", "voice")
VOICES = sys.argv[1]
PIPER = os.path.join(os.path.dirname(sys.executable), "piper")
os.makedirs(OUT, exist_ok=True)

story = json.loads(subprocess.check_output(
    ["node", "-e", "process.stdout.write(JSON.stringify(require(process.argv[1])))", os.path.join(ROOT, "fnah", "story.js")]))

NUM = {"0": "ноль", "3": "три", "5": "пять", "6": "шесть", "7": "семь", "8": "восемь", "9": "девять",
       "10": "десять", "11": "одиннадцать", "24": "двадцать четыре", "40": "сорок", "2": "два", "4": "четыре", "1": "один"}

# who -> (voice, length_scale, ffmpeg filter)
# light old-phone colour: gentle band-limit + slight saturation, then loudness-normalised so it stays clear
PHONE = "highpass=f=180,lowpass=f=5200,equalizer=f=1800:t=q:w=1.2:g=4,asoftclip=type=tanh"
LOUD = ",loudnorm=I=-13:TP=-1:LRA=7"
SPEAKERS = {
    "starshiy": ("dmitri", 1.0, PHONE + ",aecho=0.8:0.2:15:0.08"),
    # ghost: slowed, lower, long echo, through the same phone line
    "lyud": ("irina", 1.35, "asetrate=22050*0.86,aresample=22050,aecho=0.8:0.7:250|430:0.45|0.3,"
             "tremolo=f=5:d=0.25," + PHONE),
    # demonic Homka: much lower + doubled
    "homka": ("denis", 1.2, "asetrate=22050*0.72,aresample=22050,aecho=0.8:0.8:60|90:0.6|0.5,"
              "acrusher=bits=8:mix=0.25," + PHONE),
}


def speakable(s):
    s = s.replace("ZOVKA Starbucks", "Зовка Старбакс").replace("ZOVKA", "Зовка").replace("Starbucks", "Старбакс")
    s = s.replace("«", "").replace("»", "").replace("—", ",").replace("№", "номер ")
    s = re.sub(r"CAM (\d+)", lambda m: "камера " + NUM.get(m.group(1), m.group(1)), s)
    s = re.sub(r"\b(\d+)\b", lambda m: NUM.get(m.group(1), m.group(1)), s)
    return s


def dur(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
    return round(float(out), 2)


def sentences(s):
    """Split into sentences; very short ones ("Алло?") are merged into the next so subtitles don't flicker.
    Must stay identical to splitSentences() in game.js."""
    parts = [p for p in re.split(r"(?<=[.!?…])\s+", s.strip()) if p]
    out, buf = [], ""
    for p in parts:
        buf = (buf + " " + p).strip()
        if len(buf) >= 14:
            out.append(buf)
            buf = ""
    if buf:
        if out:
            out[-1] += " " + buf
        else:
            out.append(buf)
    return out


GAP = 0.3  # silence between sentences, seconds
# speed factor of each speaker's filter chain (asetrate changes duration)
RATE = {"starshiy": 1.0, "lyud": 0.86, "homka": 0.72}

index = {}
for night, lines in story["calls"].items():
    for i, line in enumerate(lines):
        if isinstance(line, str):
            line = {"t": line}
        if line.get("sfx"):
            continue
        who = line.get("who", "starshiy")
        voice, scale, flt = SPEAKERS[who]
        chunks = sentences(line.get("say", line["t"]))
        pcm, starts, sr = b"", [], 22050
        for k, ch in enumerate(chunks):
            raw = f"/tmp/_v_{night}_{i}_{k}.wav"
            subprocess.run([PIPER, "-m", os.path.join(VOICES, f"ru_RU-{voice}-medium.onnx"), "-f", raw,
                            "--length_scale", str(scale)],
                           input=speakable(ch).encode(), check=True, stderr=subprocess.DEVNULL)
            with wave.open(raw) as w:
                sr = w.getframerate()
                a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
            # trim Piper's leading/trailing silence so each start time is the real speech onset
            loud = np.nonzero(np.abs(a) > 400)[0]
            if len(loud):
                a = a[max(0, loud[0] - int(0.02 * sr)):loud[-1] + int(0.05 * sr)]
            starts.append(round(len(pcm) / 2 / sr / RATE[who], 2))
            pcm += a.tobytes() + b"\x00\x00" * int(GAP * sr)
        joined = f"/tmp/_v_{night}_{i}.wav"
        with wave.open(joined, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes(pcm)
        out = os.path.join(OUT, f"{night}_{i}.mp3")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", joined, "-af", flt + LOUD,
                        "-ac", "1", "-ar", "22050", "-b:a", "64k", out], check=True)
        index[f"{night}_{i}"] = {"d": dur(out), "s": starts}
        print(night, i, who, index[f"{night}_{i}"], chunks[0][:50])

with open(os.path.join(OUT, "index.js"), "w") as f:
    f.write("// generated by tools/make_voice.py — line durations in seconds\nconst VOICE = " + json.dumps(index) + ";\n")
